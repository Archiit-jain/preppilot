import { act, renderHook } from '@testing-library/react-native';
import { fireEvent, renderWithTheme, screen } from '../../../test-utils/render';
import { loadPack } from '../../../test-utils/theme-packs';
import { themesBaseUrl } from '../../../config/env';
import { resetThemePackStore, useThemePackStore } from '../../../theme/packs/theme-pack-store';
import {
  THEME_RESTORE_TIMEOUT_MS,
  useRestoredTheme,
} from '../../../theme/packs/use-restored-theme';
import { formatDownloadSize, ThemePicker } from '../components/theme-picker';

const notebook = loadPack('notebook');
const entry = (id: string, name: string, version = 1) => ({
  id,
  name,
  description: `${name} look.`,
  version,
  sizeBytes: 770_000,
  preview: { background: '#FBF6EA', surface: '#FFFDF7', accent: '#2450B8', text: '#1F2A3C' },
  pack: `packs/${id}.json`,
});

const actions = {
  loadCatalog: jest.fn(),
  install: jest.fn(),
  apply: jest.fn(),
  useClassic: jest.fn(),
  remove: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  resetThemePackStore();
  useThemePackStore.setState({ ...actions, catalogStatus: 'ready' });
});

describe('the themes in Settings', () => {
  it('fetches the list the first time it is shown', () => {
    useThemePackStore.setState({ catalogStatus: 'idle' });

    renderWithTheme(<ThemePicker />);

    expect(actions.loadCatalog).toHaveBeenCalledTimes(1);
  });

  it('shows Classic in use, and offers each theme with its download size', () => {
    useThemePackStore.setState({ catalog: [entry('notebook', 'Notebook')] });

    renderWithTheme(<ThemePicker />);

    expect(screen.getByTestId('theme-row-classic')).toHaveTextContent(/In use/);
    expect(screen.getByText('752 KB download')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('theme-download-notebook'));
    expect(actions.install).toHaveBeenCalledWith(entry('notebook', 'Notebook'));
  });

  it('offers to use or remove a downloaded theme, and to go back to Classic', () => {
    useThemePackStore.setState({
      catalog: [entry('notebook', 'Notebook')],
      installed: { notebook: { pack: notebook, fonts: {} } },
    });

    renderWithTheme(<ThemePicker />);

    fireEvent.press(screen.getByTestId('theme-use-notebook'));
    expect(actions.apply).toHaveBeenCalledWith('notebook');

    fireEvent.press(screen.getByTestId('theme-remove-notebook'));
    expect(actions.remove).toHaveBeenCalledWith('notebook');
  });

  it('marks the theme in use, and lets Classic back in', () => {
    useThemePackStore.setState({
      catalog: [entry('notebook', 'Notebook')],
      installed: { notebook: { pack: notebook, fonts: {} } },
      active: notebook,
    });

    renderWithTheme(<ThemePicker />);

    expect(screen.getByTestId('theme-row-notebook')).toHaveTextContent(/In use/);
    fireEvent.press(screen.getByTestId('theme-use-classic'));
    expect(actions.useClassic).toHaveBeenCalled();
  });

  it('offers an update when the server has a newer version', () => {
    useThemePackStore.setState({
      catalog: [entry('notebook', 'Notebook', 2)],
      installed: { notebook: { pack: notebook, fonts: {} } },
    });

    renderWithTheme(<ThemePicker />);

    expect(screen.getByText('Downloaded · update available')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Update' })).toBeOnTheScreen();
  });

  it('keeps downloaded themes listed when the list cannot be fetched', () => {
    useThemePackStore.setState({
      catalogStatus: 'failed',
      installed: { notebook: { pack: notebook, fonts: {} } },
    });

    renderWithTheme(<ThemePicker />);

    expect(screen.getByTestId('theme-row-notebook')).toHaveTextContent(/Downloaded/);
    expect(screen.getByTestId('theme-catalog-failed')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('theme-catalog-retry'));
    expect(actions.loadCatalog).toHaveBeenCalled();
  });

  it('says when themes are loading, unavailable, or something went wrong', () => {
    useThemePackStore.setState({ catalogStatus: 'loading' });
    const { rerender } = renderWithTheme(<ThemePicker />);
    expect(screen.getByText('Loading themes…')).toBeOnTheScreen();

    act(() => {
      useThemePackStore.setState({ catalogStatus: 'unavailable', error: 'Something broke.' });
    });
    rerender(<ThemePicker />);
    expect(
      screen.getByText("Themes aren't available in this version of PrepPilot."),
    ).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
  });

  it('shows progress while a theme downloads', () => {
    useThemePackStore.setState({
      catalog: [entry('notebook', 'Notebook')],
      tasks: { notebook: 'downloading' },
    });

    renderWithTheme(<ThemePicker />);

    expect(screen.getByTestId('theme-download-notebook')).toBeDisabled();
  });
});

describe('formatDownloadSize', () => {
  it('uses KB below a megabyte and MB above', () => {
    expect(formatDownloadSize(348_617)).toBe('340 KB');
    expect(formatDownloadSize(1_250_000)).toBe('1.3 MB');
    expect(formatDownloadSize(10)).toBe('1 KB');
  });
});

describe('restoring at launch', () => {
  it('is ready once the theme is restored', async () => {
    const restore = jest.fn().mockResolvedValue(undefined);
    useThemePackStore.setState({ restore });

    const { result } = renderHook(() => useRestoredTheme());
    await act(async () => {
      await Promise.resolve();
    });

    expect(restore).toHaveBeenCalled();
    expect(result.current).toBe(true);
  });

  it('does nothing if the app closes before restoring finishes', async () => {
    let finish: () => void = () => {};
    useThemePackStore.setState({
      restore: () => new Promise<void>((resolve) => (finish = resolve)),
    });

    const { result, unmount } = renderHook(() => useRestoredTheme());
    unmount();
    await act(async () => {
      finish();
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });

  it('opens anyway if restoring hangs', () => {
    jest.useFakeTimers();
    useThemePackStore.setState({ restore: () => new Promise(() => {}) });

    const { result, unmount } = renderHook(() => useRestoredTheme());
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(THEME_RESTORE_TIMEOUT_MS);
    });

    expect(result.current).toBe(true);
    unmount();
    jest.useRealTimers();
  });
});

describe('where themes come from', () => {
  it('is the project’s public themes bucket', () => {
    expect(
      themesBaseUrl({
        supabaseUrl: 'https://abc.supabase.co/',
        supabaseAnonKey: undefined,
        googleWebClientId: undefined,
        enablePhoneOtp: undefined,
        demoMode: 'true',
        allowAnonymousAi: undefined,
        aiProxyUrl: undefined,
      }),
    ).toBe('https://abc.supabase.co/storage/v1/object/public/themes/');
  });

  it('is nowhere when no project was bundled', () => {
    expect(
      themesBaseUrl({
        supabaseUrl: '  ',
        supabaseAnonKey: undefined,
        googleWebClientId: undefined,
        enablePhoneOtp: undefined,
        demoMode: undefined,
        allowAnonymousAi: undefined,
        aiProxyUrl: undefined,
      }),
    ).toBeNull();
  });
});
