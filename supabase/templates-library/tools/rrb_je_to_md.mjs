/**
 * Draft the RRB JE Civil, Electrical, Electronics and Mechanical templates.
 *
 * Usage: node rrb_je_to_md.mjs <je.txt> <ann.txt> <out dir>
 *   je.txt   `pdftotext -enc UTF-8` of the whole notice (para 13, CBT syllabus)
 *   ann.txt  `pdftotext -enc UTF-8 -layout -f 76 -l 80` (Annexure VII A to D)
 *
 * Source: RRB Centralised Employment Notice CEN 05/2025 (JE/DMS/CMA), published on every
 * RRB website (this copy from rrbsecunderabad.gov.in). CBT-1 is common to all posts;
 * CBT-2 has four common sections and Technical Abilities from the exam group's annexure.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { topics } from './csir_net_to_md.mjs';
import { clean } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import { escape, index, readText, rstrip, search, splitlines, strip, sub } from './lib/py.mjs';

const GROUPS = {
  A: [
    'rrb-je-civil',
    'Civil',
    [
      'Engineering Mechanics',
      'Building Construction',
      'Building materials',
      'Construction of substructure',
      'Construction of superstructure',
      'Building finishes',
      'Building maintenance',
      'Building drawing',
      'Concrete Technology',
      'Surveying',
      'Computer Aided Design',
      'Geo Technical Engineering',
      'Hydraulics',
      'Irrigation Engineering',
      'Mechanics of Structures',
      'Theory of structures',
      'Design of Concrete Structures',
      'Design of Steel Structures',
      'Transportation Engineering',
      'Highway Engineering',
      'Environmental Engineering',
      'Advanced Construction Techniques and Equipment',
      'Estimating and Costing',
      'Contracts and Accounts',
    ],
  ],
  B: [
    'rrb-je-electrical',
    'Electrical',
    [
      'Basic concepts',
      'Circuit law',
      'Magnetic Circuit',
      'AC Fundamentals',
      'Measurement and measuring instruments',
      'Electrical Machines',
      'Synchronous Machines',
      'Generation, Transmission and Distribution',
      'Switchgears and Protection',
      'Estimation and costing',
      'Utilization of Electrical Energy',
      'Basic Electronics',
    ],
  ],
  C: [
    'rrb-je-electronics',
    'Electronics',
    [
      'Electronic Components & Materials',
      'Electronic Devices and circuits',
      'Digital Electronics',
      'Linear Integrated Circuit',
      'Microprocessor and Microcontroller',
      'Electronic Measurements',
      'Communication Engineering',
      'Data communication and Network',
      'Computer Programming',
      'Basic Electrical Engg.',
    ],
  ],
  D: [
    'rrb-je-mechanical',
    'Mechanical',
    [
      'Engineering Mechanics',
      'Material Science',
      'Strength of Materials',
      'Machining',
      'Welding',
      'Grinding & Finishing Process',
      'Metrology',
      'Fluid Mechanics & Hydraulic Machinery',
      'Industrial Management',
      'Thermal Engineering',
    ],
  ],
};

// Abbreviations whose full stops would read as sentence ends.
const ABBREVIATIONS = {
  'D.C.': 'DC',
  'R.M.S.': 'RMS',
  'O.C.': 'OC',
  'S.C.': 'SC',
  'R.L. and C': 'R L and C',
  'H.R.C.': 'HRC',
  'e.m.f.': 'emf',
  'e.g.': 'eg',
  'R-Land': 'R-L and',
  'Engg.': 'Engineering',
  'gyration of : (a) ': 'gyration of ',
  'Z- Section': 'Z-Section',
};

function listed(text, label, stop, separator = ',') {
  let block = text.slice(index(text, label) + label.length);
  block = sub(String.raw`\s+`, ' ', block.slice(0, index(block, stop)));
  block = sub(String.raw`\s*etc\.?\s*$`, '', rstrip(strip(block), '.'));
  return block
    .split(separator)
    .filter((x) => clean(x))
    .map(clean);
}

function annexure(ann, letter, titles) {
  const start = index(ann, `Annexure-VII ${letter}`);
  const following = [...'BCDE'].map((c) => ann.indexOf(`Annexure-VII ${c}`, start + 1));
  const end = Math.min(...following.filter((p) => p > start));
  const lines = [];
  for (const line of splitlines(ann.slice(start, end))) {
    if (
      search(
        String.raw`CEN No\.|Page \d+ of|Annexure-VII|Syllabus for|^\s*S\.\s*N\.?|^\s*Subject\s*$`,
        line,
      )
    )
      continue;
    lines.push(strip(sub(String.raw`^\s*\d{1,2}(\s+|$)`, '', line)));
  }
  let text = sub(String.raw`\s+`, ' ', lines.join(' '));
  for (const [wrong, right] of Object.entries(ABBREVIATIONS)) text = text.replaceAll(wrong, right);
  const positions = [];
  for (let title of titles) {
    title = ABBREVIATIONS[title] ?? title.replaceAll('Engg.', 'Engineering');
    const found = search(escape(title) + String.raw`\s*(?:-|:|–)\s*`, text);
    if (!found) throw new Error(`Annexure VII ${letter}: title not found: ${title}`);
    positions.push([found.start(), found.end(), title]);
  }
  positions.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
  const chapters = [];
  positions.forEach(([, contentStart, title], i) => {
    const contentEnd = i + 1 < positions.length ? positions[i + 1][0] : text.length;
    let content = text.slice(contentStart, contentEnd);
    // "(b) 1 phase transformers" after a full stop starts a part; inside a list it is a comma.
    content = sub(String.raw`\.\s*\([a-f]\)\s*`, '. ', content);
    content = sub(String.raw`:?\s*\([a-f]\)\s*`, ', ', content);
    chapters.push([title, topics(content)]);
  });
  return chapters;
}

function common(text) {
  const maths = listed(text, 'a. Mathematics:', 'b. General Intelligence');
  const reasoning = listed(text, 'b. General Intelligence and Reasoning:', 'c. General Awareness');
  let awareness = listed(text, 'c. General Awareness:', 'd. General Science');
  awareness = awareness.map((a) => a.replaceAll('Knowledge of Current affairs', 'Current affairs'));
  const computers = listed(
    text.replaceAll('Storage devices, Networking,', 'Storage devices; Networking;'),
    'c) Basics of Computers and Applications:',
    'd) Basics of Environment',
    ';',
  );
  const environment = listed(
    text,
    'd) Basics of Environment and Pollution Control:',
    'e) Technical Abilities',
    ';',
  );
  return [
    ['CBT 1: Mathematics', [['Mathematics', maths]]],
    [
      'CBT 1: General Intelligence and Reasoning',
      [['General Intelligence and Reasoning', reasoning]],
    ],
    ['General Awareness (CBT 1 and 2)', [['General Awareness', awareness]]],
    [
      'General Science (CBT 1) and Physics and Chemistry (CBT 2)',
      [
        ['Physics', ['Physics up to Class 10 (CBSE syllabus)']],
        ['Chemistry', ['Chemistry up to Class 10 (CBSE syllabus)']],
        ['Life Sciences', ['Life Sciences up to Class 10 (CBSE syllabus, CBT 1 only)']],
      ],
    ],
    [
      'CBT 2: Basics of Computers and Applications',
      [['Basics of Computers and Applications', computers]],
    ],
    [
      'CBT 2: Basics of Environment and Pollution Control',
      [['Basics of Environment and Pollution Control', environment]],
    ],
  ];
}

// NFKC turns PDF ligatures ("ﬁ") back into letters.
const [jeFile, annFile, out] = process.argv.slice(2);
const text = readText(jeFile).normalize('NFKC');
const ann = readText(annFile).normalize('NFKC');
mkdirSync(out, { recursive: true });
const shared = common(text);
for (const [letter, [templateId, branch, titles]] of Object.entries(GROUPS)) {
  const chapters = annexure(ann, letter, titles);
  let body = [];
  for (const [subject, chs] of shared) body = body.concat(render(subject, chs));
  body = body.concat(render(`CBT 2: Technical Abilities (${branch} and Allied)`, chapters));
  writeFileSync(
    join(out, `${templateId}.md`),
    front(
      templateId,
      `RRB JE ${branch}`,
      `Railway Junior Engineer (${branch} and allied exam group): CBT 1, and CBT 2 with its technical syllabus.`,
      `RRB CEN 05/2025 (JE/DMS/CMA), para 13 and Annexure VII ${letter}; topics split from the official text.`,
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
