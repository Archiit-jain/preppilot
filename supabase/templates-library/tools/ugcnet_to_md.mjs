/**
 * Draft UGC NET templates from the official UGC NET Bureau syllabus PDFs.
 *
 * Usage: node ugcnet_to_md.mjs <dir with <key>.txt from `pdftotext -enc UTF-8`> <out dir>
 *
 * Each template has two subjects: Paper I (Teaching and Research Aptitude, common
 * to every subject) and Paper II (the subject). Units become chapters. A line
 * written as "Heading: a, b; c" becomes topics "Heading: a", "Heading: b" ... so
 * each topic keeps its context. The output is a draft, reviewed before commit.
 *
 * Also exports items() and topicsFrom(), shared with other converters.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMIT, clean, fit } from './gate_to_md.mjs';
import {
  endsWithAny,
  findall,
  islower,
  len,
  lstrip,
  match,
  search,
  slice,
  split,
  splitlines,
  strip,
  sub,
  unique,
  readText,
} from './lib/py.mjs';

const SUBJECTS = {
  commerce: ['ugc-net-commerce', 'UGC NET Commerce', '08'],
  cs: ['ugc-net-computer-science', 'UGC NET Computer Science and Applications', '87'],
  env: ['ugc-net-environmental-sciences', 'UGC NET Environmental Sciences', '89'],
  law: ['ugc-net-law', 'UGC NET Law', '58'],
  mgmt: ['ugc-net-management', 'UGC NET Management', '17'],
  pe: ['ugc-net-physical-education', 'UGC NET Physical Education', '47'],
  polsci: ['ugc-net-political-science', 'UGC NET Political Science', '02'],
  psych: ['ugc-net-psychology', 'UGC NET Psychology', '04'],
  socio: ['ugc-net-sociology', 'UGC NET Sociology', '05'],
};

const NOISE = String.raw`^(UNIVERSITY GRANTS COMMISSION.*|NET BUREAU|NET SYLLABUS|SYLLABUS.*|Subject\s*:.*|Code No.*|PAPER[- ]?I+|\d{1,3}|The details of syllabi.*)$`;
const UNIT = String.raw`^Unit\s*[-–]?\s*([IVX]+|\d+)\b\s*[:.\-–]?\s*(.*)$`;
const NUMBERED = String.raw`^(\d{1,2})\.\s+([A-Z][^.]{2,90})$`;
const HEADED = String.raw`^([A-Z][^:;]{1,60}?)\s*:\s*(.+)$`;

/** Top-level pieces of a list, split on the separators but never inside brackets. */
export function items(text, separators = ';,') {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    depth += '(['.includes(ch);
    depth -= ')]'.includes(ch);
    if (separators.includes(ch) && depth === 0) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out.filter((p) => clean(p)).map(clean);
}

export function topicsFrom(line) {
  // An inline numbered list ("1. Nature of law 2. Schools of jurisprudence")
  // is one item per number.
  const numbered = split(String.raw`(?:^|\s)\d{1,2}\.\s+(?=[A-Z])`, line).filter((p) => strip(p));
  if (numbered.length > 1) return numbered.flatMap((part) => topicsFrom(part));
  const topics = [];
  line = sub(String.raw`\b(vs|etc|e\.g|i\.e)\.\s`, (m) => `${m.group(1)} `, line);
  for (const sentence of split(String.raw`\.\s+(?=[A-Z])`, line)) {
    // Semicolons separate whole ideas; commas only list within one. So a
    // sentence is cut at semicolons first. A heading ("Environmental
    // issues: ...") carries on to the parts after it until another heading.
    let carry = null;
    for (const clause of items(sentence, ';')) {
      const headed = match(HEADED, clause);
      let parts;
      if (headed) {
        carry = clean(headed.group(1));
        parts = items(headed.group(2), ',');
      } else {
        parts = (clause.match(/,/g) || []).length >= 2 ? items(clause, ',') : [clause];
      }
      // "Forest Conservation Act, 1980": a year belongs to the piece before it.
      const joined = [];
      for (const part of parts) {
        if (joined.length && match(String.raw`^\d{4}\b`, part))
          joined[joined.length - 1] = `${joined[joined.length - 1]}, ${part}`;
        else joined.push(part);
      }
      for (const part of joined) {
        const prefixed =
          (carry && part !== clause) || (carry && !headed) ? `${carry}: ${part}` : part;
        topics.push(len(prefixed) <= LIMIT ? prefixed : part);
      }
    }
  }
  return topics.flatMap(fit);
}

