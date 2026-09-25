# The AI assistant

Implements PRD §14 and §15. Secondary, online-only, and structurally incapable of
changing the tracker on its own.

## The key never reaches a client

```
app  →  Supabase Edge Function (ask-gemini)  →  Gemini
```

The Gemini key is a Supabase secret read at request time. Nothing in the app
knows it, and a key placed in client code would ship to every device that
installs the app — including as plain text in the web bundle.

The function also:

- **Never forwards an upstream error body.** A Gemini failure can carry key or
  quota detail; failures are replaced with a generic message.
- **Rate limits per user.** The proxy spends the project owner's quota, so an
  unlimited endpoint is a financial liability as much as a security one.

## When the model is busy

The function tries Gemini 3.6 Flash, retries it once after about a second if it
answers 429 or 503, then falls back to Gemini 3.5 Flash-Lite and, if that is busy
too, Gemini 3.1 Flash-Lite. Only when all three are
busy does the student see "The assistant is busy right now. Try again in a
minute." The app reads the HTTP status from Supabase's `FunctionsHttpError`
(`context.status`); the error's message never carries it. Costs, free-tier
limits and the plan for scaling are in
[AI_COSTS_AND_PROVIDERS.md](AI_COSTS_AND_PROVIDERS.md).

## Quizzes the student configures

"Test me on this" opens a settings sheet before anything is asked:

| Setting                      | Values                                  | Default |
| ---------------------------- | --------------------------------------- | ------- |
| Questions                    | 1–15                                    | 5       |
| Difficulty                   | Easy, Medium, Hard, Competitive         | Medium  |
| More than one correct answer | On (some "select all that apply") / Off | On      |

Every question is multiple choice with four options. The settings are
normalised in `@preppilot/shared` (`normaliseQuizSettings`) and again in the
function, which cannot import the package. "Competitive" asks for the standard
of JEE, NEET or GATE. With the toggle off the model is told every question has
exactly one answer, and the parser also drops any question with several.

The parser checks each question on its own and leaves out a malformed one,
rather than refusing the whole quiz; a reply where fewer than half the requested
questions survive is refused. Repeated questions count once. A quiz of fifteen
competitive questions can take 30–60 seconds to write.

## The Quiz deck

Every quiz the student finishes — reaches the results with every question
checked — is saved to `quiz_attempts` and listed in **Sessions → Quiz deck**,
with its date, difficulty and score. From there:

- **Redo these questions** replays the saved questions with their options
  reshuffled (`shuffleOptions`): no AI request, so it works offline.
- **New quiz, same settings** asks for fresh questions on the same topic.
- **Delete from deck** tombstones the attempt.

A redo or a new quiz is saved as another attempt, so the deck shows whether the
score is improving. Quizzes abandoned part-way are not saved.

## Saved conversations

Conversations are stored in `chat_threads` and `chat_messages` and synchronise
like everything else. The assistant reopens the most recent conversation;
**Chats** lists the others (open, or delete after a confirmation) and **New
chat** starts a fresh one, saved when its first question is asked and named
after it. A suggested syllabus addition is stored with its message as JSON and
validated again when read back (`parseProposalJson`), so a stored proposal
cannot get round the grammar. Pictures are not synchronised: the message
records that it had one, and another device shows "Picture sent from another
device". Messages in a thread get strictly increasing timestamps, so a reply can
never sort above its question.

Each question is still sent to the model on its own; earlier messages in the
conversation are not sent as context (LIMITATIONS.md).

## Following up on a summary

A topic summary has **Ask a follow-up**. It opens the assistant on a new chat,
named after the topic, and every question asked in it is sent with:

- the summary, placed in the system instruction as what the student has just
  read — it is never shown as a chat message; and
- the chat's last six messages, so "give me an example of that" and "and a
  harder one?" have something to refer to.

A slim banner at the top of the chat reads _Following up on: {topic} (summary)_;
tapping it shows the summary. The source is saved on the thread
(`chat_threads.follow_up`, JSON `{ title, text }`), so reopening the chat from
**Chats**, or on another device, keeps it. **New chat** leaves it.

