/**
 * Draft the CS Executive, CS Professional and CMA Foundation, Intermediate and Final templates.
 *
 * CSEET's syllabus is a two-column table that does not extract cleanly; src/professional/cseet.md
 * is written by hand from it.
 *
 * Usage: node cs_cma_to_md.mjs <dir> <out dir> [ids...]
 *   <dir>/cs/<paper>.txt `pdftotext -enc UTF-8 -l 30` of each ICSI Syllabus 2022 study material
 *                       (icsi.edu Executive and Professional Programme pages); each opens with the
 *                       paper's official syllabus ("SYLLABUS" ... "ARRANGEMENT OF STUDY LESSONS")
 *   <dir>/cma.txt       `pdftotext -enc UTF-8` of ICMAI CMA Prospectus with Syllabus 2022
 *                       (icmai.in, Syllabus 2022 page)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { topics } from './csir_net_to_md.mjs';
import { clean, fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  finditer,
  index,
  len,
  match,
  readText,
  search,
  slice,
  split,
  strip,
  sub,
  title as pyTitle,
  unique,
} from './lib/py.mjs';

const read = (path) => readText(path).normalize('NFKC').replaceAll('\f', '\n');

/** ICSI lists sub-topics after a bullet that extracts as a lone "l". */
function bullets(text) {
  const out = [];
  for (let item of split(String.raw`(?:^|\s)l\s+(?=[A-Z0-9(])`, sub(String.raw`\s+`, ' ', text))) {
    item = clean(item);
    if (item && search('[A-Za-z]{3}', item))
      out.push(...(len(item) <= 110 ? [item] : topics(item)));
  }
  return unique(out);
}

// --- ICSI Executive and Professional -----------------------------------------
const EXECUTIVE = [
  ['e1', 'Paper 1: Jurisprudence, Interpretation and General Laws'],
  ['e2', 'Paper 2: Company Law and Practice'],
  ['e3', 'Paper 3: Setting Up of Business, Industrial and Labour Laws'],
  ['e4', 'Paper 4: Corporate Accounting and Financial Management'],
  ['e5', 'Paper 5: Capital Market and Securities Laws'],
  ['e6', 'Paper 6: Economic, Commercial and Intellectual Property Laws'],
  ['e7', 'Paper 7: Tax Laws and Practice'],
];
const PROFESSIONAL = [
  ['p1', 'Paper 1: Environmental, Social and Governance (ESG) - Principles and Practice'],
  ['p2', 'Paper 2: Drafting, Pleadings and Appearances'],
  ['p3', 'Paper 3: Compliance Management, Audit and Due Diligence'],
  ['p41', 'Elective Paper 4.1: CSR and Social Governance'],
  ['p42', 'Elective Paper 4.2: Internal and Forensic Audit'],
  ['p43', 'Elective Paper 4.3: Intellectual Property Rights - Law and Practice'],
  ['p44', 'Elective Paper 4.4: AI, Data Analytics and Cyber Security - Laws and Practice'],
  ['p45', 'Elective Paper 4.5: Advanced Direct Tax Laws and Practice'],
  ['p46', 'Elective Paper 4.6: IFSCA - Regulations, Listing and Compliances'],
  ['p5', 'Paper 5: Strategic Management and Corporate Finance'],
  ['p6', 'Paper 6: Corporate Restructuring, Valuation and Insolvency'],
  ['p71', 'Elective Paper 7.1: Arbitration, Mediation and Conciliation'],
  ['p72', 'Elective Paper 7.2: GST and Corporate Tax Planning'],
  ['p73', 'Elective Paper 7.3: Labour Laws and Practice'],
  ['p74', 'Elective Paper 7.4: Banking and Insurance - Laws and Practice'],
  ['p75', 'Elective Paper 7.5: Insolvency and Bankruptcy - Law and Practice'],
];

