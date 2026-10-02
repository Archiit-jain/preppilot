// Builds the downloadable themes into supabase/themes/dist, ready to upload to
// the public `themes` Storage bucket:
//
//   dist/catalog.json        the themes on offer, with sizes and swatches
//   dist/packs/<id>.json     each pack, copied from packs/
//   dist/fonts/<Name>.ttf    every font a pack names
//
// Fonts come from the @expo-google-fonts npm packages (SIL Open Font License),
// fetched with `npm pack` so nothing is added to the app's dependencies — the
// point of downloadable themes is that the app does not carry them.
//
// Run: node supabase/themes/build-themes.mjs
// Upload: see docs/developer/THEMES.md

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, 'packs');
const dist = join(here, 'dist');

/** Which npm package carries each font family prefix. */
const FONT_PACKAGES = {
  Caveat_: '@expo-google-fonts/caveat@0.4.2',
  Nunito_: '@expo-google-fonts/nunito@0.4.2',
  SpaceGrotesk_: '@expo-google-fonts/space-grotesk@0.4.1',
  JetBrainsMono_: '@expo-google-fonts/jetbrains-mono@0.4.1',
};

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function packageFor(fontFile) {
  const prefix = Object.keys(FONT_PACKAGES).find((p) => fontFile.startsWith(p));
  if (prefix === undefined) throw new Error(`No font package is known for ${fontFile}`);
  return FONT_PACKAGES[prefix];
}

function findFile(root, name) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(path, name);
      if (found) return found;
    } else if (entry.name === name) {
      return path;
    }
  }
  return null;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'packs'), { recursive: true });
mkdirSync(join(dist, 'fonts'), { recursive: true });

/** Looks whose character is their dark mode, so their swatch is drawn dark. */
const PREVIEW_MODE = { 'flight-deck': 'dark' };

/** The order the picker lists them in; any pack not named here follows. */
const ORDER = ['notebook', 'flight-deck', 'bold-bento'];
const rank = (name) => {
  const index = ORDER.indexOf(basename(name, '.json'));
  return index === -1 ? ORDER.length : index;
};

const packs = readdirSync(packsDir)
  .filter((name) => name.endsWith('.json'))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  .map((name) => ({ name, pack: JSON.parse(readFileSync(join(packsDir, name), 'utf8')) }));

// Unpack each font package once, into a scratch folder.
const scratch = mkdtempSync(join(tmpdir(), 'preppilot-themes-'));
const unpacked = new Map();
function unpack(spec) {
  if (unpacked.has(spec)) return unpacked.get(spec);
  const tarball = execFileSync(npm, ['pack', spec, '--silent', '--pack-destination', scratch], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
    .trim()
    .split(/\r?\n/)
    .pop();
  const target = join(scratch, basename(tarball, '.tgz'));
  mkdirSync(target, { recursive: true });
  // Relative paths: GNU tar on Windows reads "C:" in an absolute path as a host.
  execFileSync('tar', ['-xzf', tarball, '-C', basename(target)], { cwd: scratch });
  unpacked.set(spec, target);
  return target;
}

const fontSizes = new Map();
for (const { pack } of packs) {
  for (const path of Object.values(pack.fonts.files)) {
    if (fontSizes.has(path)) continue;
    const file = basename(path);
    const source = findFile(unpack(packageFor(file)), file);
    if (source === null) throw new Error(`${file} is not in ${packageFor(file)}`);
    const destination = join(dist, path);
    copyFileSync(source, destination);
    fontSizes.set(path, statSync(destination).size);
  }
}

const themes = packs.map(({ name, pack }) => {
  const packPath = `packs/${name}`;
  const json = `${JSON.stringify(pack)}\n`;
  writeFileSync(join(dist, packPath), json);
  const fonts = [...new Set(Object.values(pack.fonts.files))];
  const sizeBytes =
    Buffer.byteLength(json) + fonts.reduce((total, path) => total + fontSizes.get(path), 0);
  // The swatch shows each look in the mode it was designed around.
  const colors = pack.colors[PREVIEW_MODE[pack.id] ?? 'light'];
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    version: pack.version,
    sizeBytes,
    preview: {
      background: colors.background,
      surface: colors.surface,
      accent: colors.accent,
      text: colors.textPrimary,
    },
    pack: packPath,
  };
});

writeFileSync(join(dist, 'catalog.json'), `${JSON.stringify({ format: 1, themes }, null, 2)}\n`);
rmSync(scratch, { recursive: true, force: true });

for (const theme of themes) {
  console.log(`${theme.id.padEnd(12)} ${(theme.sizeBytes / 1024).toFixed(0).padStart(5)} KB`);
}
console.log(`Wrote ${dist}`);
