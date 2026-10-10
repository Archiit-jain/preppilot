/**
 * Checks whether the official syllabus documents behind the library have changed.
 *
 * Usage:
 *   node check_sources.mjs                 check every source; exit 1 if any changed
 *   node check_sources.mjs --record <dir>  record the baseline from the PDFs used to
 *                                          build the templates (<dir>/<key>.pdf)
 *
 * `sources.json` lists each official document, the templates built from it, and
 * fingerprints of the copy that was used: the file's SHA-256, and a hash of its text
 * with everything but letters and digits removed. A changed file whose text is the
 * same (re-saved, new metadata) is reported but not counted as a change.
 *
 * It reads PDFs (with `pdftotext`, poppler-utils) and web pages (by their visible text). Government sites are sometimes slow or block
 * some networks; a source that cannot be fetched is reported as unreachable and does
 * not fail the check.
 *
 * This only notices changes to the documents it knows. A new exam cycle often
 * publishes its syllabus at a new address; that has to be added here by hand.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), '..', 'sources.json');
const USER_AGENT = 'Mozilla/5.0 (PrepPilot syllabus check)';

const isPdf = (path) => readFileSync(path).subarray(0, 4).toString('latin1') === '%PDF';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// Named entities whose value is not a letter or digit vanish from the hash anyway; these are the
// ones a page may write without the semicolon.
const LEGACY = ['amp', 'lt', 'gt', 'quot', 'nbsp', 'copy', 'reg'];

/** HTML entities decoded far enough for the hash: numeric ones exactly, named ones to a space. */
function unescape(text) {
  return text
    .replace(/&#(\d+);?/g, (_, n) => codePoint(Number(n)))
    .replace(/&#[xX]([0-9a-fA-F]+);?/g, (_, n) => codePoint(parseInt(n, 16)))
    .replace(/&[A-Za-z][A-Za-z0-9]{1,31};/g, ' ')
    .replace(new RegExp(`&(?:${LEGACY.join('|')})`, 'g'), ' ');
}

function codePoint(n) {
  return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '�';
}

/** The visible text of a web page: scripts, styles and tags removed. */
function pageText(path) {
  let page = new TextDecoder('utf-8').decode(readFileSync(path));
  page = page.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ');
  return unescape(page.replace(/<[^>]+>/g, ' '));
}

function textHash(path) {
  const out = isPdf(path)
    ? execFileSync('pdftotext', ['-enc', 'UTF-8', path, '-'], { maxBuffer: 1 << 30 }).toString(
        'utf8',
      )
    : pageText(path);
  // Different pdftotext versions space and break lines differently; letters
  // and digits are what matter.
  return sha256(out.toLowerCase().replace(/[^0-9a-z]/g, ''));
}

// A web page's bytes change on every load (tokens, timestamps), so a page is
// compared by its text only.
const fileHash = (path) => (isPdf(path) ? sha256(readFileSync(path)) : textHash(path));

async function fetchTo(url, dest, attempts = 3) {
  let data;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = Buffer.from(await response.arrayBuffer());
      break;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
    }
  }
  if (
    data.subarray(0, 4).toString('latin1') !== '%PDF' &&
    !data.subarray(0, 2000).toString('latin1').toLowerCase().includes('<html')
  ) {
    throw new Error('the response is neither a PDF nor a web page');
  }
  writeFileSync(dest, data);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function record(directory) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  for (const source of manifest.sources) {
    let file = join(directory, `${source.key}.pdf`);
    if (!existsSync(file)) file = join(directory, `${source.key}.html`);
    if (!existsSync(file)) {
      console.log(`skip ${source.key}: no ${source.key}.pdf or .html`);
      continue;
    }
    source.sha256 = fileHash(file);
    source.textHash = textHash(file);
    source.recorded = today();
    console.log(`recorded ${source.key}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

async function check() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const changed = [];
  const resaved = [];
  const unreachable = [];
  let same = 0;
  const tmp = mkdtempSync(join(tmpdir(), 'sources-'));
  try {
    for (const source of manifest.sources) {
      const file = join(tmp, `${source.key}.pdf`);
      try {
        await fetchTo(source.url, file);
      } catch (error) {
        // any failure means "could not check"
        unreachable.push([source, error.cause?.message ?? error.message]);
        continue;
      }
      if (fileHash(file) === source.sha256) same += 1;
      else if (textHash(file) === source.textHash) resaved.push(source);
      else changed.push(source);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  let lines = [`# Syllabus source check, ${today()}`, ''];
  lines.push(
    `${same} unchanged, ${changed.length} changed, ${resaved.length} re-saved with the same text, ` +
      `${unreachable.length} unreachable, of ${manifest.sources.length} sources.`,
  );
  if (changed.length) {
    lines = lines.concat(
      ['', '## Changed: rebuild these templates', ''],
      changed.map((s) => `- **${s.key}** (${s.url}): ${s.templates.join(', ')}`),
    );
  }
  if (resaved.length)
    lines = lines.concat(
      ['', '## Re-saved, text unchanged', ''],
      resaved.map((s) => `- ${s.key}`),
    );
  if (unreachable.length) {
    lines = lines.concat(
      ['', '## Could not fetch (check by hand)', ''],
      unreachable.map(([s, error]) => `- ${s.key} (${s.url}): ${error}`),
    );
  }
  const report = lines.join('\n') + '\n';
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report, 'utf8');
  return changed.length ? 1 : 0;
}

const args = process.argv.slice(2);
if (args.length === 2 && args[0] === '--record') {
  record(args[1]);
} else if (args.length === 0) {
  process.exitCode = await check();
} else {
  console.log(
    readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('*/')[0]
      .replace(/^\/\*\*\n|^ \* ?/gm, ''),
  );
  process.exitCode = 2;
}
