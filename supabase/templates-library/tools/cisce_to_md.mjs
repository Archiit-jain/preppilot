/**
 * Draft the ICSE Class 9 and 10 and ISC Class 11 and 12 templates.
 *
 * Usage: node cisce_to_md.mjs <dir> <out dir>
 *   <dir>/icse-<subject>.raw.txt, isc-<subject>.raw.txt: `pdftotext -enc UTF-8` (reading order) of the
 *   CISCE subject syllabuses: "Regulations and Syllabuses - ICSE 2027" and "- ISC 2027" (cisce.org).
 *
 * Each syllabus gives Class IX and X (or XI and XII) separately. A unit is "N. Title"; a unit may
 * have sub-headings "(i) Title"; a unit opens with a summary sentence and then explains it in
 * lettered items "(a) ...". Topics are the summary's items and the first clause of each lettered
 * item. Practical work, projects and internal assessment are left out.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { topics } from './csir_net_to_md.mjs';
import { clean, fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  finditer,
  len,
  match,
  partition,
  readText,
  rsplit1,
  rstrip,
  search,
  slice,
  split,
  splitlines,
  strip,
  sub,
  unique,
} from './lib/py.mjs';

const STOP = String.raw`^\s*(PAPER\s*[-–]?\s*II\b|PAPER II|PRACTICAL WORK|INTERNAL ASSESSMENT|PROJECT WORK|EVALUATION|LIST OF SUGGESTED|SUGGESTED (?:LIST|ASSIGNMENTS|PROJECTS)|PRACTICAL\s*[-–:]|Paper II)`;

function read(path) {
  const text = readText(path).normalize('NFKC').replaceAll('\f', '\n');
  return sub(String.raw`(?m)^\s*(?:(?:ISC|ICSE) Examination Year \d{4}|\d{1,3})\s*$`, '', text); // page furniture
}

/** The text for each class, from its heading to the next class heading. */
function classBlocks(text, first, second) {
  const marks = [
    ...finditer(String.raw`(?m)^\s*CLASS\s*[-–]?\s*(${first}|${second})\s*$`, text),
  ].map((m) => [m.start(), m.group(1)]);
  const blocks = {};
  marks.forEach(([start, name], n) => {
    const end = n + 1 < marks.length ? marks[n + 1][0] : text.length;
    blocks[name] = `${blocks[name] ?? ''}\n${text.slice(start, end)}`;
  });
  return blocks;
}

function firstClause(item) {
  item = strip(sub(String.raw`\s+`, ' ', item));
  return clean(split(String.raw`;|\.\s|:\s|\s[-–]\s`, item)[0]);
}

/** Drops layout leftovers: page footers, notes in brackets, marks, scraps and broken formulas. */
function tidy(topic) {
  topic = sub(String.raw`(?:ISC|ICSE) Examination Year \d{4}(?:\s+\d{1,3}\b)?`, ' ', topic);
  topic = clean(sub(String.raw`^\s*\([a-z]\)\s*`, '', topic));
  if (len(topic) < 5 || match(String.raw`(?i)^(note\b|aims\b|e\.g\b|\d+\s*marks)`, topic))
    return '';
  if (topic.startsWith('(') && topic.endsWith(')')) return ''; // a teaching note, e.g. "(Simple numerical problems only)"
  const count = (c) => topic.split(c).length - 1;
  if (search('[-]', topic) || count('±') + count('−') >= 2) return ''; // a formula the PDF text cannot carry
  return topic;
}

