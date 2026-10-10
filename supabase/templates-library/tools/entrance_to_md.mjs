/**
 * Draft the NIMCET, BITSAT, IISER IAT, AMU B.Tech and CFTRI M.Sc. templates.
 *
 * Usage: node entrance_to_md.mjs <dir with *.txt from `pdftotext -enc UTF-8`> <out dir> [keys...]
 *
 * Sources (each the official syllabus):
 *   nimcet.txt  NIMCET revised syllabus (w.e.f. 2026), nimcet.admissions.nic.in
 *   bitsat.txt  BITSAT-2026 syllabus, admissions.bits-pilani.ac.in
 *   iat.txt     IAT 2026 Information Brochure, "Syllabi for IAT 2026", iiseradmission.in
 *   amu.txt     AMU B.Tech. admission test syllabus, amucontrollerexams.com
 *   cftri.txt   CSIR-CFTRI M.Sc. (Food Technology) 2026-28 entrance syllabus, cftri.res.in
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { topics } from './csir_net_to_md.mjs';
import { clean, fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  escape,
  index,
  isupper,
  islower,
  match,
  readText,
  search,
  slice,
  split,
  splitWs,
  splitlines,
  strip,
  sub,
  title,
  unique,
} from './lib/py.mjs';

function read(path) {
  const text = readText(path).normalize('NFKC');
  // Words hyphenated across lines ("com- bination"), but not "p- d- and f-block".
  return sub(String.raw`([a-z]{2})- (?=[a-z]{2})`, String.raw`\1`, text);
}

const flat = (text) => strip(sub(String.raw`\s+`, ' ', text));

const SENTENCE_CASE = String.raw`[A-Z][a-z]+(?: [a-z&]+){0,5}`; // "Breathing and exchange of gases"
const TITLE_CASE = String.raw`[A-Z][a-z]+(?: (?:and|of|in|the|&|[A-Z][A-Za-z]+)){0,6}`; // "Dual Nature of Radiation and Matter"

/** Lines "Chapter: topics". A line ending in ':' alone heads the lines that follow
 *  when they have no heading of their own. */
function headed(block, inline = SENTENCE_CASE) {
  const chapters = [];
  let group = null;
  // A chapter name with a colon inside a run-on line starts a chapter too; `inline`
  // is the casing the source uses for chapter names, so sub-headings are not taken.
  const small = new Set(['the', 'of', 'and', 'in', 'to', 'for', 'a', 'an', '&', 'its', 'their']);
  const splitter = (m) => {
    const before = m.group(1);
    const space = m.group(2);
    if (space.includes('\n')) return before + space;
    // Inside a title ("Structure of the Atom:", "Chemical Kinetics:") the word before
    // is a small word or capitalised; after a list item it is lower case or punctuation.
    // Biology lists capitalised items ("Eukaryotic Cells Biomolecules:"), so in
    // sentence-case sources only the small words count.
    let startsChapter;
    if (inline === SENTENCE_CASE) startsChapter = !small.has(before.toLowerCase());
    else
      startsChapter =
        '.;)'.includes(slice(before, -1)) ||
        (islower(slice(before, 0, 1)) && !small.has(before.toLowerCase()));
    return before + (startsChapter ? '\n' : space);
  };
  block = sub(String.raw`(\S+)(\s+)(?=${inline}: )`, splitter, block);
  for (const line of splitlines(block)
    .filter((l) => strip(l))
    .map((l) => strip(l))) {
    const heading = match(String.raw`^([A-Z][^:]{2,80}?)\s*:\s*(.*)$`, line);
    if (heading && !heading.group(2)) {
      group = clean(heading.group(1));
      continue;
    }
    if (heading && splitWs(heading.group(1)).length <= 10)
      chapters.push([clean(heading.group(1)), topics(heading.group(2))]);
    else if (chapters.length && chapters[chapters.length - 1][0] === group)
      chapters[chapters.length - 1][1].push(...topics(line));
    else if (group) chapters.push([group, topics(line)]);
    else if (chapters.length) chapters[chapters.length - 1][1].push(...topics(line));
  }
  const merged = new Map(); // a group heading and its first chapter can share a name ("Cell")
  for (const [c, t] of chapters) {
    const key = fit(c)[0];
    if (!merged.has(key)) merged.set(key, []);
    merged.get(key).push(...t);
  }
  return [...merged].filter(([, t]) => t.length).map(([c, t]) => [c, unique(t)]);
}