function icsiPaper(text) {
  // "SYLLABUS", "SYLLABUS*" or "SYLLABUS OBJECTIVES: ..." at the start of a line.
  const start =
    search(String.raw`^\s*SYLLABUS\b\*?`, text, 'm') || search('Level of Knowledge', text);
  const end = search('ARRANGEMENT OF STUDY|LESSON WISE SUMMARY', text.slice(start.end()));
  let block = end ? text.slice(start.end(), start.end() + end.start()) : text.slice(start.end());
  block = sub(String.raw`\(\s*[ivxl]+\s*\)`, ' ', block); // page numbers in roman numerals
  block = sub(String.raw`\s+`, ' ', block);
  // Lesson titles, from the "Arrangement of Study Lessons" list, for papers whose syllabus
  // runs a title straight into its contents without a colon.
  const arrangement = search(
    'ARRANGEMENT OF STUDY LESSONS(.{0,3000})',
    sub(String.raw`\s+`, ' ', text),
  );
  let lessons = [];
  if (arrangement) {
    lessons = split(String.raw`(?<![\d.])\b\d{1,2}\.\s+`, arrangement.group(1))
      .slice(1)
      .filter((t) => clean(t))
      .map(clean);
  }
  const chapters = [];
  for (const item of split(String.raw`(?<![\d.])\b(?=\d{1,2}\.\s+[A-Z])`, block)) {
    let head = match(String.raw`(\d{1,2})\.\s+([^:]{3,140}?)\s*:\s*(.*)$`, strip(item));
    const plain = match(String.raw`(\d{1,2})\.\s+(.*)$`, strip(item));
    if (plain && lessons.length) {
      const m = lessons.find((l) => plain.group(2).startsWith(slice(l, 0, 40)) && len(l) > 5);
      if (m !== undefined && (!head || len(head.group(2)) > len(m) + 20)) {
        const rest = plain.group(2).startsWith(m)
          ? slice(plain.group(2), len(m))
          : slice(plain.group(2), 40);
        head = match(String.raw`(\d+)\.\s+(.*?)\s*:\s*(.*)$`, `${plain.group(1)}. ${m}: ${rest}`);
      }
    }
    if (!head) continue;
    let found = bullets(head.group(3));
    if (found.length <= 1 && head.group(3).includes(';')) {
      // some papers list sub-topics with semicolons
      found = head
        .group(3)
        .split(';')
        .flatMap((p) => fit(clean(p)))
        .filter((t) => search('[A-Za-z]{3}', t));
    }
    if (found.length) chapters.push([fit(clean(head.group(2)))[0], found]);
  }
  return chapters;
}

const icsi = (src, papers) =>
  papers.map(([key, name]) => [name, icsiPaper(read(join(src, 'cs', `${key}.txt`)))]);

// --- ICMAI CMA ---------------------------------------------------------------
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const CMA_LEVELS = {
  'cma-foundation': range(1, 5),
  'cma-intermediate': range(5, 13),
  'cma-final': range(13, 21),
};

function cmaPapers(text) {
  const papers = new Map();
  // The case-study, reading-list and fee pages follow the last paper.
  text = text.slice(0, index(text, 'APPLICATIONS OF LEARNING POINTS'));
  // "PAPER - 5 BUSINESS LAWS...", "PAPER - 3" (title on the next lines), "PAPER - 20 A STRATEGIC..."
  const heads = [
    ...finditer(
      String.raw`^PAPER\s*-\s*(\d{1,2})\s?([A-C])?\b[ \t]*([A-Z][A-Z ,&()\-]*?)?[ \t]*$`,
      text,
      'm',
    ),
  ];
  heads.forEach((head, n) => {
    const end = n + 1 < heads.length ? heads[n + 1].start() : text.length;
    let body = text.slice(head.end(), end);
    const titleMore = match(
      String.raw`\s*([A-Z][A-Z ,&()\-]+)\n(?:\s*([A-Z][A-Z ,&()\-]+)\n)?`,
      body,
    ); // wrapped titles
    let t = [head.group(3) || '', ...(titleMore ? titleMore.groups() : [])]
      .filter(Boolean)
      .join(' ');
    t = sub(String.raw`\s*\(SECTION\s*-\s*[AB]\)`, '', t);
    const number = Number(head.group(1));
    const key = `${number}${head.group(2) || ''}`;
    // The whole paper body: the PDF's page order can put later modules before "SECTION A".
    // Only "N. Title" followed by "N.M" items counts, so the weight table is skipped.
    body = sub(String.raw`\s+`, ' ', body);
    body = sub(
      String.raw`www\.icmai\.in|CMA Prospectus - \d{4}|\d+ The Institute of Cost Accountants of India`,
      ' ',
      body,
    );
    let chapters = [];
    for (const item of split(String.raw`(?<![\d.,])\b(?=\d{1,2}\.\s+[A-Z])`, body)) {
      const head2 = match(String.raw`(\d{1,2})\.\s+(.*)$`, strip(item));
      if (!head2) continue;
      const pieces = split(String.raw`\s*\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s+`, head2.group(2));
      const title2 = split(String.raw`\s+SECTION\s+[A-Z]\s*:`, pieces[0])[0];
      let found = pieces
        .slice(1)
        .map((p) => clean(split(String.raw`\s+SECTION\s+[A-Z]\s*:`, p)[0]));
      found = found.flatMap(fit).filter((x) => search('[A-Za-z]{3}', x));
      if (found.length) chapters.push([fit(clean(title2))[0], unique(found)]);
    }
    const merged = new Map();
    for (const [c, ts] of chapters) {
      // a module split by a page break appears twice
      if (!merged.has(c)) merged.set(c, []);
      merged.get(c).push(...ts);
    }
    chapters = [...merged].map(([c, ts]) => [c, unique(ts)]);
    const name = pyTitle(sub(String.raw`\s*\([A-Z]+\)\s*$`, '', t))
      .replaceAll(' And ', ' and ')
      .replaceAll(' Of ', ' of ');
    if (!papers.has(key)) papers.set(key, [`Paper ${key}: ${name}`, chapters]);
  });
  return papers;
}

