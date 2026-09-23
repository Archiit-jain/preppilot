import type { AppStateStatus } from 'react-native';
import { AUTO_SYNC_INTERVAL_MS, startAutoSync, type AppStateSource } from '../auto-sync';

/** An AppState the test can move between foreground and background. */
function fakeAppState(initial: AppStateStatus = 'active') {
  let listener: ((state: AppStateStatus) => void) | null = null;
  const remove = jest.fn(() => {
    listener = null;
  });

  const source: AppStateSource = {
    currentState: initial,
    addEventListener: (_type, next) => {
      listener = next;
      return { remove };
    },
  };

  return {
    source,
    remove,
    moveTo(state: AppStateStatus) {
      listener?.(state);
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('syncing on a timer', () => {
  it('syncs every five minutes while the app is open', () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    startAutoSync(sync, fakeAppState('active').source);

    jest.advanceTimersByTime(AUTO_SYNC_INTERVAL_MS - 1);
    expect(sync).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(sync).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(AUTO_SYNC_INTERVAL_MS * 2);
    expect(sync).toHaveBeenCalledTimes(3);
  });

  it('is five minutes, as asked for', () => {
    expect(AUTO_SYNC_INTERVAL_MS).toBe(300_000);
  });

  /** A timer in a backgrounded app is unreliable and spends battery for nothing. */
  it('stops while the app is in the background and resumes when it returns', () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    const app = fakeAppState('active');
    startAutoSync(sync, app.source);

    app.moveTo('background');
    sync.mockClear();
    jest.advanceTimersByTime(AUTO_SYNC_INTERVAL_MS * 3);
    expect(sync).not.toHaveBeenCalled();

    app.moveTo('active');
    jest.advanceTimersByTime(AUTO_SYNC_INTERVAL_MS);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('does not start a timer for an app launched into the background', () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    startAutoSync(sync, fakeAppState('background').source);

    jest.advanceTimersByTime(AUTO_SYNC_INTERVAL_MS * 2);

    expect(sync).not.toHaveBeenCalled();
  });
});

describe('syncing when the student leaves', () => {
  it('syncs the moment the app goes to the background', () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    const app = fakeAppState('active');
    startAutoSync(sync, app.source);

    app.moveTo('background');

    expect(sync).toHaveBeenCalledTimes(1);
  });

  /** iOS passes through 'inactive' on its way out; one departure is one sync. */
  it('syncs once for one departure, not once per state it passes through', () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    const app = fakeAppState('active');
    startAutoSync(sync, app.source);

    app.moveTo('inactive');
    app.moveTo('background');

    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('does not sync on coming back to the app', () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    const app = fakeAppState('background');
    startAutoSync(sync, app.source);

    app.moveTo('active');

    expect(sync).not.toHaveBeenCalled();
  });
});

describe('stopping', () => {
  it('stops the timer and stops listening when the student signs out', () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    const app = fakeAppState('active');
    const stop = startAutoSync(sync, app.source);

    stop();
    jest.advanceTimersByTime(AUTO_SYNC_INTERVAL_MS * 3);
    app.moveTo('background');

    expect(sync).not.toHaveBeenCalled();
    expect(app.remove).toHaveBeenCalled();
  });
});
