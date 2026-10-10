/**
 * Draft GATE templates from the official GATE syllabus PDFs.
 *
 * Usage: node gate_to_md.mjs <dir with CODE.raw.txt from `pdftotext`> <out dir>
 *
 * The official syllabus is written as "Section N: Subject" headings followed by
 * "Chapter: topic; topic, topic" paragraphs. This turns that into the library's
 * Markdown source. The output is a draft: each file is reviewed before it is
 * committed, and is marked unverified because the topic split is mechanical.
 *
 * Also exports the shared helpers clean() and fit() used by the other converters.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { len, match, slice, split, splitlines, strip, sub, rsplit1, readText } from './lib/py.mjs';

export const PAPERS = {
  AE: ['gate-aerospace', 'GATE Aerospace Engineering'],
  AG: ['gate-agricultural', 'GATE Agricultural Engineering'],
  AR: ['gate-architecture-planning', 'GATE Architecture and Planning'],
  BM: ['gate-biomedical', 'GATE Biomedical Engineering'],
  BT: ['gate-biotechnology', 'GATE Biotechnology'],
  CH: ['gate-chemical', 'GATE Chemical Engineering'],
  CY: ['gate-chemistry', 'GATE Chemistry'],
  CE: ['gate-civil', 'GATE Civil Engineering'],
  DA: ['gate-data-science-ai', 'GATE Data Science and Artificial Intelligence'],
  EY: ['gate-ecology-evolution', 'GATE Ecology and Evolution'],
  EE: ['gate-electrical', 'GATE Electrical Engineering'],
  EC: ['gate-electronics-communication', 'GATE Electronics and Communication Engineering'],
  ES: ['gate-environmental', 'GATE Environmental Science and Engineering'],
  GE: ['gate-geomatics', 'GATE Geomatics Engineering'],
  MA: ['gate-mathematics', 'GATE Mathematics'],
  ME: ['gate-mechanical', 'GATE Mechanical Engineering'],
  MT: ['gate-metallurgical', 'GATE Metallurgical Engineering'],
  MN: ['gate-mining', 'GATE Mining Engineering'],
  NM: ['gate-naval-marine', 'GATE Naval Architecture and Marine Engineering'],
  PE: ['gate-petroleum', 'GATE Petroleum Engineering'],
  PH: ['gate-physics', 'GATE Physics'],
  ST: ['gate-statistics', 'GATE Statistics'],
  TF: ['gate-textile', 'GATE Textile Engineering and Fibre Science'],
  XL: ['gate-life-sciences', 'GATE Life Sciences'],
};

const GENERAL_APTITUDE = `# General Aptitude
## Verbal Aptitude
- Basic English grammar: tenses, articles, adjectives, prepositions, conjunctions
- Verb-noun agreement and other parts of speech
- Basic vocabulary: words, idioms and phrases in context
- Reading and comprehension
- Narrative sequencing
## Quantitative Aptitude
- Data interpretation: bar graphs, pie charts and other graphs
- 2- and 3-dimensional plots, maps and tables
- Numerical computation and estimation: ratios, percentages, powers, exponents and logarithms
- Permutations, combinations and series
- Mensuration and geometry
- Elementary statistics and probability
## Analytical Aptitude
- Logic: deduction and induction
- Analogy
- Numerical relations and reasoning
## Spatial Aptitude
- Transformation of shapes: translation, rotation, scaling, mirroring, assembling and grouping
- Paper folding, cutting and patterns in 2 and 3 dimensions
`;

const NOISE = String.raw`^(GATE 2026|IIT Guwahati.*|Page \d+.*|\d+)$`;
const SUBJECT = String.raw`^(?:Section\s*\d+\s*[:.\-–]?\s*|Part[\s-]*[A-Z0-9]+\s*(?:\([^)]*\))?\s*[:.\-–]\s*|XL-[P-U]\s+)(.*)$`;
const CHAPTER = String.raw`^([A-Z][^:;]{2,80}?):\s*(.+)$`;

export const LIMIT = 120; // the app's MAX_NAME_LENGTH

export function clean(text) {
  text = strip(sub(String.raw`\s+`, ' ', text), ' .;,:');
  text = sub(String.raw`^\(?[ivx]+\)\s*`, '', text);
  text = sub(String.raw`^(and|or)\s+`, '', text, 0, 'i');
  return text ? slice(text, 0, 1).toUpperCase() + slice(text, 1) : text;
}

export function topicsOf(text) {
  const out = [];
  for (let piece of split(String.raw`;|\.\s+(?=[A-Z])`, text)) {
    piece = clean(piece);
    if (!piece) continue;
    if (len(piece) > 110 || (piece.match(/,/g) || []).length >= 2) {
      // Long runs of comma-separated items read better one by one, but
      // never split inside brackets.
      const parts = [];
      let depth = 0;
      let current = '';
      for (const ch of piece) {
        depth += ch === '(';
        depth -= ch === ')';
        if (ch === ',' && depth === 0) {
          parts.push(current);
          current = '';
        } else current += ch;
      }
      parts.push(current);
      out.push(...parts.map(clean).filter(Boolean));
    } else out.push(piece);
  }
  return out.filter((t) => !['etc', 'etc.'].includes(t.toLowerCase())).flatMap(fit);
}

/** Splits a topic too long for the app at its natural joins; shortens as a last resort. */
export function fit(topic) {
  if (len(topic) <= LIMIT) return [topic];
  // "survey (a, b) leveling (c, d)": two bracketed lists run together; split between them.
  // Sub-item markers "(a) ... (b) ..." also start a new piece.
  const between = split(String.raw`(?<=\))\s+(?=[A-Za-z][^()]*\()|\s+\([a-h]\)\s+`, topic);
  if (between.length > 1) return between.filter((p) => clean(p)).flatMap((p) => fit(clean(p)));
  // "Heading (a, b, c)" too long as one: each bracketed item under the heading.
  const bracketed = match(String.raw`^([^()]{2,60}?)\s*\(([^()]+)\)\s*$`, topic);
  if (bracketed && bracketed.group(2).includes(',')) {
    const head = clean(bracketed.group(1));
    return bracketed
      .group(2)
      .split(',')
      .filter((p) => clean(p))
      .flatMap((p) => fit(`${head}: ${clean(p)}`));
  }
  for (const joint of [', ', ' and ', '; ', ' - ']) {
    const parts = topic.split(joint).map(clean).filter(Boolean);
    if (parts.length > 1) return parts.flatMap(fit);
  }
  const cut = rsplit1(slice(topic, 0, LIMIT - 1), ' ')[0];
  return [`${cut}…`];
}

