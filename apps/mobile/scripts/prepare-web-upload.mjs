// Renames the folders in the web build that hosts quietly drop.
//
// Expo puts the app's code in `_expo/` and bundled fonts under
// `assets/__node_modules/`. Netlify's drag-and-drop upload skips folders that
// start with "_" or are named like node_modules, so a dropped build had every
// page but no code: a blank screen. Here those folders get plain names and
// every reference to them in the built files is rewritten to match.
//
// Run after `expo export`: node scripts/prepare-web-upload.mjs dist

import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');

const RENAMES = [
  ['_expo', 'expo'],
  [join('assets', '__node_modules'), join('assets', 'modules')],
];
const REWRITES = [
  ['/_expo/', '/expo/'],
  ['/assets/__node_modules/', '/assets/modules/'],
];
const TEXT = new Set(['.html', '.js', '.css', '.json', '.map', '.txt']);

for (const [from, to] of RENAMES) {
  try {
    statSync(join(dist, from));
  } catch {
    continue;
  }
  renameSync(join(dist, from), join(dist, to));
}

let changed = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!TEXT.has(extname(entry.name))) continue;
    const before = readFileSync(path, 'utf8');
    let after = before;
    for (const [from, to] of REWRITES) after = after.split(from).join(to);
    if (after !== before) {
      writeFileSync(path, after);
      changed += 1;
    }
  }
}
walk(dist);

console.log(`Prepared ${dist} for upload: ${changed} files rewritten.`);
