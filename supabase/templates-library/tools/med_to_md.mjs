/**
 * Draft the FMGE, INI-CET, BDS, NEET MDS and GPAT templates.
 *
 * Usage: node med_to_md.mjs <dir> <out dir> [ids...]
 *   <dir>/fmge-l.txt   `pdftotext -enc UTF-8 -layout -f 85 -l 98` of the NBEMS FMGE December
 *                      2024 Information Bulletin, section 12 "Syllabus and Exam Blueprint"
 *   <dir>/bds.txt      `pdftotext -enc UTF-8` of the DCI Revised BDS Course Regulations, 2007
 *                      (text copy hosted by KGMU; the DCI gazette copy is a scanned image)
 *   <dir>/bpharm.txt   `pdftotext -enc UTF-8` of the PCI "Rules & Syllabus for the B. Pharm
 *                      Course" (pci.gov.in, Course Wise Regulations)
 *
 * FMGE's syllabus is NBEMS's extract of the Graduate Medical Education Regulations. INI-CET
 * (AIIMS) covers "the entire MBBS curriculum" and publishes no list, so it uses the same
 * official extract. NEET MDS lists its subjects (NEET-MDS 2025 bulletin, para 5.10) and
 * refers to the DCI BDS regulations for content. GPAT groups questions into five areas
 * (GPAT 2024 bulletin, para 5.3) over the B. Pharm syllabus; each course is placed in an
 * area by its name.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { topics } from './csir_net_to_md.mjs';
import { clean, fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import {
  finditer,
  index,
  isupper,
  islower,
  len,
  match,
  readText,
  search,
  slice,
  split,
  splitlines,
  strip,
  sub,
  title as pyTitle,
  unique,
} from './lib/py.mjs';

const read = (path) => readText(path).normalize('NFKC').replaceAll('\f', '\n'); // page breaks

// --- FMGE / INI-CET ---------------------------------------------------------
const PRE_PARA = [
  'ANATOMY',
  'PHYSIOLOGY',
  'BIOCHEMISTRY',
  'PATHOLOGY',
  'MICROBIOLOGY',
  'PHARMACOLOGY',
  'FORENSIC MEDICINE',
];
const CLINICAL = [
  'GENERAL SURGERY',
  'ANESTHESIA',
  'ORTHOPEDICS',
  'RADIO- DIAGNOSIS',
  'RADIOTHERAPY',
  'PAEDIATRICS',
  'MEDICINE',
  'TUBERCULOSIS AND RESPIRATORY DISEASES',
  'PSYCHIATRY',
  'DERMATOLOGY AND SEXUALLY TRANSMITTED DISEASES',
  'OPHTHALMOLOGY',
  'OTORHINOLARYNGOLOGY',
  'OBSTETRICS AND GYNECOLOGY',
  'COMMUNITY MEDICINE',
];
// The Anatomy block's two columns run together in the PDF; this is its text, in order.
const FMGE_ANATOMY = [
  ['General Anatomy', ['Basic tissues of the body', 'Terminology and nomenclature']],
  ['Elements of Anatomy', ['Osteology', 'Arthrology', 'Myology', 'Angiology', 'Neurology']],
  [
    'Regional Anatomy',
    [
      'Upper limb',
      'Lower limb',
      'Thorax including diaphragm',
      'Abdomen and pelvis',
      'Head and neck',
      'Brain and spinal cord',
    ],
  ],
  [
    'Embryology',
    ['Development of individual organs and systems', 'Postnatal growth and development'],
  ],
  ['Histology', ['General histology', 'Microanatomy of individual organs and systems']],
  ['Human Genetics', ['Principles of human genetics and molecular biology']],
  ['Radiological Anatomy', ['Skiagrams', 'Special X-rays', 'Principles of imaging techniques']],
  ['Surface Anatomy', ['In cadavers', 'In the living']],
  ['Sectional Anatomy', ['Thorax, abdomen, head, neck and brain']],
];

const subjectName = (heading) =>
  ({ 'RADIO- DIAGNOSIS': 'Radiodiagnosis', ANESTHESIA: 'Anaesthesia' })[heading] ??
  pyTitle(heading).replaceAll(' And ', ' and ');

function fmge(text) {
  text = text.slice(0, index(text, 'BLUE PRINT'));
  const lines = splitlines(text);
  const starts = new Map();
  lines.forEach((line, i) => {
    const s = strip(line);
    if ([...PRE_PARA, ...CLINICAL].includes(s) && !starts.has(s)) starts.set(s, i);
  });
  const order = [...starts.keys()].sort((a, b) => starts.get(a) - starts.get(b));
  const chapters = {};
  order.forEach((heading, n) => {
    const end = n + 1 < order.length ? starts.get(order[n + 1]) : lines.length;
    const items = [];
    for (const line of lines.slice(starts.get(heading) + 1, end)) {
      if (!strip(line) || search(String.raw`FMGE December|एफ़एमजीई|^\s*\d+\s*$`, line)) continue;
      // A continuation is indented deeper or starts in lower case.
      if (items.length && (match(String.raw`^\s{7,}`, line) || islower(slice(strip(line), 0, 1))))
        items[items.length - 1] += ` ${strip(line)}`;
      else items.push(strip(line));
    }
    const found = [];
    for (const item of items) found.push(...(len(item) > 90 ? topics(item) : [clean(item)]));
    chapters[heading] = unique(found).filter(Boolean);
  });
  chapters.ANATOMY = null;
  const pre = PRE_PARA.map((h) =>
    h === 'ANATOMY'
      ? [
          'Anatomy',
          FMGE_ANATOMY.flatMap(([c, ts]) => ts.map((t) => (len(t) < 60 ? `${c}: ${t}` : t))),
        ]
      : [subjectName(h), chapters[h]],
  );
  const clinical = CLINICAL.map((h) => [subjectName(h), chapters[h]]);
  return [
    ['Pre-clinical and Para-clinical Subjects', pre],
    ['Clinical Subjects', clinical],
  ];
}

// --- BDS / NEET MDS ---------------------------------------------------------
const BDS_SUBJECTS = [
  [
    'HUMAN ANATOMY, EMBRYOLOGY, HISTOLOGY & MEDICAL GENETICS',
    'Human Anatomy, Embryology, Histology and Medical Genetics',
  ],
  ['HUMAN PHYSIOLOGY', 'Human Physiology'],
  ['BIOCHEMISTRY AND NUTRITION', 'Biochemistry and Nutrition'],
  [
    'DENTAL ANATOMY, EMBRYOLOGY AND ORAL HISTOLOGY',
    'Dental Anatomy, Embryology and Oral Histology',
  ],
  ['GENERAL PATHOLOGY', 'General Pathology'],
  ['MICROBIOLOGY', 'Microbiology'],
  [
    'GENERAL AND DENTAL PHARMACOLOGY AND THERAPEUTICS',
    'General and Dental Pharmacology and Therapeutics',
  ],
  ['DENTAL MATERIALS', 'Dental Materials'],
  ['ORAL PATHOLOGY & ORAL MICROBIOLOGY', 'Oral Pathology and Oral Microbiology'],
  ['GENERAL MEDICINE', 'General Medicine'],
  ['10. GENERAL SURGERY', 'General Surgery'],
  ['11. CONSERVATIVE DENTISTRY AND ENDODONTICS', 'Conservative Dentistry and Endodontics'],
  ['12. ORAL & MAXILLOFACIAL SURGERY', 'Oral and Maxillofacial Surgery'],
  ['13. ORAL MEDICINE AND RADIOLOGY', 'Oral Medicine and Radiology'],
  ['14. ORTHODONTICS & DENTAL ORTHOPAEDICS', 'Orthodontics and Dentofacial Orthopaedics'],
  ['15. PAEDIATRIC & PREVENTIVE DENTISTRY', 'Paediatric and Preventive Dentistry'],
  ['16. PUBLIC HEALTH DENTISTRY', 'Public Health Dentistry'],
  ['17. PERIODONTOLOGY', 'Periodontology'],
  ['18. PROSTHODONTICS AND CROWN & BRIDGE', 'Prosthodontics and Crown and Bridge'],
];

function bdsBlocks(text) {
  const body = text.slice(index(text, 'SYLLABUS OF STUDY'));
  const lines = splitlines(body);
  const starts = [];
  for (const [heading, name] of BDS_SUBJECTS) {
    const target = heading.toUpperCase();
    const prev = starts.length ? starts[starts.length - 1][0] : -1;
    const i = lines.findIndex((l, k) => strip(l).toUpperCase().startsWith(target) && k > prev);
    if (i < 0) continue;
    starts.push([i, name]);
  }
  const blocks = {};
  starts.forEach(([i, name], n) => {
    let end;
    if (n + 1 < starts.length) end = starts[n + 1][0];
    else {
      // the last subject ends where Aesthetic Dentistry or the internship rules begin
      end = lines.length;
      for (let k = i + 1; k < lines.length; k++) {
        if (match(String.raw`^\s*(19|20|21|22)\.\s+[A-Z]|.*\bINTERNSHIP\b`, lines[k])) {
          end = k;
          break;
        }
      }
    }
    blocks[name] = lines.slice(i + 1, end);
  });
  return blocks;
}

/** The numbered items of a subject's course content, by their titles. */
function bdsTopics(block) {
  let text = sub(String.raw`\s+`, ' ', block.join(' '));
  // The course content, not the goals and objectives before it; "Theory" only as a fallback.
  const start =
    search(
      String.raw`COURSE CONTENTS?|OUTLINE OF THE COURSE CONTENT|THEORY SYLLABUS|DETAILED SYLLABUS|FURTHER DETAILS OF THE COURSE`,
      text,
      'i',
    ) || search(String.raw`\bTHEORY\b`, text);
  text = start ? text.slice(start.end()) : text;
  const end = search(
    String.raw`\b(PRACTICALS?|PRACTICAL EXERCISES|RECOMMENDED BOOKS|TEXT ?BOOKS|BOOKS RECOMMENDED|SCHEME OF EXAMINATION|CLINICALS?)\b`,
    text,
  );
  text = end ? text.slice(0, end.start()) : text;
  const found = [];
  for (const item of split(String.raw`(?<![\d.])\b\d{1,2}[.)]\s+`, text).slice(1)) {
    const upper = match(String.raw`^([A-Z][A-Z &,/'-]{3,}?)\s+[A-Z][a-z]`, item); // "CHEMISTRY OF X Carbohydrates..."
    let t = upper ? upper.group(1) : split(String.raw`\s+[-–]\s+|:\s|\.\s|;\s|\(`, item)[0];
    t = clean(sub(String.raw`\s*\d{1,2}\s*$`, '', t));
    if (
      match(
        String.raw`(Should|To |Have |Be able|Students?\b|Know|Understand|Prescribe|Observe|Critically|Acquire|Identify|Demonstrate|Describe|Explain|The different|The principles)`,
        t,
      )
    )
      continue; // learning objectives, not course content
    if (
      len(t) > 3 &&
      len(t) <= 90 &&
      search('[A-Za-z]{3}', t) &&
      !search(String.raw`\b(19|20)\d\d\b|Edition|Publish|\bby\s+[A-Z]`, t)
    ) {
      found.push(isupper(t) ? slice(t, 0, 1).toUpperCase() + slice(t, 1).toLowerCase() : t);
    }
  }
  return unique(found);
}

