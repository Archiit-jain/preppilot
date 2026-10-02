import * as nativeFiles from '../packs/theme-files';
import * as webFiles from '../packs/theme-files.web';

/**
 * A small in-memory stand-in for expo-file-system's File and Directory: enough
 * to show where things are written and that a half-finished download is not
 * mistaken for an installed theme.
 */
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const join = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
      .join('/')
      .replace(/\/+/g, '/');

  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return dirs.has(this.uri);
    }
    create() {
      const segments = this.uri.split('/');
      for (let i = 1; i <= segments.length; i += 1) dirs.add(segments.slice(0, i).join('/'));
    }
    delete() {
      for (const dir of [...dirs])
        if (dir === this.uri || dir.startsWith(`${this.uri}/`)) dirs.delete(dir);
      for (const file of [...files.keys()]) if (file.startsWith(`${this.uri}/`)) files.delete(file);
    }
    list() {
      const prefix = `${this.uri}/`;
      const children = new Set<string>();
      for (const path of [...dirs, ...files.keys()]) {
        if (path.startsWith(prefix)) children.add(path.slice(prefix.length).split('/')[0]!);
      }
      return [...children].map((name) =>
        dirs.has(prefix + name) ? new Directory(prefix + name) : new File(prefix + name),
      );
    }
  }

  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    async text() {
      return files.get(this.uri) ?? '';
    }
    write(content: string) {
      files.set(this.uri, content);
    }
    delete() {
      files.delete(this.uri);
    }
    static downloadFileAsync = async (url: string, destination: File) => {
      if (url.includes('fail')) throw new Error('offline');
      files.set(destination.uri, `font from ${url}`);
      return destination;
    };
  }

  return {
    Directory,
    File,
    Paths: { document: new Directory('file:///docs') },
    __reset: () => {
      files.clear();
      dirs.clear();
    },
    __files: files,
  };
});

const fs = jest.requireMock('expo-file-system') as {
  __reset: () => void;
  __files: Map<string, string>;
};

beforeEach(() => fs.__reset());

describe('on the phone', () => {
  it('remembers which theme is in use, and forgets it', async () => {
    expect(await nativeFiles.readActiveThemeId()).toBeNull();

    await nativeFiles.writeActiveThemeId('notebook');
    expect(await nativeFiles.readActiveThemeId()).toBe('notebook');

    await nativeFiles.writeActiveThemeId(null);
    expect(await nativeFiles.readActiveThemeId()).toBeNull();
    await nativeFiles.writeActiveThemeId(null);
  });

  it('treats an empty choice as none', async () => {
    await nativeFiles.writeActiveThemeId('  ');

    expect(await nativeFiles.readActiveThemeId()).toBeNull();
  });

  it('downloads fonts into the theme folder, replacing an old copy', async () => {
    const first = await nativeFiles.downloadThemeFont(
      'notebook',
      'Caveat_700Bold',
      'https://x/a.ttf',
    );
    const again = await nativeFiles.downloadThemeFont(
      'notebook',
      'Caveat_700Bold',
      'https://x/b.ttf',
    );

    expect(first).toBe('file:/docs/themes/notebook/fonts/Caveat_700Bold.ttf');
    expect(again).toBe(first);
    expect(fs.__files.get(first)).toBe('font from https://x/b.ttf');
  });

  it('lists only themes whose record was written, skipping unreadable ones', async () => {
    expect(await nativeFiles.readInstalledThemes()).toEqual([]);

    await nativeFiles.writeInstalledTheme('notebook', { pack: { id: 'notebook' } });
    // A download that stopped before its record: fonts but no installed.json.
    await nativeFiles.downloadThemeFont('flight-deck', 'Mono', 'https://x/m.ttf');
    await nativeFiles.writeInstalledTheme('broken', {});
    fs.__files.set('file:/docs/themes/broken/installed.json', '{not json');
    await nativeFiles.writeActiveThemeId('notebook');

    expect(await nativeFiles.readInstalledThemes()).toEqual([{ pack: { id: 'notebook' } }]);
  });

  it('removes a theme and everything in its folder', async () => {
    await nativeFiles.downloadThemeFont('notebook', 'Caveat_700Bold', 'https://x/a.ttf');
    await nativeFiles.writeInstalledTheme('notebook', { pack: {} });

    await nativeFiles.removeInstalledTheme('notebook');
    await nativeFiles.removeInstalledTheme('notebook');

    expect(await nativeFiles.readInstalledThemes()).toEqual([]);
    expect([...fs.__files.keys()]).toEqual([]);
  });
});

describe('in the browser', () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeStorage,
      configurable: true,
    });
  });

  afterAll(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('remembers the theme in use', async () => {
    await webFiles.writeActiveThemeId('notebook');
    expect(await webFiles.readActiveThemeId()).toBe('notebook');

    await webFiles.writeActiveThemeId(null);
    expect(await webFiles.readActiveThemeId()).toBeNull();
  });

  it('loads fonts from their own address rather than copying them', async () => {
    expect(await webFiles.downloadThemeFont('notebook', 'Caveat', 'https://x/a.ttf')).toBe(
      'https://x/a.ttf',
    );
  });

  it('keeps records, skips unreadable ones, and removes them', async () => {
    await webFiles.writeInstalledTheme('notebook', { pack: { id: 'notebook' } });
    store.set('preppilot.theme.installed.bad', '{nope');
    store.set('unrelated', 'x');

    expect(await webFiles.readInstalledThemes()).toEqual([{ pack: { id: 'notebook' } }]);

    await webFiles.removeInstalledTheme('notebook');
    store.delete('preppilot.theme.installed.bad');
    expect(await webFiles.readInstalledThemes()).toEqual([]);
  });

  it('carries on when storage is blocked', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
      configurable: true,
    });

    expect(await webFiles.readActiveThemeId()).toBeNull();
    expect(await webFiles.readInstalledThemes()).toEqual([]);
    await expect(webFiles.writeActiveThemeId('notebook')).resolves.toBeUndefined();
    await expect(webFiles.writeInstalledTheme('notebook', {})).resolves.toBeUndefined();
    await expect(webFiles.removeInstalledTheme('notebook')).resolves.toBeUndefined();
  });

  it('carries on when storage throws on use', async () => {
    const throwing = {
      get length(): number {
        throw new Error('blocked');
      },
      key: () => null,
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    Object.defineProperty(globalThis, 'localStorage', { value: throwing, configurable: true });

    expect(await webFiles.readActiveThemeId()).toBeNull();
    expect(await webFiles.readInstalledThemes()).toEqual([]);
    await expect(webFiles.writeActiveThemeId('notebook')).resolves.toBeUndefined();
    await expect(webFiles.writeActiveThemeId(null)).resolves.toBeUndefined();
    await expect(webFiles.writeInstalledTheme('notebook', {})).resolves.toBeUndefined();
    await expect(webFiles.removeInstalledTheme('notebook')).resolves.toBeUndefined();
  });
});
