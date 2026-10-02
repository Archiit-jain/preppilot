import { DEFAULT_TIMER_FACE, parseTimerFace, type TimerFace } from '@preppilot/shared';
import { create } from 'zustand';
import { getRepositories } from '../../../db/client';

/** Where the chosen face is kept, per device, like the Pomodoro settings. */
export const TIMER_FACE_PREFERENCE = 'timer.face';

interface TimerFaceState {
  readonly face: TimerFace;
  /** Reads the face chosen last time. Never throws: the default is fine. */
  load: (userId: string | null) => Promise<void>;
  choose: (face: TimerFace, userId: string | null) => Promise<void>;
}

/**
 * The full-screen timer's face, shared by the topic timer and Focus Mode so a
 * student picks it once.
 */
export const useTimerFaceStore = create<TimerFaceState>((set) => ({
  face: DEFAULT_TIMER_FACE,

  async load(userId) {
    if (userId === null) return;
    try {
      const stored = await getRepositories().preferences.get(userId, TIMER_FACE_PREFERENCE);
      set({ face: parseTimerFace(stored) });
    } catch {
      // Unreadable: keep the current face.
    }
  },

  async choose(face, userId) {
    set({ face });
    if (userId === null) return;
    try {
      await getRepositories().preferences.set(userId, TIMER_FACE_PREFERENCE, face);
    } catch {
      // Applied for now; only remembering it failed.
    }
  },
}));

/** Test seam. */
export function resetTimerFaceStore(): void {
  useTimerFaceStore.setState({ face: DEFAULT_TIMER_FACE });
}