const isHeading = (line) => Boolean(match(UNIT, line, 'i') || match(NUMBERED, line));

/** Rejoins lines the PDF wrapped, so one bullet or paragraph is one line. */
function logicalLines(text) {
  text = text.replaceAll('', '\n•').replaceAll('•', '\n•');
  const raw = splitlines(text)
    .map((l) => strip(l))
    .filter((l) => l && !match(NOISE, l, 'i'));
  const out = [];
  for (let line of raw) {
    const bullet = line.startsWith('•');
    line = strip(lstrip(line, '• '));
    if (!line) continue;
    if (out.length && !bullet && !isHeading(line) && !isHeading(out[out.length - 1])) {
      const prev = out[out.length - 1];
      if (prev.endsWith('-') && islower(slice(line, 0, 1))) {
        out[out.length - 1] = prev + line;
        continue;
      }
      const abbreviation = search(String.raw`\b(vs|etc|e\.g|i\.e|viz)\.$`, prev);
      if (!endsWithAny(prev, ['.', ':']) || abbreviation || islower(slice(line, 0, 1))) {
        out[out.length - 1] = `${prev} ${line}`;
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

export function units(text) {
  const lines = logicalLines(text);
  const chapters = []; // [name, [topics]]
  let pendingName = false;
  let unitNumber = '';

  for (const line of lines) {
    if (match(String.raw`^NOTE\b`, line)) break; // exam-pattern notes after the last unit are not syllabus
    if (!search('[A-Za-z]', line)) continue; // a separator line such as "*****"
    if (findall(String.raw`\bUnit\b`, line, 'i').length > 1) continue; // an overview line listing every unit
    const unit = match(UNIT, line, 'i');
    const numbered = match(NUMBERED, line);
    if (unit || numbered) {
      unitNumber = unit ? unit.group(1) : numbered.group(1);
      let name = clean(unit ? unit.group(2) : numbered.group(2));
      // A unit title that runs on into its content is cut at the first sentence.
      name = name ? fit(name.split('. ')[0])[0] : name;
      chapters.push([name, []]);
      pendingName = !name;
      continue;
    }
    if (!chapters.length) continue; // the introduction before the first unit
    if (pendingName) {
      pendingName = false;
      // A short line after an untitled unit is its title; a long one is
      // already its content, so the unit keeps its number as a name.
      if (len(line) <= 60) {
        chapters[chapters.length - 1][0] = clean(line);
        continue;
      }
      chapters[chapters.length - 1][0] = `Unit ${unitNumber}`;
    }
    chapters[chapters.length - 1][1].push(...topicsFrom(line));
  }
  // A unit can run past the validator's limit when its text is long.
  return chapters.filter(([n, t]) => n && t.length).map(([n, t]) => [n, t.slice(0, 200)]);
}

function render(subject, chapters) {
  const out = [`# ${subject}`];
  for (const [name, topics] of chapters) {
    out.push(`## ${name}`);
    out.push(...unique(topics).map((t) => `- ${t}`)); // drop exact repeats
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [src, out] = process.argv.slice(2);
  mkdirSync(out, { recursive: true });
  const paper1 = units(readText(join(src, 'paper1.txt')));
  for (const [key, [templateId, name, code]] of Object.entries(SUBJECTS)) {
    const paper2 = units(readText(join(src, `${key}.txt`)));
    const subject = name.replace('UGC NET ', '');
    const body = [
      ...render('Paper I: Teaching and Research Aptitude', paper1),
      ...render(`Paper II: ${subject}`, paper2),
    ];
    writeFileSync(
      join(out, `${templateId}.md`),
      '---\n' +
        `id: ${templateId}\n` +
        `name: ${name}\n` +
        `description: Paper I (Teaching and Research Aptitude) and the Paper II syllabus for ${subject}.\n` +
        'category: exam\n' +
        `source: UGC NET Bureau official syllabus, Paper I and subject code ${code}; topics split from the official text.\n` +
        'verified: false\n' +
        'version: 1\n' +
        '---\n' +
        body.join('\n') +
        '\n',
      'utf8',
    );
    console.log(key, '->', templateId, paper2.length, 'units');
  }
}
