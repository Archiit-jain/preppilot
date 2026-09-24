import { isValidName } from '../domain/types';

/**
 * The two things the assistant can produce about a single topic: a summary to
 * read, and questions to answer.
 *
 * Both are parsed here, away from the network and the UI, because both arrive as
 * free text from a model and neither can be trusted to be well formed. A
 * question whose "correct" answer was never established cannot be marked, so
 * each question is checked on its own and a malformed one is left out.
 */

/** Four options: enough that guessing is unlikely, few enough to read at a glance. */
export const QUIZ_OPTIONS = 4;

/** The most questions a student may ask for in one quiz. */
export const MAX_QUIZ_QUESTIONS = 15;

export const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard', 'competitive'] as const;
export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];

/** What a student chooses before a quiz is written. */
export interface QuizSettings {
  /** 1 to {@link MAX_QUIZ_QUESTIONS}. */
  readonly questionCount: number;
  readonly difficulty: QuizDifficulty;
  /**
   * Whether a question may have more than one correct option. Off means every
   * question has exactly one; on means some may be "select all that apply".
   */
  readonly allowMultiple: boolean;
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  questionCount: 5,
  difficulty: 'medium',
  allowMultiple: true,
};

/**
 * Settings brought into range.
 *
 * They arrive from a stepper, from a saved quiz and from the network, and a
 * count of 0 or 40 or a difficulty nobody offered must not reach the model.
 */
export function normaliseQuizSettings(
  settings: Partial<QuizSettings> | null | undefined,
): QuizSettings {
  const count = Math.round(Number(settings?.questionCount ?? DEFAULT_QUIZ_SETTINGS.questionCount));
  const questionCount = Number.isFinite(count)
    ? Math.min(MAX_QUIZ_QUESTIONS, Math.max(1, count))
    : DEFAULT_QUIZ_SETTINGS.questionCount;
  const difficulty = QUIZ_DIFFICULTIES.includes(settings?.difficulty as QuizDifficulty)
    ? (settings?.difficulty as QuizDifficulty)
    : DEFAULT_QUIZ_SETTINGS.difficulty;
  const allowMultiple =
    typeof settings?.allowMultiple === 'boolean'
      ? settings.allowMultiple
      : DEFAULT_QUIZ_SETTINGS.allowMultiple;
  return { questionCount, difficulty, allowMultiple };
}

export interface QuizQuestion {
  readonly question: string;
  /** Always exactly `QUIZ_OPTIONS` of them. */
  readonly options: readonly string[];
  /**
   * Every correct option, as indexes into `options`.
   *
   * Usually one. A question may have several, in which case the student has to
   * pick exactly that set — and the question text says so, because a multi-answer
   * question that looks single-answer is a trick rather than a test.
   */
  readonly answerIndexes: readonly number[];
  /** Shown after answering, right or wrong. */
  readonly explanation: string;
}

/** True when a question expects more than one option to be selected. */
export function isMultipleAnswer(question: QuizQuestion): boolean {
  return question.answerIndexes.length > 1;
}

export interface Quiz {
  readonly topicName: string;
  readonly questions: readonly QuizQuestion[];
}

/** The longest a summary may be before it stops being a summary. */
export const MAX_SUMMARY_LENGTH = 2000;

/**
 * Reads a summary out of a reply.
 *
 * Models like to wrap prose in a fenced block or prefix it with "Summary:";
 * neither belongs on screen, and both would show up as literal characters.
 */
export function parseSummary(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  let text = raw.trim();
  if (text.length === 0) return null;

  // A whole reply wrapped in one fence.
  const fenced = /^```(?:[a-z]*)?\n([\s\S]*?)```$/i.exec(text);
  if (fenced?.[1] !== undefined) text = fenced[1].trim();

  text = text.replace(/^(?:summary|answer)\s*:\s*/i, '').trim();

  if (text.length === 0) return null;
  return text.length > MAX_SUMMARY_LENGTH
    ? `${text.slice(0, MAX_SUMMARY_LENGTH).trimEnd()}…`
    : text;
}

export interface ParseQuizOptions {
  /** How many questions were asked for; extra ones are dropped. */
  readonly expected?: number;
  /** When false, a question with more than one correct option is left out. */
  readonly allowMultiple?: boolean;
}

/**
 * Reads a quiz out of a reply.
 *
 * A question whose answer index points outside its options, or which offers two
 * identical choices, is not a question a student can be marked against, so it is
 * left out. Every question that remains is complete in itself. Asked for fifteen,
 * a model that gets one wrong should not cost the student the other fourteen — but
 * a reply where fewer than half the questions survive is refused, since by then
 * the reply as a whole is not to be trusted.
 */
export function parseQuiz(
  raw: string,
  topicName: string,
  { expected = DEFAULT_QUIZ_SETTINGS.questionCount, allowMultiple = true }: ParseQuizOptions = {},
): Quiz | null {
  const json = extractJson(raw);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const questions = Array.isArray(parsed)
    ? parsed
    : (parsed as { questions?: unknown } | null)?.questions;

  if (!Array.isArray(questions) || questions.length === 0) return null;

  const wanted = Math.min(MAX_QUIZ_QUESTIONS, Math.max(1, Math.round(expected)));
  const cleaned: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (const entry of questions) {
    if (cleaned.length === wanted) break;
    const question = readQuestion(entry);
    if (question === null) continue;
    if (!allowMultiple && isMultipleAnswer(question)) continue;
    // The same question twice is one question, whatever the model thinks.
    const key = question.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(question);
  }

  if (cleaned.length === 0 || cleaned.length < Math.ceil(wanted / 2)) return null;
  if (!isValidName(topicName)) return null;

  return { topicName: topicName.trim(), questions: cleaned };
}

