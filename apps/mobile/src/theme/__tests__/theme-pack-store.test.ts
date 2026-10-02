import { loadAsync } from 'expo-font';
import { themesBaseUrl } from '../../config/env';
import { loadPack, rawPack } from '../../test-utils/theme-packs';
import {
  downloadThemeFont,
  readActiveThemeId,
  readInstalledThemes,
  removeInstalledTheme,
  writeActiveThemeId,
  writeInstalledTheme,
} from '../packs/theme-files';
import {
  resetThemePackStore,
  THEME_FETCH_TIMEOUT_MS,
  useThemePackStore,
} from '../packs/theme-pack-store';

jest.mock('expo-font', () => ({ loadAsync: jest.fn() }));
jest.mock('../../config/env', () => ({ themesBaseUrl: jest.fn() }));
jest.mock('../packs/theme-files', () => ({
  downloadThemeFont: jest.fn(),
  readActiveThemeId: jest.fn(),
  readInstalledThemes: jest.fn(),
  removeInstalledTheme: jest.fn(),
  writeActiveThemeId: jest.fn(),
  writeInstalledTheme: jest.fn(),
}));

const BASE = 'https://example.supabase.co/storage/v1/object/public/themes/';
const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.Mock;

const notebook = loadPack('notebook');
const notebookFonts = Object.fromEntries(
  Object.keys(notebook.fonts.files).map((family) => [
    family,
    `file:///themes/notebook/${family}.ttf`,
  ]),
);
const entry = {
  id: 'notebook',
  name: 'Notebook',
  description: 'Ruled paper.',
  version: 1,
  sizeBytes: 770_000,
  preview: { background: '#FBF6EA', surface: '#FFFDF7', accent: '#2450B8', text: '#1F2A3C' },
  pack: 'packs/notebook.json',
};

const fetchMock = jest.fn();
const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) });

const state = () => useThemePackStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  resetThemePackStore();
  global.fetch = fetchMock as never;
  mocked(themesBaseUrl).mockReturnValue(BASE);
  mocked(loadAsync).mockResolvedValue(undefined);
  mocked(readInstalledThemes).mockResolvedValue([]);
  mocked(readActiveThemeId).mockResolvedValue(null);
  mocked(writeActiveThemeId).mockResolvedValue(undefined);
  mocked(writeInstalledTheme).mockResolvedValue(undefined);
  mocked(removeInstalledTheme).mockResolvedValue(undefined);
  mocked(downloadThemeFont).mockImplementation(
    async (themeId: string, family: string) => `file:///themes/${themeId}/${family}.ttf`,
  );
});

describe('restoring at launch', () => {
  it('stays on Classic when nothing was chosen', async () => {
    await state().restore();

    expect(state().active).toBeNull();
    expect(loadAsync).not.toHaveBeenCalled();
  });

  it('re-applies the theme chosen last time, fonts first', async () => {
    mocked(readInstalledThemes).mockResolvedValue([
      { pack: rawPack('notebook'), fonts: notebookFonts },
    ]);
    mocked(readActiveThemeId).mockResolvedValue('notebook');

    await state().restore();

    expect(loadAsync).toHaveBeenCalledWith(notebookFonts);
    expect(state().active?.id).toBe('notebook');
    expect(Object.keys(state().installed)).toEqual(['notebook']);
  });

  it('forgets a chosen theme that is no longer on the phone', async () => {
    mocked(readActiveThemeId).mockResolvedValue('notebook');

    await state().restore();

    expect(state().active).toBeNull();
    expect(writeActiveThemeId).toHaveBeenCalledWith(null);
  });

  it('ignores records that are damaged or missing a font', async () => {
    const { Caveat_700Bold: _missing, ...partial } = notebookFonts;
    mocked(readInstalledThemes).mockResolvedValue([
      { pack: { format: 99 }, fonts: {} },
      { pack: rawPack('notebook'), fonts: partial },
      { pack: rawPack('notebook') },
      null,
    ]);

    await state().restore();

    expect(state().installed).toEqual({});
  });

  it('falls back to Classic when the fonts will not load', async () => {
    mocked(readInstalledThemes).mockResolvedValue([
      { pack: rawPack('notebook'), fonts: notebookFonts },
    ]);
    mocked(readActiveThemeId).mockResolvedValue('notebook');
    mocked(loadAsync).mockRejectedValue(new Error('corrupt font'));

    await state().restore();

    expect(state().active).toBeNull();
  });
});

