/**
 * Draft the AIAPGET Ayurveda template from NCISM's BAMS course curricula (Table 2 of each subject).
 *
 * AIAPGET's bulletin says the syllabus is the subjects of the graduate-level regulations of NCISM (Ayurveda)
 * and NCH (Homoeopathy). NCISM publishes one PDF per BAMS subject (ncismindia.org, 1st to 3rd professional).
 *
 * Usage: node aiapget_to_md.mjs <dir> <out.md>
 *   <dir>/<CODE>.txt  `pdftotext -enc UTF-8 -layout` of each subject PDF, CODE as in SUBJECTS below
 *
 * Table 2 comes in three shapes: numbered topics ("2.1 ..."), "1 Title: details. details." rows, and a title
 * row followed by one indented topic per line. Each is reduced to chapter -> topics; long sentences are
 * split at full stops and semicolons and shortened by fit().
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  finditer,
  fullmatch,
  len,
  lstrip,
  match,
  partition,
  readText,
  search,
  split,
  strip,
  sub,
  unique,
} from './lib/py.mjs';

const SUBJECTS = [
  ['PV', 'Padartha Vijnanam'],
  ['SN', 'Samskritam evam Ayurved Ithihas'],
  ['KS', 'Kriya Sharira'],
  ['RS', 'Rachana Sharira'],
  ['DG', 'Dravyaguna Vijnana'],
  ['RB', 'Rasashastra evam Bhaishajyakalpana'],
  ['RN', 'Roga Nidana evam Vikriti Vijnana'],
  ['AT', 'Agada Tantra evam Vidhi Vaidyaka'],
  ['SW', 'Swasthavritta evam Yoga'],
  ['SA2', 'Samhita Adhyayan 2'],
  ['KC', 'Kayachikitsa'],
  ['PK', 'Panchakarma evam Upakarma'],
  ['ST', 'Shalya Tantra'],
  ['SL', 'Shalakya Tantra'],
  ['PS', 'Prasuti Tantra evam Stri Roga'],
  ['KB', 'Kaumarabhritya'],
  ['SA3', 'Samhita Adhyayan 3'],
];
const HEADER = String.raw`^(Sr\.?|No|Paper|PART|Part|Term|hours|A2|B2|Lecture|Non-|List of Topics|Theory|Practica|l$|Table|Page|NCISM|.*BAMS\s*\(Ayurvedacharya\))`;
const CHAPTER = String.raw`^(\d{1,2})\.?\s+(?!\d)(\S.*)$`;
const PRACTICAL = String.raw`^(Demonstrat|Hands[- ]on|Video|Observe|Perform|Practical|Clinical posting|Visit|Case (?:taking|presentation)|Skill|Importance of Simulation)`;
const FOOTER = String.raw`AyUG-?\w+\s*-\s*I+\s*BAMS|^NCISM\s*\d|\d+\s*/\s*\d*$`;
const TOPIC = String.raw`^(\d{1,2})\.(\d{1,2})\.?\s+(.+)$`;
const SENTENCE_END = String.raw`(?<=[a-z\)])\.\s+`;

function table2(text) {
  const starts = [...finditer(String.raw`Table\s*2\s*:\s*Contents of Course[^\n]*\n`, text)].map(
    (m) => m.end(),
  );
  if (!starts.length) return '';
  const body = text.slice(starts.length > 1 ? starts[1] : starts[0]);
  const end = search(String.raw`Table\s*3\s*:`, body);
  return end ? body.slice(0, end.start()) : body;
}

/** [indent, text of the first column] with term numerals and stray figures removed. */
function leftCell(raw) {
  const indent = len(raw) - len(lstrip(raw));
  let text = split(String.raw`\s{3,}`, strip(raw))[0];
  text = strip(sub(String.raw`\s+(?:I{1,3}|\d{1,3})$`, '', text));
  text = sub(String.raw`^(\d{1,2})\s+\1\.\s+`, String.raw`\1 `, text); // "1 1. Title" -> "1 Title"
  return [indent, text];
}

function sentences(text) {
  const out = [];
  for (let part of split(String.raw`(?<=[a-z\)])\.\s+|;\s+`, text)) {
    part = strip(part, ' .,:-');
    if (len(part) > 3 && search('[A-Za-z]{3}', part)) out.push(...fit(part));
  }
  return out;
}

/**
 * Chapter blocks: a numbered row at the margin starts a chapter; everything up to the next one
 * belongs to it. Topics are the block's numbered items (N.M or an indented "N."), or else its
 * sentences. The chapter name is the text before the first item, or before the first colon.
 */
function parse(text) {
  const rows = table2(text)
    .split('\n')
    .filter((r) => strip(r))
    .map(leftCell)
    .filter(
      ([, l]) =>
        l && !match(HEADER, l) && !fullmatch(String.raw`[\d\s./]+`, l) && !search(FOOTER, l, 'i'),
    );
  const blocks = [];
  for (const [indent, left] of rows) {
    const c = match(CHAPTER, left);
    if (c && indent <= 2 && !match(TOPIC, left) && len(c.group(2)) > 3) blocks.push([c.group(2)]);
    else if (blocks.length) blocks.at(-1).push([indent, left]);
  }
  const chapters = [];
  for (const [head, ...lines] of blocks) {
    if (match(PRACTICAL, head, 'i')) continue;
    const items = [];
    const titleTail = [];
    for (const [indent, left] of lines) {
      const t = match(TOPIC, left);
      const c = match(CHAPTER, left);
      if (t) items.push(t.group(3));
      else if (c && indent > 2) items.push(c.group(2));
      else if (items.length) items[items.length - 1] += ` ${left}`;
      else titleTail.push(left);
    }
    const title = [head, ...titleTail].join(' ');
    let name;
    let topics;
    if (items.length) {
      name = split(String.raw`:\s`, title, 1)[0];
      topics = [];
      for (const it of items) {
        if (match(PRACTICAL, it, 'i')) continue;
        const first = split(SENTENCE_END, strip(it), 1)[0];
        topics.push(...fit(strip(first, ' .:-')));
      }
    } else {
      const [before, , rest] = partition(title, ':');
      name = before;
      topics = strip(rest) ? sentences(rest) : sentences(name).slice(1);
      if (!topics.length) topics = [fit(strip(name, ' .:-'))[0]];
    }
    name = fit(strip(sub(String.raw`\s+`, ' ', name), ' .:-'))[0];
    topics = unique(topics).filter((t) => t && t !== name);
    chapters.push([name, topics.length ? topics : [name]]);
  }
  return chapters;
}

const [src, out] = process.argv.slice(2);
let body = [];
for (const [code, name] of SUBJECTS) {
  const chapters = parse(readText(join(src, `${code}.txt`)));
  console.log(
    code,
    chapters.length,
    chapters.reduce((n, [, t]) => n + t.length, 0),
  );
  // The app allows at most 120 chapters in a subject; split longer ones into parts.
  const parts = [];
  for (let i = 0; i < chapters.length; i += 100) parts.push(chapters.slice(i, i + 100));
  if (!parts.length) parts.push([]);
  parts.forEach((part, k) => {
    body = body.concat(render(parts.length === 1 ? name : `${name} (Part ${k + 1})`, part));
  });
}
const head = front(
  'aiapget-ayurveda',
  'AIAPGET Ayurveda',
  'All India AYUSH PG Entrance Test (Ayurveda): the BAMS subjects of the first to third professional years.',
  "NTA AIAPGET 2026 bulletin (syllabus = NCISM graduate-level BAMS curriculum); topics from NCISM's BAMS course curricula, Table 2 of each subject, ncismindia.org.",
);
writeFileSync(out, head + body.join('\n') + '\n', 'utf8');
