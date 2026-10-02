/**
 * The browser build's theme storage.
 *
 * A browser has no app documents folder, so fonts are not copied anywhere: the
 * pack records the font's own address and the browser's HTTP cache keeps it.
 * The records themselves go in localStorage, which can be unavailable (private
 * windows, blocked storage) — every access is guarded, and a theme that cannot
 * be remembered still works for the rest of the visit.
 */

const ACTIVE_KEY = 'preppilot.theme.active';
const RECORD_PREFIX = 'preppilot.theme.installed.';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function readActiveThemeId(): Promise<string | null> {
  try {
    return storage()?.getItem(ACTIVE_KEY) ?? null;
  } catch {
    return null;
  }
}

export async function writeActiveThemeId(id: string | null): Promise<void> {
  try {
    if (id === null) storage()?.removeItem(ACTIVE_KEY);
    else storage()?.setItem(ACTIVE_KEY, id);
  } catch {
    // Not remembered; the theme still applies until the page is reloaded.
  }
}

export async function readInstalledThemes(): Promise<unknown[]> {
  const store = storage();
  if (store === null) return [];
  const records: unknown[] = [];
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key === null || !key.startsWith(RECORD_PREFIX)) continue;
      try {
        records.push(JSON.parse(store.getItem(key) ?? 'null'));
      } catch {
        // Unreadable: treated as not installed.
      }
    }
  } catch {
    return records;
  }
  return records;
}

export async function downloadThemeFont(
  _themeId: string,
  _family: string,
  url: string,
): Promise<string> {
  return url;
}

export async function writeInstalledTheme(themeId: string, record: unknown): Promise<void> {
  try {
    storage()?.setItem(`${RECORD_PREFIX}${themeId}`, JSON.stringify(record));
  } catch {
    // Not remembered past this visit.
  }
}

export async function removeInstalledTheme(themeId: string): Promise<void> {
  try {
    storage()?.removeItem(`${RECORD_PREFIX}${themeId}`);
  } catch {
    // Nothing to remove.
  }
}
