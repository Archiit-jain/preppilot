/**
 * The AI proxy.
 *
 * PRD §15 requires the Gemini key be server-side only. This function is the only
 * place it exists: the app calls here, this calls Gemini. The key is read from a
 * Supabase secret and never returned to the client.
 *
 * Deploy with:
 *   supabase secrets set GEMINI_API_KEY=...
 *   supabase functions deploy ask-gemini
 *
 * Deploy it *with* JWT verification — the default. See `callerId` below: the
 * per-account rate limit is only meaningful because the platform has already
 * rejected anything without a valid token.
 *
 * Until it is deployed the app disables the assistant rather than sending
 * questions into nothing.
 */

// Supabase Edge Functions run on Deno; these globals are provided by that runtime.
declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (
    options: { hostname?: string; port?: number },
    handler: (request: Request) => Promise<Response>,
  ) => unknown;
};

/**
 * Pinned deliberately rather than tracking `gemini-flash-latest`.
 *
 * An alias that moves under a deployed function changes its answers, its cost
 * and its latency without anything in this repository changing. Google retires
 * models — `gemini-2.5-flash`, pinned here previously, now refuses new callers
 * outright — so this needs revisiting, but as an edit someone reviews.
 */
const MODEL = 'gemini-3.6-flash';

/**
 * Answer, in order, when the main model cannot.
 *
 * On Google's free tier the main model allows only a few dozen requests a day
 * for the whole project, and even a paid project sees it refuse with 503 when
 * Google is overloaded. Each Flash-Lite has its own, far larger, free allowance
 * and costs a fraction as much, so a student gets a slightly plainer answer
 * instead of none. Two of them means one running out does not end the day.
 */
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;

const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** Upstream statuses that mean "not now" rather than "not this request". */
const BUSY_STATUSES = new Set([429, 503]);

/** Pause before retrying the main model. Read per call so tests can set it to 0. */
function retryDelayMs(): number {
  const configured = Number(Deno.env.get('AI_RETRY_DELAY_MS'));
  return Number.isFinite(configured) && configured >= 0 ? configured : 1200;
}

/**
 * A cap on reasoning, not a ban.
 *
 * The model thinks before answering, and left uncapped it spent roughly nine
 * times as many tokens thinking as answering on a two-sentence question about
 * Ohm's law. The project owner pays for those tokens and the student waits for
 * them. This leaves room to reason about a genuinely hard question while
 * refusing to deliberate over a simple one.
 */
const THINKING_BUDGET = 512;

/**
 * Per-account request budget.
 *
 * The proxy spends the project owner's Gemini quota, so an unlimited endpoint is
 * a financial liability as much as a security one (D29). This is a coarse
 * in-memory limit — it resets when the instance recycles and is not shared
 * between instances — so it bounds runaway use rather than enforcing a quota. A
 * durable limit belongs in the database when usage justifies it.
 */
const RATE_LIMIT = { requests: 20, windowMs: 60 * 60 * 1000 };
const recentRequests = new Map<string, number[]>();

/**
 * A ceiling across every anonymous caller together.
 *
 * Anonymous access exists so the browser demo can answer without an account
 * (D54). It is off unless `ALLOW_ANONYMOUS_AI` is exactly "true", because the
 * function's URL is public wherever the client runs — "the demo is on localhost"
 * protects the page, not this endpoint. Anyone who finds the URL can call it, so
 * the per-account limit is replaced by one shared budget rather than dropped.
 */
const ANONYMOUS_LIMIT = { requests: 60, windowMs: 60 * 60 * 1000 };
const ANONYMOUS_ID = 'anonymous';

/**
 * True while this file is being run as a local proxy rather than deployed.
 *
 * The local server binds to loopback, so nothing off this machine can reach it
 * and there is no account to attribute a request to anyway. Deployed, the flag
 * stays false and anonymous access remains something that must be switched on
 * deliberately.
 */
let servingLocally = false;

function anonymousAllowed(): boolean {
  return servingLocally || Deno.env.get('ALLOW_ANONYMOUS_AI') === 'true';
}

function withinRateLimit(userId: string, now: number): boolean {
  const limit = userId === ANONYMOUS_ID ? ANONYMOUS_LIMIT : RATE_LIMIT;
  const cutoff = now - limit.windowMs;
  const recent = (recentRequests.get(userId) ?? []).filter((at) => at > cutoff);

  if (recent.length >= limit.requests) return false;

  recent.push(now);
  recentRequests.set(userId, recent);
  return true;
}

