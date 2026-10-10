/**
 * Draft the international exam templates.
 *
 * Usage: node intl_to_md.mjs <dir> <out dir> [template ids]
 *
 * From official documents (`pdftotext -enc UTF-8` into <dir>):
 *   cfa1.txt, cfa2.txt, cfa3-<pathway>.txt  CFA Institute 2026 Level I, II, III Topic Outlines
 *   usmle.txt                               USMLE Content Outline (2026), usmle.org
 *   mcat.txt                                AAMC "What's on the MCAT Exam?" (2020)
 *   smle-l.txt                              SCFHS SMLE Applicant Guide 2024 (`pdftotext -layout`)
 *   gcse-maths.txt, gcse-science.txt        UK DfE GCSE subject content
 * From official web pages, transcribed below (names as the owner publishes them):
 *   SAT    College Board, Assessment Framework for the Digital SAT Suite, Tables 10 and 16
 *   GRE    ETS, GRE General Test content pages (Verbal, Quantitative, Analytical Writing)
 *   GMAT   mba.com, GMAT Focus Edition exam structure and Data Insights pages
 *   TOEFL  ETS, TOEFL iBT test content page (task types)
 *   IELTS  ielts.org, IELTS Academic test format pages
 *   LSAT   LSAC, test format, Logical Reasoning and Reading Comprehension pages
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clean, fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  fullmatch,
  index,
  isupper,
  len,
  match,
  readText,
  rstrip,
  search,
  slice,
  split,
  splitlines,
  strip,
  sub,
  title,
  unique,
} from './lib/py.mjs';

const BULLET = '•';
const SQUARE = '▪';

function read(path) {
  return readText(path).normalize('NFKC').replaceAll('\f', '\n');
}

const startsUpper = (s) => isupper(slice(s, 0, 1));

const CFA_TOPICS = [
  'Quantitative Methods',
  'Economics',
  'Corporate Issuers',
  'Financial Statement Analysis',
  'Equity Investments',
  'Equity Valuation',
  'Fixed Income',
  'Derivatives',
  'Alternative Investments',
  'Portfolio Management',
  'Ethical and Professional Standards',
  'Asset Allocation',
  'Portfolio Construction',
  'Performance Measurement',
  'Derivatives and Risk Management',
  'Portfolio Management Pathway',
  'Private Markets Pathway',
  'Private Wealth Pathway',
];
const USMLE_SYSTEMS = [
  'Human Development',
  'Immune System',
  'Blood & Lymphoreticular System',
  'Behavioral Health',
  'Nervous System & Special Senses',
  'Skin & Subcutaneous Tissue',
  'Musculoskeletal System',
  'Cardiovascular System',
  'Respiratory System',
  'Gastrointestinal System',
  'Renal & Urinary System',
  'Pregnancy, Childbirth, & the Puerperium',
  'Female and Transgender Reproductive System & Breast',
  'Male and Transgender Reproductive System',
  'Endocrine System',
  'Multisystem Processes & Disorders',
  'Biostatistics, Epidemiology/Population Health, & Interpretation of the Medical Literature',
  'Social Sciences',
];
const MCAT_SECTIONS = {
  1: 'Biological and Biochemical Foundations of Living Systems',
  2: 'Biological and Biochemical Foundations of Living Systems',
  3: 'Biological and Biochemical Foundations of Living Systems',
  4: 'Chemical and Physical Foundations of Biological Systems',
  5: 'Chemical and Physical Foundations of Biological Systems',
  6: 'Psychological, Social, and Biological Foundations of Behavior',
  7: 'Psychological, Social, and Biological Foundations of Behavior',
  8: 'Psychological, Social, and Biological Foundations of Behavior',
  9: 'Psychological, Social, and Biological Foundations of Behavior',
  10: 'Psychological, Social, and Biological Foundations of Behavior',
};
const SMLE_SECTIONS = [
  'Medicine',
  'Pediatrics',
  'Obstetrics And Gynecology',
  'Surgery',
  'Patient Safety, Preventive Medicine, & Ethics',
];
const GCSE_MATHS_AREAS = [
  'Number',
  'Algebra',
  'Ratio, proportion and rates of change',
  'Geometry and measures',
  'Probability',
  'Statistics',
];
const GCSE_SCIENCE_AREAS = {
  Biology: [
    'Cell biology',
    'Transport systems',
    'Health, disease and the development of medicines',
    'Coordination and control',
    'Photosynthesis',
    'Ecosystems',
    'Inheritance, variation and evolution',
  ],
  Chemistry: [
    'Atomic structure and the Periodic Table',
    'Structure, bonding and the properties of matter',
    'Chemical changes',
    'Energy changes in chemistry',
    'Rate and extent of chemical change',
    'Chemical analysis',
    'Chemical and allotropic forms of carbon',
    'Earth and atmospheric science',
  ],
  Physics: [
    'Energy',
    'Forces',
    'Forces and motion',
    'Waves in matter',
    'Light and electromagnetic waves',
    'Electricity',
    'Magnetism and electromagnetism',
    'Particle model of matter',
    'Atomic structure',
  ],
};
const GCSE_TEXT = [
  [
    'English Language',
    [
      [
        'Critical Reading and Comprehension',
        [
          'Identifying and interpreting themes, ideas and information',
          'Drawing inferences and justifying them',
          'Identifying bias and misuse of evidence',
          'Summary and synthesis',
          "Evaluating a writer's choice of vocabulary, form, grammar and structure",
          'Comparing texts',
        ],
      ],
      [
        'Writing',
        [
          'Writing for different purposes and audiences: describe, narrate, explain, instruct, argue',
          'Using language imaginatively and creatively',
          'Accurate spelling, punctuation and grammar',
        ],
      ],
      [
        'Spoken Language',
        [
          'Presenting information and ideas',
          'Responding to questions and feedback',
          'Using spoken Standard English',
        ],
      ],
    ],
  ],
  [
    'English Literature',
    [
      [
        'Detailed Study',
        [
          'A play by Shakespeare',
          'A 19th century novel',
          'Poetry since 1789, including Romantic poetry',
          'Fiction or drama from the British Isles from 1914 onwards',
        ],
      ],
      [
        'Reading Critically',
        [
          'Literal and inferential comprehension',
          'Critical reading and themes',
          'Evaluating language, structure and form',
          'Comparing texts',
          'Unseen texts',
        ],
      ],
    ],
  ],
  [
    'Geography',
    [
      ['Place: processes and relationships', ['Geography of the UK']],
      [
        'Physical geography: processes and change',
        ['Geomorphic processes and landscape', 'Changing weather and climate'],
      ],
      [
        'People and environment: processes and interactions',
        ['Global ecosystems and biodiversity', 'Resources and their management'],
      ],
      [
        'Human geography: processes and change',
        ['Cities and urban society', 'Global economic development issues'],
      ],
      [
        'Skills',
        [
          'Locational knowledge',
          'Maps, atlases, OS maps and GIS',
          'Fieldwork in two contrasting environments',
          'Graphical, numerical and statistical skills',
        ],
      ],
    ],
  ],
  [
    'History',
    [
      [
        'Studies Required',
        [
          'British depth study',
          'Period study (at least 50 years)',
          'Thematic study',
          'European or wider world depth study',
          'The historic environment: a site study',
        ],
      ],
      ['Eras', ['Medieval (500-1500)', 'Early Modern (1450-1750)', 'Modern (1700-present day)']],
    ],
  ],
];
const MRCS = [
  [
    'Paper 1: Applied Basic Sciences',
    [
      [
        'Applied Surgical Anatomy',
        [
          'Thorax',
          'Abdomen: wall, cavity, viscera and vessels',
          'Pelvis',
          'Perineum',
          'Upper limb and breast',
          'Lower limb',
          'Spine',
          'Head and neck',
          'Brain',
          'Autonomic nervous system',
          'Surgically related embryology and development',
          'Surface and imaging anatomy',
        ],
      ],
      [
        'Applied Surgical Physiology',
        [
          'General physiological principles',
          'Cardiovascular system',
          'Respiratory system',
          'Gastrointestinal system',
          'Urinary system',
          'Endocrine system',
          'Neurological system',
        ],
      ],
      [
        'Applied Surgical Pathology',
        [
          'Surgical immunology',
          'Surgical haematology',
          'Surgical clinical chemistry',
          'Principles of neoplasia and oncology',
          'Cardiovascular system',
          'Respiratory system',
          'Digestive system',
          'Genitourinary system',
          'Central and peripheral neurological systems',
          'Skin cancer',
          'Lymphoreticular system',
          'Musculoskeletal system',
          'Pathology of the breast',
          'Pathology of the endocrine glands',
        ],
      ],
      [
        'Other Sciences',
        [
          'Pharmacology as applied to surgical practice',
          'Microbiology as applied to surgical practice',
          'Imaging',
          'Data interpretation and audit',
        ],
      ],
    ],
  ],
  [
    'Paper 2: Principles of Surgery in General',
    [
      [
        'Common Congenital and Acquired Surgical Conditions',
        [
          'Gastrointestinal disease',
          'Breast disease',
          'Vascular disease',
          'Cardiovascular and pulmonary disease',
          'Genitourinary disease',
          'Orthopaedic conditions',
          'Diseases of the skin, head and neck',
          'Neurology and neurosurgery',
          'Endocrine disease',
          'The lymphoreticular system',
          'Principles of cancer therapy and palliative care',
          'Acute emergencies',
        ],
      ],
      [
        'Perioperative Management',
        [
          'Preoperative assessment and management',
          'Intraoperative care',
          'Perioperative care',
          'Postoperative care',
          'Nutritional management',
          'Haemostasis and blood products',
          'Coagulation, deep vein thrombosis and embolism',
          'Metabolic and endocrine disorders',
        ],
      ],
      [
        'Trauma, including the Multiply Injured Patient',
        [
          'General',
          'Shock',
          'Wounds and soft tissue injuries',
          'Burns',
          'Fractures and dislocations',
          'Organ-specific trauma',
        ],
      ],
      ['Other Areas', ['Surgical care of children', 'Medico-legal aspects of surgical practice']],
    ],
  ],
];
const SAT = [
  [
    'Reading and Writing',
    [
      [
        'Information and Ideas',
        [
          'Central Ideas and Details',
          'Command of Evidence: Textual',
          'Command of Evidence: Quantitative',
          'Inferences',
        ],
      ],
      [
        'Craft and Structure',
        ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
      ],
      ['Expression of Ideas', ['Rhetorical Synthesis', 'Transitions']],
      ['Standard English Conventions', ['Boundaries', 'Form, Structure, and Sense']],
    ],
  ],
  [
    'Math',
    [
      [
        'Algebra',
        [
          'Linear equations in one variable',
          'Linear equations in two variables',
          'Linear functions',
          'Systems of two linear equations in two variables',
          'Linear inequalities in one or two variables',
        ],
      ],
      [
        'Advanced Math',
        [
          'Equivalent expressions',
          'Nonlinear equations in one variable and systems of equations in two variables',
          'Nonlinear functions',
        ],
      ],
      [
        'Problem-Solving and Data Analysis',
        [
          'Ratios, rates, proportional relationships, and units',
          'Percentages',
          'One-variable data: distributions and measures of center and spread',
          'Two-variable data: models and scatterplots',
          'Probability and conditional probability',
          'Inference from sample statistics and margin of error',
          'Evaluating statistical claims: observational studies and experiments',
        ],
      ],
      [
        'Geometry and Trigonometry',
        [
          'Area and volume',
          'Lines, angles, and triangles',
          'Right triangles and trigonometry',
          'Circles',
        ],
      ],
    ],
  ],
];
const GRE = [
  [
    'Verbal Reasoning',
    [['Question Types', ['Reading Comprehension', 'Text Completion', 'Sentence Equivalence']]],
  ],
  [
    'Quantitative Reasoning',
    [
      [
        'Arithmetic',
        [
          'Properties and types of integers: divisibility, factorization, primes, remainders',
          'Arithmetic operations, exponents and roots',
          'Estimation, percent, ratio and rate',
          'Absolute value and the number line',
          'Decimal representation and sequences of numbers',
        ],
      ],
      [
        'Algebra',
        [
          'Operations with exponents',
          'Factoring and simplifying algebraic expressions',
          'Relations, functions, equations and inequalities',
          'Linear and quadratic equations and inequalities',
          'Simultaneous equations and inequalities',
          'Setting up equations to solve word problems',
          'Coordinate geometry: graphs, intercepts and slopes',
        ],
      ],
      [
        'Geometry',
        [
          'Parallel and perpendicular lines',
          'Circles',
          'Triangles, including special triangles',
          'Quadrilaterals and other polygons',
          'Congruent and similar figures',
          'Three-dimensional figures',
          'Area, perimeter and volume',
          'Pythagorean theorem',
          'Angle measurement in degrees',
        ],
      ],
      [
        'Data Analysis',
        [
          'Descriptive statistics: mean, median, mode, range, standard deviation, quartiles',
          'Interpretation of tables and graphs',
          'Elementary probability',
          'Random variables and probability distributions, including normal distributions',
          'Counting methods: combinations, permutations and Venn diagrams',
        ],
      ],
      [
        'Question Types',
        [
          'Quantitative Comparison',
          'Multiple-choice: select one',
          'Multiple-choice: select one or more',
          'Numeric Entry',
          'Data Interpretation sets',
        ],
      ],
    ],
  ],
  ['Analytical Writing', [['Analytical Writing', ['Analyze an Issue task']]]],
];
// Official: Problem Solving on arithmetic and elementary algebra. The topics are those that
// independent prep analyses agree on (D113): Physics Wallah, Target Test Prep, CrackVerbal, e-GMAT.
const GMAT = [
  [
    'Quantitative Reasoning',
    [
      [
        'Arithmetic',
        [
          'Number properties: divisibility, factors and multiples',
          'Fractions, decimals and percentages',
          'Ratios and proportions',
          'Word problems: rates, work and interest',
          'Statistics',
          'Counting methods and probability',
        ],
      ],
      ['Algebra', ['Linear and quadratic equations', 'Inequalities', 'Equivalent expressions']],
    ],
  ],
  ['Verbal Reasoning', [['Question Types', ['Reading Comprehension', 'Critical Reasoning']]]],
  [
    'Data Insights',
    [
      [
        'Question Types',
        [
          'Data Sufficiency',
          'Multi-Source Reasoning',
          'Table Analysis',
          'Graphics Interpretation',
          'Two-Part Analysis',
        ],
      ],
    ],
  ],
];
const TOEFL = [
  [
    'Reading',
    [['Task Types', ['Complete the Words', 'Read in Daily Life', 'Read an Academic Passage']]],
  ],
  [
    'Listening',
    [
      [
        'Task Types',
        [
          'Listen and Choose a Response',
          'Listen to a Conversation',
          'Listen to an Announcement',
          'Listen to an Academic Talk',
        ],
      ],
    ],
  ],
  [
    'Writing',
    [['Task Types', ['Build a Sentence', 'Write an Email', 'Write for an Academic Discussion']]],
  ],
  ['Speaking', [['Task Types', ['Listen and Repeat', 'Take an Interview']]]],
];
const IELTS = [
  [
    'Listening',
    [
      [
        'Recordings',
        [
          'Part 1: conversation in an everyday social setting',
          'Part 2: talk in an everyday social setting',
          'Part 3: discussion in an educational or training setting',
          'Part 4: lecture on an academic subject',
        ],
      ],
      [
        'Question Types',
        [
          'Multiple choice',
          'Matching',
          'Plan/map/diagram labelling',
          'Form/note/table/flow chart completion',
          'Sentence completion',
          'Short-answer questions',
        ],
      ],
    ],
  ],
  [
    'Reading (Academic)',
    [
      [
        'Question Types',
        [
          'Multiple choice',
          'Identifying information (True/False/Not given)',
          "Identifying writer's views/claims (Yes/No/Not given)",
          'Matching information',
          'Matching headings',
          'Matching features',
          'Matching sentence endings',
          'Sentence completion',
          'Summary/note/table/flow chart completion',
          'Diagram label completion',
          'Short-answer questions',
        ],
      ],
    ],
  ],
  [
    'Writing (Academic)',
    [
      [
        'Tasks',
        [
          'Task 1: describe a graph, chart, table or diagram (150 words)',
          'Task 2: respond to a point of view, argument or problem (250 words)',
        ],
      ],
      [
        'Assessment Criteria',
        [
          'Task achievement / Task response',
          'Coherence and cohesion',
          'Lexical resource',
          'Grammatical range and accuracy',
        ],
      ],
    ],
  ],
  [
    'Speaking',
    [
      ['Parts', ['Part 1: introduction and interview', 'Part 2: long turn', 'Part 3: discussion']],
      [
        'Assessment Criteria',
        [
          'Fluency and coherence',
          'Lexical resource',
          'Grammatical range and accuracy',
          'Pronunciation',
        ],
      ],
    ],
  ],
];
const LSAT = [
  [
    'Logical Reasoning',
    [
      [
        'Skills',
        [
          'Recognizing the parts of an argument and their relationships',
          'Recognizing similarities and differences between patterns of reasoning',
          'Drawing well-supported conclusions',
          'Reasoning by analogy',
          'Recognizing misunderstandings or points of disagreement',
          'Determining how additional evidence affects an argument',
          'Detecting assumptions made by particular arguments',
          'Identifying and applying principles or rules',
          'Identifying flaws in arguments',
          'Identifying explanations',
        ],
      ],
    ],
  ],
  [
    'Reading Comprehension',
    [
      [
        'What Questions Ask About',
        [
          'The main idea or primary purpose',
          'Information that is explicitly stated',
          'Information or ideas that can be inferred',
          'The meaning or purpose of words or phrases in context',
          'The organization or structure',
          'Applying information to a new context',
          'Principles that function in the selection',
          'Analogies to claims or arguments in the selection',
          "The author's attitude as revealed in tone or language",
          'The impact of new information on claims or arguments',
        ],
      ],
    ],
  ],
  [
    'LSAT Argumentative Writing',
    [
      [
        'Argumentative Writing',
        [
          'Prewriting analysis of the perspectives',
          'Writing a position essay addressing other perspectives',
        ],
      ],
    ],
  ],
];

// --- CFA ----------------------------------------------------------------------
/** [[topic, [learning modules]]] in document order. */
function cfaModules(text) {
  const topics = new Map();
  let current = null;
  let previous = '';
  for (let line of splitlines(text)) {
    line = strip(line);
    if (!line) continue;
    if (CFA_TOPICS.includes(line)) {
      current = line;
      if (!topics.has(current)) topics.set(current, []);
      previous = '';
      continue;
    }
    const module = match(String.raw`^(.{3,120}?)\s+The candidate should be able to`, line);
    if (module && current) {
      // The end of the previous outcome can run in ("between economies Capital Market ..."):
      // it is lower case, the module name is not.
      const name = sub('^[a-z][^A-Z]*', '', module.group(1));
      topics.get(current).push(fit(clean(name))[0]);
    } else if (
      line.startsWith('The candidate should be able to') &&
      current &&
      previous &&
      !search(`LEARNING OUTCOMES|CFA Institute|□`, previous)
    ) {
      topics.get(current).push(fit(clean(previous))[0]); // the module name on the line before
    }
    previous = line;
  }
  return [...topics].filter(([, m]) => m.length).map(([t, m]) => [t, unique(m)]);
}