const NEET_MDS_PARTS = {
  'Part A': [
    [
      'General Anatomy including Embryology and Histology',
      ['Human Anatomy, Embryology, Histology and Medical Genetics'],
    ],
    [
      'General Human Physiology and Biochemistry',
      ['Human Physiology', 'Biochemistry and Nutrition'],
    ],
    [
      'Dental Anatomy, Embryology and Oral Histology',
      ['Dental Anatomy, Embryology and Oral Histology'],
    ],
    ['General Pathology and Microbiology', ['General Pathology', 'Microbiology']],
    [
      'General and Dental Pharmacology and Therapeutics',
      ['General and Dental Pharmacology and Therapeutics'],
    ],
    ['General Medicine', ['General Medicine']],
    ['General Surgery', ['General Surgery']],
  ],
  'Part B': [
    ['Dental Materials', ['Dental Materials']],
    ['Oral Pathology and Oral Microbiology', ['Oral Pathology and Oral Microbiology']],
    ['Oral Medicine and Radiology', ['Oral Medicine and Radiology']],
    ['Pedodontics and Preventive Dentistry', ['Paediatric and Preventive Dentistry']],
    ['Orthodontics and Dentofacial Orthopedics', ['Orthodontics and Dentofacial Orthopaedics']],
    ['Periodontology', ['Periodontology']],
    ['Prosthodontics and Crown and Bridge', ['Prosthodontics and Crown and Bridge']],
    ['Conservative Dentistry and Endodontics', ['Conservative Dentistry and Endodontics']],
    ['Oral and Maxillofacial Surgery', ['Oral and Maxillofacial Surgery']],
    ['Public Health Dentistry', ['Public Health Dentistry']],
  ],
};
const BDS_YEARS = {
  'First Year': [
    'Human Anatomy, Embryology, Histology and Medical Genetics',
    'Human Physiology',
    'Biochemistry and Nutrition',
    'Dental Anatomy, Embryology and Oral Histology',
  ],
  'Second Year': [
    'General Pathology',
    'Microbiology',
    'General and Dental Pharmacology and Therapeutics',
    'Dental Materials',
  ],
  'Third Year': ['Oral Pathology and Oral Microbiology', 'General Medicine', 'General Surgery'],
  'Final Year': [
    'Conservative Dentistry and Endodontics',
    'Oral and Maxillofacial Surgery',
    'Oral Medicine and Radiology',
    'Orthodontics and Dentofacial Orthopaedics',
    'Paediatric and Preventive Dentistry',
    'Public Health Dentistry',
    'Periodontology',
    'Prosthodontics and Crown and Bridge',
  ],
};

