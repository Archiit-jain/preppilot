/**
 * Draft the SSC JE Civil, Electrical and Mechanical templates.
 *
 * Usage: node ssc_je_to_md.mjs <je.txt from `pdftotext -enc UTF-8`> <out dir>
 *
 * Source: SSC "Notice of Junior Engineer Examination, 2026" (ssc.gov.in, notice board,
 * Notice_of_adv_je_2026.pdf), para 14 Indicative Syllabus. Paper I is General
 * Intelligence and Reasoning, General Awareness and the engineering part; Paper II is
 * the engineering part in detail, so the engineering topics come from Paper II and
 * cover both papers.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { topics } from './csir_net_to_md.mjs';
import { clean, fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  fullmatch,
  index,
  match,
  partition,
  readText,
  search,
  splitlines,
  strip,
  sub,
  unique,
} from './lib/py.mjs';

const PARTS = [
  ['Part-A (Civil & Structural Engineering):', 'ssc-je-civil', 'Civil'],
  ['Part-B (Electrical Engineering):', 'ssc-je-electrical', 'Electrical'],
  ['Part- C (Mechanical Engineering):', 'ssc-je-mechanical', 'Mechanical'],
];
const END = 'Part-D (Computer Science and Information Technology):';

function paperOne(text) {
  const start = index(text, '14.2 PAPER-I:');
  const block = sub(
    String.raw`\s+`,
    ' ',
    text.slice(start, index(text, 'Part-A (Civil Engineering):', start)),
  );
  const reasoning = block
    .slice(index(block, 'General Intelligence & Reasoning:'))
    .split('14.2.2')[0];
  const awareness = block.slice(index(block, 'General Awareness:'));
  const out = [];
  for (const [name, para] of [
    ['General Intelligence and Reasoning', reasoning],
    ['General Awareness', awareness],
  ]) {
    const body = partition(para, ':')[2];
    // The list of question types is the syllabus; the sentences around it describe the test.
    const listed =
      search(String.raw`questions on (.+?)(?:, etc)?\.`, body) ||
      search(String.raw`pertaining to (.+?)(?:, etc)?\.`, body);
    let items = listed
      .group(1)
      .replaceAll('problemsolving', 'problem-solving')
      .split(',')
      .filter((x) => clean(x))
      .map(clean);
    if (name === 'General Awareness') {
      items = [
        'Current events',
        'Everyday observation and experience in their scientific aspect',
        ...items.map((i) => `India and its neighbouring countries: ${i}`),
      ];
    }
    out.push([`Paper I: ${name}`, [[name, items]]]);
  }
  return out;
}

function engineering(text, heading) {
  const start = index(text, heading, index(text, '14.3 PAPER II:')) + heading.length;
  const following = PARTS.map(([p]) => p).filter((p) => text.indexOf(p, start) > 0);
  const end = Math.min(...following.map((p) => index(text, p, start)), index(text, END, start));
  let block = text.slice(start, end);
  block = sub(String.raw`\n\s*14\.3\.\d\s*\n`, '\n', block); // para numbers between wrapped lines
  const lines = splitlines(block)
    .filter((l) => strip(l) && !fullmatch(String.raw`Page \d+.*|\d+`, strip(l)))
    .map((l) => strip(l));
  const joined = [];
  for (const line of lines) {
    if (
      joined.length &&
      !search('[.:;]$', joined[joined.length - 1]) &&
      !match(String.raw`^[A-Z][^:]{2,60}:`, line)
    )
      joined[joined.length - 1] += ` ${line}`;
    else joined.push(line);
  }
  const chapters = [];
  for (const line of joined) {
    const headed = match(String.raw`^([A-Z][^:]{2,70}):\s*(.*)$`, line);
    if (headed && !headed.group(2)) continue; // a group heading ("Construction Materials and Management:"); its lines follow
    let content = headed ? headed.group(2) : line;
    for (const [wrong, right] of [
      ['A.C. Circuits', 'AC circuits'],
      ['StarDelta', 'Star-Delta'],
      ['CAD/CAM', 'CAD-CAM'],
      ['reuse/ recycle', 'reuse, recycle'],
    ])
      content = content.replaceAll(wrong, right);
    content = sub(String.raw`\s*/\s*`, '; ', content); // Mechanical lists its topics with slashes
    const found = topics(content);
    if (headed) chapters.push([fit(clean(headed.group(1)))[0], found]);
    else if (chapters.length) chapters[chapters.length - 1][1].push(...found);
  }
  return chapters.map(([c, t]) => [c, unique(t)]);
}

const [file, out] = process.argv.slice(2);
const text = readText(file);
mkdirSync(out, { recursive: true });
const common = paperOne(text);
for (const [heading, templateId, branch] of PARTS) {
  const chapters = engineering(text, heading);
  let body = [];
  for (const [subject, chs] of common) body = body.concat(render(subject, chs));
  body = body.concat(render(`${branch} Engineering (Papers I and II)`, chapters));
  writeFileSync(
    join(out, `${templateId}.md`),
    front(
      templateId,
      `SSC JE ${branch}`,
      `Junior Engineer (${branch}): reasoning and general awareness, and the ${branch.toLowerCase()} engineering syllabus of Papers I and II.`,
      'SSC Notice of Junior Engineer Examination 2026, para 14 Indicative Syllabus; topics split from the official text.',
    ) +
      body.join('\n') +
      '\n',
    'utf8',
  );
  console.log(
    templateId,
    chapters.length,
    'chapters',
    chapters.reduce((n, [, t]) => n + t.length, 0),
    'topics',
  );
}
