import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';
import { StudySessionRepository } from '../../../db/repositories/study-sessions';
import { createTestClock, createTestDatabase } from '../../../db/test-support/test-database';
import { renderWithTheme } from '../../../test-utils/render';
import { getRepositories } from '../../../db/client';
import { useAuthStore } from '../../auth/auth-store';
import {
  announceTimerFinished,
  armTimerAlert,
  disarmTimerAlert,
  vibrateFinished,
} from '../../timer/timer-alert';
import { activeCapabilities, focusCapabilities } from '../capabilities';
import { FOCUS_PREFERENCE, FocusScreen } from '../focus-screen';
import {
  configureFocusContext,
  resetFocusStore,
  useFocusStore,
  watchForDistractions,
} from '../focus-store';

jest.mock('../../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: { LANDSCAPE: 5, PORTRAIT_UP: 3 },
}));
jest.mock('../../timer/timer-alert', () => ({
  armTimerAlert: jest.fn().mockResolvedValue(undefined),
  disarmTimerAlert: jest.fn().mockResolvedValue(undefined),
  announceTimerFinished: jest.fn().mockResolvedValue(undefined),
  vibrateFinished: jest.fn(),
}));
jest.mock('../../../db/client', () => ({ getRepositories: jest.fn() }));

const USER = 'user-1';
const NOW = new Date(2026, 7, 24, 10).getTime();

let db: ReturnType<typeof createTestDatabase>;
let clock: ReturnType<typeof createTestClock>;
let sessions: StudySessionRepository;

const focus = () => useFocusStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  db = createTestDatabase();
  clock = createTestClock(NOW);
  sessions = new StudySessionRepository(db, clock);
  resetFocusStore();
  configureFocusContext({ userId: USER, sessions, now: clock.now });
});

afterEach(() => {
  db.$close();
});

describe('capabilities', () => {
  /**
   * PRD §17: "Never claim universal app blocking. Document device/API
   * limitations." The panel is that documentation, so this must stay false.
   */
  it('never claims it can block other apps', () => {
    const blocking = focusCapabilities('android').find((entry) => entry.id === 'blocking');

    expect(blocking?.supported).toBe(false);
    expect(blocking?.detail).toMatch(/does not let PrepPilot block other apps/);
  });

  it('does not claim it can silence other apps', () => {
    expect(focusCapabilities('android').find((entry) => entry.id === 'dnd')?.supported).toBe(false);
  });

  it('claims only what it does: a full-screen timer and its own silence', () => {
    const supported = activeCapabilities('android').map((entry) => entry.id);

    expect(supported).toEqual(
      expect.arrayContaining(['fullscreen', 'quiet', 'awake', 'distractions']),
    );
    expect(supported).not.toContain('blocking');
  });

  /** The browser build cannot keep the screen awake or watch app state. */
  it('reports fewer capabilities on the web', () => {
    const web = focusCapabilities('web');

    expect(web.find((entry) => entry.id === 'awake')?.supported).toBe(false);
    expect(web.find((entry) => entry.id === 'distractions')?.supported).toBe(false);
    expect(web.find((entry) => entry.id === 'fullscreen')?.supported).toBe(true);
  });
});

describe('running a session', () => {
  it('records a study session when it begins', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25 });
    });

    expect(focus().timer?.status).toBe('running');
    expect(await sessions.findById(focus().sessionId!)).toMatchObject({
      status: 'running',
      timerMode: 'custom',
    });
  });

  it('ignores a second start while one is running', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25 });
    });
    const first = focus().sessionId;

    await act(async () => {
      await focus().begin({ minutes: 45 });
    });

    expect(focus().sessionId).toBe(first);
  });

  it('completes the session and reports the time focused', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25 });
    });
    const sessionId = focus().sessionId!;
    clock.advance(600_000);

    await act(async () => {
      await focus().end();
    });

    expect(await sessions.findById(sessionId)).toMatchObject({
      status: 'completed',
      durationSeconds: 600,
    });
    expect(focus().lastSessionSeconds).toBe(600);
  });

  /** Refusing to let someone start studying is worse than losing the record. */
  it('still runs the timer when the session cannot be recorded', async () => {
    jest.spyOn(sessions, 'start').mockRejectedValue(new Error('SQLITE_BUSY'));

    await act(async () => {
      await focus().begin({ minutes: 25 });
    });

    expect(focus().timer?.status).toBe('running');
    expect(focus().error).toMatch(/still running/);
  });

  it('reports a failure to save the finished session', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25 });
    });
    jest.spyOn(sessions, 'complete').mockRejectedValue(new Error('disk full'));

    await act(async () => {
      await focus().end();
    });

    expect(focus().error).toMatch(/could not save this session/);
  });

  it('does nothing when ending with no session', async () => {
    await expect(focus().end()).resolves.toBeUndefined();
  });
});

