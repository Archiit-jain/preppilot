import { countCorrect, type Quiz, type QuizSettings } from '@preppilot/shared';
import { create } from 'zustand';
import type { Repositories } from '../../db/client';
import type { QuizAttempt } from '../../db/repositories/quiz-attempts';
import { activeTrackerId } from '../trackers/trackers-store';

/** Where a quiz was about, as far as the deck needs to know. */
export interface QuizPlace {
  readonly topicId: string | null;
  readonly chapterName: string | null;
  readonly subjectName: string | null;
}

export interface QuizDeckState {
  readonly attempts: readonly QuizAttempt[];
  readonly loading: boolean;
  readonly error: string | null;
}

export interface QuizDeckActions {
  load: (userId: string, repositories: Repositories) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

const initialState: QuizDeckState = { attempts: [], loading: false, error: null };

let context: { userId: string; repositories: Repositories } | null = null;

/**
 * Saves a finished quiz to the deck.
 *
 * Called once, when the student reaches the results with every question
 * checked — a quiz abandoned halfway is not an attempt worth keeping. Refreshes
 * the deck if it has been opened, so the new attempt is at the top of it.
 */
export async function recordQuizAttempt(
  userId: string,
  repositories: Repositories,
  quiz: Quiz,
  answers: readonly (readonly number[])[],
  settings: Pick<QuizSettings, 'difficulty' | 'allowMultiple'>,
  place: QuizPlace,
): Promise<void> {
  await repositories.quizAttempts.record({
    userId,
    trackerId: activeTrackerId(),
    topicId: place.topicId,
    topicName: quiz.topicName,
    chapterName: place.chapterName,
    subjectName: place.subjectName,
    settings,
    questions: quiz.questions,
    answers,
    correct: countCorrect(quiz, answers),
  });
  if (context !== null && context.userId === userId) {
    await useQuizDeckStore.getState().load(userId, repositories);
  }
}

/** The Quiz deck: every quiz the student finished in the current course. */
export const useQuizDeckStore = create<QuizDeckState & QuizDeckActions>((set, get) => ({
  ...initialState,

  async load(userId, repositories) {
    context = { userId, repositories };
    set({ loading: true, error: null });
    try {
      set({ attempts: await repositories.quizAttempts.listByUser(userId, activeTrackerId()) });
    } catch {
      set({ error: 'We could not open your quiz deck. Try again.' });
    } finally {
      set({ loading: false });
    }
  },

  async remove(id) {
    if (context === null) return;
    const { userId, repositories } = context;
    try {
      await repositories.quizAttempts.softDelete(id);
      await get().load(userId, repositories);
    } catch {
      set({ error: 'We could not delete that quiz. Try again.' });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

/** Test seam. */
export function resetQuizDeckStore(): void {
  context = null;
  useQuizDeckStore.setState({ ...initialState });
}