const topicBlocks = (text) =>
  Object.fromEntries(
    Object.entries(bdsBlocks(text)).map(([name, lines]) => [name, bdsTopics(lines)]),
  );
const orSelf = (blocks, s) => (blocks[s] && blocks[s].length ? blocks[s] : [s]);

function bds(text) {
  const blocks = topicBlocks(text);
  return Object.entries(BDS_YEARS).map(([year, subjects]) => [
    year,
    subjects.map((s) => [s, orSelf(blocks, s)]),
  ]);
}

function neetMds(text) {
  const blocks = topicBlocks(text);
  return Object.entries(NEET_MDS_PARTS).map(([part, chapters]) => [
    part,
    chapters.map(([t, sources]) => [t, unique(sources.flatMap((s) => orSelf(blocks, s)))]),
  ]);
}

// --- GPAT -------------------------------------------------------------------
const GPAT_AREAS = [
  ['Pharmacognosy and Allied Subjects', 'PHARMACOGNOSY|HERBAL'],
  ['Pharmaceutical Chemistry and Allied Subjects', '(?<!BIO)CHEMISTRY|ANALYSIS|INSTRUMENTAL'],
  [
    'Pharmaceutics and Allied Subjects',
    'PHARMACEUTICS|INDUSTRIAL PHARMACY|BIOPHARMACEUTICS|DRUG DELIVERY|PHARMACEUTICAL ENGINEERING|COSMETIC',
  ],
  ['Pharmacology and Allied Subjects', 'PHARMACOLOGY|TOXICOLOGY|PATHOPHYSIOLOGY'],
  ['Other Subjects of B. Pharm', '.'],
];

