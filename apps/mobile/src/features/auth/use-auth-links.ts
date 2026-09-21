import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { useAuthStore } from './auth-store';

/**
 * Listens for confirmation links opening the app.
 *
 * Both halves are needed, and for different journeys: a student who taps the
 * link while PrepPilot is closed arrives through `getInitialURL`, and one who
 * left it open in the background arrives through the listener. Handling only the
 * second is the classic version of this bug — it works in testing, where the app
 * is always already running, and fails for everyone installing it fresh.
 *
 * Links that carry nothing of ours are ignored by the store, so this can watch
 * every link the scheme receives without claiming them all.
 */
export function useAuthLinks(): void {
  useEffect(() => {
    let cancelled = false;
    const handle = (url: string | null) => {
      if (cancelled || url === null) return;
      void useAuthStore.getState().completeAuthLink(url);
    };

    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', (event) => handle(event.url));

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
