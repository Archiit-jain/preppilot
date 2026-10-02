import { Directory, File, Paths } from 'expo-file-system';

/**
 * Where downloaded themes live on the phone.
 *
 *   <documents>/themes/active.txt            the id of the theme in use, if any
 *   <documents>/themes/<id>/installed.json   the pack and where its fonts are
 *   <documents>/themes/<id>/fonts/<Family>.ttf
 *
 * The documents folder, not the cache: the OS may empty a cache whenever it
 * likes, and a theme that silently vanished would drop the student back to
 * Classic with no explanation. `installed.json` is written last, so a download
 * cut off part-way leaves no record and is simply not listed.
 */

const root = () => new Directory(Paths.document, 'themes');

function ensureDirectory(directory: Directory): void {
  directory.create({ intermediates: true, idempotent: true });
}

export async function readActiveThemeId(): Promise<string | null> {
  const file = new File(root(), 'active.txt');
  if (!file.exists) return null;
  const id = (await file.text()).trim();
  return id.length === 0 ? null : id;
}

export async function writeActiveThemeId(id: string | null): Promise<void> {
  const file = new File(root(), 'active.txt');
  if (id === null) {
    if (file.exists) file.delete();
    return;
  }
  ensureDirectory(root());
  file.write(id);
}

/** Every installed record, unvalidated: the store checks each before use. */
export async function readInstalledThemes(): Promise<unknown[]> {
  const directory = root();
  if (!directory.exists) return [];

  const records: unknown[] = [];
  for (const entry of directory.list()) {
    if (!(entry instanceof Directory)) continue;
    const file = new File(entry, 'installed.json');
    if (!file.exists) continue;
    try {
      records.push(JSON.parse(await file.text()));
    } catch {
      // A record that cannot be read is treated as not installed.
    }
  }
  return records;
}

/** Downloads one font into the theme's folder and returns its local address. */
export async function downloadThemeFont(
  themeId: string,
  family: string,
  url: string,
): Promise<string> {
  const fonts = new Directory(root(), themeId, 'fonts');
  ensureDirectory(fonts);
  const destination = new File(fonts, `${family}.ttf`);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(url, destination);
  return file.uri;
}

export async function writeInstalledTheme(themeId: string, record: unknown): Promise<void> {
  const directory = new Directory(root(), themeId);
  ensureDirectory(directory);
  new File(directory, 'installed.json').write(JSON.stringify(record));
}

export async function removeInstalledTheme(themeId: string): Promise<void> {
  const directory = new Directory(root(), themeId);
  if (directory.exists) directory.delete();
}