function readQuestion(entry: unknown): QuizQuestion | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const record = entry as Record<string, unknown>;

  const question = typeof record.question === 'string' ? record.question.trim() : '';
  if (question.length === 0 || question.length > 500) return null;

  if (!Array.isArray(record.options)) return null;
  const options = record.options
    .filter((option): option is string => typeof option === 'string')
    .map((option) => option.trim())
    .filter((option) => option.length > 0 && option.length <= 300);

  // Two identical options make one of them wrong for no reason a student can see.
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return null;
  if (options.length < QUIZ_OPTIONS) return null;

  const answers = readAnswerIndexes(record, options.length);
  if (answers === null) return null;

  // Every question shows exactly four options. A model that offers more is
  // trimmed rather than thrown away: the correct ones are kept, and distractors
  // fill the rest.
  const trimmed = trimToFour(options, answers);
  if (trimmed === null) return null;

  const explanation =
    typeof record.explanation === 'string' ? record.explanation.trim().slice(0, 500) : '';

  return {
    question,
    options: trimmed.options,
    answerIndexes: trimmed.answerIndexes,
    explanation,
  };
}

/** Accepts a single `answerIndex` or an `answerIndexes` array; normalises to the array. */
function readAnswerIndexes(record: Record<string, unknown>, optionCount: number): number[] | null {
  const raw = Array.isArray(record.answerIndexes)
    ? record.answerIndexes
    : [record.answerIndex ?? record.answerIndexes];

  const indexes = [...new Set(raw)].filter(
    (value): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < optionCount,
  );

  if (indexes.length !== new Set(raw).size) return null;
  if (indexes.length === 0) return null;

  // A question where everything is correct tests nothing.
  if (indexes.length >= optionCount) return null;

  return indexes.sort((a, b) => a - b);
}

/**
 * Reduces a question to exactly four options, keeping every correct one.
 *
 * Order is preserved so the correct answers are not all bunched at the top,
 * which would be a giveaway across three questions.
 */
function trimToFour(
  options: readonly string[],
  answerIndexes: readonly number[],
): { options: string[]; answerIndexes: number[] } | null {
  if (options.length === QUIZ_OPTIONS) {
    return { options: [...options], answerIndexes: [...answerIndexes] };
  }

  const correct = new Set(answerIndexes);
  // More correct answers than slots cannot be shown honestly.
  if (correct.size > QUIZ_OPTIONS - 1) return null;

  const keep = new Set(answerIndexes);
  for (let index = 0; index < options.length && keep.size < QUIZ_OPTIONS; index += 1) {
    keep.add(index);
  }

  const ordered = [...keep].sort((a, b) => a - b);
  const kept = ordered.map((index) => options[index] as string);
  const nextAnswers = ordered
    .map((index, position) => (correct.has(index) ? position : -1))
    .filter((position) => position !== -1);

  return { options: kept, answerIndexes: nextAnswers };
}

/** Pulls the JSON out of a reply that may have prose or a fence around it. */
function extractJson(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = (fenced?.[1] ?? raw).trim();

  const start = candidate.search(/[[{]/);
  if (start === -1) return null;

  const opening = candidate[start];
  const closing = opening === '[' ? ']' : '}';
  const end = candidate.lastIndexOf(closing);
  if (end <= start) return null;

  return candidate.slice(start, end + 1);
}

/**
 * Whether one question was answered correctly.
 *
 * Exact set equality: on a multi-answer question, missing a correct option is as
 * wrong as choosing an incorrect one. Partial credit would let a student pass by
 * selecting everything.
 */
export function isAnswerCorrect(question: QuizQuestion, selected: readonly number[]): boolean {
  const chosen = new Set(selected);
  if (chosen.size !== question.answerIndexes.length) return false;
  return question.answerIndexes.every((index) => chosen.has(index));
}

/** Whether every question was answered correctly. */
export function isQuizPassed(quiz: Quiz, answers: readonly (readonly number[])[]): boolean {
  if (answers.length !== quiz.questions.length) return false;
  return quiz.questions.every((question, index) => isAnswerCorrect(question, answers[index] ?? []));
}

/** How many were right, for telling a student where they stand. */
export function countCorrect(quiz: Quiz, answers: readonly (readonly number[])[]): number {
  let correct = 0;
  quiz.questions.forEach((question, index) => {
    if (isAnswerCorrect(question, answers[index] ?? [])) correct += 1;
  });
  return correct;
}

/**
 * The same question with its options in a new order.
 *
 * A redone quiz keeps its questions — that is the point of redoing it — but a
 * student who remembers "the answer was the third one" has remembered a position,
 * not the physics. `random` is injectable so tests are deterministic.
 */
export function shuffleOptions(
  question: QuizQuestion,
  random: () => number = Math.random,
): QuizQuestion {
  const order = question.options.map((_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap] as number, order[index] as number];
  }
  const correct = new Set(question.answerIndexes);
  return {
    ...question,
    options: order.map((from) => question.options[from] as string),
    answerIndexes: order.map((from, to) => (correct.has(from) ? to : -1)).filter((to) => to !== -1),
  };
}