function cma(text, numbers) {
  const papers = cmaPapers(text);
  const num = (k) => Number(match(String.raw`\d+`, k).group(0));
  return [...papers.keys()]
    .sort((a, b) => num(a) - num(b) || (a < b ? -1 : a > b ? 1 : 0))
    .filter((k) => numbers.includes(num(k)))
    .map((k) => papers.get(k));
}

const TEMPLATES = [
  [
    'cs-executive',
    'CS Executive',
    'ICSI Executive Programme (Syllabus 2022): Groups 1 and 2, seven papers.',
    "ICSI Syllabus 2022, the syllabus page of each paper's official study material, icsi.edu.",
    (src) => icsi(src, EXECUTIVE),
  ],
  [
    'cs-professional',
    'CS Professional',
    "ICSI Professional Programme (Syllabus 2022): core papers and both elective papers' options.",
    "ICSI Syllabus 2022, the syllabus page of each paper's official study material, icsi.edu.",
    (src) => icsi(src, PROFESSIONAL),
  ],
  [
    'cma-foundation',
    'CMA Foundation',
    'ICMAI CMA Foundation (Syllabus 2022): Papers 1 to 4.',
    'ICMAI CMA Prospectus, Syllabus 2022, detailed contents; topics from the official text.',
    (src) => cma(read(join(src, 'cma.txt')), CMA_LEVELS['cma-foundation']),
  ],
  [
    'cma-intermediate',
    'CMA Intermediate',
    'ICMAI CMA Intermediate (Syllabus 2022): Groups I and II, Papers 5 to 12.',
    'ICMAI CMA Prospectus, Syllabus 2022, detailed contents; topics from the official text.',
    (src) => cma(read(join(src, 'cma.txt')), CMA_LEVELS['cma-intermediate']),
  ],
  [
    'cma-final',
    'CMA Final',
    'ICMAI CMA Final (Syllabus 2022): Groups III and IV, Papers 13 to 20 with electives.',
    'ICMAI CMA Prospectus, Syllabus 2022, detailed contents; topics from the official text.',
    (src) => cma(read(join(src, 'cma.txt')), CMA_LEVELS['cma-final']),
  ],
];

const [src, out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const [templateId, name, description, source, parse] of TEMPLATES) {
  if (only.length && !only.includes(templateId)) continue;
  const subjects = parse(src);
  let body = [];
  for (const [subject, chapters] of subjects)
    body = body.concat(
      render(
        subject,
        chapters.filter(([, t]) => t.length).map(([c, t]) => [c, t.slice(0, 200)]),
      ),
    );
  writeFileSync(
    join(out, `${templateId}.md`),
    front(templateId, name, description, source) + body.join('\n') + '\n',
    'utf8',
  );
  console.log(
    templateId,
    subjects.map(([s, c]) => [slice(s, 0, 30), c.length]),
  );
}
