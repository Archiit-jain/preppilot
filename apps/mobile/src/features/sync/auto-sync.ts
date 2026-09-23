import { AppState, type AppStateStatus } from 'react-native';

/** How often to sync while the app is open. */
export const AUTO_SYNC_INTERVAL_MS = 5 * 60_000;

/** The part of React Native's AppState this module uses, so tests can drive it. */
export interface AppStateSource {
  readonly currentState: AppStateStatus | null;
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void,
  ): { remove: () => void };
}

/**
 * Keeps a signed-in device in step with the server without being asked.
 *
 * Two triggers, on top of the sync made on sign-in and the one made when the
 * connection returns:
 *
 * - **Every five minutes while the app is open**, so work done on another
 *   device appears here without a trip to Settings.
 * - **The moment the student leaves the app.** Leaving is when unsent work is
 *   most at risk: the app may not be opened again for days, or may be removed.
 *   Android gives a backgrounded app only a short while, so this is a best
 *   effort — anything it does not finish stays pending and goes on the next
 *   sync, because rows are only marked sent once the server has them.
 *
 * The timer runs only while the app is in the foreground. A backgrounded
 * JavaScript timer is unreliable on both platforms, and syncing a device the
 * student is not looking at spends their battery and data for nothing.
 *
 * Overlapping calls are harmless: the store ignores a sync while one is running.
 */
export function startAutoSync(
  sync: () => Promise<unknown>,
  appState: AppStateSource = AppState,
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let current: AppStateStatus | null = appState.currentState;

  const startTimer = () => {
    if (timer !== null) return;
    timer = setInterval(() => void sync(), AUTO_SYNC_INTERVAL_MS);
  };

  const stopTimer = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  if (current === 'active') startTimer();

  const subscription = appState.addEventListener('change', (next) => {
    const previous = current;
    current = next;

    if (next === 'active') {
      startTimer();
      return;
    }

    stopTimer();
    // Only on the way out of the foreground. iOS passes through 'inactive' on
    // its way to 'background', and syncing on both would send the same work
    // twice for one departure.
    if (previous === 'active') void sync();
  });

  return () => {
    stopTimer();
    subscription.remove();
  };
}
