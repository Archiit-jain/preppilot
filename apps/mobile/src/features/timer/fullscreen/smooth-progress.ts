import { faceReadout, STOPWATCH_CYCLE_SECONDS, type TimerState } from '@preppilot/shared';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * A timer's progress as a value that glides.
 *
 * The screen only learns the time once a second, so anything drawn straight
 * from that moved in visible steps. Here each second's reading starts a linear
 * animation to the end of the session, timed to arrive exactly when the timer
 * does; the next reading re-aims it, so it never drifts. Paused, it holds the
 * exact value. Runs on the UI thread, so a sixty-minute glide costs nothing.
 */
export function useSmoothProgress(timer: TimerState, now: number): SharedValue<number> {
  const readout = faceReadout(timer, now);
  const progress = useSharedValue(readout.fraction);
  const running = timer.status === 'running';
  // A stopwatch's hour starts over; the glide must restart with it.
  const lap = readout.countsDown ? 0 : Math.floor(readout.seconds / STOPWATCH_CYCLE_SECONDS);

  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      progress.value = readout.fraction;
      return;
    }
    const left = readout.countsDown
      ? readout.seconds
      : STOPWATCH_CYCLE_SECONDS - (readout.seconds % STOPWATCH_CYCLE_SECONDS);
    // A new session, a new lap of the hour, or a resume after a long pause:
    // jump to where the timer is rather than gliding the long way there.
    if (Math.abs(progress.value - readout.fraction) > 0.02) progress.value = readout.fraction;
    progress.value = withTiming(1, {
      duration: left * 1000,
      easing: Easing.linear,
      // This is the clock itself, not decoration: with "reduce motion" on it
      // would otherwise jump straight to the end of the session.
      reduceMotion: ReduceMotion.Never,
    });
    // Re-aimed on every reading; `readout` is derived from these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, running, lap, timer.targetSeconds, progress]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  return progress;
}