function chaptersOf(block) {
  const lines = splitlines(block).map((l) => rstrip(l));
  // Units are numbered 1, 2, 3...; numbering restarts at 1 for the next section (Civics, then
  // History) or after an overview table that lists the unit titles. A run after a SECTION
  // heading adds to the units; any other restart replaces the run before it if it has more text.
  const runs = [];
  let units = [];
  let expected = 1;
  let sectionSeen = false;
  let runAfterSection = false;
  let current = null;
  for (const line of lines) {
    // Theory only: stop at the practical or project section (the introduction's
    // mention of "Paper II" comes before the first unit, so only check after it).
    if (current !== null && match(STOP, line, 'i')) break;
    if (match(String.raw`^\s*(SECTION|PART)\s+[A-Z]\b`, line)) sectionSeen = true;
    const unit = match(String.raw`^\s*(\d{1,2})\.\s+([A-Z].*)$`, line);
    const listing = unit ? search(String.raw`\s\d{1,2}\.\s+[A-Z]`, unit.group(2)) : null; // an overview of all units
    if (unit && Number(unit.group(1)) === 1 && units.length && expected > 1 && !listing) {
      runs.push([units, runAfterSection]);
      units = [];
      expected = 1;
      runAfterSection = sectionSeen;
    }
    if (unit && [expected, expected + 1].includes(Number(unit.group(1))) && !listing) {
      // A title may run on into its content: "Emergence of the Colonial Economy (i) Development..."
      let t = split(String.raw`(?=\s\((?:i|a)\)\s)|(?<=[a-z)])\s*:\s+`, unit.group(2), 1)[0];
      let rest = slice(unit.group(2), len(t));
      if (len(t) > 90) {
        const cut = rsplit1(slice(t, 0, 90), ' ')[0];
        rest = slice(t, len(cut)) + rest;
        t = cut;
      }
      current = [clean(t), strip(rest) ? [rest] : []];
      units.push(current);
      expected = Number(unit.group(1)) + 1;
      sectionSeen = false; // a SECTION heading counts only before the next restart
      continue;
    }
    if (current !== null) current[1].push(line);
  }
  runs.push([units, runAfterSection]);
  const size = (run) => run.reduce((n, [, body]) => n + len(body.join(' ')), 0);
  units = [];
  for (const [run, afterSection] of runs) {
    if (afterSection || !units.length) units = units.concat(run);
    else if (size(run) > size(units)) units = run;
  }
  const chapters = [];
  for (const [t, body] of units) {
    const sections = [];
    let subsection = [t, []];
    for (const line of body) {
      const heading = match(String.raw`^\s*\(([ivx]+)\)\s+([A-Z][^.;:]{2,80})$`, line);
      if (heading) {
        if (subsection[1].length) sections.push(subsection);
        subsection = [`${t}: ${clean(heading.group(2))}`, []];
        continue;
      }
      subsection[1].push(line);
    }
    sections.push(subsection);
    for (const [name, textLines] of sections) {
      const text = textLines
        .filter((l) => strip(l))
        .map((l) => strip(l))
        .join(' ');
      const [summary, , detail] = partition(text, '(a)');
      let found = strip(summary) ? topics(summary) : [];
      for (const item of detail ? split(String.raw`\([a-z]\)\s*`, `(a)${detail}`).slice(1) : []) {
        const clause = firstClause(item);
        if (len(clause) > 3 && search('[A-Za-z]{3}', clause)) found = found.concat(fit(clause));
      }
      found = unique(found.map(tidy)).filter(Boolean);
      if (found.length) chapters.push([fit(name)[0], found.slice(0, 200)]);
    }
  }
  return chapters;
}

// English is laid out as question types and prescribed texts, not numbered units; these are
// transcribed from the ICSE 2027 and ISC 2027 English syllabuses.
const ICSE_LANGUAGE = [
  'Paper 1: English Language',
  [
    'Composition (300-350 words)',
    'Letter writing: formal and informal',
    'Notice writing',
    'E-mail writing',
    'Unseen prose passage: comprehension and vocabulary',
    'Summary writing',
    'Functional grammar: prepositions, conjunctions, verbs and sentence structure',
  ],
];
const ISC_LANGUAGE = [
  'English Language',
  [
    'Composition (400-450 words)',
    'Directed writing: article, review, blog, report',
    'Proposal writing',
    'Grammar: transformation of sentences, phrasal verbs, verbs and tenses',
    'Comprehension: analysis, vocabulary and inference',
    'Summary writing',
  ],
];
const ENGLISH = {
  'icse|IX': [
    ICSE_LANGUAGE,
    ['Paper 2: Literature - Drama', ['Julius Caesar (Acts I and II) - William Shakespeare']],
    [
      'Paper 2: Literature - Prose (Treasure Chest)',
      [
        "Bonku Babu's Friend - Satyajit Ray",
        'Oliver Asks for More - Charles Dickens',
        'The Model Millionaire - Oscar Wilde',
        'Home-coming - Rabindranath Tagore',
        'The Boy who Broke the Bank - Ruskin Bond',
      ],
    ],
    [
      'Paper 2: Literature - Poetry (Treasure Chest)',
      [
        'The Night Mail - W.H. Auden',
        'Skimbleshanks: The Railway Cat - T.S. Eliot',
        'I Remember, I Remember - Thomas Hood',
        "A Doctor's Journal Entry for August 6, 1945 - Vikram Seth",
        'A Work of Artifice - Marge Piercy',
      ],
    ],
  ],
  'icse|X': [
    ICSE_LANGUAGE,
    ['Paper 2: Literature - Drama', ['Julius Caesar (Acts III, IV and V) - William Shakespeare']],
    [
      'Paper 2: Literature - Prose (Treasure Chest)',
      [
        'With the Photographer - Stephen Leacock',
        'The Elevator - William Sleator',
        'The Girl Who Can - Ama Ata Aidoo',
        'The Pedestrian - Ray Bradbury',
        'The Last Lesson - Alphonse Daudet',
      ],
    ],
    [
      'Paper 2: Literature - Poetry (Treasure Chest)',
      [
        'Haunted Houses - H.W. Longfellow',
        'The Glove and the Lions - Leigh Hunt',
        'When Great Trees Fall - Maya Angelou',
        'A Considerable Speck - Robert Frost',
        'The Power of Music - Sukumar Ray',
      ],
    ],
  ],
  'isc|XI': [
    ISC_LANGUAGE,
    ['Literature - Drama', ['Macbeth (Acts I and II) - William Shakespeare']],
    [
      'Literature - Short Stories (Prism)',
      [
        'A Living God - Lafcadio Hearn',
        'Advice to Youth - Mark Twain',
        'The Paper Menagerie - Ken Liu',
        'The Great Automatic Grammatizator - Roald Dahl',
        "Thank You, Ma'am - Langston Hughes",
      ],
    ],
    [
      'Literature - Poetry (Rhapsody)',
      [
        'Abhisara: The Tryst - Rabindranath Tagore',
        'Why I Like the Hospital - Tony Hoagland',
        'Sonnet 116 - William Shakespeare',
        'Death of a Naturalist - Seamus Heaney',
        'Strange Meeting - Wilfred Owen',
      ],
    ],
  ],
  'isc|XII': [
    ISC_LANGUAGE,
    ['Literature - Drama', ['Macbeth (Acts III, IV and V) - William Shakespeare']],
    [
      'Literature - Short Stories (Prism)',
      [
        'Atithi / Guest - Rabindranath Tagore',
        'The Cookie Lady - Philip K. Dick',
        'There Will Come Soft Rains - Ray Bradbury',
        'Indigo - Satyajit Ray',
        'The Medicine Bag - Virginia Driving Hawk Sneve',
      ],
    ],
    [
      'Literature - Poetry (Rhapsody)',
      [
        'Telephone Conversation - Wole Soyinka',
        'Tithonus - Alfred, Lord Tennyson',
        'Beethoven - Shane Koyczan',
        'Small Towns and the River - Mamang Dai',
        'Death be not Proud - John Donne',
      ],
    ],
  ],
};