describe('counting distractions', () => {
  /**
   * The honest substitute for app blocking: PrepPilot cannot stop someone
   * switching away, but it can notice and tell them afterwards.
   */
  it('counts each time the app leaves the foreground', async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as (state: string) => void);
      return { remove: jest.fn() } as never;
    });

    await act(async () => {
      await focus().begin({ minutes: 25 });
    });
    const stop = watchForDistractions();

    act(() => {
      listeners[0]?.('background');
      listeners[0]?.('active');
      listeners[0]?.('background');
    });

    expect(focus().timesLeft).toBe(2);
    stop();
  });

  /** The OS reports intermediate states; one switch away must count once. */
  it('does not count repeated background reports as separate departures', async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as (state: string) => void);
      return { remove: jest.fn() } as never;
    });

    await act(async () => {
      await focus().begin({ minutes: 25 });
    });
    watchForDistractions();

    act(() => {
      listeners[0]?.('inactive');
      listeners[0]?.('background');
    });

    expect(focus().timesLeft).toBe(1);
  });

  it('counts nothing when no session is running', () => {
    act(() => {
      focus().noteLeft();
    });

    expect(focus().timesLeft).toBe(0);
  });

  it('removes its listener when torn down', async () => {
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove } as never);

    watchForDistractions()();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('the screen', () => {
  const render = () => renderWithTheme(<FocusScreen />);

  it('offers durations before starting', () => {
    render();

    expect(screen.getByRole('button', { name: '25 min' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '90 min' })).toBeOnTheScreen();
  });

  it('states plainly that it cannot block other apps', () => {
    render();

    expect(
      screen.getByText(/does not let PrepPilot block other apps|Not possible on this platform/),
    ).toBeOnTheScreen();
  });

  it('starts a session from the chosen duration', async () => {
    render();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: '45 min' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });

    await waitFor(() => expect(focus().timer?.targetSeconds).toBe(45 * 60));
  });

  it('shows the countdown while running', async () => {
    render();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });

    await waitFor(() => expect(screen.getByTestId('focus-readout')).toHaveTextContent('00:25:00'));
  });

  it('shows how many times the student left', async () => {
    render();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });

    act(() => {
      focus().noteLeft();
    });

    await waitFor(() =>
      expect(screen.getByText('You have left PrepPilot 1 time')).toBeOnTheScreen(),
    );
  });

  it('summarises the session once it ends', async () => {
    render();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });
    clock.advance(900_000);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    });

    await waitFor(() => expect(screen.getByText('Session finished')).toBeOnTheScreen());
    expect(screen.getByTestId('focus-summary-time')).toBeOnTheScreen();
    expect(screen.getByTestId('focus-summary-left')).toBeOnTheScreen();
  });

  it('can start another session from the summary', async () => {
    render();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start another' }));
    });

    expect(screen.getByRole('button', { name: 'Start focus session' })).toBeOnTheScreen();
  });
});

describe('the countdown finishing', () => {
  /** A finished session must stop recording, not keep banking time. */
  it('ends itself when the time runs out', async () => {
    jest.useFakeTimers();
    renderWithTheme(<FocusScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: '25 min' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });

    await act(async () => {
      clock.advance(25 * 60 * 1000);
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => expect(focus().timer?.status).toBe('finished'));
    jest.useRealTimers();
  });
});