describe('the list of themes', () => {
  it('says themes are unavailable when the app has no server', async () => {
    mocked(themesBaseUrl).mockReturnValue(null);

    await state().loadCatalog();

    expect(state().catalogStatus).toBe('unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and validates the catalog', async () => {
    fetchMock.mockReturnValue(respond({ format: 1, themes: [entry] }));

    await state().loadCatalog();

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}catalog.json`, expect.anything());
    expect(state().catalogStatus).toBe('ready');
    expect(state().catalog.map((theme) => theme.id)).toEqual(['notebook']);
  });

  it('reports a failed fetch', async () => {
    fetchMock.mockReturnValue(respond({}, false));

    await state().loadCatalog();

    expect(state().catalogStatus).toBe('failed');
  });
});

describe('downloading a theme', () => {
  it('fetches the pack and its fonts, keeps them, and switches to it', async () => {
    fetchMock.mockReturnValue(respond(rawPack('notebook')));

    const ok = await state().install(entry);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}packs/notebook.json`, expect.anything());
    expect(downloadThemeFont).toHaveBeenCalledWith(
      'notebook',
      'Caveat_700Bold',
      `${BASE}fonts/Caveat_700Bold.ttf`,
    );
    expect(writeInstalledTheme).toHaveBeenCalledWith('notebook', {
      pack: notebook,
      fonts: notebookFonts,
    });
    expect(writeActiveThemeId).toHaveBeenCalledWith('notebook');
    expect(state().active?.id).toBe('notebook');
    expect(state().tasks).toEqual({});
  });

  it('says what went wrong when the download fails, and leaves nothing behind', async () => {
    fetchMock.mockReturnValue(respond(rawPack('notebook')));
    mocked(downloadThemeFont).mockRejectedValueOnce(new Error('offline'));

    const ok = await state().install(entry);

    expect(ok).toBe(false);
    expect(removeInstalledTheme).toHaveBeenCalledWith('notebook');
    expect(state().error).toBe("Couldn't download Notebook. Check your connection and try again.");
    expect(state().active).toBeNull();
    expect(state().tasks).toEqual({});
  });

  it('refuses a pack this version cannot render', async () => {
    fetchMock.mockReturnValue(respond({ ...(rawPack('notebook') as object), format: 2 }));

    expect(await state().install(entry)).toBe(false);
    expect(state().error).toBe('Notebook needs a newer version of PrepPilot.');
  });

  it('refuses a pack that is not the one listed', async () => {
    fetchMock.mockReturnValue(respond(rawPack('flight-deck')));

    expect(await state().install(entry)).toBe(false);
    expect(state().installed).toEqual({});
  });

  it('does nothing without a server, or while the same theme is downloading', async () => {
    mocked(themesBaseUrl).mockReturnValueOnce(null);
    expect(await state().install(entry)).toBe(false);

    useThemePackStore.setState({ tasks: { notebook: 'downloading' } });
    expect(await state().install(entry)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up on a server that never answers', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );

    const pending = state().loadCatalog();
    jest.advanceTimersByTime(THEME_FETCH_TIMEOUT_MS);
    await pending;
    jest.useRealTimers();

    expect(state().catalogStatus).toBe('failed');
  });
});

describe('switching and removing', () => {
  beforeEach(() => {
    useThemePackStore.setState({
      installed: { notebook: { pack: notebook, fonts: notebookFonts } },
    });
  });

  it('switches to a downloaded theme', async () => {
    expect(await state().apply('notebook')).toBe(true);
    expect(state().active?.id).toBe('notebook');
  });

  it('cannot switch to a theme that is not downloaded', async () => {
    expect(await state().apply('flight-deck')).toBe(false);
  });

  it('explains a theme whose fonts will not open', async () => {
    mocked(loadAsync).mockRejectedValue(new Error('corrupt'));

    expect(await state().apply('notebook')).toBe(false);
    expect(state().error).toBe("Couldn't open Notebook. Remove it and download it again.");
    expect(state().active).toBeNull();
  });

  it('goes back to Classic', async () => {
    await state().apply('notebook');

    await state().useClassic();

    expect(state().active).toBeNull();
    expect(writeActiveThemeId).toHaveBeenLastCalledWith(null);
  });

  it('removing the theme in use returns to Classic', async () => {
    await state().apply('notebook');

    await state().remove('notebook');

    expect(state().active).toBeNull();
    expect(removeInstalledTheme).toHaveBeenCalledWith('notebook');
    expect(state().installed).toEqual({});
  });

  it('removes a theme that is not in use without touching the one that is', async () => {
    await state().remove('notebook');

    expect(writeActiveThemeId).not.toHaveBeenCalled();
    expect(state().installed).toEqual({});
  });

  it('clears an error', () => {
    useThemePackStore.setState({ error: 'Something' });

    state().clearError();

    expect(state().error).toBeNull();
  });
});
