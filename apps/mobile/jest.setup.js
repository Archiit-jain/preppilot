/* eslint-env jest */
// react-native-reanimated is handled by the jest-expo preset. Its own `/mock`
// entry point is not compatible with the version in use and breaks on load.

// expo-router's navigation internals do not parse under the Jest transform, and
// tests assert on navigation intent rather than on real screen transitions.
//
// The factory deliberately creates no elements. NativeWind's babel preset
// rewrites element creation to use an injected helper, which Jest rejects as an
// out-of-scope variable inside a mock factory.
jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismiss: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  };

  const nothing = () => null;

  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    usePathname: jest.fn(() => '/'),
    useSegments: jest.fn(() => []),
    // On a screen's first focus this is exactly `useEffect`, and a standalone
    // render in a test is a screen being focused once. A no-op here would mean
    // no screen ever loaded its data.
    useFocusEffect: (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useEffect } = require('react');
      useEffect(callback, [callback]);
    },
    Redirect: nothing,
    Stack: Object.assign(nothing, { Screen: nothing }),
    Tabs: Object.assign(nothing, { Screen: nothing }),
    // Every Link in the app uses `asChild`, so returning the child is faithful.
    Link: ({ children }) => children,
  };
});

// The Google sign-in native module has no implementation under Jest, and the
// package does not export its own mock. This mirrors the few helpers the app
// uses; tests that exercise sign-in pass their own account picker instead.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(async () => null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
  isErrorWithCode: (error) => error !== null && typeof error === 'object' && 'code' in error,
  isCancelledResponse: (response) => response?.type === 'cancelled',
  isSuccessResponse: (response) => response?.type === 'success',
}));