function cfa3(src) {
  const core = cfaModules(read(join(src, 'cfa3-portfolio-management.txt')));
  let out = core.filter(([t]) => !t.includes('Pathway'));
  for (const key of ['portfolio-management', 'private-markets', 'private-wealth']) {
    out = out.concat(
      cfaModules(read(join(src, `cfa3-${key}.txt`)))
        .filter(([t]) => t.includes('Pathway'))
        .map(([t, m]) => [`Pathway (choose one): ${t.replaceAll(' Pathway', '')}`, m]),
    );
  }
  return [['Level III', out]];
}

// --- USMLE --------------------------------------------------------------------
function usmle(text) {
  const anchor = 'Human Development\nNormal age-related';
  const body = text.includes(anchor)
    ? text.slice(text.indexOf(anchor))
    : text.slice(text.lastIndexOf('Human Development'));
  let lines = splitlines(body).map((l) => strip(l));
  lines = lines.filter(
    (l) => l && !match(String.raw`For Public Release|Copyright|^\d+$|^Public$`, l),
  );
  // A long system name wraps onto a second line ("Female and Transgender Reproductive" / "System & Breast").
  const joined = [];
  for (const line of lines) {
    if (joined.length && USMLE_SYSTEMS.includes(`${joined.at(-1)} ${line}`))
      joined[joined.length - 1] = `${joined.at(-1)} ${line}`;
    else joined.push(line);
  }
  const subjects = [];
  let system = null;
  let chapter = null;
  for (const line of joined) {
    if (USMLE_SYSTEMS.includes(line)) {
      system = [line.replaceAll(' & ', ' and ').replaceAll('&', 'and'), []];
      subjects.push(system);
      chapter = null;
      continue;
    }
    if (system === null) continue;
    if (line.startsWith(BULLET)) {
      if (chapter === null) {
        chapter = [system[0], []];
        system[1].push(chapter);
      }
      for (const item of line.split(BULLET).slice(1)) {
        const head = clean(split(String.raw`\s+o\s+`, strip(item))[0]);
        if (head && search('[A-Za-z]{3}', head)) chapter[1].push(...fit(head));
      }
    } else if (line.startsWith('o ') && chapter !== null) {
      continue; // sub-items: their parent bullet is the topic
    } else if (len(line) <= 120 && !line.endsWith('.') && startsUpper(line)) {
      chapter = [fit(clean(line))[0], []];
      system[1].push(chapter);
    }
  }
  return subjects.map(([s, chs]) => [
    s,
    chs.filter(([, t]) => t.length).map(([c, t]) => [c, unique(t).slice(0, 200)]),
  ]);
}