function gpat(text) {
  text = text.slice(index(text, 'BP101T. HUMAN ANATOMY'));
  // Headings are written several ways: "BP101T.", "BP 303 T.", "BP503.T.", "BP606TPHARMA...".
  const heading = String.raw`BP\s*(\d)\s*(\d)\s*(\d)\s*\.?\s*(RBT|RMT|ET|T)?\s*[.:]?\s*([A-Z][^\n(]*?)\s*\(\s*Theory\s*\)`;
  const starts = [...[...finditer(`^${heading}`, text, 'm')].map((m) => m.start()), text.length];
  const courses = starts.slice(0, -1).map((a, i) => text.slice(a, starts[i + 1]));
  const areas = new Map(GPAT_AREAS.map(([name]) => [name, []]));
  for (const course of courses) {
    const head = match(heading, course);
    const code = head.group(1) + head.group(2) + head.group(3);
    const kind = head.group(4) || 'T';
    const name = head.group(5);
    if (kind.includes('E') || kind.includes('R') || Number(code) >= 803) continue; // electives (BP803 onwards) and remedial courses
    let t = pyTitle(clean(name)).replaceAll(' And ', ' and ').replaceAll(' Of ', ' of ');
    t = sub(
      String.raw`\bIi\b`,
      'II',
      sub(String.raw`\bIii\b`, 'III', sub(String.raw`(?<=[a-z])(I{1,3})\b`, String.raw` \1`, t)),
    );
    t = sub(String.raw`\s*[–-]\s*(?=I)`, ' ', t).replaceAll('Biostatisitcs', 'Biostatistics');
    t = sub('Pharmacy(i{1,2})$', (m) => `Pharmacy ${m.group(1).toUpperCase()}`, t);
    if (
      search(
        'COMMUNICATION|COMPUTER APPLICATIONS|ENVIRONMENTAL SCIENCES|REMEDIAL',
        name.toUpperCase(),
      )
    )
      continue; // not pharmacy subjects
    const at = course.indexOf('Course Content');
    let content = at < 0 ? course : course.slice(at + 'Course Content'.length);
    content = split(
      String.raw`\n\s*(?:BP\s*\d\s*\d\s*\d\s*\.?\s*[A-Z]*\s*P\b|Recommended Books)|\(\s*Practical\s*\)`,
      content,
    )[0];
    content = sub(String.raw`\b\d{1,2}\s*Hours?\b|\n\s*\d{1,3}\s*\n`, ' ', content, 0, 'i');
    content = sub('[•▪]', '. ', content); // PDF bullets
    content = sub(String.raw`\(([a-h]|[ivx]+)\)\s*|\b[ivx]+\)\s*`, '. ', content);
    let found = [];
    for (const unit of split(String.raw`UNIT\s*[-–]?\s*[IVX]+\s*:?`, content, 0, 'i').slice(1))
      found.push(...topics(sub(String.raw`\s+`, ' ', unit)));
    // Strip list letters left at the end ("... tolerance. b") and stray full stops.
    found = found.map((x) => clean(sub(String.raw`(?:\.\s*|\s+)[a-h]$`, '', x)));
    found = unique(found).filter((x) => search('[A-Za-z]{3}', x) && !x.includes('Practical'));
    const area = GPAT_AREAS.find(([, pattern]) => search(pattern, name.toUpperCase()))[0];
    areas.get(area).push([fit(`BP${code} ${t}`)[0], found.slice(0, 200)]);
  }
  return [...areas].filter(([, chapters]) => chapters.length);
}

