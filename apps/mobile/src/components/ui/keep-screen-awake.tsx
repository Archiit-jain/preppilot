import { useKeepAwake } from 'expo-keep-awake';

/**
 * Keeps the screen on for as long as this is rendered.
 *
 * A component rather than a call to `useKeepAwake`, because the hook always
 * activates once called — passing no tag does not switch it off. Rendering this
 * conditionally is how the screen is kept awake only when it should be.
 */
export function KeepScreenAwake({ tag }: { readonly tag: string }) {
  useKeepAwake(tag);
  return null;
}
