import {
  parseThemeCatalog,
  parseThemePack,
  ThemePackError,
  type ThemeCatalogEntry,
  type ThemePack,
} from '@preppilot/shared';
import { loadAsync } from 'expo-font';
import { create } from 'zustand';
import { themesBaseUrl } from '../../config/env';
import {
  downloadThemeFont,
  readActiveThemeId,
  readInstalledThemes,
  removeInstalledTheme,
  writeActiveThemeId,
  writeInstalledTheme,
} from './theme-files';

/**
 * Downloadable themes (DECISIONS.md, D106).
 *
 * Classic is built in and is what `active === null` means. Every other look is
 * fetched from the server only when the student asks for it, kept on the device,
 * and re-applied at launch from there — so after one download a theme works
 * offline, and a student who never opens Settings → Themes downloads nothing.
 */

/** A theme on this device: the validated pack and the address of each font. */
export interface InstalledTheme {
  readonly pack: ThemePack;
  readonly fonts: Readonly<Record<string, string>>;
}

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable';
export type ThemeTask = 'downloading' | 'applying';

export interface ThemePackState {
  /** The theme in use, or null for Classic. */
  readonly active: ThemePack | null;
  readonly installed: Readonly<Record<string, InstalledTheme>>;
  readonly catalog: readonly ThemeCatalogEntry[];
  readonly catalogStatus: CatalogStatus;
  /** What is happening to each theme right now, so its row can say so. */
  readonly tasks: Readonly<Record<string, ThemeTask>>;
  /** A student-facing sentence about the last thing that went wrong. */
  readonly error: string | null;
}

export interface ThemePackActions {
  /** Re-applies the theme chosen last time. Never throws: any failure means Classic. */
  restore: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  /** Downloads a theme and switches to it. */
  install: (entry: ThemeCatalogEntry) => Promise<boolean>;
  apply: (themeId: string) => Promise<boolean>;
  useClassic: () => Promise<void>;
  remove: (themeId: string) => Promise<void>;
  clearError: () => void;
}

const initialState: ThemePackState = {
  active: null,
  installed: {},
  catalog: [],
  catalogStatus: 'idle',
  tasks: {},
  error: null,
};

/** Long enough for a slow connection to fetch a 300 KB font; short enough to give up. */
export const THEME_FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), THEME_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/** Checks a stored record as strictly as a download: storage can be stale or tampered with. */
function readRecord(value: unknown): InstalledTheme | null {
  try {
    const record = value as { pack?: unknown; fonts?: unknown };
    const pack = parseThemePack(record.pack);
    const fonts = record.fonts as Record<string, unknown> | undefined;
    if (fonts === undefined || fonts === null || typeof fonts !== 'object') return null;
    const resolved: Record<string, string> = {};
    for (const family of Object.keys(pack.fonts.files)) {
      const uri = fonts[family];
      if (typeof uri !== 'string' || uri.length === 0) return null;
      resolved[family] = uri;
    }
    return { pack, fonts: resolved };
  } catch {
    return null;
  }
}

/** Registers a theme's fonts under the family names its pack uses. */
async function loadThemeFonts(theme: InstalledTheme): Promise<void> {
  await loadAsync({ ...theme.fonts });
}

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

export const useThemePackStore = create<ThemePackState & ThemePackActions>((set, get) => ({
  ...initialState,

  async restore() {
    try {
      const records = (await readInstalledThemes())
        .map(readRecord)
        .filter((theme): theme is InstalledTheme => theme !== null);
      const installed = Object.fromEntries(records.map((theme) => [theme.pack.id, theme]));
      set({ installed });

      const activeId = await readActiveThemeId();
      const theme = activeId === null ? undefined : installed[activeId];
      if (theme === undefined) {
        if (activeId !== null) await writeActiveThemeId(null);
        return;
      }

      await loadThemeFonts(theme);
      set({ active: theme.pack });
    } catch {
      // Classic is always there to fall back to; a theme that cannot be
      // restored is not worth delaying start-up or showing an error over.
      set({ active: null });
    }
  },

  async loadCatalog() {
    const base = themesBaseUrl();
    if (base === null) {
      set({ catalogStatus: 'unavailable' });
      return;
    }

    set({ catalogStatus: 'loading' });
    try {
      const response = await fetchWithTimeout(`${base}catalog.json`);
      const catalog = parseThemeCatalog(await response.json());
      set({ catalog: catalog.themes, catalogStatus: 'ready' });
    } catch {
      set({ catalogStatus: 'failed' });
    }
  },

  async install(entry) {
    const base = themesBaseUrl();
    if (base === null || get().tasks[entry.id] !== undefined) return false;

    set((state) => ({ tasks: { ...state.tasks, [entry.id]: 'downloading' }, error: null }));
    try {
      const response = await fetchWithTimeout(`${base}${entry.pack}`);
      const pack = parseThemePack(await response.json());
      if (pack.id !== entry.id) throw new ThemePackError('The theme does not match the list');

      const fonts: Record<string, string> = {};
      for (const [family, path] of Object.entries(pack.fonts.files)) {
        fonts[family] = await downloadThemeFont(pack.id, family, `${base}${path}`);
      }

      const theme: InstalledTheme = { pack, fonts };
      // Written last: until this record exists the theme is not installed.
      await writeInstalledTheme(pack.id, theme);
      set((state) => ({
        installed: { ...state.installed, [pack.id]: theme },
        tasks: without(state.tasks, entry.id),
      }));
    } catch (error) {
      await removeInstalledTheme(entry.id).catch(() => undefined);
      set((state) => ({
        tasks: without(state.tasks, entry.id),
        error:
          error instanceof ThemePackError
            ? `${entry.name} needs a newer version of PrepPilot.`
            : `Couldn't download ${entry.name}. Check your connection and try again.`,
      }));
      return false;
    }

    return get().apply(entry.id);
  },

  async apply(themeId) {
    const theme = get().installed[themeId];
    if (theme === undefined) return false;

    set((state) => ({ tasks: { ...state.tasks, [themeId]: 'applying' }, error: null }));
    try {
      await loadThemeFonts(theme);
      await writeActiveThemeId(themeId);
      set((state) => ({ active: theme.pack, tasks: without(state.tasks, themeId) }));
      return true;
    } catch {
      set((state) => ({
        tasks: without(state.tasks, themeId),
        error: `Couldn't open ${theme.pack.name}. Remove it and download it again.`,
      }));
      return false;
    }
  },

  async useClassic() {
    set({ active: null, error: null });
    await writeActiveThemeId(null).catch(() => undefined);
  },

  async remove(themeId) {
    if (get().active?.id === themeId) await get().useClassic();
    await removeInstalledTheme(themeId).catch(() => undefined);
    set((state) => ({ installed: without(state.installed, themeId) }));
  },

  clearError() {
    set({ error: null });
  },
}));

/** Test seam. */
export function resetThemePackStore(): void {
  useThemePackStore.setState({ ...initialState });
}
