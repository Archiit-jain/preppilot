import type { QuizQuestion } from '@preppilot/shared';
import { readAttempt } from '../repositories/quiz-attempts';
import type { QuizAttemptRow } from '../schema';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../test-support/test-database';

const USER = 'user-1';

let db: ReturnType<typeof createTestDatabase>;
let repositories: ReturnType<typeof createTestRepositories>;
let clock: ReturnType<typeof createTestClock>;

beforeEach(() => {
  db = createTestDatabase();
  clock = createTestClock();
  repositories = createTestRepositories(db, clock);
});

afterEach(() => {
  db.$close();
});

const question = (n: number): QuizQuestion => ({
  question: `Q${n}?`,
  options: ['A', 'B', 'C', 'D'],
  answerIndexes: [n % 4],
  explanation: '',
});

const record = (topicName: string, trackerId: string | null = null, correct = 1) =>
  repositories.quizAttempts.record({
    userId: USER,
    trackerId,
    topicName,
    settings: { difficulty: 'hard', allowMultiple: false },
    questions: [question(0), question(1)],
    answers: [[0], [3]],
    correct,
  });

describe('the Quiz deck', () => {
  it('keeps a finished quiz whole, so it can be redone exactly', async () => {
    await record("Ohm's law");

    const [attempt] = await repositories.quizAttempts.listByUser(USER);
    expect(attempt).toMatchObject({
      topicName: "Ohm's law",
      difficulty: 'hard',
      allowMultiple: false,
      correct: 1,
      total: 2,
    });
    expect(attempt!.questions).toEqual([question(0), question(1)]);
    expect(attempt!.answers).toEqual([[0], [3]]);
  });

  it('lists the newest first, per course', async () => {
    await record('First', 'jee');
    clock.advance(10);
    await record('Second', 'jee');
    await record('Elsewhere', 'neet');

    expect(
      (await repositories.quizAttempts.listByUser(USER, 'jee')).map((a) => a.topicName),
    ).toEqual(['Second', 'First']);
  });

  it('forgets a deleted quiz', async () => {
    const row = await record('Gone');
    await repositories.quizAttempts.softDelete(row.id);

    expect(await repositories.quizAttempts.listByUser(USER)).toEqual([]);
  });
});

describe('reading a stored quiz back', () => {
  const row = (over: Partial<QuizAttemptRow>): QuizAttemptRow => ({
    id: 'a',
    userId: USER,
    trackerId: null,
    topicId: null,
    topicName: 'T',
    chapterName: null,
    subjectName: null,
    difficulty: 'easy',
    allowMultiple: true,
    questions: JSON.stringify([question(0)]),
    answers: JSON.stringify([[0]]),
    correct: 1,
    total: 1,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    syncStatus: 'synced',
    ...over,
  });

  it('reads well-formed columns', () => {
    expect(readAttempt(row({}))?.questions).toHaveLength(1);
  });

  it('treats a missing answer as nothing chosen', () => {
    expect(readAttempt(row({ answers: JSON.stringify(['x']) }))?.answers).toEqual([[]]);
  });

  /** Rows arrive from other devices; a broken one is skipped, not fatal. */
  it('leaves out a quiz it cannot read', () => {
    expect(readAttempt(row({ questions: '{broken' }))).toBeNull();
    expect(readAttempt(row({ questions: '[]' }))).toBeNull();
    expect(readAttempt(row({ questions: JSON.stringify([{ question: 1 }]) }))).toBeNull();
    expect(readAttempt(row({ answers: '{}' }))).toBeNull();
  });
});

describe('synchronisation', () => {
  it('lists, stores and marks rows', async () => {
    const mine = await record('Mine');
    const all = await repositories.quizAttempts.listAllForSync(USER);
    expect(all).toHaveLength(1);

    await repositories.quizAttempts.markSynced([mine.id]);
    await repositories.quizAttempts.markSynced([]);
    expect((await repositories.quizAttempts.listAllForSync(USER))[0]!.syncStatus).toBe('synced');

    await repositories.quizAttempts.upsertFromSync({ ...mine, correct: 2, updatedAt: 99 });
    expect((await repositories.quizAttempts.listByUser(USER))[0]!.correct).toBe(2);
  });
});
