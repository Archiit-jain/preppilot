import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Turning the phone for the full-screen timer.
 *
 * The rest of the app is portrait-only (app.json), so landscape is asked for
 * only while the full-screen timer is open and portrait is restored when it
 * closes. Both are best-effort: a browser or device that refuses still shows
 * the timer, laid out for whatever shape the screen is.
 */
export async function enterLandscape(): Promise<void> {
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } catch {
    // Not supported here; the faces lay out for the current shape instead.
  }
}

export async function leaveLandscape(): Promise<void> {
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    // Nothing to restore.
  }
}
