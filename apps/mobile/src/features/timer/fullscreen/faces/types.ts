import type { FaceReadout } from '@preppilot/shared';

export interface FaceProps {
  readonly readout: FaceReadout;
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

/** The fraction of the session still to go — what a draining face shows. */
export function remainingFraction(readout: FaceReadout): number {
  return readout.countsDown ? 1 - readout.fraction : readout.fraction;
}
