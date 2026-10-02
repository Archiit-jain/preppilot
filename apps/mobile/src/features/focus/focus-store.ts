import {
  createTimer,
  elapsedSeconds,
  finish,
  isExpired,
  pause,
  resume,
  start,
  type FocusAlert,
  type TimerState,
} from '@preppilot/shared';
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';
import type { StudySessionRepository } from '../../db/repositories/study-sessions';
import { activeTrackerId } from '../trackers/trackers-store';
import {
  announceTimerFinished,
  armTimerAlert,
  disarmTimerAlert,
  vibrateFinished,
} from '../timer/timer-alert';

export interface FocusState {
  readonly timer: TimerState | null;
  readonly sessionId: string | null;
  /**
   * How many times the student left PrepPilot during this session.
   *
   * This is the honest substitute for app blocking, which Android does not
   * permit (D22): PrepPilot cannot stop someone switching away, but it can
   * notice and show them afterwards.
   */
  readonly timesLeft: number;
  readonly subjectName: string | null;
  readonly error: string | null;
  /** Seconds studied in the session that just ended, for the summary. */
  readonly lastSessionSeconds: number | null;
  /** How this session announces its end, chosen when it began. */
  readonly alert: FocusAlert;
}

export interface FocusActions {
  begin: (options: {
    minutes: number;
    subjectId?: string | null;
    subjectName?: string | null;
    alert?: FocusAlert;
  }) => Promise<void>;
  /** Pauses the countdown; the full-screen timer's tap does this. */
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
  /** Records that the app went to the background. Driven by an AppState listener. */
  noteLeft: () => void;
  reset: () => void;
  clearError: () => void;
}

const initialState: FocusState = {
  timer: null,
  sessionId: null,
  timesLeft: 0,
  subjectName: null,
  error: null,
  lastSessionSeconds: null,
  alert: 'both',
};

/** A sound needs a scheduled notification; vibration alone is felt in the app. */
const usesSound = (alert: FocusAlert) => alert === 'both' || alert === 'sound';
const usesVibration = (alert: FocusAlert) => alert === 'both' || alert === 'vibrate';

const FOCUS_ALERT_WORDING = {
  slot: 'focus' as const,
  title: 'Focus session done',
  body: 'Nice work. Take a breather before the next one.',
};

interface Context {
  readonly userId: string;
  readonly sessions: StudySessionRepository;
  readonly now: () => number;
}

let context: Context | null = null;

export function configureFocusContext(ctx: Context): void {
  context = ctx;
}

function requireContext(): Context {
  if (context === null) {
    throw new Error('Focus Mode used before configureFocusContext() was called.');
  }
  return context;
}

/** The clock the focus session runs on, shared with its display. */
export function focusNow(): number {
  return context?.now() ?? Date.now();
}

export const useFocusStore = create<FocusState & FocusActions>((set, get) => ({
  ...initialState,

  async begin({ minutes, subjectId = null, subjectName = null, alert = 'both' }) {
    const ctx = requireContext();
    const status = get().timer?.status;
    if (status === 'running' || status === 'paused') return;

    const now = ctx.now();
    const timer = start(createTimer({ mode: 'custom', targetSeconds: minutes * 60 }), now);
    set({ timer, timesLeft: 0, subjectName, error: null, lastSessionSeconds: null, alert });
    // Armed now so the chime comes even with the phone face-down or locked.
    if (usesSound(alert)) void armTimerAlert(timer, now, FOCUS_ALERT_WORDING);

    try {
      const session = await ctx.sessions.start({
        userId: ctx.userId,
        trackerId: activeTrackerId(),
        // A focus session is a countdown, so it records as a custom timer.
        timerMode: 'custom',
        subjectId,
        subjectName,
      });
      set({ sessionId: session.id });
    } catch {
      // The session still runs; losing the recording is better than refusing to
      // let someone start studying.
      set({ error: 'We could not record this session. Your focus timer is still running.' });
    }
  },

  async pause() {
    const ctx = requireContext();
    const { timer, sessionId } = get();
    if (timer === null || timer.status !== 'running') return;

    const now = ctx.now();
    const paused = pause(timer, now);
    set({ timer: paused });
    void disarmTimerAlert('focus');

    if (sessionId === null) return;
    try {
      await ctx.sessions.heartbeat(sessionId, elapsedSeconds(paused, now), 'paused');
    } catch {
      // Best-effort: the session's time is saved when it ends.
    }
  },

  async resume() {
    const ctx = requireContext();
    const { timer, sessionId, alert } = get();
    if (timer === null || timer.status !== 'paused') return;

    const now = ctx.now();
    const resumed = resume(timer, now);
    set({ timer: resumed });
    // Re-armed for the new end, which is later by however long it was paused.
    if (usesSound(alert)) void armTimerAlert(resumed, now, FOCUS_ALERT_WORDING);

    if (sessionId === null) return;
    try {
      await ctx.sessions.heartbeat(sessionId, elapsedSeconds(resumed, now), 'running');
    } catch {
      // Best-effort, as above.
    }
  },

  async end() {
    const ctx = requireContext();
    const { timer, sessionId, alert } = get();
    if (timer === null) return;

    const now = ctx.now();
    const finished = finish(timer, now);
    const seconds = elapsedSeconds(finished, now);
    set({ timer: finished, lastSessionSeconds: seconds });

    // Ended early: the chime must not still go off. Ran out: the student is
    // told, in whichever way they chose.
    void disarmTimerAlert('focus');
    if (isExpired(timer, now) && usesVibration(alert)) {
      vibrateFinished();
      void announceTimerFinished();
    }

    if (sessionId === null) return;
    try {
      await ctx.sessions.complete(sessionId, seconds);
      set({ sessionId: null });
    } catch {
      set({ error: 'We could not save this session. Your study time may be incomplete.' });
    }
  },

  noteLeft() {
    if (get().timer?.status !== 'running') return;
    set({ timesLeft: get().timesLeft + 1 });
  },

  reset() {
    set({ ...initialState });
  },

  clearError() {
    set({ error: null });
  },
}));

/**
 * Watches for the app leaving the foreground while a focus session runs.
 *
 * Returns an unsubscribe. Only counts transitions *into* the background, so a
 * single switch away is not counted repeatedly as the OS reports intermediate
 * states.
 */
export function watchForDistractions(): () => void {
  // Starts as 'active' rather than reading AppState.currentState: this is only
  // ever called from a running session, which by definition is on screen, and
  // the reported value is not reliably 'active' on every platform.
  let previous: AppStateStatus = 'active';

  const subscription = AppState.addEventListener('change', (next) => {
    const leftForeground = previous === 'active' && next !== 'active';
    if (leftForeground) useFocusStore.getState().noteLeft();
    previous = next;
  });

  return () => subscription.remove();
}

/** Test seam: clears the store and its captured context. */
export function resetFocusStore(): void {
  context = null;
  useFocusStore.setState({ ...initialState });
}