const SUBJECTS = {
  icse: [
    ['english', 'English'],
    ['history', 'History and Civics'],
    ['geography', 'Geography'],
    ['maths', 'Mathematics'],
    ['physics', 'Physics'],
    ['chemistry', 'Chemistry'],
    ['biology', 'Biology'],
    ['computer', 'Computer Applications'],
  ],
  'isc-science': [
    ['english', 'English'],
    ['physics', 'Physics'],
    ['chemistry', 'Chemistry'],
    ['maths', 'Mathematics'],
    ['biology', 'Biology'],
    ['computer', 'Computer Science'],
  ],
  'isc-commerce': [
    ['english', 'English'],
    ['accountancy', 'Accountancy'],
    ['commerce', 'Commerce'],
    ['economics', 'Economics'],
    ['business', 'Business Studies'],
    ['maths', 'Mathematics'],
  ],
  'isc-humanities': [
    ['english', 'English'],
    ['history', 'History'],
    ['polsci', 'Political Science'],
    ['geography', 'Geography'],
    ['economics', 'Economics'],
    ['psychology', 'Psychology'],
    ['sociology', 'Sociology'],
  ],
};

const TEMPLATES = [
  ['icse-class-9', 'ICSE Class 9', 'icse', 'icse', 'IX', 'X', 'IX'],
  ['icse-class-10', 'ICSE Class 10', 'icse', 'icse', 'IX', 'X', 'X'],
  ['isc-class-11-science', 'ISC Class 11 - Science', 'isc', 'isc-science', 'XI', 'XII', 'XI'],
  ['isc-class-11-commerce', 'ISC Class 11 - Commerce', 'isc', 'isc-commerce', 'XI', 'XII', 'XI'],
  [
    'isc-class-11-humanities',
    'ISC Class 11 - Humanities',
    'isc',
    'isc-humanities',
    'XI',
    'XII',
    'XI',
  ],
  ['isc-class-12-science', 'ISC Class 12 - Science', 'isc', 'isc-science', 'XI', 'XII', 'XII'],
  ['isc-class-12-commerce', 'ISC Class 12 - Commerce', 'isc', 'isc-commerce', 'XI', 'XII', 'XII'],
  [
    'isc-class-12-humanities',
    'ISC Class 12 - Humanities',
    'isc',
    'isc-humanities',
    'XI',
    'XII',
    'XII',
  ],
];

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const [templateId, name, board, group, first, second, which] of TEMPLATES) {
  let body = [];
  const counts = [];
  for (const [key, subject] of SUBJECTS[group]) {
    const chapters =
      key === 'english'
        ? ENGLISH[`${board}|${which}`]
        : chaptersOf(
            classBlocks(read(join(src, `${board}-${key}.raw.txt`)), first, second)[which] ?? '',
          );
    counts.push([subject, chapters.length, chapters.reduce((n, [, t]) => n + t.length, 0)]);
    body = body.concat(render(subject, chapters));
  }
  const exam = board === 'icse' ? 'ICSE 2027' : 'ISC 2027';
  const subjects = SUBJECTS[group].map(([, s]) => s).join(', ');
  writeFileSync(
    join(out, `${templateId}.md`),
    front(
      templateId,
      name,
      `CISCE Class ${which} theory syllabus: ${subjects}.`,
      `CISCE Regulations and Syllabuses - ${exam}, Class ${which} theory of each subject (cisce.org); topics from the official text.`,
      'school',
    ) +
      body.join('\n') +
      '\n',
    'utf8',
  );
  console.log(templateId, counts);
}
