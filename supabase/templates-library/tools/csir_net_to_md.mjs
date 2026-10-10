/**
 * Draft the four CSIR NET templates from the CSIR HRDG syllabus PDFs.
 *
 * Usage: node csir_net_to_md.mjs <dir with chem/life/math/phys.txt from `pdftotext -enc UTF-8`> <out dir>
 *
 * Sources (csirhrdg.res.in, CSIR-UGC JRF NET EXAM > Syllabus):
 *   chem  20201221135711180chemical_science_syllabus.pdf
 *   life  20260121115025355Merged_Syllabus_CSIR-DBT_21Jan2026.pdf (Life Sciences and
 *         Biotechnology, merged with DBT-BET from the December 2026 cycle)
 *   math  20201221140054469mathmeticascience_syllbus.pdf
 *   phys  20201221140202824physicalscience_syllbus.pdf
 *
 * Every template starts with Part A (common to all subjects). Each subject's PDF
 * has its own layout, so each has its own small parser; topic splitting is shared.
 * Also exports topics(), used by other converters.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMIT, clean, fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import { items, topicsFrom } from './ugcnet_to_md.mjs';
import {
  escape,
  fullmatch,
  index,
  isupper,
  islower,
  len,
  match,
  rstrip,
  slice,
  split,
  splitWs,
  splitlines,
  strip,
  sub,
  title,
  unique,
  readText,
} from './lib/py.mjs';

// The scheme on each subject's CSIR HRDG page describes Part A.
const PART_A = [
  '# Part A: General Aptitude',
  '## General Aptitude',
  '- General Science',
  '- Quantitative Reasoning and Analysis',
  '- Research Aptitude',
];

const KEEP_WHOLE = 90; // a sentence this short stays one topic

const every = (xs, step, from) => xs.filter((_, i) => i >= from && (i - from) % step === 0);

export function topics(text) {
  const out = [];
  // "..., etc. Next sentence": the list ends there.
  text = sub(String.raw`,?\s*\betc\.?\s+(?=[A-Z0-9])`, '. ', text);
  text = sub(String.raw`\b(vs|etc|eg|e\.g|i\.e)\.\s`, (m) => `${m.group(1)} `, text);
  for (let sentence of split(String.raw`(?<=[.;])\s+(?=[A-Z0-9(])`, text)) {
    sentence = clean(sentence);
    if (!sentence) continue;
    if (len(sentence) <= KEEP_WHOLE) {
      out.push(sentence);
      continue;
    }
    // A long list is split at its commas, but a piece of one or two short
    // words ("finite", "Lagrange") stays with the piece before it.
    const merged = [];
    for (const piece of topicsFrom(sentence)) {
      const short = len(piece) <= 15 && splitWs(piece).length <= 2 && !piece.includes(':');
      if (merged.length && short && len(merged[merged.length - 1]) + len(piece) + 2 <= LIMIT) {
        const lower = slice(piece, 0, 1).toLowerCase() + slice(piece, 1);
        merged[merged.length - 1] =
          `${merged[merged.length - 1]}, ${sentence.includes(lower) ? lower : piece}`;
      } else merged.push(piece);
    }
    out.push(...merged);
  }
  return unique(out.filter((t) => !['etc', 'etc.'].includes(t.toLowerCase())));
}

/** One line of text without page numbers or the site footer. */
function flat(text) {
  const lines = splitlines(text.replaceAll('\f', '\n'))
    .map((l) => strip(l))
    .filter((l) => l && !fullmatch(String.raw`\d{1,2}|csirh?r?dg\.res\.in`, l));
  let joined = '';
  for (const line of lines) {
    if (joined.endsWith('-') && islower(slice(line, 0, 1))) joined += line;
    else joined += ` ${line}`;
  }
  return strip(sub(String.raw`\s+`, ' ', joined));
}

