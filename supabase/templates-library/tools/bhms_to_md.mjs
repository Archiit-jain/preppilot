/**
 * Draft the AIAPGET Homoeopathy template from the BHMS syllabus published by NCH (nch.org.in/upload/bhms_syllabus.pdf).
 *
 * AIAPGET's bulletin says the syllabus is the subjects of NCH's graduate-level (BHMS) regulations. NCH's newer
 * competency-based curriculum so far covers only the first BHMS year, so the full BHMS syllabus is used.
 *
 * Usage: node bhms_to_md.mjs <bhms.txt> <out.md>   (`pdftotext -enc UTF-8 -layout` of the PDF)
 */

import { writeFileSync } from 'node:fs';
import { fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  endsWithAny,
  islower,
  len,
  lstrip,
  match,
  readText,
  rstrip,
  search,
  slice,
  split,
  strip,
  sub,
  unique,
} from './lib/py.mjs';

// Subject headings as printed (an all-caps line on its own), with the name used in the template.
const SUBJECTS = [
  ['ANATOMY', 'Anatomy'],
  ['PHYSIOLOGY', 'Physiology'],
  [
    'ORGANON OF MEDICINE WITH HOMOEOPATHIC PHILOSOPHY',
    'Organon of Medicine and Homoeopathic Philosophy',
  ],
  ['HOMOEOPATHIC PHARMACY', 'Homoeopathic Pharmacy'],
  ['HOMOEOPATHIC MATERIA MEDICA', 'Homoeopathic Materia Medica'],
  ['PATHOLOGY', 'Pathology and Microbiology'],
  ['FORENSIC MEDICINE AND TOXIOCOLOGY', 'Forensic Medicine and Toxicology'],
  ['REPERTORY', 'Repertory'],
  ['SURGERY', 'Surgery'],
  ['GYNAECOLOGY AND OBSTETRICS', 'Obstetrics and Gynaecology'],
  ['COMMUNITY MEDICINE', 'Community Medicine'],
  ['PRACTICE OF MEDICINE', 'Practice of Medicine'],
];
const HEAD = String.raw`^\s{0,12}\(?(?:\d{1,2}|[IVX]{1,5}|[A-Za-z]|[ivx]{1,4})[.)]\s+(.{3,}?)\s*[:;-]?\s*$`;
const STOP = String.raw`^\s*(?:[B-Z]\.\s*)?(?:Practical|Examination|Distribution of marks|Clinical|C\. )`;
const NUMBER = String.raw`^\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s*`;

function subjectBlocks(text) {
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((l, i) => {
    const s = rstrip(sub(String.raw`^Instructions:\s*`, '', strip(l)), '.');
    for (const [head, name] of SUBJECTS) {
      if (s === head && !starts.some(([, n]) => n === name)) starts.push([i, name]);
    }
  });
  starts.sort((a, b) => a[0] - b[0]);
  return starts.map(([i, name], k) => [
    name,
    lines.slice(i + 1, k + 1 < starts.length ? starts[k + 1][0] : lines.length),
  ]);
}

function parse(lines) {
  // Start at the theory part when the subject has one.
  const k = lines.findIndex((l) => match(String.raw`^\s*(?:A\.\s*)?Theory\b`, strip(l), 'i'));
  if (k >= 0) lines = lines.slice(k + 1);
  const chapters = [];
  let cur = null;
  for (const raw of lines) {
    if (!strip(raw)) continue;
    if (match(STOP, raw, 'i') && chapters.length) break;
    const indent = len(raw) - len(lstrip(raw));
    const h = match(HEAD, raw);
    const text = strip(raw);
    const isHead =
      h &&
      len(h.group(1)) < 90 &&
      (endsWithAny(text, [':', ':-', '-']) || (indent <= 2 && !text.endsWith('.')));
    if (h && !isHead && cur !== null) {
      cur[1].push(h.group(1));
      continue;
    }
    if (isHead) {
      cur = [fit(strip(h.group(1), ' .:;-'))[0], []];
      chapters.push(cur);
    } else if (cur !== null && indent > 12) {
      if (
        cur[1].length &&
        (islower(slice(text, 0, 1)) || endsWithAny(cur[1].at(-1), [',', '-', 'and', 'of']))
      ) {
        cur[1][cur[1].length - 1] = `${cur[1].at(-1)} ${text}`;
      } else {
        cur[1].push(text);
      }
    }
  }
  return chapters.map(([name, items]) => {
    const topics = [];
    for (let it of items) {
      it = sub(NUMBER, '', it);
      for (let part of split(String.raw`;\s+|(?<=[a-z\)])\.\s+`, it)) {
        part = strip(sub(NUMBER, '', part), ' .,:-');
        if (len(part) > 2 && search('[A-Za-z]{3}', part)) topics.push(...fit(part));
      }
    }
    const u = unique(topics);
    return [name, u.length ? u : [name]];
  });
}

const [input, output] = process.argv.slice(2);
const text = readText(input).replaceAll('\f', '\n');
let body = [];
for (const [name, lines] of subjectBlocks(text)) {
  const chapters = parse(lines).map(([c, t]) => [c === 'Theory' ? name : c, t]);
  console.log(
    name,
    chapters.length,
    chapters.reduce((n, [, t]) => n + t.length, 0),
  );
  if (chapters.length) body = body.concat(render(name, chapters));
}
const head = front(
  'aiapget-homoeopathy',
  'AIAPGET Homoeopathy',
  'All India AYUSH PG Entrance Test (Homoeopathy): the BHMS subjects from Anatomy to Practice of Medicine.',
  'NTA AIAPGET 2026 bulletin (syllabus = NCH graduate-level BHMS regulations); topics from the BHMS syllabus published by NCH, nch.org.in.',
);
writeFileSync(output, head + body.join('\n') + '\n', 'utf8');