/** Splits a run-on block at known chapter titles, in order. */
function titled(block, titles) {
  const text = flat(block);
  const positions = [];
  let start = 0;
  for (const t of titles) {
    const found = search(escape(t) + String.raw`\s*:?\s*`, text.slice(start));
    if (!found) throw new Error(`title not found: ${t}`);
    positions.push([start + found.start(), start + found.end(), t]);
    start += found.end();
  }
  return positions.map(([, contentStart, t], i) => {
    const end = i + 1 < positions.length ? positions[i + 1][0] : text.length;
    return [t, topics(text.slice(contentStart, end))];
  });
}

function between(text, start, end = null) {
  const i = index(text, start) + start.length;
  return end ? text.slice(i, index(text, end, i)) : text.slice(i);
}

// --- NIMCET -----------------------------------------------------------------
function nimcet(text) {
  const out = [];
  for (const [name, start, end] of [
    ['Mathematics', 'Mathematics: (50 Questions)', 'Analytical Ability'],
    [
      'Analytical Ability and Logical Reasoning',
      'Logical Reasoning: (40 Questions)',
      'Computer Awareness',
    ],
    ['Computer Awareness', 'Computer Awareness: (20 Questions)', 'General English'],
    ['General English', 'General English: (10 Questions)', null],
  ]) {
    const block = between(text, start, end);
    let chapters = headed(block);
    if (!chapters.length) chapters = [[name, topics(flat(block))]];
    out.push([name, chapters]);
  }
  return out;
}

// --- BITSAT -----------------------------------------------------------------
function bitsat(text) {
  text = sub(String.raw`\n\s*[IVX]+\s*\n`, '\n', text); // page numbers in roman numerals
  text = flat(text);
  // Part III holds two tests; give each its own part.
  text = text
    .replaceAll(
      'Part III: (a) English Proficiency and (b) Logical Reasoning (a) English Proficiency',
      'Part III: English Proficiency',
    )
    .replaceAll('(b) Logical Reasoning', 'Part III: Logical Reasoning');
  const names = [
    'Physics',
    'Chemistry',
    'English Proficiency',
    'Logical Reasoning',
    'Mathematics',
    'Biology',
  ];
  const out = [];
  for (const part of split(String.raw`Part [IVX]+:\s*`, text).slice(1)) {
    const name = names.find((n) => part.startsWith(n));
    const body = part.slice(name.length);
    const chapters = [];
    // Chapters are "1. Title" ("1: Title" in Biology); topics are "1.1 ...".
    for (const chapter of split(String.raw`(?<![\d.])(?=\b\d{1,2}[.:]\s+[A-Za-z])`, body)) {
      const head = match(String.raw`(\d{1,2})[.:]\s+(.*)$`, strip(chapter));
      if (!head) continue;
      const pieces = split(String.raw`\s*\b\d{1,2}\.\d{1,2}\s+`, head.group(2));
      const t = clean(pieces[0]);
      let found;
      if (name === 'Logical Reasoning') {
        // Each item is "Term: what the question looks like"; the term is the topic.
        found = pieces.slice(1).map((p) => clean(p.split(':')[0]));
      } else {
        found = pieces.slice(1).flatMap((p) => topics(p));
        if (!found.length) found = topics(t);
      }
      chapters.push([fit(t)[0], unique(found)]);
    }
    out.push([name, chapters.filter(([, x]) => x.length)]);
  }
  return out;
}

// --- IISER IAT --------------------------------------------------------------
function iat(text) {
  text = sub(
    String.raw`IISER Aptitude Test \(IAT\) 2026 – Information Brochure|\n\s*\d{1,2}\s*\n`,
    '\n',
    text,
  );
  text = text.slice(index(text, 'A. Biology', index(text, 'SYLLABI FOR IAT 2026') - 200));
  text = text.replaceAll('SYLLABI FOR IAT 2026', '');
  const out = [];
  for (const [letter, name, nxt] of [
    ['A', 'Biology', 'B. Chemistry'],
    ['B', 'Chemistry', 'C. Mathematics'],
    ['C', 'Mathematics', 'D. Physics'],
    ['D', 'Physics', null],
  ]) {
    const block = between(text, `${letter}. ${name}`, nxt || 'ANNEXURE');
    out.push([name, headed(block, name === 'Biology' ? SENTENCE_CASE : TITLE_CASE)]);
  }
  return out;
}