// --- MCAT ---------------------------------------------------------------------
const TAGS = String.raw`\((?:BIO|BC|OC|GC|PHY|PSY|SOC)(?:,\s*(?:BIO|BC|OC|GC|PHY|PSY|SOC))*\)`;

function mcat(text) {
  const sections = new Map();
  let category = null;
  let heading = null;
  for (let line of splitlines(text)) {
    line = strip(line);
    if (!line || line.startsWith('©') || fullmatch(String.raw`\d+`, line)) continue;
    const cat = match(String.raw`^(\d{1,2})([A-E]):\s+(.{5,140})$`, line);
    if (cat && cat.group(1) in MCAT_SECTIONS) {
      category = [`${cat.group(1)}${cat.group(2)}: ${clean(cat.group(3))}`, []];
      const name = MCAT_SECTIONS[cat.group(1)];
      if (!sections.has(name)) sections.set(name, []);
      sections.get(name).push(category);
      heading = null;
      continue;
    }
    if (category === null) continue;
    const head = match(String.raw`^([A-Z][^${SQUARE}.]{2,90}?)\s*${TAGS}\s*$`, line);
    if (head) {
      heading = clean(head.group(1));
      continue;
    }
    if (heading && line.startsWith(SQUARE)) {
      for (let item of line.split(SQUARE).slice(1)) {
        item = clean(sub(String.raw`\s*${TAGS}`, '', split(String.raw`\s+o\s+`, strip(item))[0]));
        if (item && search('[A-Za-z]{3}', item)) {
          category[1].push(...fit(len(heading) + len(item) < 110 ? `${heading}: ${item}` : item));
        }
      }
    }
  }
  const out = [...sections].map(([name, cats]) => [
    name,
    cats.filter(([, t]) => t.length).map(([c, t]) => [fit(c)[0], unique(t).slice(0, 200)]),
  ]);
  out.push([
    'Critical Analysis and Reasoning Skills',
    [
      [
        'Reasoning Skills',
        ['Foundations of Comprehension', 'Reasoning Within the Text', 'Reasoning Beyond the Text'],
      ],
      ['Passage Disciplines', ['Humanities', 'Social Sciences']],
    ],
  ]);
  return out;
}

