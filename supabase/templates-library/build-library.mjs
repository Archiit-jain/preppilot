// Builds the cloud template library from the Markdown sources in src/.
//
//   src/<group>/<id>.md   one syllabus per file (format below)
//   dist/catalog.json     the list the app shows, with counts and subject names
//   dist/templates/<id>.json
//
// Source format — front matter, then # subjects, ## chapters, - topics:
//
//   ---
//   id: gate-civil
//   name: GATE Civil Engineering
//   description: One line shown under the name.
//   category: exam            (exam | school | custom)
//   source: Where the syllabus was taken from, e.g. the official brochure.
//   verified: false           (true only when transcribed from the official text)
//   version: 1
//   ---
//   # Engineering Mathematics
//   ## Linear Algebra
//   - Matrix algebra
//   - Systems of linear equations
//
// Every template's source must be an official syllabus or a named, recognised
// curriculum; nothing is taken from other apps (docs/developer/TEMPLATE_LIBRARY.md).
//
// Run: node supabase/templates-library/build-library.mjs

import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, 'src');
const dist = join(here, 'dist');
const FORMAT = 1;
const CATEGORIES = new Set(['exam', 'school', 'custom']);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : name.endsWith('.md') ? [path] : [];
  });
}

export function parseSource(text, file = 'source') {
  const fail = (line, message) => {
    throw new Error(`${file}${line ? `:${line}` : ''}: ${message}`);
  };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') fail(1, 'must start with front matter (---)');
  const end = lines.indexOf('---', 1);
  if (end === -1) fail(1, 'front matter is not closed');

  const meta = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([a-z]+):\s*(.*)$/.exec(line.trim());
    if (match) meta[match[1]] = match[2].trim();
  }
  for (const key of ['id', 'name', 'description', 'category', 'source']) {
    if (!meta[key]) fail(0, `front matter needs ${key}`);
  }
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(meta.id)) fail(0, `bad id ${meta.id}`);
  if (basename(file, '.md') !== meta.id && file !== 'source') fail(0, 'file name must be the id');
  if (!CATEGORIES.has(meta.category)) fail(0, `bad category ${meta.category}`);

  const subjects = [];
  let subject = null;
  let chapter = null;
  lines.slice(end + 1).forEach((raw, offset) => {
    const lineNo = end + 2 + offset;
    const line = raw.trim();
    if (line === '' || line.startsWith('<!--')) return;
    if (line.startsWith('## ')) {
      if (subject === null) fail(lineNo, 'chapter before any subject');
      chapter = { name: line.slice(3).trim(), topics: [] };
      subject.chapters.push(chapter);
    } else if (line.startsWith('# ')) {
      subject = { name: line.slice(2).trim(), chapters: [] };
      subjects.push(subject);
      chapter = null;
    } else if (line.startsWith('- ')) {
      if (chapter === null) fail(lineNo, 'topic before any chapter');
      chapter.topics.push(line.slice(2).trim());
    } else {
      fail(lineNo, `unrecognised line: ${line}`);
    }
  });

  if (subjects.length === 0) fail(0, 'no subjects');
  for (const s of subjects) {
    if (s.chapters.length === 0) fail(0, `subject "${s.name}" has no chapters`);
    for (const c of s.chapters) {
      if (c.topics.length === 0) fail(0, `chapter "${c.name}" has no topics`);
      for (const name of [s.name, c.name, ...c.topics]) {
        // The app's limit on any name (MAX_NAME_LENGTH in @preppilot/shared).
        if (name.length > 120) fail(0, `name too long: ${name.slice(0, 40)}…`);
      }
    }
  }

  return {
    format: FORMAT,
    id: meta.id,
    name: meta.name,
    description: meta.description,
    category: meta.category,
    source: meta.source,
    verified: meta.verified === 'true',
    version: Number(meta.version ?? 1),
    subjects,
  };
}

function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, 'templates'), { recursive: true });

  const seen = new Set();
  const catalog = [];
  for (const file of files(srcDir).sort()) {
    const template = parseSource(readFileSync(file, 'utf8'), file);
    if (seen.has(template.id)) throw new Error(`${file}: duplicate id ${template.id}`);
    seen.add(template.id);

    const { version, ...body } = template;
    const path = `templates/${template.id}.json`;
    writeFileSync(join(dist, path), `${JSON.stringify(body)}\n`);

    const chapters = template.subjects.reduce((n, s) => n + s.chapters.length, 0);
    const topics = template.subjects.reduce(
      (n, s) => n + s.chapters.reduce((m, c) => m + c.topics.length, 0),
      0,
    );
    catalog.push({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      source: template.source,
      verified: template.verified,
      counts: { subjects: template.subjects.length, chapters, topics },
      subjects: template.subjects.map((s) => s.name),
      version,
      path,
    });
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(
    join(dist, 'catalog.json'),
    `${JSON.stringify({ format: FORMAT, templates: catalog }, null, 1)}\n`,
  );
  console.log(`Built ${catalog.length} templates into ${dist}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