/**
 * The account a request belongs to, taken from the bearer token's `sub` claim.
 *
 * Read from the token rather than a header: a header is whatever the caller
 * types, so a limit keyed on one is bypassed by changing it — and a single
 * fallback value would put every student in the world into one shared bucket,
 * where twenty questions an hour is a global limit rather than a personal one.
 *
 * The claim is trusted because Supabase verifies the JWT before this function
 * runs. Deploying with `--no-verify-jwt` removes that guarantee and, with it,
 * the meaning of the limit.
 */
function callerId(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const payload = token.split('.')[1];
  if (payload === undefined || payload.length === 0) return null;

  try {
    // base64url, and atob wants padded base64.
    const normalised = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalised.padEnd(normalised.length + ((4 - (normalised.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * The system instruction.
 *
 * PRD §14 forbids the assistant changing the tracker on its own. The client
 * enforces that structurally — a reply can only ever *propose*, and the proposal
 * grammar has no verb for deleting or completing — but stating it here too means
 * the model is not fighting the format.
 */
const SYSTEM_INSTRUCTION = `You are PrepPilot's study assistant. Help students understand topics they are studying.

Rules:
- Answer clearly and briefly. Students are revising, not reading an essay.
- Never claim to have changed anything in their tracker. You cannot.
- If you want to suggest additions to their syllabus, end your reply with a fenced block:

\`\`\`preppilot-proposal
{"kind":"addChapters","subjectName":"<an existing subject>","chapters":[{"name":"...","topics":["..."]}]}
\`\`\`

- Only ever propose adding chapters or topics. You cannot delete, complete, or reorder anything.
- Keep a proposal small enough to read: at most a handful of chapters.
- Write maths as plain text with Unicode symbols (x², a/b, √x, π, ≤), never LaTeX. A phone shows LaTeX as raw backslashes.
- When the student sends a picture — a textbook page, handwritten notes, a diagram, a question — read it carefully, including handwriting, and answer from what it shows. If it is too blurred or cut off to read, say what you cannot make out rather than guessing.`;

/** The longest question a student may type. Generated prompts are not bound by this. */
const MAX_QUESTION_LENGTH = 2000;

/**
 * Pictures the model can read, and how large one may be.
 *
 * The app sends a JPEG shrunk to 1600 pixels on its longest side, which comes to
 * a few hundred kilobytes. The cap is several times that, so a larger picture
 * from the web build still gets through, while an upload big enough to be abuse
 * is refused before it costs anything.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_IMAGE_BASE64_LENGTH = 5_000_000;

interface InlineImage {
  readonly mimeType: string;
  readonly data: string;
}

/** The attached picture, `null` when there is none, or the reason it was refused. */
function readImage(value: unknown): InlineImage | null | { error: string; status: number } {
  if (value === undefined || value === null) return null;

  const image = value as { mimeType?: unknown; data?: unknown };
  if (
    typeof image.mimeType !== 'string' ||
    !IMAGE_TYPES.includes(image.mimeType) ||
    typeof image.data !== 'string' ||
    image.data.length === 0 ||
    !/^[A-Za-z0-9+/]+=*$/.test(image.data)
  ) {
    return { error: 'That picture could not be read.', status: 400 };
  }
  if (image.data.length > MAX_IMAGE_BASE64_LENGTH) {
    return { error: 'That picture is too large.', status: 413 };
  }

  return { mimeType: image.mimeType, data: image.data };
}

/** What the caller is asking for. */
const MODES = ['ask', 'summarize', 'quiz'] as const;
type Mode = (typeof MODES)[number];

/**
 * For summaries and quizzes.
 *
 * Deliberately silent about proposals: neither of these adds anything to a
 * tracker, and a model told it may propose will sometimes do so mid-summary.
 */
const STUDY_AID_INSTRUCTION = `You are PrepPilot's study assistant, helping a student revise a single topic.

Rules:
- Follow the requested format exactly. Nothing before it, nothing after it.
- Be accurate. Where a topic name is ambiguous, say so rather than inventing detail.
- Never claim to have changed anything in the student's tracker. You cannot.`;

/** Quiz settings, mirrored from @preppilot/shared (the function cannot import it). */
const MAX_QUIZ_QUESTIONS = 15;
const DIFFICULTIES = ['easy', 'medium', 'hard', 'competitive'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

interface QuizSettings {
  readonly questionCount: number;
  readonly difficulty: Difficulty;
  readonly allowMultiple: boolean;
}

/** Whatever arrives, a count between 1 and 15, a known difficulty and a boolean. */
export function readQuizSettings(body: {
  questionCount?: unknown;
  difficulty?: unknown;
  allowMultiple?: unknown;
}): QuizSettings {
  const count = Math.round(Number(body.questionCount ?? 5));
  return {
    questionCount: Number.isFinite(count) ? Math.min(MAX_QUIZ_QUESTIONS, Math.max(1, count)) : 5,
    difficulty: DIFFICULTIES.includes(body.difficulty as Difficulty)
      ? (body.difficulty as Difficulty)
      : 'medium',
    allowMultiple: typeof body.allowMultiple === 'boolean' ? body.allowMultiple : true,
  };
}

const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  easy: 'Easy: check recall of definitions, facts and basic ideas.',
  medium: 'Medium: ask the student to apply the idea to a straightforward case.',
  hard: 'Hard: need several steps of reasoning, with distractors built from common misconceptions.',
  competitive:
    'Competitive: the standard of Indian competitive entrance exams such as JEE, NEET or GATE — tricky distractors, numerical reasoning where the topic allows it.',
};

/** The most of a follow-up's source text the model is given. */
const MAX_FOLLOW_UP_LENGTH = 4000;
/** How many earlier messages of a follow-up chat are sent, newest last. */
const MAX_HISTORY = 6;
const MAX_HISTORY_MESSAGE = 2000;

interface FollowUp {
  readonly title: string;
  readonly text: string;
}

/** A follow-up's source, trimmed to size, or null if there is none or it is not usable. */
export function readFollowUp(value: unknown): FollowUp | null {
  const followUp = value as { title?: unknown; text?: unknown } | null | undefined;
  if (typeof followUp?.text !== 'string' || followUp.text.trim().length === 0) return null;
  const title = typeof followUp.title === 'string' ? followUp.title.trim().slice(0, 200) : '';
  return { title, text: followUp.text.trim().slice(0, MAX_FOLLOW_UP_LENGTH) };
}

/**
 * The earlier turns of a follow-up chat, as Gemini contents.
 *
 * Anything that is not a well-formed message is dropped rather than refused: a
 * follow-up still makes sense with less history. Only the most recent turns are
 * kept, and each is capped, so history cannot become a way round the question
 * length limit or run up the cost of every question.
 */
export function readHistory(
  value: unknown,
): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { role: string; text: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        ((entry as { role?: unknown }).role === 'student' ||
          (entry as { role?: unknown }).role === 'assistant') &&
        typeof (entry as { text?: unknown }).text === 'string' &&
        (entry as { text: string }).text.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((entry) => ({
      role: entry.role === 'student' ? ('user' as const) : ('model' as const),
      parts: [{ text: entry.text.trim().slice(0, MAX_HISTORY_MESSAGE) }],
    }));
}

interface RequestBody {
  readonly question?: unknown;
  readonly subjectNames?: unknown;
  readonly mode?: unknown;
  /** For summarize and quiz: where the topic sits in the syllabus. */
  readonly topicName?: unknown;
  readonly chapterName?: unknown;
  readonly subjectName?: unknown;
  /** For quiz: how many questions, how hard, and whether several may be correct. */
  readonly questionCount?: unknown;
  readonly difficulty?: unknown;
  readonly allowMultiple?: unknown;
  /** For ask: a picture to answer from, as base64. */
  readonly image?: unknown;
  /**
   * For ask: what the question follows up on — a topic summary the student
   * was reading — and the conversation so far in that chat.
   */
  readonly followUp?: unknown;
  readonly history?: unknown;
}

/**
 * Summaries and quizzes are built from the topic's *name* and its place in the
 * syllabus, because that is all a template holds — `TemplateTopic` is a name and
 * nothing else. There is no stored prose to summarise, so the model is told to
 * work from the syllabus position and to say when a name is too vague to work
 * from, rather than inventing content for it.
 */
function studyPrompt(mode: Mode, body: RequestBody): string {
  const topic = typeof body.topicName === 'string' ? body.topicName.trim() : '';
  const chapter = typeof body.chapterName === 'string' ? body.chapterName.trim() : '';
  const subject = typeof body.subjectName === 'string' ? body.subjectName.trim() : '';

  const place = [subject, chapter].filter((part) => part.length > 0).join(' → ');
  const context = place.length > 0 ? `It sits under ${place}.` : '';

  if (mode === 'summarize') {
    return `Summarise the study topic "${topic}" for a student revising it. ${context}

Rules:
- Six sentences at most. A student is revising, not reading a chapter.
- Cover what it is, why it matters, and the one thing most often got wrong.
- Plain prose. No headings, no bullet list, no markdown fence.
- If the name is too vague to summarise honestly, say so in one sentence instead of guessing.`;
  }

  const quiz = readQuizSettings(body);
  const n = quiz.questionCount;
  const answerRule = quiz.allowMultiple
    ? `- Most questions have one correct answer. Where more than one is correct, list
  them all and begin the question text with "Select all that apply." — a student
  must never have to guess that several answers are wanted.
- Never mark all four options correct; at least one must be wrong.`
    : `- Every question has exactly ONE correct option. answerIndexes always holds a
  single index. Never write "select all that apply".`;

  return `Write exactly ${n} multiple-choice question${n === 1 ? '' : 's'} checking whether a student understands "${topic}". ${context}

Difficulty — ${DIFFICULTY_GUIDE[quiz.difficulty]}

Reply with JSON and nothing else, in this shape:
{"questions":[{"question":"...","options":["...","...","...","..."],"answerIndexes":[0],"explanation":"..."}]}

Rules:
- Exactly ${n} question${n === 1 ? '' : 's'}, each with exactly 4 options. Never 3, never 5.
- answerIndexes lists every correct option by position, counting from 0.
${answerRule}
- No two options within a question may be the same, and no two questions may be the same.
- Test understanding, not recall of wording.
- Write maths as plain text with Unicode symbols, never LaTeX.
- explanation says why those options are correct, in one sentence.`;
}

/**
 * The web build runs in a browser and calls this cross-origin, so without these
 * the request never arrives — the browser refuses it before it is sent.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * The answer text, ignoring any part the model marks as its own reasoning.
 *
 * A thinking model can return several parts, and the first is not necessarily
 * the answer. Taking `parts[0]` blindly risks showing a student the model's
 * working in place of its reply.
 */
export function extractReply(payload: unknown): string {
  const candidate = (payload as { candidates?: unknown[] } | null)?.candidates?.[0];
  const parts = (candidate as { content?: { parts?: unknown[] } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .filter((part): part is { text: string } => {
      const typed = part as { text?: unknown; thought?: unknown };
      return typeof typed.text === 'string' && typed.thought !== true;
    })
    .map((part) => part.text)
    .join('')
    .trim();
}

/**
 * Calls the main model, retrying once if it is busy, then the fallback.
 *
 * Returns null when every attempt was refused as busy. Any other
 * failure is returned as it came, since retrying a bad request only spends
 * quota on the same refusal.
 */
async function generate(
  apiKey: string,
  request: Record<string, unknown>,
): Promise<Response | null> {
  const call = (model: string, body: Record<string, unknown>) =>
    fetch(`${endpoint(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const withThinking = {
    ...request,
    generationConfig: { thinkingConfig: { thinkingBudget: THINKING_BUDGET } },
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs()));
    const response = await call(MODEL, withThinking);
    if (!BUSY_STATUSES.has(response.status)) return response;
  }

  // Flash-Lite is sent no thinking budget: it thinks little by default, and a
  // setting a model does not support is rejected rather than ignored.
  for (const model of FALLBACK_MODELS) {
    const fallback = await call(model, request);
    if (!BUSY_STATUSES.has(fallback.status)) return fallback;
  }
  return null;
}

export async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (apiKey === undefined || apiKey.length === 0) {
    // Never echo configuration detail back to a client.
    return jsonResponse({ error: 'The assistant is not configured.' }, 503);
  }

  const userId = callerId(request) ?? (anonymousAllowed() ? ANONYMOUS_ID : null);
  if (userId === null) {
    return jsonResponse({ error: 'Sign in to ask a question.' }, 401);
  }
  if (!withinRateLimit(userId, Date.now())) {
    return jsonResponse({ error: 'Too many questions right now. Try again later.' }, 429);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const mode: Mode = MODES.includes(body.mode as Mode) ? (body.mode as Mode) : 'ask';

  if (mode !== 'ask') {
    const topic = typeof body.topicName === 'string' ? body.topicName.trim() : '';
    if (topic.length === 0 || topic.length > 200) {
      return jsonResponse({ error: 'That topic could not be read.' }, 400);
    }
  }

  if (mode === 'ask') {
    // The cap bounds what a student types. It is checked before the prompt is
    // built so that raising the room a generated prompt needs cannot quietly
    // raise the room a person has.
    const typed = typeof body.question === 'string' ? body.question.trim() : '';
    if (typed.length === 0 || typed.length > MAX_QUESTION_LENGTH) {
      return jsonResponse({ error: 'Ask a shorter question.' }, 400);
    }
  }

  // Only a question can carry a picture; summaries and quizzes work from the
  // topic's name.
  const image = mode === 'ask' ? readImage(body.image) : null;
  if (image !== null && 'error' in image) {
    return jsonResponse({ error: image.error }, image.status);
  }

  const question = mode === 'ask' ? (body.question as string).trim() : studyPrompt(mode, body);

  const subjectNames = Array.isArray(body.subjectNames)
    ? body.subjectNames.filter((name): name is string => typeof name === 'string').slice(0, 50)
    : [];

  const studying =
    subjectNames.length > 0
      ? `The student is studying: ${subjectNames.join(', ')}.`
      : 'The student has not added any subjects yet.';

  // A follow-up chat carries what it follows up on, and its recent turns, so
  // "give me an example of that" has something to refer to.
  const followUp = mode === 'ask' ? readFollowUp(body.followUp) : null;
  const history = followUp !== null ? readHistory(body.history) : [];
  const context =
    followUp === null
      ? studying
      : `${studying}

The student is asking follow-up questions about this summary${
          followUp.title.length > 0 ? ` of "${followUp.title}"` : ''
        }, which they have just read. Answer in its light; do not repeat it back.

<summary>
${followUp.text}
</summary>`;

  // Chat is told about the proposal grammar because it may offer to add to the
  // tracker. A summary or a quiz never does, and giving those the same
  // instruction invites a stray proposal block in the middle of them.
  const modelRequest = {
    systemInstruction: {
      parts: [
        {
          text:
            mode === 'ask'
              ? `${SYSTEM_INSTRUCTION}\n\n${context}`
              : `${STUDY_AID_INSTRUCTION}\n\n${context}`,
        },
      ],
    },
    contents: [
      ...history,
      {
        role: 'user',
        // The picture goes first: the model reads what follows in its light.
        parts: [...(image !== null ? [{ inlineData: image }] : []), { text: question }],
      },
    ],
  };

  try {
    const response = await generate(apiKey, modelRequest);

    if (response === null) {
      // Every model declined for now. Said as "busy" so the app can tell the
      // student to try again shortly rather than that something is broken.
      return jsonResponse({ error: 'The assistant is busy right now.' }, 429);
    }

    if (!response.ok) {
      // The upstream body can contain key or quota detail; do not forward it.
      return jsonResponse({ error: 'The assistant could not answer that.' }, 502);
    }

    const reply = extractReply(await response.json());

    if (reply.length === 0) {
      return jsonResponse({ error: 'The assistant did not reply.' }, 502);
    }

    return jsonResponse({ reply }, 200);
  } catch {
    return jsonResponse({ error: 'The assistant could not be reached.' }, 502);
  }
}

/**
 * Run directly, this becomes a local AI proxy.
 *
 * The Gemini key must never reach a device (PRD §15), so something server-side
 * has to hold it — normally the deployed Edge Function. Running the very same
 * file here gives the app a server to talk to before any Supabase project
 * exists, with no second implementation to drift out of step (D56).
 *
 * Bound to loopback deliberately: only this machine can reach it.
 */
if (import.meta.main) {
  servingLocally = true;
  const port = Number(Deno.env.get('AI_PROXY_PORT') ?? '8787');

  Deno.serve({ hostname: '127.0.0.1', port }, handler);
}
