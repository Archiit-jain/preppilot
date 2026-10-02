import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Vibration } from 'react-native';
import { remainingSeconds, type TimerState } from '@preppilot/shared';

/**
 * Telling a student their timer has finished.
 *
 * A countdown that ends silently ends unnoticed: the student is meant to be
 * studying, not watching a number. The alert is a scheduled local notification
 * rather than an in-app animation, so it arrives whether they are on another
 * screen, in another app, or have the phone face-down on the desk.
 *
 * Everything here is best-effort and never throws. A timer that refuses to
 * start because a notification could not be scheduled would be a worse app than
 * one that occasionally fails to chime.
 */

/** What the notification says, per timer mode. */
function wording(timer: TimerState): { title: string; body: string } {
  if (timer.mode !== 'pomodoro') {
    return { title: 'Time’s up', body: 'Your timer has finished.' };
  }

  return timer.phase === 'work'
    ? { title: 'Work interval done', body: 'Time for a break.' }
    : { title: 'Break over', body: 'Ready for the next interval?' };
}

/**
 * Which timer an alert belongs to. The topic timer and Focus Mode each keep
 * their own, so pausing one never cancels the other's chime.
 */
export type AlertSlot = 'timer' | 'focus';

export interface AlertOptions {
  readonly slot?: AlertSlot;
  /** Replaces the default wording, e.g. for a focus session. */
  readonly title?: string;
  readonly body?: string;
}

const scheduled = new Map<AlertSlot, string>();

/**
 * Schedules the chime for the moment this countdown ends.
 *
 * A stopwatch has no end, so there is nothing to arm. Re-arming replaces any
 * previous alert, which is what makes pausing and resuming land on the new end
 * time rather than the original one.
 */
export async function armTimerAlert(
  timer: TimerState,
  now: number,
  options: AlertOptions = {},
): Promise<void> {
  const slot = options.slot ?? 'timer';
  await disarmTimerAlert(slot);

  const remaining = remainingSeconds(timer, now);
  if (remaining === null || remaining <= 0) return;

  try {
    const fallback = wording(timer);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title ?? fallback.title,
        body: options.body ?? fallback.body,
        data: { kind: slot },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: remaining,
        repeats: false,
      },
    });
    scheduled.set(slot, id);
  } catch {
    scheduled.delete(slot);
  }
}

/** Cancels a pending chime — the timer was paused, stopped or reset. */
export async function disarmTimerAlert(slot: AlertSlot = 'timer'): Promise<void> {
  const id = scheduled.get(slot);
  if (id === undefined) return;

  scheduled.delete(slot);
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing to do: a notification that cannot be cancelled will simply fire.
  }
}

/**
 * The in-app half of the alert, for a student who is looking at the screen.
 *
 * The scheduled notification still fires and carries the sound; this adds the
 * physical cue, which is the part a person notices without reading anything.
 */
export async function announceTimerFinished(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics are unavailable on web and on some devices. Not worth a message.
  }
}

/** A pattern long enough to notice on a desk: three pulses. */
export const FINISHED_VIBRATION = [0, 500, 250, 500, 250, 500];

/** Buzzes the phone for a finished session, for a student who chose vibration. */
export function vibrateFinished(): void {
  try {
    Vibration.vibrate(FINISHED_VIBRATION);
  } catch {
    // No vibrator (web, some tablets): nothing else to do.
  }
}

/** Test seam: forgets any armed alert without touching the platform. */
export function resetTimerAlert(): void {
  scheduled.clear();
}