// --- SMLE ---------------------------------------------------------------------
/** SCFHS SMLE Applicant Guide 2024, Appendix B content outline (`pdftotext -layout`). */
function smle(text) {
  text = text.slice(index(text, 'SMLE Content Outline'));
  const subjects = [];
  let specialty = null;
  for (const raw of splitlines(text)) {
    let line = sub(String.raw`\s{2,}(Mastery level|\d)\s*$`, '', rstrip(raw));
    line = sub(String.raw`\s{2,}(Topic|Mastery level)\s*$`, '', line);
    const stripped = strip(line);
    if (!stripped || fullmatch(String.raw`\d+|Topic|Mastery level`, stripped)) continue;
    const section = SMLE_SECTIONS.find((s) => stripped.startsWith(s));
    if (section && !raw.startsWith(' ')) {
      subjects.push([section.replaceAll('And', 'and').replaceAll(', &', ' and'), []]);
      specialty = null;
      continue;
    }
    if (!subjects.length) continue;
    const last = subjects.at(-1);
    const head = match(String.raw`^([A-Z][A-Za-z ,&/'-]+?):\s*(.*)$`, line);
    if (head && !raw.startsWith(' ') && !head.group(2)) {
      specialty = [title(clean(head.group(1))).replaceAll(' And ', ' and '), []];
      last[1].push(specialty);
      continue;
    }
    if (raw.startsWith(' ') && !raw.startsWith('  ') && match('[A-Z0-9]', stripped)) {
      if (len(stripped) > 90) {
        if (last[0].startsWith('Patient Safety') && specialty && specialty[1].length) break; // the prose after the outline ends it
        continue;
      }
      if (specialty === null) {
        specialty = [last[0], []];
        last[1].push(specialty);
      }
      specialty[1].push(clean(stripped));
    } else if (head && specialty !== null) {
      // "Epidemiology/Biostatistics: Measures Of Health Status"
      specialty[1].push(clean(stripped));
    } else if (specialty !== null && specialty[1].length && !raw.startsWith(' ')) {
      specialty[1][specialty[1].length - 1] = clean(`${specialty[1].at(-1)} ${stripped}`); // a wrapped topic
    }
  }
  return subjects.map(([s, chs]) => [
    s,
    chs.filter(([, t]) => t.length).map(([c, t]) => [c, unique(t)]),
  ]);
}

