import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, Platform, type KeyboardEvent, type View } from 'react-native';

/**
 * How far the on-screen keyboard covers the bottom of a view, in points.
 *
 * `KeyboardAvoidingView` works this out from the view's layout *relative to its
 * parent*, which inside a screen below the status bar and above a tab bar is not
 * where the view actually is — so it lifted the assistant's composer by less than
 * the keyboard covered, and the text box stayed half hidden. Measuring the view
 * in window coordinates, the same space the keyboard's position is reported in,
 * gives the real overlap wherever the view sits, whether or not the system also
 * resized the window.
 *
 * Give the returned value to the view as bottom padding.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    // iOS announces the keyboard before it moves, so the padding animates with
    // it; Android only reports after, including when its height changes.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      const keyboardTop = event.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _width, height) => {
        setOverlap(Math.max(0, Math.round(y + height - keyboardTop)));
      });
    };

    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, () => setOverlap(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);

  return overlap;
}
