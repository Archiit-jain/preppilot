import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, type KeyboardEvent, type View } from 'react-native';
import { useKeyboardOverlap } from '../use-keyboard-overlap';

type Handler = (event: KeyboardEvent) => void;

const handlers = new Map<string, Handler>();
const removed: string[] = [];

beforeEach(() => {
  handlers.clear();
  removed.length = 0;
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, handler: Handler) => {
    handlers.set(name, handler);
    return { remove: () => removed.push(name) };
  }) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// iOS listens for the Will events and Android for the Did ones.
const find = (suffix: string) =>
  [...handlers.entries()].find(([name]) => name.endsWith(suffix))?.[1] ?? (() => {});
const show = (event: KeyboardEvent) => find('Show')(event);
const hide = (event: KeyboardEvent) => find('Hide')(event);

/** A view whose top is at `y` and which is `height` tall, in window coordinates. */
const viewAt = (y: number, height: number) => ({
  current: {
    measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) =>
      callback(0, y, 400, height),
  } as unknown as View,
});

const keyboardAt = (screenY: number) =>
  ({ endCoordinates: { screenY, height: 300, screenX: 0, width: 400 } }) as KeyboardEvent;

it('is the part of the view the keyboard covers', () => {
  // The view runs from 40 to 740; the keyboard starts at 500.
  const { result } = renderHook(() => useKeyboardOverlap(viewAt(40, 700)));

  act(() => show(keyboardAt(500)));
  expect(result.current).toBe(240);

  act(() => hide(keyboardAt(900)));
  expect(result.current).toBe(0);
});

/** Where the system already resized the window, nothing is covered. */
it('is zero when the keyboard sits below the view', () => {
  const { result } = renderHook(() => useKeyboardOverlap(viewAt(40, 400)));

  act(() => show(keyboardAt(500)));

  expect(result.current).toBe(0);
});

it('ignores a keyboard event once the view has gone', () => {
  const { result } = renderHook(() => useKeyboardOverlap({ current: null }));

  act(() => show(keyboardAt(500)));

  expect(result.current).toBe(0);
});

it('stops listening when unmounted', () => {
  const { unmount } = renderHook(() => useKeyboardOverlap(viewAt(0, 100)));

  unmount();

  expect(removed).toHaveLength(2);
  expect(removed.some((name) => name.endsWith('Show'))).toBe(true);
  expect(removed.some((name) => name.endsWith('Hide'))).toBe(true);
});
