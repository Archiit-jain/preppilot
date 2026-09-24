import { uuidV7, type QuizQuestion, type QuizSettings } from '@preppilot/shared';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { quizAttempts, type QuizAttemptRow } from '../schema';
import { systemClock, type Clock, type Database } from '../types';
import { scopedToTracker } from './tracker-scope';

export interface RecordAttemptInput {
  readonly userId: string;
  readonly trackerId?: string | null;
  readonly topicId?: string | null;
  readonly topicName: string;
  readonly chapterName?: string | null;
  readonly subjectName?: string | null;
  readonly settings: Pick<QuizSettings, 'difficulty' | 'allowMultiple'>;
  readonly questions: readonly QuizQuestion[];
  readonly answers: readonly (readonly number[])[];
  readonly correct: number;
}

/** A saved quiz with its JSON columns read back. */
export interface QuizAttempt extends Omit<QuizAttemptRow, 'questions' | 'answers'> {
  readonly questions: readonly QuizQuestion[];
  readonly answers: readonly (readonly number[])[];
}

/**
 * Reads a stored attempt back into questions and answers.
 *
 * The columns arrive from other devices through sync, so they are not assumed
 * to be well formed: an attempt whose questions cannot be read is left out of
 * the deck rather than crashing it.
 */
export function readAttempt(row: QuizAttemptRow): QuizAttempt | null {
  try {
    const questions = JSON.parse(row.questions) as unknown;
    const answers = JSON.parse(row.answers) as unknown;
    if (!Array.isArray(questions) || questions.length === 0) return null;
    if (!Array.isArray(answers)) return null;
    const valid = questions.every(
      (q) =>
        typeof q === 'object' &&
        q !== null &&
        typeof (q as QuizQuestion).question === 'string' &&
        Array.isArray((q as QuizQuestion).options) &&
        Array.isArray((q as QuizQuestion).answerIndexes),
    );
    if (!valid) return null;
    return {
      ...row,
      questions: questions as QuizQuestion[],
      answers: answers.map((entry) => (Array.isArray(entry) ? (entry as number[]) : [])),
    };
  } catch {
    return null;
  }
}

/** Finished quizzes: the Quiz deck. */
export class QuizAttemptRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock = systemClock,
  ) {}

  /** A tracker's deck, newest first. */
  async listByUser(userId: string, trackerId?: string | null): Promise<QuizAttempt[]> {
    const rows = await this.db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          isNull(quizAttempts.deletedAt),
          ...scopedToTracker(quizAttempts.trackerId, trackerId),
        ),
      )
      .orderBy(desc(quizAttempts.createdAt));
    return rows.map(readAttempt).filter((attempt): attempt is QuizAttempt => attempt !== null);
  }

  async record(input: RecordAttemptInput): Promise<QuizAttemptRow> {
    const now = this.clock.now();
    const row: QuizAttemptRow = {
      id: uuidV7(),
      userId: input.userId,
      trackerId: input.trackerId ?? null,
      topicId: input.topicId ?? null,
      topicName: input.topicName,
      chapterName: input.chapterName ?? null,
      subjectName: input.subjectName ?? null,
      difficulty: input.settings.difficulty,
      allowMultiple: input.settings.allowMultiple,
      questions: JSON.stringify(input.questions),
      answers: JSON.stringify(input.answers),
      correct: input.correct,
      total: input.questions.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };
    await this.db.insert(quizAttempts).values(row);
    return row;
  }

  async softDelete(id: string): Promise<void> {
    const now = this.clock.now();
    await this.db
      .update(quizAttempts)
      .set({ deletedAt: now, updatedAt: now, syncStatus: 'pending' })
      .where(eq(quizAttempts.id, id));
  }

  // ---------------------------------------------------------------------------
  // Synchronisation
  // ---------------------------------------------------------------------------

  async listAllForSync(userId: string): Promise<QuizAttemptRow[]> {
    return this.db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId));
  }

  async upsertFromSync(row: Record<string, unknown>): Promise<void> {
    await this.db
      .insert(quizAttempts)
      .values(row as never)
      .onConflictDoUpdate({ target: quizAttempts.id, set: row as never });
  }

  async markSynced(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(quizAttempts)
      .set({ syncStatus: 'synced' })
      .where(inArray(quizAttempts.id, [...ids]));
  }
}