const TEMPLATES = [
  [
    'fmge',
    'fmge-l.txt',
    fmge,
    'Foreign Medical Graduate Examination',
    'Screening test for foreign medical graduates: pre-clinical, para-clinical and clinical subjects.',
    'NBEMS FMGE December 2024 Information Bulletin, section 12 Syllabus (extract of the Graduate Medical Education Regulations); topics from the official text.',
  ],
  [
    'ini-cet',
    'fmge-l.txt',
    fmge,
    'INI-CET',
    'AIIMS Institute of National Importance Combined Entrance Test: the MBBS curriculum.',
    'AIIMS: INI-CET covers the entire MBBS curriculum. Topic list: NBEMS official extract of the Graduate Medical Education Regulations (FMGE bulletin).',
  ],
  [
    'bds',
    'bds.txt',
    bds,
    'BDS',
    'Bachelor of Dental Surgery: the DCI syllabus, year by year.',
    'DCI Revised BDS Course Regulations, 2007, Syllabus of Study; topics are the numbered items of each subject.',
  ],
  [
    'neet-mds',
    'bds.txt',
    neetMds,
    'NEET MDS',
    'National Eligibility cum Entrance Test for MDS: Part A (7 subjects) and Part B (10 subjects).',
    'Subjects: NBEMS NEET-MDS 2025 Information Bulletin, para 5.10. Topics: DCI Revised BDS Course Regulations, 2007, to which the bulletin refers.',
  ],
  [
    'gpat',
    'bpharm.txt',
    gpat,
    'GPAT',
    "Graduate Pharmacy Aptitude Test: the B. Pharm syllabus in GPAT's five question areas.",
    'Areas: NBEMS GPAT 2024 Information Bulletin, para 5.3. Topics: PCI Rules and Syllabus for the B. Pharm course, theory courses (unit contents).',
  ],
];

const [src, out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const [templateId, file, parse, name, description, source] of TEMPLATES) {
  if (only.length && !only.includes(templateId)) continue;
  const subjects = parse(read(join(src, file)));
  let body = [];
  for (const [subject, chapters] of subjects)
    body = body.concat(
      render(
        subject,
        chapters.filter(([, t]) => t && t.length).map(([c, t]) => [c, t.slice(0, 200)]),
      ),
    );
  writeFileSync(
    join(out, `${templateId}.md`),
    front(templateId, name, description, source) + body.join('\n') + '\n',
    'utf8',
  );
  console.log(
    templateId,
    subjects.map(([s, c]) => [s, c.length]),
  );
}