// --- GCSE ---------------------------------------------------------------------
function gcseMaths(text) {
  const start = index(text, 'should require students to'); // the content list, after the aims
  const end = text.indexOf('Assessment objectives', start);
  text = text.slice(start, end > 0 ? end : text.length);
  const chapters = [];
  let area = null;
  let current = null;
  for (let line of splitlines(text)) {
    line = strip(line);
    if (!line || fullmatch(String.raw`\d+`, line)) continue;
    if (GCSE_MATHS_AREAS.includes(line)) {
      area = line;
      continue;
    }
    const item = match(String.raw`^(\d{1,3})\.\s+(.*)$`, line);
    if (item && area) {
      const clause = split(String.raw`;|\s\(|\.\s|,\s(?:including|e\.g)`, item.group(2))[0];
      if (current) current[1].push(...fit(clean(clause)));
      continue;
    }
    if (area && len(line) <= 60 && startsUpper(line) && !line.endsWith('.') && !item) {
      current = [`${area}: ${clean(line)}`, []];
      chapters.push(current);
    }
  }
  return chapters.filter(([, t]) => t.length).map(([c, t]) => [c, unique(t)]);
}

function gcseScience(text) {
  const out = [];
  const lines = splitlines(text).map((l) => strip(l));
  for (const [science, areas] of Object.entries(GCSE_SCIENCE_AREAS)) {
    const start = lines.findIndex((l) => l.startsWith(`${science} is the science`));
    if (start < 0) throw new Error(`${science}: start not found`);
    const chapters = [];
    let current = null;
    for (const line of lines.slice(start)) {
      if (
        ['Biology is the science', 'Chemistry is the science', 'Physics is the science'].some((p) =>
          line.startsWith(p),
        ) &&
        !line.startsWith(science)
      )
        break;
      if (areas.includes(line)) {
        current = [line, []];
        chapters.push(current);
        continue;
      }
      if (current === null || !line || line.startsWith(BULLET) || fullmatch(String.raw`\d+`, line))
        continue;
      if (line === 'Use of mathematics') {
        current = null; // the maths-skills lists repeat across topics
        continue;
      }
      if (len(line) <= 70 && startsUpper(line) && !line.endsWith('.') && !line.endsWith(':'))
        current[1].push(clean(line));
    }
    out.push([
      `Combined Science: ${science}`,
      chapters.filter(([, t]) => t.length).map(([c, t]) => [c, unique(t)]),
    ]);
  }
  return out;
}

