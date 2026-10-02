import type { FaceReadout } from '@preppilot/shared';
import type { SharedValue } from 'react-native-reanimated';

export interface FaceProps {
  readonly readout: FaceReadout;
  /**
   * How far through, 0..1, moving continuously rather than once a second.
   * Anything that drains or fills is drawn from this; only digits use `readout`.
   */
  readonly progress: SharedValue<number>;
  /** The subject's colour, or the theme accent for unattached sessions. */
  readonly accent: string;
  readonly width: number;
  readonly height: number;
  /** Animations (waves, trickling sand) move only while the timer runs. */
  readonly running: boolean;
}

/**
 * Each face has its own fixed palette, chosen for being looked at across a
 * desk for an hour, not the app theme's: a full-screen clock is a different
 * object from a settings screen. `ink` is what the controls on top are drawn in.
 */
export interface FacePalette {
  readonly background: string;
  readonly ink: string;
  readonly muted: string;
}

/** The share still to go for a countdown, the share done for a stopwatch. */
export function shownFraction(progress: number, countsDown: boolean): number {
  'worklet';
  const clamped = Math.min(1, Math.max(0, progress));
  return countsDown ? 1 - clamped : clamped;
}