The function accepts `followUp` (trimmed to 4,000 characters) and `history`
(the last six well-formed turns, each trimmed to 2,000 characters) only in
`ask` mode, and ignores history unless a follow-up source is present. Ordinary
chats still send each question on its own.

## Keeping an answer as a note

- A topic summary has **Add as note**, which files it under that topic (or
  sub-topic) with `source = 'summary'`.
- Every assistant reply has a small **page +** button, _Add as note_: the
  student picks the topic, and the reply is saved as plain text (`toPlainText`
  keeps bullets and numbered steps, drops every markup symbol) with
  `source = 'assistant'`.

The Notes tab labels both ("AI summary", "From the assistant").

## Asking about a picture

A question can carry one picture: a textbook page, handwritten notes, a diagram,
a printed question. The composer's picture button offers **Take photo** or
**Choose from gallery**; the gallery goes through Android's system photo picker,
so only the camera asks for a permission.

```
pick → shrink to 1600 px, JPEG 70% (on the device) → base64 → ask-gemini → Gemini
```

Shrinking happens on the device (`attach-image.ts`, `expo-image-manipulator`).
A phone photo is several megabytes; at 1600 px printed text stays legible and
the upload is a few hundred kilobytes. A picture sent with no question is asked
about with a fixed prompt — explain what it shows and answer any question in it.

The function accepts JPEG, PNG, WebP and HEIC, refuses anything that is not
plain base64 (400) or larger than 5,000,000 base64 characters (413) before any
Gemini quota is spent, and places the picture ahead of the question in the
request so the model reads the question in its light. Summaries and quizzes
never take a picture.

## Replies are formatted, not shown raw

Gemini writes Markdown whether asked to or not. Shown raw, a reply is full of
`**`, `*`, `#` and LaTeX backslashes. `features/ai/markdown.ts` parses the
constructs a chat answer actually uses — bold, italics, strikethrough, inline
code, headings, bullets (nested), numbered steps, quotes, rules, fenced code and
tables — and `components/rich-reply.tsx` renders them with the app's own text
styles. Anything unrecognised passes through as plain text.

Maths gets the same treatment: `$x^2$`, `\(…\)`, `\[…\]` and `$$…$$` are
rewritten as plain Unicode — `\frac{a}{b}` as a/b, `x^{2}` as x², `\sqrt{x}` as
√x, Greek letters and relations as their symbols. A dollar sign counts as maths
only when it hugs its content, so "$5 and $10" is left alone. The system
instruction also tells the model not to use LaTeX; the parser is the safety net.

Written in-house rather than taken from a Markdown package: those bring a full
CommonMark parser and renderer for what is a few hundred lines.

## The composer stays above the keyboard

`KeyboardAvoidingView` computed the keyboard's overlap from the view's layout
relative to its _parent_. Inside a screen below the status bar and above the tab
bar that is not where the view is, so the text box rose by less than the
keyboard covered and stayed half hidden. `lib/use-keyboard-overlap.ts` measures
the view in window coordinates — the space the keyboard's position is reported
in — and pads the screen by exactly the part covered.

## The assistant cannot change anything

PRD §14 forbids the assistant marking topics complete, deleting topics, altering
the syllabus or imposing schedules. That is enforced by the data shape, not by
instructions in a prompt.

A reply is parsed into an inert **proposal**, and the proposal grammar has only
two verbs: `addChapters` and `addTopics`. There is no way to express deleting or
completing, so a model attempting it produces nothing parseable. A test asserts a
`deleteTopics` proposal parses to `null`.

```
reply → parse → proposal (inert) → student reviews → confirms → applied
```

Applying lists exactly what will be added first. A proposal over 200 topics is
refused outright: confirming hundreds of topics is a rubber stamp, not the review
§14 asks for.

## Unconfigured and offline are different

The assistant disables itself and says which it is, rather than accepting a
question and failing after the student has typed it:

- **No Supabase project** — "not set up yet"
- **Offline** — "needs an internet connection. Everything else keeps working
  offline."

## Deploying

```bash
supabase secrets set GEMINI_API_KEY=...
supabase functions deploy ask-gemini
```

Until then the assistant reports itself unavailable and nothing else is affected.