function chemistry(text) {
  text = flat(text);
  text = text.replaceAll('Analytical chemistry- ', 'Analytical chemistry: ');
  text = text.replaceAll('Pericyclic reactions – ', 'Pericyclic reactions: ');
  text = text
    .replaceAll('exactlysolvable', 'exactly solvable')
    .replaceAll('DebyeHuckel', 'Debye-Huckel');
  text = text
    .replaceAll('Electron- transfer', 'Electron-transfer')
    .replaceAll('electron- transfer', 'electron-transfer');
  const areas = [
    'Inorganic Chemistry',
    'Physical Chemistry:',
    'Organic Chemistry',
    'Interdisciplinary topics',
  ];
  const subjects = [];
  areas.forEach((area, i) => {
    const start = index(text, area) + area.length;
    const end = i + 1 < areas.length ? index(text, areas[i + 1]) : text.length;
    let chapters = [];
    for (let item of split(String.raw`(?:^|\s)\d{1,2}\.\s+`, text.slice(start, end))) {
      item = clean(item);
      if (!item) continue;
      const headed = match(String.raw`^([^:]{3,70}):\s*(.+)$`, item);
      if (headed) chapters.push([clean(headed.group(1)), topics(headed.group(2))]);
      else {
        // No heading: a long item is named by its first clause.
        const name = len(item) > 60 ? split(' by | involving ', items(item, ';,')[0])[0] : item;
        chapters.push([fit(clean(name))[0], topics(item)]);
      }
    }
    if (chapters.every(([c, t]) => t.length === 1 && t[0] === c)) {
      // A list of one-line items (Interdisciplinary topics) is one chapter.
      chapters = [[area, chapters.map(([c]) => c)]];
    }
    subjects.push([rstrip(area, ':'), chapters]);
  });
  return subjects;
}

function physics(text) {
  text = flat(text);
  for (const [wrong, right] of [
    ['dynamicsmoment', 'dynamics: moment'],
    ['relativityLorentz', 'relativity: Lorentz'],
    ['Timeindependent', 'Time-independent'],
    ['RungeKutta', 'Runge-Kutta'],
    ['Gellmann', 'Gell-Mann'],
  ])
    text = text.replaceAll(wrong, right);
  const core = index(text, 'CORE') + 'CORE'.length;
  const advanced = index(text, 'P AR T ‘ B’');
  const subjects = [];
  for (const [name, part] of [
    ['Core', text.slice(core, advanced)],
    ['Advanced', text.slice(index(text, 'ADVANCED', advanced) + 8)],
  ]) {
    const chapters = [];
    const pieces = split(String.raw`(?:^|\s)([IVX]{1,4})\.\s+`, part);
    for (const body of every(pieces, 2, 2)) {
      const t = match(
        String.raw`^(Mathematical Methods of Physics|Classical Mechanics|Electromagnetic Theory|Quantum Mechanics|Thermodynamic and Statistical Physics|Electronics and Experimental Methods|Atomic & Molecular Physics|Condensed Matter Physics|Nuclear and Particle Physics)\s*(.*)$`,
        body,
        's',
      );
      chapters.push([t.group(1), topics(t.group(2))]);
    }
    subjects.push([`Physical Sciences: ${name}`, chapters]);
  }
  return subjects;
}

const MATH_HEADINGS = [
  'Analysis',
  'Linear Algebra',
  'Complex Analysis',
  'Algebra',
  'Topology',
  'Ordinary Differential Equations (ODEs)',
  'Partial Differential Equations (PDEs)',
  'Numerical Analysis',
  'Calculus of Variations',
  'Linear Integral Equations',
  'Classical Mechanics',
];

function linesToTopics(block) {
  block = block.replaceAll('Ø- function', 'Ø-function');
  // A line the PDF wrapped ends in "and" or a comma; join it to the next.
  block = sub(String.raw`(,| and)\s*\n\s*(?:\d{1,2}\s*\n\s*)?`, String.raw`\1 `, block);
  const out = [];
  for (const line of block.split('\n')) out.push(...topics(line));
  // Wrapped lines leave fragments; rejoin a piece that starts in lower case.
  const fixed = [];
  for (const t of out) {
    if (fixed.length && islower(slice(t, 0, 1)))
      fixed[fixed.length - 1] = `${fixed[fixed.length - 1]} ${t}`;
    else fixed.push(t);
  }
  return fixed.flatMap(fit);
}