describe('navigation from the summary', () => {
  it('offers a way back to the tracker', async () => {
    renderWithTheme(<FocusScreen />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Back to tracker' }));
    });

    expect(router.push).toHaveBeenCalledWith('/');
  });
});

describe('errors', () => {
  it('shows a student-facing message before starting', async () => {
    jest.spyOn(sessions, 'start').mockRejectedValue(new Error('SQLITE_BUSY'));
    renderWithTheme(<FocusScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });
    await act(async () => {
      await focus().end();
    });
    act(() => {
      focus().reset();
    });
    // Re-render the idle screen with the error still set.
    act(() => {
      useFocusStore.setState({ error: 'We could not record this session.' });
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen());
  });

  it('dismisses an error', () => {
    act(() => {
      useFocusStore.setState({ error: 'boom' });
      focus().clearError();
    });

    expect(focus().error).toBeNull();
  });
});

describe('using the store before configuration', () => {
  it('fails with an actionable message', async () => {
    resetFocusStore();

    await expect(focus().begin({ minutes: 25 })).rejects.toThrow(/configureFocusContext/);
  });
});

describe('pausing', () => {
  it('pauses and resumes, keeping the time already focused', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25, alert: 'silent' });
    });
    clock.advance(60_000);
    await act(async () => {
      await focus().pause();
    });
    clock.advance(10 * 60_000);
    await act(async () => {
      await focus().resume();
    });

    expect(focus().timer?.status).toBe('running');
    expect(focus().timer?.bankedSeconds).toBe(60);
  });

  it('ignores pause when not running and resume when not paused', async () => {
    await act(async () => {
      await focus().pause();
      await focus().resume();
    });

    expect(focus().timer).toBeNull();
  });

  it('carries on when progress cannot be saved', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25 });
    });
    jest.spyOn(sessions, 'heartbeat').mockRejectedValue(new Error('busy'));

    await act(async () => {
      await focus().pause();
      await focus().resume();
    });

    expect(focus().timer?.status).toBe('running');
  });

  it('does not start a second session while one is paused', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25 });
      await focus().pause();
      await focus().begin({ minutes: 45 });
    });

    expect(focus().timer?.targetSeconds).toBe(25 * 60);
  });
});

describe('the end alert', () => {
  it('schedules a sound for sound alerts, and moves it when paused', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25, alert: 'sound' });
    });
    expect(armTimerAlert).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Number),
      expect.objectContaining({ slot: 'focus' }),
    );

    await act(async () => {
      await focus().pause();
      await focus().resume();
    });
    expect(disarmTimerAlert).toHaveBeenCalledWith('focus');
    expect(armTimerAlert).toHaveBeenCalledTimes(2);
  });

  it('schedules nothing for vibration or silence', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25, alert: 'vibrate' });
      await focus().pause();
      await focus().resume();
    });

    expect(armTimerAlert).not.toHaveBeenCalled();
  });

  it('vibrates when time runs out, if chosen', async () => {
    await act(async () => {
      await focus().begin({ minutes: 1, alert: 'vibrate' });
    });
    clock.advance(60_000);
    await act(async () => {
      await focus().end();
    });

    expect(vibrateFinished).toHaveBeenCalled();
    expect(announceTimerFinished).toHaveBeenCalled();
  });

  it('stays quiet when ended early, or when silent', async () => {
    await act(async () => {
      await focus().begin({ minutes: 25, alert: 'both' });
      await focus().end();
    });
    expect(vibrateFinished).not.toHaveBeenCalled();
    expect(disarmTimerAlert).toHaveBeenCalledWith('focus');

    act(() => focus().reset());
    await act(async () => {
      await focus().begin({ minutes: 1, alert: 'silent' });
    });
    clock.advance(60_000);
    await act(async () => {
      await focus().end();
    });
    expect(vibrateFinished).not.toHaveBeenCalled();
  });
});