// --- AMU B.Tech -------------------------------------------------------------
const AMU_PHYSICS = [
  'Physical World and Measurement',
  'Kinematics',
  'Laws of Motion',
  'Work, Energy and Power',
  'Motion of System of Particles and Rigid Body',
  'Gravitation',
  'Properties of Bulk Matter',
  'Thermodynamics',
  'Behaviour of Perfect Gas and Kinetic Theory',
  'Oscillations and Waves',
  'Electrostatics',
  'Current Electricity',
  'Magnetic Effects of Current and Magnetism',
  'Electromagnetic Induction and Alternating Currents',
  'Electromagnetic Waves',
  'Optics',
  'Dual Nature of Matter and Radiation',
  'Atoms & Nuclei',
  'Electronic Devices',
];
const AMU_CHEMISTRY = [
  'Some Basic Concepts of Chemistry',
  'Structure of Atom',
  'Classification of Elements and Periodicity in Properties',
  'Chemical Bonding and Molecular Structure',
  'States of Matter : Gases and Liquids',
  'Chemical Thermodynamics',
  'Equilibrium',
  'Redox Reactions',
  'Hydrogen',
  's-Block Elements',
  'Some p-Block Elements',
  'Organic Chemistry – Some Basic Principles and Techniques',
  'Hydrocarbons',
  'Environmental Chemistry',
  'Solid State',
  'Solutions',
  'Electrochemistry',
  'Chemical Kinetics',
  'Surface Chemistry',
  'General Principles and Processes of Isolation of Elements',
  'p-Block Elements',
  'd and f-Block Elements',
  'Coordination Compounds',
  'Haloalkanes and Haloarenes',
  'Alcohols, Phenols and Ethers',
  'Aldehydes, Ketones and Carboxylic Acids',
  'Organic Compounds Containing Nitrogen',
  'Biomolecules',
  'Polymers',
  'Chemistry in Every Day Life',
];
const AMU_MATHS = [
  '1. SETS',
  '2. RELATIONS & FUNCTIONS',
  '3. TRIGNOMETRIC FUCNTIONS',
  '1. PRINCIPLE OF MATHEMATICAL INDUCTION',
  '2. COMPLEX NUMBERS AND QUADRATIC EQUATIONS',
  '3. LINEAR INEQUALITIES',
  '4. PERMUTATIONS AND COMBINATIONS',
  '5. BINOMIAL THEOREM',
  '6. SEQUENCE AND SERIES',
  '1. STRAIGHT LINES',
  '2. CONIC SECTION',
  '3. INTRODUCTION TO THREE DIMENSIONAL GEOMETRY',
  'LIMITS AND DERIVATIVES',
  '1. MATHEMATICAL REASONING',
  '2. PROBABILITY',
  '1. Relations and Functions',
  '2. Inverse Trigonometric Functions',
  '1. Matrices',
  '2. Determinants',
  '1. Continuity and Differentiability',
  '2. Applications of Derivatives',
  '3. Integrals',
  '4. Applications of the Integrals',
  '5. Differential Equations',
  '1. Vectors',
  '2. Three – dimensional Geometry',
  '1. Linear programming',
  '1. Probability',
];
// The official file misspells two titles; the template uses the right spelling.
const AMU_NAMES = {
  'TRIGNOMETRIC FUCNTIONS': 'Trigonometric Functions',
  'Chemistry in Every Day Life': 'Chemistry in Everyday Life',
  'States of Matter : Gases and Liquids': 'States of Matter: Gases and Liquids',
};

function amuName(t) {
  t = sub(String.raw`^\d+\.\s*`, '', t);
  t = AMU_NAMES[t] ?? t;
  return isupper(t)
    ? title(t).replaceAll(' And ', ' and ').replaceAll(' Of ', ' of ').replaceAll(' To ', ' to ')
    : t;
}

function amu(text) {
  text = flat(text);
  const physics = between(text, 'Physics', 'Chemistry CHEMISTRY');
  const chemistry = between(text, 'Chemistry CHEMISTRY', 'Mathematics UNIT');
  const mathsStart = index(text, 'Mathematics UNIT');
  let maths = text.slice(mathsStart, index(text, 'B.ARCH', mathsStart));
  const second = maths.indexOf('1. SETS', maths.indexOf('1. SETS') + 1);
  maths = second > 0 ? maths.slice(0, second) : maths;
  maths = sub(
    String.raw`UNIT\s*[-–]?\s*[IVX]+\s*:\s*[A-Z &]+?(?=\s+\d\.|\s+[A-Z]{2,})`,
    ' ',
    maths,
  );
  maths = sub(String.raw`RECOMMENDED TEXT BOOKS.*?Publication\.\s*`, ' ', maths);
  const out = [];
  for (const [name, block, titles] of [
    ['Physics', physics, AMU_PHYSICS],
    ['Chemistry', chemistry, AMU_CHEMISTRY],
    ['Mathematics', maths, AMU_MATHS],
  ])
    out.push([
      name,
      titled(block, titles)
        .filter(([, t]) => t.length)
        .map(([c, t]) => [amuName(c), t]),
    ]);
  return out;
}