export function convert(code, raw) {
  const [templateId, name] = PAPERS[code];
  // Page headers can land mid-sentence where a paragraph crosses a page.
  raw = sub(String.raw`GATE 2026|IIT Guwahati \| Organizing Institute`, ' ', raw);
  let lines = splitlines(raw.replaceAll('\f', '\n')).map((l) => strip(l));
  lines = lines.filter((l) => l && !match(NOISE, l) && !match(String.raw`^${code}\s`, l));

  const subjects = []; // [name, [[chapter, [topics]]]]
  let current = null;
  let skipNote = false;
  const subject = (t) => {
    current = [clean(t) || name.replace('GATE ', ''), []];
    subjects.push(current);
  };

  const xl = code === 'XL';
  for (const line of lines) {
    if (match(String.raw`^(Important Note|Note\b|In each of the following)`, line, 'i')) {
      skipNote = true;
      continue;
    }
    if (match(String.raw`^(Core|Special) Topics:?$`, line, 'i')) continue;
    // Life Sciences: the sub-papers (XL-P Chemistry ...) are the subjects,
    // and their numbered sections are chapters.
    if (xl) {
      const subm = match(String.raw`^XL-[P-U]\s+(.+?)(?:\s*\(.*\))?$`, line);
      if (subm) {
        subject(subm.group(1));
        continue;
      }
      const sec = match(String.raw`^Section\s*\d+\s*:?\s*(.*)$`, line);
      if (sec && current !== null) {
        current[1].push([clean(sec.group(1)) || `Section ${current[1].length + 1}`, []]);
        continue;
      }
    }
    const heading = match(SUBJECT, line);
    if (heading && len(line) < 120) {
      skipNote = false;
      subject(heading.group(1) || line);
      continue;
    }
    const m = match(CHAPTER, line);
    // A note runs until the next heading or chapter.
    if (skipNote && !m) continue;
    skipNote = false;
    if (current === null) subject(name.replace('GATE ', ''));
    if (m) current[1].push([clean(m.group(1)), topicsOf(m.group(2))]);
    else if (current[1].length) current[1][current[1].length - 1][1].push(...topicsOf(line));
    else current[1].push([current[0], topicsOf(line)]);
  }

  const body = [];
  for (const [t, chapters] of subjects) {
    const kept = chapters.filter(([, ts]) => ts.length);
    if (!kept.length) continue;
    body.push(`# ${t}`);
    for (const [chapter, topics] of kept) {
      body.push(`## ${chapter}`);
      body.push(...topics.map((x) => `- ${x}`));
    }
  }
  return (
    '---\n' +
    `id: ${templateId}\n` +
    `name: ${name}\n` +
    `description: General Aptitude and the full ${name.replace('GATE ', '')} paper syllabus.\n` +
    'category: exam\n' +
    `source: GATE 2026 official syllabus (${code}), IIT Guwahati; topics split from the official text.\n` +
    'verified: false\n' +
    'version: 1\n' +
    '---\n' +
    GENERAL_APTITUDE +
    body.join('\n') +
    '\n'
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [src, out] = process.argv.slice(2);
  mkdirSync(out, { recursive: true });
  for (const code of Object.keys(PAPERS)) {
    const text = readText(join(src, `${code}.raw.txt`));
    writeFileSync(join(out, `${PAPERS[code][0]}.md`), convert(code, text), 'utf8');
    console.log(code, '->', PAPERS[code][0]);
  }
}