describe('choosing how a session runs', () => {
  const preferences = { get: jest.fn(), set: jest.fn() };

  beforeEach(() => {
    preferences.get.mockResolvedValue(null);
    preferences.set.mockResolvedValue(undefined);
    jest.mocked(getRepositories).mockReturnValue({ preferences } as never);
    useAuthStore.setState({ user: { id: USER } as never });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  const startNow = async () => {
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start focus session' }));
    });
  };

  it('opens on the settings saved last time', async () => {
    preferences.get.mockResolvedValue(
      JSON.stringify({ presets: [20, 50], minutes: 50, alert: 'silent', keepAwake: false }),
    );
    renderWithTheme(<FocusScreen />);

    await waitFor(() => expect(screen.getByRole('button', { name: '50 min' })).toBeSelected());
    expect(screen.queryByRole('button', { name: '25 min' })).toBeNull();
    expect(screen.getByTestId('focus-alert-silent')).toBeSelected();
  });

  it('takes any exact length, and refuses one out of range', async () => {
    renderWithTheme(<FocusScreen />);
    const field = screen.getByLabelText('Or type an exact length (minutes)');

    fireEvent.changeText(field, '500');
    fireEvent(field, 'submitEditing');
    expect(screen.getByText('Enter a whole number from 1 to 240.')).toBeOnTheScreen();

    fireEvent.changeText(field, '37');
    fireEvent(field, 'submitEditing');
    fireEvent(field, 'blur');
    await startNow();

    expect(focus().timer?.targetSeconds).toBe(37 * 60);
    expect(preferences.set).toHaveBeenCalledWith(
      USER,
      FOCUS_PREFERENCE,
      expect.stringContaining('"minutes":37'),
    );
  });

  it('steps the length in fives', async () => {
    renderWithTheme(<FocusScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Increase Length' }));
    await startNow();

    expect(focus().timer?.targetSeconds).toBe(30 * 60);
  });

  it('saves a length as a preset, and removes it again', () => {
    renderWithTheme(<FocusScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Increase Length' }));

    fireEvent.press(screen.getByTestId('focus-save-preset'));
    expect(screen.getByRole('button', { name: '30 min' })).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('focus-remove-preset'));
    expect(screen.queryByRole('button', { name: '30 min' })).toBeNull();
  });

  it('says when the presets are full', async () => {
    preferences.get.mockResolvedValue(
      JSON.stringify({ presets: [5, 10, 15, 20, 25, 30], minutes: 37 }),
    );
    renderWithTheme(<FocusScreen />);

    await waitFor(() => expect(screen.getByTestId('focus-presets-full')).toBeOnTheScreen());
  });

  it('remembers the alert and screen choices, and starts with them', async () => {
    renderWithTheme(<FocusScreen />);

    fireEvent.press(screen.getByTestId('focus-alert-vibrate'));
    expect(screen.getByText(/Vibration only works while PrepPilot is open/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Keep the screen on during a session' }));
    await startNow();

    expect(focus().alert).toBe('vibrate');
    expect(preferences.set).toHaveBeenLastCalledWith(
      USER,
      FOCUS_PREFERENCE,
      expect.stringContaining('"keepAwake":false'),
    );
  });

  it('still works when settings cannot be read or saved', async () => {
    preferences.get.mockRejectedValue(new Error('locked'));
    renderWithTheme(<FocusScreen />);
    await act(async () => {
      await Promise.resolve();
    });
    jest.mocked(getRepositories).mockImplementation(() => {
      throw new Error('not open');
    });

    fireEvent.press(screen.getByTestId('focus-alert-silent'));

    expect(screen.getByTestId('focus-alert-silent')).toBeSelected();
  });

  it('pauses, resumes and goes full screen while running', async () => {
    renderWithTheme(<FocusScreen />);
    await startNow();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    });
    expect(focus().timer?.status).toBe('paused');
    expect(screen.getByText(/· paused/)).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('focus-fullscreen'));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Resume timer' }));
    });
    expect(focus().timer?.status).toBe('running');

    act(() => {
      useFocusStore.setState({ timesLeft: 2 });
    });
    expect(screen.getByText('Left PrepPilot 2 times')).toBeOnTheScreen();
    act(() => {
      useFocusStore.setState({ timesLeft: 1 });
    });
    expect(screen.getByText('Left PrepPilot 1 time')).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Leave full screen' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    });
    expect(focus().timer?.status).toBe('running');
  });
});
