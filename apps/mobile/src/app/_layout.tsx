// First import in the app: identifiers are generated the moment anything is
// written, including while the database is still being seeded.
import { installCryptoPolyfill } from '../lib/install-crypto';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthGate } from '../features/auth/auth-gate';
import { interFonts } from '../theme/fonts';
import { configureNotificationHandler } from '../features/reminders/notifications';
import { useRestoredTheme } from '../theme/packs/use-restored-theme';
import { ThemeProvider, useTheme } from '../theme/theme-context';

function RootStack() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </>
  );
}

installCryptoPolyfill();

// Runs once at module load: a reminder should be visible even while the app
// is open, which is not the default.
configureNotificationHandler();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(interFonts);
  // A downloaded theme is re-applied before the first frame, so it does not
  // open in Classic and then jump.
  const themeRestored = useRestoredTheme();

  // Rendering before the faces load shows a flash of the platform default at
  // different metrics, and everything reflows once Inter arrives.
  if (!fontsLoaded || !themeRestored) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthGate>
          <RootStack />
        </AuthGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
