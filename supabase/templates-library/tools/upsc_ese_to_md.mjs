/**
 * Draft the four UPSC ESE templates from the ESE notification's "Standard and Syllabi".
 *
 * Usage: node upsc_ese_to_md.mjs <ese.raw.txt from `pdftotext -enc UTF-8`> <out dir>
 *
 * Each template: Paper I General Studies and Engineering Aptitude (common), then the
 * discipline's Paper I and Paper II, which together form the Prelims Paper II and
 * the two Mains papers.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clean, fit } from './gate_to_md.mjs';
import { front, papers, render } from './numbered_to_md.mjs';
import { escape, index, search, split, splitlines, sub, readText } from './lib/py.mjs';

const DISCIPLINES = [
  ['Civil Engineering', 'upsc-ese-civil'],
  ['Mechanical Engineering', 'upsc-ese-mechanical'],
  ['Electrical Engineering', 'upsc-ese-electrical'],
  ['Electronics & Telecommunication Engineering', 'upsc-ese-electronics-telecom'],
];

function generalStudies(section) {
  const line = splitlines(section).find((l) => l.startsWith('1. Current issues'));
  const items = split(String.raw`,?\s*\d{1,2}\.\s+`, ` ${line}`);
  return items.filter((i) => clean(i)).flatMap((i) => fit(clean(i)));
}

const [file, out] = process.argv.slice(2);
const text = readText(file);
mkdirSync(out, { recursive: true });
let syllabi = text.slice(index(text, 'Section-III Standard and Syllabi'));
syllabi = syllabi.slice(0, index(syllabi, 'Appendix-IIA'));
// Three Electrical chapters are printed without a colon after their title.
for (const t of [
  'Engineering Mathematics',
  'Electrical Materials',
  'Electric Circuits and Fields',
]) {
  syllabi = sub(String.raw`(\n\d\. ${escape(t)}) (?=[A-Z])`, String.raw`\1: `, syllabi);
}
const gs = generalStudies(syllabi);

const starts = DISCIPLINES.map(([name]) =>
  search(String.raw`\n\s*${escape(name)}\s*\n\s*Contents for syllabi`, syllabi).start(),
);
DISCIPLINES.forEach(([name, templateId], i) => {
  const end = i + 1 < starts.length ? starts[i + 1] : syllabi.length;
  let block = syllabi.slice(starts[i], end);
  block = block.slice(index(block, 'PAPER'));
  const parsed = papers(block);
  let body = [
    '# Prelims Paper I: General Studies and Engineering Aptitude',
    '## General Studies and Engineering Aptitude',
    ...gs.map((t) => `- ${t}`),
  ];
  for (const [paper, chapters] of parsed) body = body.concat(render(`${name}: ${paper}`, chapters));
  writeFileSync(
    join(out, `${templateId}.md`),
    front(
      templateId,
      `UPSC ESE ${name.replaceAll('&', 'and')}`,
      `Engineering Services: General Studies and Engineering Aptitude, and both ${name} papers.`,
      'UPSC Engineering Services Examination 2027 notification, Section III Standard and Syllabi; topics split from the official text.',
    ) +
      body.join('\n') +
      '\n',
    'utf8',
  );
  console.log(
    templateId,
    parsed.map(([p, c]) => [p, c.length]),
  );
});