function mathematics(text) {
  text = text.slice(index(text, 'UNIT'));
  const subjects = [];
  const units = split(String.raw`UNIT\s*–\s*(\d)`, text);
  const numbers = every(units, 2, 1);
  const bodies = every(units, 2, 2);
  numbers.forEach((number, k) => {
    const body = bodies[k].split('All students are expected')[0];
    const heading = MATH_HEADINGS.map(escape).join('|');
    const parts = split(String.raw`(?:^|\n|(?<=\. ))(${heading})\s*:`, body);
    const chapters = [];
    if (strip(parts[0])) {
      // Unit 4 has no headings; its own note calls it the statistics unit.
      chapters.push(['Statistics', linesToTopics(parts[0])]);
    }
    const titles = every(parts, 2, 1);
    const contents = every(parts, 2, 2);
    titles.forEach((t, j) => chapters.push([t, linesToTopics(contents[j])]));
    subjects.push([`Unit ${number}`, chapters]);
  });
  return subjects;
}

// Life Sciences: lettered items run their title straight into the content
// ("Cell signaling Hormones and their receptors ..."). These titles are written
// in title case or are a single word, so they are listed; others are found by case.
const LIFE_TITLES = [
  'Structure and function of biomolecules',
  'Photosynthesis',
  'Cancer',
  'Plant hormones',
  'Evolution of Life and Life Forms',
  'Principles & Methods of Taxonomy',
  'Microbial Life',
  'Protists',
  'Fungi',
  'Plant Life',
  'Animal Life',
  'Introduction to Ecology',
  'Population Ecology',
  'Community Ecology',
  'Ecosystem Ecology',
  'Human Impacts on Ecosystems',
  'Biodiversity and Conservation',
  'Act and policies',
  'Behavioural Ecology',
  'Major Bioinformatic Resources',
  'Basic Concepts of Sequence Analysis',
  'Gene annotation',
  'Molecular Modelling and Dynamics',
  'Classification and comparison of protein 3D structures',
  'Drug design',
  'Systems Biology',
  'Introductory Mathematics',
  'Engineering Principles',
  'Thermodynamics in Biological Systems',
  'Bioprocess Engineering and Technology',
  'Enzymes and microbial technology',
  'Downstream processing in biotechnology',
  'Bioprocess Plant Design',
  'Molecular Biology Techniques',
  'Biophysical Methods',
  'Genomics, Transcriptomics, Proteomics and Metabolomics',
  'Radiolabeling techniques',
  'Histochemical and Immunotechniques',
  'Microscopic techniques',
  'Electrophysiological methods',
  'Methods in field biology',
  'Statistical Methods',
  'IPR, Biosafety and Bioethics',
  'Cell wall and cell membrane: structure and function',
  'Structural organization and function of intracellular organelles',
  'Medical Biotechnology',
  'Recombinant DNA technology',
  'Animal Biotechnology',
  'Agriculture Biotechnology',
  'Marine Biotechnology',
  'Environmental Biotechnology',
  'Microbial Physiology',
  'Metabolic Engineering and Synthetic Biology',
];

function lifeItem(item, statements) {
  // Section 1 lists whole sentences: "Conformation of proteins (Ramachandran plot, ...)."
  if (statements) {
    const bracketed = match(String.raw`^(.+?)\s*\((.+)\)\.$`, item);
    if (bracketed) {
      const parts = items(bracketed.group(2)).filter(
        (p) => !['etc', 'etc.'].includes(p.toLowerCase()),
      );
      return [bracketed.group(1), parts];
    }
    return [rstrip(item, '.'), item];
  }
  for (const t of LIFE_TITLES) {
    if (item.startsWith(`${t} `) || item === t) return [t, slice(item, len(t))];
  }
  const headed = match(String.raw`^([^:]{3,60}):\s*(.+)$`, item);
  if (headed) return [headed.group(1), headed.group(2)];
  const words = item.split(' ');
  for (let i = 2; i < words.length; i++) {
    if (isupper(slice(words[i], 0, 1)) && islower(slice(words[i - 1], 0, 1)))
      return [words.slice(0, i).join(' '), words.slice(i).join(' ')];
  }
  return [item, ''];
}