// --- CFTRI ------------------------------------------------------------------
const CFTRI = [
  'Physics',
  'Chemistry',
  'Mathematics',
  'Botany & Zoology',
  'Microbiology & Biotechnology',
  'Biochemistry & Nutrition',
  'Agriculture and Dairy Technology',
  'Food Engineering',
  'Food Processing',
  'Mental Ability',
  'General Awareness on health & wellness',
];

function cftri(text) {
  const lines = splitlines(text).map((l) => strip(l));
  const at = lines.indexOf('Physics');
  if (at < 0) throw new Error('Physics not found');
  let body = lines.slice(at).join('\n');
  body = body.split('*****')[0];
  const out = [];
  CFTRI.forEach((name, i) => {
    const start = i ? index(body, `\n${name}\n`) : 0;
    const end = i + 1 < CFTRI.length ? index(body, `\n${CFTRI[i + 1]}\n`) : body.length;
    const block = slice(strip(body.slice(start, end)), name.length);
    const chapters = name === 'Agriculture and Dairy Technology' ? headed(block) : [];
    out.push([name, chapters.length ? chapters : [[name, topics(flat(block))]]]);
  });
  return out;
}

const TEMPLATES = [
  [
    'nimcet',
    'nimcet',
    'NIMCET',
    nimcet,
    'NIT MCA Common Entrance Test: Mathematics, Analytical Ability and Logical Reasoning, Computer Awareness and General English.',
    'NIMCET revised syllabus (with effect from 2026), nimcet.admissions.nic.in; topics split from the official text.',
  ],
  [
    'bitsat',
    'bitsat',
    'BITSAT',
    bitsat,
    'BITS Admission Test: Physics, Chemistry, Mathematics or Biology, English Proficiency and Logical Reasoning.',
    'BITSAT-2026 official syllabus, BITS Pilani admissions; topics split from the official text.',
  ],
  [
    'iat',
    'iiser-iat',
    'IISER IAT',
    iat,
    'IISER Aptitude Test: Biology, Chemistry, Mathematics and Physics.',
    'IAT 2026 Information Brochure, Syllabi for IAT 2026, iiseradmission.in; topics split from the official text.',
  ],
  [
    'amu',
    'amu-btech',
    'AMU B.Tech Entrance (AMUEEE)',
    amu,
    'Aligarh Muslim University B.Tech admission test: Physics, Chemistry and Mathematics.',
    'AMU Controller of Examinations, B.Tech. admission test syllabus; topics split from the official text.',
  ],
  [
    'cftri',
    'cftri-msc-food-technology',
    'CFTRI M.Sc. Food Technology Entrance',
    cftri,
    'CSIR-CFTRI Mysore M.Sc. (Food Technology) entrance: sciences, food subjects, mental ability and awareness.',
    'CSIR-CFTRI M.Sc. (Food Technology) 2026-28 entrance syllabus, cftri.res.in; topics split from the official text.',
  ],
];

const [src, out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const [key, templateId, name, parse, description, source] of TEMPLATES) {
  if (only.length && !only.includes(key)) continue;
  const subjects = parse(read(join(src, `${key}.txt`)));
  let body = [];
  for (const [subject, chapters] of subjects) {
    // Drop list numbers and textbook references left by the PDF layout.
    const cleaned = chapters.map(([c, t]) => [
      c,
      t
        .filter((x) => search('[A-Za-z]{2}', x) && !x.includes('NCERT Publication'))
        .map((x) => sub(String.raw`^\d{1,2}\.\s+`, '', x)),
    ]);
    body = body.concat(
      render(
        subject,
        cleaned.filter(([, t]) => t.length).map(([c, t]) => [c, t.slice(0, 200)]),
      ),
    );
  }
  writeFileSync(
    join(out, `${templateId}.md`),
    front(templateId, name, description, source) + body.join('\n') + '\n',
    'utf8',
  );
  console.log(
    templateId,
    subjects.map(([s, c]) => [s, c.length, c.reduce((n, [, t]) => n + t.length, 0)]),
  );
}
