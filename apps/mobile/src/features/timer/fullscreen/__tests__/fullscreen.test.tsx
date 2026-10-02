import { createTimer, pause, start, TIMER_FACES, type TimerState } from '@preppilot/shared';
import * as ScreenOrientation from 'expo-screen-orientation';
import { act, fireEvent, renderHook, renderWithTheme, screen } from '../../../../test-utils/render';
import { getRepositories } from '../../../../db/client';
import { useAuthStore } from '../../../auth/auth-store';
import { minutesLabel, wedgePath } from '../faces/wedge-face';
import { shownFraction } from '../faces/types';
import { useSmoothProgress } from '../smooth-progress';
import { CONTROLS_VISIBLE_MS, FullScreenTimer } from '../fullscreen-timer';
import { enterLandscape, leaveLandscape } from '../orientation';
import { resetTimerFaceStore, TIMER_FACE_PREFERENCE, useTimerFaceStore } from '../timer-face-store';

jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: { LANDSCAPE: 5, PORTRAIT_UP: 3 },
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('../../../../db/client', () => ({ getRepositories: jest.fn() }));
jest.mock('../../../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));

const T0 = 1_700_000_000_000;
const lock = jest.mocked(ScreenOrientation.lockAsync);
const preferences = { get: jest.fn(), set: jest.fn() };

const countdown = (status: 'idle' | 'running' | 'paused' = 'running'): TimerState => {
  const idle = createTimer({ mode: 'custom', targetSeconds: 25 * 60 });
  if (status === 'idle') return idle;
  const running = start(idle, T0);
  return status === 'running' ? running : pause(running, T0 + 60_000);
};

function show(
  timer: TimerState,
  now = T0 + 1000,
  extra: Partial<Parameters<typeof FullScreenTimer>[0]> = {},
) {
  const onToggle = jest.fn();
  const onClose = jest.fn();
  const view = renderWithTheme(
    <FullScreenTimer
      visible
      timer={timer}
      now={now}
      title="Optics"
      detail="Focus · interval 1"
      accent="#3B82F6"
      onToggle={onToggle}
      onClose={onClose}
      {...extra}
    />,
  );
  return { onToggle, onClose, ...view };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  resetTimerFaceStore();
  preferences.get.mockResolvedValue(null);
  preferences.set.mockResolvedValue(undefined);
  jest.mocked(getRepositories).mockReturnValue({ preferences } as never);
  useAuthStore.setState({ user: { id: 'u1' } as never });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the full-screen timer', () => {
  it('renders nothing until asked for', () => {
    renderWithTheme(
      <FullScreenTimer
        visible={false}
        timer={countdown()}
        now={T0}
        title="Optics"
        accent="#000000"
        onToggle={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('fullscreen-timer')).toBeNull();
  });

  it('turns to landscape while open and back to portrait when closed', () => {
    const { unmount } = show(countdown());

    expect(lock).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.LANDSCAPE);
    unmount();
    expect(lock).toHaveBeenLastCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  });

  it('pauses with a tap anywhere', () => {
    const { onToggle } = show(countdown());

    fireEvent.press(screen.getByRole('button', { name: 'Pause timer' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('names the tap for each state, and says what a tap will do', () => {
    show(countdown('paused'));
    expect(screen.getByRole('button', { name: 'Resume timer' })).toBeOnTheScreen();
    expect(screen.getByTestId('fullscreen-status')).toHaveTextContent(/tap anywhere to resume/);
  });

  it('starts an idle timer with a tap', () => {
    const { onToggle } = show(countdown('idle'));

    expect(screen.getByTestId('fullscreen-status')).toHaveTextContent('Tap anywhere to start');
    fireEvent.press(screen.getByRole('button', { name: 'Start timer' }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('closes on a tap once the time is up', () => {
    const finished = { ...countdown(), status: 'finished' as const, startedAt: null };
    const { onClose, onToggle } = show(finished);

    fireEvent.press(screen.getByRole('button', { name: 'Close full screen' }));

    expect(onClose).toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('shows its controls briefly, then gets out of the way while running', () => {
    show(countdown());
    expect(screen.getByText('Optics')).toBeOnTheScreen();
    expect(screen.getByText('Focus · interval 1')).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(CONTROLS_VISIBLE_MS);
    });
    expect(screen.queryByTestId('fullscreen-close')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Pause timer' }));
    expect(screen.getByTestId('fullscreen-close')).toBeOnTheScreen();
  });

  it('keeps its controls up while paused', () => {
    show(countdown('paused'));

    act(() => {
      jest.advanceTimersByTime(CONTROLS_VISIBLE_MS * 2);
    });

    expect(screen.getByTestId('fullscreen-close')).toBeOnTheScreen();
  });

  it('closes from the close button', () => {
    const { onClose } = show(countdown(), T0, { detail: null });

    fireEvent.press(screen.getByRole('button', { name: 'Leave full screen' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('switches face and remembers the choice', async () => {
    show(countdown());
    expect(screen.getByTestId('face-flip')).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Hourglass face' }));
    });

    expect(screen.getByTestId('face-hourglass')).toBeOnTheScreen();
    expect(preferences.set).toHaveBeenCalledWith('u1', TIMER_FACE_PREFERENCE, 'hourglass');
  });
});

describe.each(TIMER_FACES)('the %s face', (face) => {
  it.each([
    ['a running countdown', countdown('running')],
    ['a paused countdown', countdown('paused')],
    ['a stopwatch', start(createTimer({ mode: 'stopwatch' }), T0)],
  ])('draws %s', (_name, timer) => {
    useTimerFaceStore.setState({ face });
    show(timer, T0 + 90_000);

    expect(screen.getByTestId(`face-${face}`)).toBeOnTheScreen();
  });

  it('draws the very start and the very end', () => {
    useTimerFaceStore.setState({ face });
    const timer = countdown('running');
    const { rerender } = show(timer, T0);
    expect(screen.getByTestId(`face-${face}`)).toBeOnTheScreen();

    rerender(
      <FullScreenTimer
        visible
        timer={timer}
        now={T0 + 25 * 60_000}
        title="Optics"
        accent="#3B82F6"
        onToggle={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByTestId(`face-${face}`)).toBeOnTheScreen();
  });
});

describe('the flip cards', () => {
  it('flips the old digit over when one changes, then settles', () => {
    const timer = countdown();
    const { rerender } = show(timer, T0 + 1000);
    expect(screen.queryAllByTestId('flip-flap')).toHaveLength(0);

    rerender(
      <FullScreenTimer
        visible
        timer={timer}
        now={T0 + 2000}
        title="Optics"
        accent="#3B82F6"
        onToggle={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('flip-flap').length).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.queryAllByTestId('flip-flap')).toHaveLength(0);
  });

  it('adds an hour card past sixty minutes', () => {
    show(start(createTimer({ mode: 'custom', targetSeconds: 2 * 3600 }), T0), T0);

    expect(screen.getAllByTestId('flip-digit')).toHaveLength(5);
  });
});

describe('the time wedge', () => {
  it('draws a slice from twelve o’clock', () => {
    expect(wedgePath(50, 40, 0.25)).toBe('M 50 50 L 50 10 A 40 40 0 0 1 90 50 Z');
    expect(wedgePath(50, 40, 0.75)).toContain(' 0 1 1 ');
  });

  it('draws a whole disc, and nothing at all, at the two ends', () => {
    expect(wedgePath(50, 40, 1)).toBe('M 50 10 A 40 40 0 1 1 50 90 A 40 40 0 1 1 50 10 Z');
    expect(wedgePath(50, 40, 0)).toBe('M 50 50 Z');
  });

  it('counts whole minutes left, and minutes in for a stopwatch', () => {
    expect(minutesLabel(61, true)).toBe('2 min left');
    expect(minutesLabel(0, true)).toBe('0 min left');
    expect(minutesLabel(119, false)).toBe('1 min in');
  });
});

describe('remembering the face', () => {
  it('loads the face chosen last time', async () => {
    preferences.get.mockResolvedValue('tide');

    await useTimerFaceStore.getState().load('u1');

    expect(useTimerFaceStore.getState().face).toBe('tide');
  });

  it('keeps the current face when nothing can be read, or nobody is signed in', async () => {
    preferences.get.mockRejectedValue(new Error('locked'));
    await useTimerFaceStore.getState().load('u1');
    await useTimerFaceStore.getState().load(null);

    expect(useTimerFaceStore.getState().face).toBe('flip');
  });

  it('applies a choice even when it cannot be saved', async () => {
    preferences.set.mockRejectedValue(new Error('locked'));
    await useTimerFaceStore.getState().choose('ring', 'u1');
    await useTimerFaceStore.getState().choose('minimal', null);

    expect(useTimerFaceStore.getState().face).toBe('minimal');
  });
});

describe('turning the screen', () => {
  it('carries on when the device refuses', async () => {
    lock.mockRejectedValue(new Error('unsupported'));

    await expect(enterLandscape()).resolves.toBeUndefined();
    await expect(leaveLandscape()).resolves.toBeUndefined();
  });
});

describe('smooth progress', () => {
  it('holds the exact value while paused', () => {
    const paused = countdown('paused');
    const { result } = renderHook(() => useSmoothProgress(paused, T0 + 500_000));

    expect(result.current.value).toBeCloseTo(60 / 1500);
  });

  it('glides towards the end while running', () => {
    const { result } = renderHook(() => useSmoothProgress(countdown(), T0 + 1000));
    const before = result.current.value;

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    // Moving between readings, not waiting for the next one.
    expect(result.current.value).toBeGreaterThan(before);
    expect(result.current.value).toBeLessThanOrEqual(1);
  });

  it('jumps rather than glides when it is far from the truth', () => {
    const stopwatch = start(createTimer({ mode: 'stopwatch' }), T0);
    const { result, rerender } = renderHook(
      ({ now }: { now: number }) => useSmoothProgress(stopwatch, now),
      { initialProps: { now: T0 } },
    );
    rerender({ now: T0 + 3600_000 + 900_000 });

    expect(result.current.value).toBeCloseTo(0.25, 2);
  });

  it('shows the share left for a countdown and the share done for a stopwatch', () => {
    expect(shownFraction(0.25, true)).toBe(0.75);
    expect(shownFraction(0.25, false)).toBe(0.25);
    expect(shownFraction(1.5, false)).toBe(1);
    expect(shownFraction(-1, true)).toBe(1);
  });
});
