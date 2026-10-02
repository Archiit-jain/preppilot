import { useEffect, useState } from 'react';
import { useThemePackStore } from './theme-pack-store';

/** Past this, the app opens in Classic rather than keep the student waiting. */
export const THEME_RESTORE_TIMEOUT_MS = 2_500;

/**
 * Re-applies the downloaded theme chosen last time before the first screen draws.
 *
 * Waiting avoids a flash of Classic followed by a jump to the theme. The wait is
 * bounded: restoring reads local files only, but a launch must never hang on a
 * cosmetic choice, so after the timeout the app opens regardless.
 */
export function useRestoredTheme(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setReady(true);
    };
    const timer = setTimeout(finish, THEME_RESTORE_TIMEOUT_MS);
    void useThemePackStore
      .getState()
      .restore()
      .finally(() => {
        clearTimeout(timer);
        finish();
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return ready;
}
