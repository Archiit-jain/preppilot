import { elapsedSeconds, remainingSeconds, type TimerState } from './timer';

/**
 * Focus Mode's settings, and what the full-screen timer faces draw.
 *
 * Stored per device as JSON in the preferences table. A stored value is read
 * leniently: one bad field falls back to its default rather than throwing the
 * student's other choices away.
 */

/** Any whole number of minutes in this range. */
export const FOCUS_LIMITS = { min: 1, max: 240 } as const;

/** How many lengths a student can keep as one-tap presets. */
export const MAX_FOCUS_PRESETS = 6;

/**
 * What happens when a focus session ends.
 *
 * Sound needs a notification (Android plays it through the notification
 * channel); vibration is felt in the app. Silent does neither.
 */
export const FOCUS_ALERTS = ['both', 'sound', 'vibrate', 'silent'] as const;
export type FocusAlert = (typeof FOCUS_ALERTS)[number];

export interface FocusSettings {
  /** Lengths in minutes, ascending, no repeats. */
  readonly presets: readonly number[];
  /** The length chosen last time, so the screen opens on it. */
  readonly minutes: number;
  readonly alert: FocusAlert;
  readonly keepAwake: boolean;
}

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  presets: [25, 45, 60, 90],
  minutes: 25,
  alert: 'both',
  keepAwake: true,
};

/** A whole number of minutes within the limits, or null. */
export function toFocusMinutes(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof number !== 'number' || !Number.isInteger(number)) return null;
  return number >= FOCUS_LIMITS.min && number <= FOCUS_LIMITS.max ? number : null;
}

function cleanPresets(values: readonly unknown[]): number[] {
  const minutes = values.map(toFocusMinutes).filter((value): value is number => value !== null);
  return [...new Set(minutes)].sort((a, b) => a - b).slice(0, MAX_FOCUS_PRESETS);
}

export function parseFocusSettings(stored: string | null): FocusSettings {
  if (stored === null) return DEFAULT_FOCUS_SETTINGS;
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return DEFAULT_FOCUS_SETTINGS;
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_FOCUS_SETTINGS;
  }

  return {
    // An empty list is a real choice (the student removed every preset).
    presets: Array.isArray(raw.presets)
      ? cleanPresets(raw.presets)
      : DEFAULT_FOCUS_SETTINGS.presets,
    minutes: toFocusMinutes(raw.minutes) ?? DEFAULT_FOCUS_SETTINGS.minutes,
    alert: (FOCUS_ALERTS as readonly unknown[]).includes(raw.alert)
      ? (raw.alert as FocusAlert)
      : DEFAULT_FOCUS_SETTINGS.alert,
    keepAwake:
      typeof raw.keepAwake === 'boolean' ? raw.keepAwake : DEFAULT_FOCUS_SETTINGS.keepAwake,
  };
}

export function serialiseFocusSettings(settings: FocusSettings): string {
  return JSON.stringify(settings);
}

/** Adds a preset. Returns the settings unchanged when it exists or the list is full. */
export function addFocusPreset(settings: FocusSettings, minutes: number): FocusSettings {
  const valid = toFocusMinutes(minutes);
  if (valid === null || settings.presets.includes(valid)) return settings;
  if (settings.presets.length >= MAX_FOCUS_PRESETS) return settings;
  return { ...settings, presets: cleanPresets([...settings.presets, valid]) };
}

export function removeFocusPreset(settings: FocusSettings, minutes: number): FocusSettings {
  return { ...settings, presets: settings.presets.filter((value) => value !== minutes) };
}

/* ------------------------------------------------------------------------- */
/* Full-screen timer faces                                                    */
/* ------------------------------------------------------------------------- */

export const TIMER_FACES = ['flip', 'minimal', 'ring', 'wedge', 'hourglass', 'tide'] as const;
export type TimerFace = (typeof TIMER_FACES)[number];

export const DEFAULT_TIMER_FACE: TimerFace = 'flip';

export const TIMER_FACE_NAMES: Readonly<Record<TimerFace, string>> = {
  flip: 'Flip cards',
  minimal: 'Minimal',
  ring: 'Ring',
  wedge: 'Time wedge',
  hourglass: 'Hourglass',
  tide: 'Rising tide',
};

export function parseTimerFace(stored: string | null): TimerFace {
  return (TIMER_FACES as readonly (string | null)[]).includes(stored)
    ? (stored as TimerFace)
    : DEFAULT_TIMER_FACE;
}

/** A stopwatch has no end, so its faces go round once an hour instead. */
export const STOPWATCH_CYCLE_SECONDS = 3600;

export interface FaceReadout {
  /** The number shown: time left for a countdown, time so far for a stopwatch. */
  readonly seconds: number;
  readonly countsDown: boolean;
  /** How far through, 0 at the start to 1 at the end (or the top of the hour). */
  readonly fraction: number;
  /** The digit groups to draw: `['24', '59']`, or `['1', '05', '00']` past an hour. */
  readonly groups: readonly string[];
}

export function clockGroups(seconds: number): string[] {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? [String(hours), pad(minutes), pad(secs)] : [pad(minutes), pad(secs)];
}

/** Everything a face needs to draw this moment of the timer. */
export function faceReadout(timer: TimerState, now: number): FaceReadout {
  const remaining = remainingSeconds(timer, now);
  const elapsed = elapsedSeconds(timer, now);

  if (remaining === null) {
    return {
      seconds: elapsed,
      countsDown: false,
      fraction: (elapsed % STOPWATCH_CYCLE_SECONDS) / STOPWATCH_CYCLE_SECONDS,
      groups: clockGroups(elapsed),
    };
  }

  // A countdown always has a target: remaining time is measured against it.
  const total = timer.targetSeconds as number;
  return {
    seconds: remaining,
    countsDown: true,
    fraction: total > 0 ? Math.min(1, Math.max(0, (total - remaining) / total)) : 1,
    groups: clockGroups(remaining),
  };
}