function life(text) {
  text = flat(text);
  for (const [wrong, right] of [
    ['Bio-Technolgy', 'Bio-Technology'],
    ['Antigenantibody', 'Antigen-antibody'],
    ['MetapopulationsHabitat', 'Metapopulations: Habitat'],
    ['variationpolymorphism', 'variation: polymorphism'],
    ['selforganizing', 'self-organizing'],
  ])
    text = text.replaceAll(wrong, right);
  text = text.slice(index(text, '1. STRUCTURE AND FUNCTION OF BIOMOLECULES'));
  const sections = split(
    String.raw`(?:^|\s)(\d{1,2})\.\s+([A-Z][A-Z ,&\-–]+?)(?=\s+[A-Z]\.\s)`,
    text,
  );
  const numbers = every(sections, 3, 1);
  const titles = every(sections, 3, 2);
  const bodies = every(sections, 3, 3);
  const subjects = [];
  numbers.forEach((number, k) => {
    const chapters = [];
    for (let item of split(String.raw`(?:^|(?<=[\s.]))[A-L]\.\s+(?=[A-Z])`, bodies[k])) {
      item = strip(item);
      if (!clean(item)) continue;
      let [name, content] = lifeItem(item, number === '1');
      name = clean(name);
      const contentTopics = Array.isArray(content)
        ? content
        : clean(content)
          ? topics(content)
          : [name];
      chapters.push([fit(name)[0], contentTopics]);
    }
    subjects.push([
      title(strip(titles[k]))
        .replaceAll(' And ', ' and ')
        .replaceAll(' Of ', ' of ')
        .replaceAll(' In ', ' in '),
      chapters,
    ]);
  });
  return subjects;
}

const TEMPLATES = {
  chem: [
    'csir-net-chemical-sciences',
    'CSIR NET Chemical Sciences',
    chemistry,
    'Part A General Aptitude and the Chemical Sciences syllabus: inorganic, physical, organic and interdisciplinary.',
    'CSIR HRDG official syllabus, Chemical Sciences (revised exam scheme from June 2017); topics split from the official text.',
  ],
  life: [
    'csir-net-life-sciences',
    'CSIR NET Life Sciences and Biotechnology',
    life,
    'Part A General Aptitude and the merged CSIR-DBT Life Sciences and Biotechnology syllabus (from December 2026).',
    'CSIR HRDG official merged CSIR-DBT syllabus, Life Sciences and Bio-Technology (21 January 2026); topics split from the official text.',
  ],
  math: [
    'csir-net-mathematical-sciences',
    'CSIR NET Mathematical Sciences',
    mathematics,
    'Part A General Aptitude and Units 1 to 4 of the Mathematical Sciences syllabus.',
    'CSIR HRDG official syllabus, Mathematical Sciences; topics split from the official text.',
  ],
  phys: [
    'csir-net-physical-sciences',
    'CSIR NET Physical Sciences',
    physics,
    'Part A General Aptitude and the core and advanced Physical Sciences syllabus.',
    'CSIR HRDG official syllabus, Physical Sciences; topics split from the official text.',
  ],
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [src, out] = process.argv.slice(2);
  mkdirSync(out, { recursive: true });
  for (const [key, [templateId, name, parse, description, source]] of Object.entries(TEMPLATES)) {
    const subjects = parse(readText(join(src, `${key}.txt`)));
    let body = [...PART_A];
    for (const [subject, chapters] of subjects) {
      body = body.concat(
        render(
          subject,
          chapters.filter(([, t]) => t.length).map(([c, t]) => [c, t.slice(0, 200)]),
        ),
      );
    }
    // clean() capitalises the first letter, which breaks "pH".
    writeFileSync(
      join(out, `${templateId}.md`),
      front(templateId, name, description, source) +
        body.join('\n').replaceAll('- PH\n', '- pH\n') +
        '\n',
      'utf8',
    );
    console.log(
      templateId,
      subjects.map(([s, c]) => [s, c.length]),
    );
  }
}