const TEMPLATES = [
  [
    'cfa-level-1',
    'CFA Level I',
    'CFA Program Level I: the ten topics and their learning modules (2026 curriculum).',
    'CFA Institute, 2026 Level I Topic Outlines; learning modules as named.',
    (src) => [['Level I', cfaModules(read(join(src, 'cfa1.txt')))]],
  ],
  [
    'cfa-level-2',
    'CFA Level II',
    'CFA Program Level II: topics and learning modules (2026 curriculum).',
    'CFA Institute, 2026 Level II Topic Outlines; learning modules as named.',
    (src) => [['Level II', cfaModules(read(join(src, 'cfa2.txt')))]],
  ],
  [
    'cfa-level-3',
    'CFA Level III',
    'CFA Program Level III: core topics and the three pathways (2026 curriculum).',
    'CFA Institute, 2026 Level III Topic Outlines (core and pathways); learning modules as named.',
    cfa3,
  ],
  [
    'usmle',
    'USMLE',
    'United States Medical Licensing Examination: the content outline shared by all Steps.',
    "USMLE Content Outline (2026), usmle.org; topics are the outline's first-level items.",
    (src) => usmle(read(join(src, 'usmle.txt'))),
  ],
  [
    'mcat',
    'MCAT',
    'Medical College Admission Test: the four sections, by content category.',
    "AAMC, What's on the MCAT Exam? (2020); topics are the outline's first-level items.",
    (src) => mcat(read(join(src, 'mcat.txt'))),
  ],
  [
    'sat',
    'SAT',
    'Digital SAT: Reading and Writing and Math, by content domain and skill.',
    'College Board, Assessment Framework for the Digital SAT Suite, Tables 10 and 16.',
    () => SAT,
  ],
  [
    'gre-general',
    'GRE General',
    'GRE General Test: Verbal Reasoning, Quantitative Reasoning, Analytical Writing.',
    'ETS, GRE General Test content pages.',
    () => GRE,
  ],
  [
    'gmat',
    'GMAT',
    'GMAT Focus Edition: Quantitative Reasoning, Verbal Reasoning, Data Insights.',
    'Sections and question types: mba.com, GMAT Focus Edition pages. Quant topics: at least two independent prep analyses (mba.com publishes no topic list).',
    () => GMAT,
  ],
  [
    'toefl',
    'TOEFL iBT',
    'TOEFL iBT: Reading, Listening, Writing and Speaking task types.',
    'ETS, TOEFL iBT test content page.',
    () => TOEFL,
  ],
  [
    'ielts',
    'IELTS Academic',
    'IELTS Academic: Listening, Reading, Writing and Speaking.',
    'ielts.org, IELTS Academic test format pages.',
    () => IELTS,
  ],
  [
    'smle',
    'SMLE',
    'Saudi Medical Licensing Exam: the SCFHS content outline by section and specialty.',
    'SCFHS SMLE Applicant Guide 2024, Appendix B blueprint and content outline.',
    (src) => smle(read(join(src, 'smle-l.txt'))),
  ],
  [
    'mrcs-part-a',
    'MRCS Part A',
    'Intercollegiate MRCS Part A: Applied Basic Sciences and Principles of Surgery in General.',
    'Intercollegiate MRCS content guide (Royal Colleges of Surgeons), Part A content areas; transcribed.',
    () => MRCS,
  ],
  [
    'gcse',
    'GCSE (UK)',
    'GCSE core subjects: English Language and Literature, Mathematics, Combined Science, Geography, History.',
    'UK Department for Education GCSE subject content (gov.uk); Maths and Combined Science headings from the ' +
      'documents, the other subjects transcribed.',
    (src) => [
      ...GCSE_TEXT.slice(0, 2),
      ['Mathematics', gcseMaths(read(join(src, 'gcse-maths.txt')))],
      ...gcseScience(read(join(src, 'gcse-science.txt'))),
      ...GCSE_TEXT.slice(2),
    ],
  ],
  [
    'lsat',
    'LSAT',
    'Law School Admission Test: Logical Reasoning, Reading Comprehension, Argumentative Writing.',
    'LSAC, LSAT test format, Logical Reasoning and Reading Comprehension pages.',
    () => LSAT,
  ],
];

const [src, out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const [templateId, name, description, source, parse] of TEMPLATES) {
  if (only.length && !only.includes(templateId)) continue;
  const subjects = parse(src);
  let body = [];
  for (const [subject, chapters] of subjects) {
    body = body.concat(
      render(
        subject,
        chapters.filter(([, t]) => t.length).map(([c, t]) => [c, t.slice(0, 200)]),
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
    subjects.map(([s, c]) => [slice(s, 0, 30), c.length, c.reduce((n, [, t]) => n + t.length, 0)]),
  );
}
