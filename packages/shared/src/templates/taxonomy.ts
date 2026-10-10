import type { TemplateCategory, TemplateCounts } from './template';

/**
 * How the template library is organised for browsing.
 *
 * A template's syllabus (subject → chapter → topic) says nothing about where it
 * belongs in the library, and the three broad `category` values it carries
 * (exam, school, custom) are far too coarse for 200-odd templates. This file is
 * the catalog's shelf plan: every template id is placed on exactly one shelf
 * (a group and a subgroup), with aliases so a student can find it by the name
 * they know ("JEE", "GATE AI", "C++").
 *
 * It is metadata only. Nothing here touches a syllabus, and a template is never
 * listed twice: extra discoverability comes from aliases, not extra placements.
 *
 * Ids are stable, so placements are keyed by id rather than by display name. A
 * template that arrives from the online library before this file knows about it
 * is not hidden: `placeTemplate` puts it on an "Other templates" shelf, and a
 * test fails until it is given a proper place.
 */

export interface TemplateSubgroup {
  readonly id: string;
  readonly label: string;
}

export interface TemplateGroup {
  readonly id: string;
  readonly label: string;
  /** One line for the category card. */
  readonly description: string;
  readonly subgroups: readonly TemplateSubgroup[];
}

export const TEMPLATE_GROUPS: readonly TemplateGroup[] = [
  {
    id: 'school',
    label: 'School Education',
    description: 'CBSE, ICSE, ISC and other school curricula',
    subgroups: [
      { id: 'cbse', label: 'CBSE' },
      { id: 'icse-isc', label: 'ICSE and ISC' },
      { id: 'other-curricula', label: 'Other Curricula' },
    ],
  },
  {
    id: 'engineering',
    label: 'Engineering & Science Entrance',
    description: 'JEE, GATE, BITSAT and other entrance exams',
    subgroups: [
      { id: 'jee', label: 'JEE' },
      { id: 'gate-engineering', label: 'GATE Engineering' },
      { id: 'gate-science', label: 'GATE Science' },
      { id: 'other-entrance', label: 'Other Entrance Exams' },
    ],
  },
  {
    id: 'medical',
    label: 'Medical & Healthcare Exams',
    description: 'NEET, licensing, dental, nursing, AYUSH and pharmacy',
    subgroups: [
      { id: 'medical-entrance', label: 'Medical Entrance' },
      { id: 'medical-pg-licensing', label: 'PG and Licensing' },
      { id: 'dental', label: 'Dental' },
      { id: 'nursing', label: 'Nursing' },
      { id: 'ayush', label: 'Ayurveda and Homoeopathy' },
      { id: 'pharmacy', label: 'Pharmacy' },
    ],
  },
  {
    id: 'government',
    label: 'Government Exams',
    description: 'UPSC, SSC, banking and railway exams',
    subgroups: [
      { id: 'upsc', label: 'UPSC' },
      { id: 'engineering-services', label: 'Engineering Services (ESE)' },
      { id: 'ssc', label: 'SSC' },
      { id: 'banking', label: 'Banking' },
      { id: 'railways', label: 'Railways' },
    ],
  },
  {
    id: 'research',
    label: 'Teaching & Research Eligibility',
    description: 'UGC NET and CSIR NET',
    subgroups: [
      { id: 'ugc-net', label: 'UGC NET' },
      { id: 'csir-net', label: 'CSIR NET' },
    ],
  },
  {
    id: 'professional',
    label: 'Professional Qualifications',
    description: 'CA, CMA, CS and CFA',
    subgroups: [
      { id: 'ca', label: 'Chartered Accountancy (CA)' },
      { id: 'cma', label: 'Cost and Management Accounting (CMA)' },
      { id: 'cs', label: 'Company Secretary (CS)' },
      { id: 'cfa', label: 'CFA' },
    ],
  },
  {
    id: 'management-law',
    label: 'Management & Law Entrance',
    description: 'CAT, IPMAT, CLAT and LSAT',
    subgroups: [
      { id: 'management-entrance', label: 'Management Entrance' },
      { id: 'law-entrance', label: 'Law Entrance' },
    ],
  },
  {
    id: 'international',
    label: 'International Exams & English Tests',
    description: 'SAT, GRE, GMAT, ENEM, IELTS and TOEFL',
    subgroups: [
      { id: 'admissions-tests', label: 'Admissions Tests' },
      { id: 'english-proficiency', label: 'English Proficiency' },
    ],
  },
  {
    id: 'technology',
    label: 'Technology & Software',
    description: 'Programming, web, mobile, cloud and data',
    subgroups: [
      { id: 'programming-languages', label: 'Programming Languages' },
      { id: 'web-development', label: 'Web Development' },
      { id: 'mobile-development', label: 'Mobile Development' },
      { id: 'cloud-devops', label: 'Cloud and DevOps' },
      { id: 'data-ai', label: 'Data Science and AI' },
      { id: 'software-engineering', label: 'Software Engineering' },
      { id: 'cybersecurity', label: 'Cybersecurity' },
    ],
  },
  {
    id: 'maths-science',
    label: 'Mathematics & Science Courses',
    description: 'Starter courses, school maths and higher maths',
    subgroups: [
      { id: 'science-starters', label: 'Starter Courses' },
      { id: 'core-maths', label: 'Core Mathematics' },
      { id: 'higher-maths', label: 'Higher Mathematics' },
    ],
  },
  {
    id: 'medical-learning',
    label: 'Medical Learning',
    description: 'MBBS curriculum and clinical specialties',
    subgroups: [
      { id: 'mbbs-curriculum', label: 'MBBS Curriculum' },
      { id: 'specialties', label: 'Clinical Specialties' },
    ],
  },
  {
    id: 'languages',
    label: 'Languages',
    description: 'English and world languages',
    subgroups: [
      { id: 'english', label: 'English' },
      { id: 'world-languages', label: 'World Languages' },
    ],
  },
  {
    id: 'creative',
    label: 'Music, Design & Marketing',
    description: 'Instruments, singing, UI design, marketing and study skills',
    subgroups: [
      { id: 'music', label: 'Music' },
      { id: 'design', label: 'Design' },
      { id: 'marketing', label: 'Marketing' },
      { id: 'study-skills', label: 'Study Skills' },
    ],
  },
  {
    id: 'other',
    label: 'Other Templates',
    description: 'Templates not yet sorted into a category',
    subgroups: [{ id: 'other', label: 'Other' }],
  },
];

export interface TemplatePlacement {
  readonly group: string;
  readonly subgroup: string;
  /** Other names a student may search by. */
  readonly aliases: readonly string[];
}

const placements = new Map<string, TemplatePlacement>();

function shelve(
  group: string,
  subgroup: string,
  templates: Readonly<Record<string, readonly string[]>>,
) {
  for (const [id, aliases] of Object.entries(templates)) {
    if (placements.has(id)) throw new Error(`${id} is placed twice`);
    placements.set(id, { group, subgroup, aliases });
  }
}

// --- School Education ---------------------------------------------------------
shelve('school', 'cbse', {
  'cbse-class-9': ['cbse 9', 'class ix'],
  'cbse-class-10': ['cbse 10', 'class x', 'board exam'],
  'cbse-class-11-pcm': ['cbse 11 science', 'class 11 science', 'physics chemistry maths'],
  'cbse-class-11-pcmb': ['cbse 11 science', 'class 11 science', 'biology maths'],
  'cbse-class-11-commerce': ['cbse 11 commerce'],
  'cbse-class-11-humanities': ['cbse 11 arts', 'class 11 arts'],
  'cbse-class-12-pcm': [
    'cbse 12 science',
    'class 12 science',
    'physics chemistry maths',
    'board exam',
  ],
  'cbse-class-12-pcmb': ['cbse 12 science', 'class 12 science', 'biology maths', 'board exam'],
  'cbse-class-12-commerce': ['cbse 12 commerce', 'board exam'],
  'cbse-class-12-humanities': ['cbse 12 arts', 'class 12 arts', 'board exam'],
});
shelve('school', 'icse-isc', {
  'icse-class-9': ['icse 9', 'cisce'],
  'icse-class-10': ['icse 10', 'cisce', 'board exam'],
  'isc-class-11-science': ['isc 11 science', 'cisce'],
  'isc-class-11-commerce': ['isc 11 commerce', 'cisce'],
  'isc-class-11-humanities': ['isc 11 arts', 'cisce'],
  'isc-class-12-science': ['isc 12 science', 'cisce', 'board exam'],
  'isc-class-12-commerce': ['isc 12 commerce', 'cisce', 'board exam'],
  'isc-class-12-humanities': ['isc 12 arts', 'cisce', 'board exam'],
});
shelve('school', 'other-curricula', {
  gcse: ['uk', 'united kingdom', 'british'],
  'example-class-10-science': ['example', 'sample'],
});

// --- Engineering & Science Entrance ------------------------------------------
shelve('engineering', 'jee', {
  'jee-main-2026': ['jee', 'jee mains', 'iit jee', 'nta'],
  'jee-advanced-2026': ['jee', 'jee adv', 'iit jee', 'iit'],
});
shelve('engineering', 'gate-engineering', {
  'gate-cs-it': ['gate cs', 'gate cse', 'gate it', 'computer science'],
  'gate-data-science-ai': ['gate ai', 'gate da', 'gate ds', 'artificial intelligence', 'ai', 'ml'],
  'gate-aerospace': ['gate ae'],
  'gate-agricultural': ['gate ag'],
  'gate-architecture-planning': ['gate ar', 'architecture'],
  'gate-biomedical': ['gate bm'],
  'gate-biotechnology': ['gate bt'],
  'gate-chemical': ['gate ch'],
  'gate-civil': ['gate ce'],
  'gate-electrical': ['gate ee'],
  'gate-electronics-communication': ['gate ec', 'gate ece'],
  'gate-environmental': ['gate es'],
  'gate-geomatics': ['gate ge'],
  'gate-mechanical': ['gate me'],
  'gate-metallurgical': ['gate mt'],
  'gate-mining': ['gate mn'],
  'gate-naval-marine': ['gate na'],
  'gate-petroleum': ['gate pe'],
  'gate-textile': ['gate tf'],
});
shelve('engineering', 'gate-science', {
  'gate-chemistry': ['gate cy'],
  'gate-ecology-evolution': ['gate ey'],
  'gate-life-sciences': ['gate xl'],
  'gate-mathematics': ['gate ma', 'gate maths'],
  'gate-physics': ['gate ph'],
  'gate-statistics': ['gate st'],
});
shelve('engineering', 'other-entrance', {
  bitsat: ['bits pilani', 'bits'],
  'amu-btech': ['amueee', 'amu', 'aligarh', 'btech'],
  'iiser-iat': ['iiser', 'iat', 'bs ms'],
  nimcet: ['mca', 'nit mca'],
  'cftri-msc-food-technology': ['cftri', 'food technology'],
});

// --- Medical & Healthcare Exams ----------------------------------------------
shelve('medical', 'medical-entrance', {
  'neet-ug-2026': ['neet', 'neet ug', 'mbbs entrance'],
  mcat: ['aamc'],
  mdcat: ['pakistan', 'pmdc'],
});
shelve('medical', 'medical-pg-licensing', {
  'neet-pg': ['neet', 'nbems', 'md ms entrance'],
  'ini-cet': ['inicet', 'aiims pg'],
  fmge: ['fmge', 'mci screening'],
  usmle: ['us medical licensing'],
  smle: ['saudi', 'scfhs'],
  'mrcs-part-a': ['mrcs', 'royal college of surgeons'],
});
shelve('medical', 'dental', {
  bds: ['dentistry', 'dental surgery'],
  'neet-mds': ['neet', 'mds', 'dental pg'],
});
shelve('medical', 'nursing', { norcet: ['aiims', 'nursing officer'] });
shelve('medical', 'ayush', {
  'aiapget-ayurveda': ['aiapget', 'ayush', 'bams'],
  'aiapget-homoeopathy': ['aiapget', 'ayush', 'bhms', 'homeopathy'],
});
shelve('medical', 'pharmacy', { gpat: ['pharmacy', 'b pharm'] });

// --- Government Exams ---------------------------------------------------------
shelve('government', 'upsc', {
  'upsc-cse': ['ias', 'civil services', 'cse', 'upsc prelims', 'upsc mains'],
  'upsc-cds': ['cds', 'combined defence services', 'defence'],
  'upsc-nda': ['nda', 'national defence academy', 'defence'],
  'upsc-cmse': ['cmse', 'combined medical services'],
});
shelve('government', 'engineering-services', {
  'upsc-ese-civil': ['ese', 'ies', 'engineering services'],
  'upsc-ese-electrical': ['ese', 'ies', 'engineering services'],
  'upsc-ese-electronics-telecom': ['ese', 'ies', 'engineering services', 'e and t', 'ece'],
  'upsc-ese-mechanical': ['ese', 'ies', 'engineering services'],
});
shelve('government', 'ssc', {
  'ssc-cgl': ['cgl', 'combined graduate level'],
  'ssc-chsl': ['chsl', 'combined higher secondary level'],
  'ssc-gd': ['gd', 'constable'],
  'ssc-je-civil': ['ssc je', 'junior engineer'],
  'ssc-je-electrical': ['ssc je', 'junior engineer'],
  'ssc-je-mechanical': ['ssc je', 'junior engineer'],
});
shelve('government', 'banking', {
  'ibps-po': ['bank po', 'probationary officer', 'banking'],
  'ibps-clerk': ['bank clerk', 'banking'],
  'sbi-po': ['bank po', 'probationary officer', 'banking'],
  'sbi-clerk': ['bank clerk', 'banking', 'junior associate'],
});
shelve('government', 'railways', {
  'rrb-je-civil': ['railway', 'rrb', 'junior engineer'],
  'rrb-je-electrical': ['railway', 'rrb', 'junior engineer'],
  'rrb-je-electronics': ['railway', 'rrb', 'junior engineer'],
  'rrb-je-mechanical': ['railway', 'rrb', 'junior engineer'],
});

// --- Teaching & Research Eligibility -------------------------------------------
shelve('research', 'ugc-net', {
  'ugc-net-commerce': ['net', 'ugc'],
  'ugc-net-computer-science': ['net', 'ugc', 'computer science'],
  'ugc-net-environmental-sciences': ['net', 'ugc'],
  'ugc-net-law': ['net', 'ugc'],
  'ugc-net-management': ['net', 'ugc'],
  'ugc-net-physical-education': ['net', 'ugc'],
  'ugc-net-political-science': ['net', 'ugc'],
  'ugc-net-psychology': ['net', 'ugc'],
  'ugc-net-sociology': ['net', 'ugc'],
});
shelve('research', 'csir-net', {
  'csir-net-chemical-sciences': ['net', 'csir', 'jrf'],
  'csir-net-life-sciences': ['net', 'csir', 'jrf'],
  'csir-net-mathematical-sciences': ['net', 'csir', 'jrf'],
  'csir-net-physical-sciences': ['net', 'csir', 'jrf'],
});

// --- Professional Qualifications ------------------------------------------------
shelve('professional', 'ca', {
  'ca-foundation': ['ca', 'icai', 'chartered accountant'],
  'ca-intermediate': ['ca inter', 'ca', 'icai', 'chartered accountant'],
  'ca-final': ['ca', 'icai', 'chartered accountant'],
});
shelve('professional', 'cma', {
  'cma-foundation': ['icmai', 'cost accountant'],
  'cma-intermediate': ['cma inter', 'icmai', 'cost accountant'],
  'cma-final': ['icmai', 'cost accountant'],
});
shelve('professional', 'cs', {
  cseet: ['cs', 'icsi', 'company secretary'],
  'cs-executive': ['cs', 'icsi', 'company secretary'],
  'cs-professional': ['cs', 'icsi', 'company secretary'],
});
shelve('professional', 'cfa', {
  'cfa-level-1': ['cfa level 1', 'cfa 1', 'chartered financial analyst', 'finance'],
  'cfa-level-2': ['cfa level 2', 'cfa 2', 'chartered financial analyst', 'finance'],
  'cfa-level-3': ['cfa level 3', 'cfa 3', 'chartered financial analyst', 'finance'],
});

// --- Management & Law Entrance --------------------------------------------------
shelve('management-law', 'management-entrance', {
  cat: ['iim', 'mba', 'common admission test'],
  'ipmat-indore': ['ipmat', 'iim indore', 'bba', 'ipm'],
});
shelve('management-law', 'law-entrance', {
  'clat-ug': ['clat', 'law', 'nlu', 'llb'],
  'clat-pg': ['clat', 'law', 'nlu', 'llm'],
  lsat: ['law', 'law school admission test'],
});

// --- International Exams & English Tests ----------------------------------------
shelve('international', 'admissions-tests', {
  sat: ['college board', 'digital sat', 'study abroad'],
  'gre-general': ['gre', 'ets', 'study abroad'],
  gmat: ['gmat focus', 'mba', 'study abroad'],
  enem: ['brazil', 'inep'],
});
shelve('international', 'english-proficiency', {
  ielts: ['ielts', 'english test', 'study abroad'],
  toefl: ['toefl', 'ets', 'english test', 'study abroad'],
});

// --- Technology & Software ------------------------------------------------------
shelve('technology', 'programming-languages', {
  'c-language': ['c programming', 'c language'],
  cpp: ['c++', 'cpp', 'c plus plus'],
  java: ['programming'],
  javascript: ['js', 'ecmascript', 'programming'],
  python: ['py', 'programming'],
});
shelve('technology', 'web-development', {
  'front-end': ['frontend', 'web development', 'html', 'css'],
  'back-end': ['backend', 'web development', 'server'],
  reactjs: ['react', 'frontend'],
  nextjs: ['next', 'next js', 'frontend'],
  nodejs: ['node', 'node js', 'backend'],
  expressjs: ['express', 'backend'],
  flask: ['python web', 'backend'],
  fastapi: ['fast api', 'python web', 'backend'],
});
shelve('technology', 'mobile-development', {
  android: ['kotlin', 'mobile app'],
  ios: ['swift', 'iphone', 'mobile app'],
  flutter: ['dart', 'mobile app'],
  firebase: ['mobile backend'],
});
shelve('technology', 'cloud-devops', {
  'aws-cloud-practitioner': ['aws', 'amazon web services', 'cloud'],
  'microsoft-azure': ['azure', 'cloud'],
  'google-cloud': ['gcp', 'cloud'],
  devops: ['ci cd', 'docker', 'kubernetes'],
  'salesforce-admin': ['salesforce', 'crm'],
});
shelve('technology', 'data-ai', {
  'data-science': ['data analysis', 'analytics'],
  'machine-learning': ['ml', 'ai', 'artificial intelligence'],
});
shelve('technology', 'software-engineering', {
  'data-structures-and-algorithms': ['dsa', 'algorithms', 'coding interview'],
  'design-patterns': ['oop', 'software design'],
  'game-development': ['gamedev', 'games'],
});
shelve('technology', 'cybersecurity', {
  'ethical-hacking': ['cybersecurity', 'security', 'penetration testing'],
});

// --- Mathematics & Science Courses ----------------------------------------------
shelve('maths-science', 'science-starters', {
  'mathematics-starter': ['maths basics', 'ncert'],
  'physics-starter': ['physics basics', 'ncert'],
  'chemistry-starter': ['chemistry basics', 'ncert'],
  'biology-starter': ['biology basics', 'ncert'],
  arithmetic: ['maths basics'],
});
shelve('maths-science', 'core-maths', {
  algebra: ['maths'],
  geometry: ['maths'],
  trigonometry: ['trig', 'maths'],
  calculus: ['maths'],
  statistics: ['stats', 'maths'],
  probability: ['maths'],
});
shelve('maths-science', 'higher-maths', {
  'linear-algebra': ['matrices', 'maths'],
  'discrete-mathematics': ['discrete maths', 'maths'],
  'number-theory': ['maths'],
  'set-theory': ['maths'],
  logic: ['maths'],
  'graph-theory': ['maths'],
  combinatorics: ['maths'],
  'game-theory': ['maths'],
  topology: ['maths'],
});

// --- Medical Learning ------------------------------------------------------------
shelve('medical-learning', 'mbbs-curriculum', {
  mbbs: ['medicine', 'nmc'],
  'mbbs-pre-clinical': ['mbbs first year', 'anatomy', 'physiology', 'biochemistry'],
  'mbbs-para-clinical': ['mbbs second year', 'pathology', 'pharmacology', 'microbiology'],
  'mbbs-clinical': ['mbbs final year'],
});
shelve('medical-learning', 'specialties', {
  anesthesiology: ['anaesthesia', 'anesthesia'],
  cardiology: ['heart'],
  dermatology: ['skin'],
  'emergency-medicine': ['emergency'],
  endocrinology: ['hormones'],
  gastroenterology: ['gi'],
  nephrology: ['kidney'],
  neurology: ['brain'],
  'obstetrics-gynecology': ['obgyn', 'obg', 'gynaecology'],
  oncology: ['cancer'],
  ophthalmology: ['eye'],
  orthopedics: ['orthopaedics', 'bones'],
  psychiatry: ['mental health'],
  pulmonology: ['lungs', 'respiratory'],
  radiology: ['imaging'],
  urology: ['urinary'],
});

// --- Languages -------------------------------------------------------------------
shelve('languages', 'english', { english: ['grammar', 'communication'] });
shelve('languages', 'world-languages', {
  chinese: ['mandarin', 'hsk'],
  french: ['francais', 'delf'],
  german: ['deutsch', 'goethe'],
  italian: ['italiano'],
  japanese: ['nihongo', 'jlpt'],
  korean: ['hangul', 'topik'],
  spanish: ['espanol', 'dele'],
});

// --- Music, Design & Marketing ----------------------------------------------------
shelve('creative', 'music', {
  drums: ['percussion', 'instrument'],
  flute: ['instrument'],
  guitar: ['instrument'],
  piano: ['keyboard', 'instrument'],
  saxophone: ['sax', 'instrument'],
  singing: ['vocals', 'voice'],
  violin: ['instrument'],
});
shelve('creative', 'design', { 'ui-design': ['ui', 'ux', 'user interface'] });
shelve('creative', 'marketing', {
  'content-marketing': ['marketing'],
  'digital-marketing': ['marketing'],
  'email-marketing': ['marketing'],
  'facebook-ads': ['meta ads', 'marketing'],
  'google-ads': ['adwords', 'ppc', 'marketing'],
  seo: ['search engine optimization', 'marketing'],
  'social-media-marketing': ['smm', 'marketing'],
});
shelve('creative', 'study-skills', {
  'example-study-skills': ['example', 'sample', 'study skills'],
});

/** Every id with a placement, for the completeness test. */
export const PLACED_TEMPLATE_IDS: readonly string[] = [...placements.keys()];

const FALLBACK: TemplatePlacement = { group: 'other', subgroup: 'other', aliases: [] };

/** Where a template sits in the library. Unknown ids go on the "Other" shelf rather than vanish. */
export function placeTemplate(id: string): TemplatePlacement {
  return placements.get(id) ?? FALLBACK;
}

export function templateGroup(id: string): TemplateGroup {
  return (
    TEMPLATE_GROUPS.find((group) => group.id === id) ?? (TEMPLATE_GROUPS.at(-1) as TemplateGroup)
  );
}

export function subgroupLabel(group: string, subgroup: string): string {
  return templateGroup(group).subgroups.find((s) => s.id === subgroup)?.label ?? subgroup;
}

// --- The browsable index ------------------------------------------------------------

/** What every template offers the library, whether bundled or online. */
export interface LibrarySource {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: TemplateCategory;
  readonly counts: TemplateCounts;
  readonly subjects: readonly string[];
}

/** School facets read from the id, so "class 12 commerce" can be a filter as well as a search. */
export interface TemplateFacets {
  readonly classLevel?: string;
  readonly stream?: string;
}

export interface LibraryItem<T extends LibrarySource = LibrarySource> {
  readonly source: T;
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly subgroup: string;
  readonly groupLabel: string;
  readonly subgroupLabel: string;
  readonly facets: TemplateFacets;
  /** Normalised search fields, strongest first. Built once, not per keystroke. */
  readonly search: { readonly primary: string; readonly labels: string; readonly body: string };
}

const STREAMS: Readonly<Record<string, string>> = {
  pcm: 'Science (PCM)',
  pcmb: 'Science (PCMB)',
  science: 'Science',
  commerce: 'Commerce',
  humanities: 'Humanities',
};

export function facetsOf(id: string): TemplateFacets {
  const school = /^(?:cbse|icse|isc)-class-(\d+)(?:-([a-z]+))?$/.exec(id);
  if (school === null) return {};
  const stream = school[2] === undefined ? undefined : STREAMS[school[2]];
  return stream === undefined
    ? { classLevel: `Class ${school[1]}` }
    : { classLevel: `Class ${school[1]}`, stream };
}

/**
 * Lower case, accents and punctuation dropped, "&" read as "and". "+" and "#"
 * are kept because they are the difference between C, C++ and C#.
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

export function indexTemplate<T extends LibrarySource>(source: T): LibraryItem<T> {
  const placement = placeTemplate(source.id);
  const group = templateGroup(placement.group);
  const sub = subgroupLabel(placement.group, placement.subgroup);
  const facets = facetsOf(source.id);
  return {
    source,
    id: source.id,
    name: source.name,
    group: group.id,
    subgroup: placement.subgroup,
    groupLabel: group.label,
    subgroupLabel: sub,
    facets,
    search: {
      primary: normalizeSearch([source.name, ...placement.aliases].join(' | ')),
      labels: normalizeSearch(
        [group.label, sub, facets.classLevel ?? '', facets.stream ?? ''].join(' | '),
      ),
      body: normalizeSearch(
        [source.id.replace(/-/g, ' '), source.description, ...source.subjects].join(' | '),
      ),
    },
  };
}

/** A term matches the start of a word, or (for longer terms) anywhere once spaces are ignored, so "btech" finds "B.Tech". */
function has(field: string, term: string): boolean {
  if (field.startsWith(term) || field.includes(` ${term}`)) return true;
  return term.length >= 4 && field.replace(/ /g, '').includes(term);
}

/** How well an item matches a query: 0 for no match, higher for a closer one. */
export function matchScore(item: LibraryItem, query: string): number {
  const q = normalizeSearch(query);
  if (q.length === 0) return 1;
  const terms = q.split(' ');
  const { primary, labels, body } = item.search;
  const names = primary.split(' | ');
  if (names.includes(q)) return 100;
  if (names.some((name) => name.startsWith(q))) return 80;
  if (terms.every((term) => has(primary, term))) return 60;
  if (terms.every((term) => has(primary, term) || has(labels, term))) return 40;
  if (terms.every((term) => has(primary, term) || has(labels, term) || has(body, term))) return 20;
  return 0;
}

export type LibrarySort = 'relevance' | 'category' | 'name' | 'size' | 'recent';

export interface LibraryFilter {
  readonly query?: string;
  readonly group?: string | null;
  readonly subgroup?: string | null;
  readonly classLevel?: string | null;
  readonly stream?: string | null;
  readonly sort?: LibrarySort;
  /** Template ids, most recently used first. */
  readonly recent?: readonly string[];
}

/**
 * The items a student sees: search and filters applied together, each item
 * once. "relevance" falls back to A–Z when there is no query; "category" follows
 * the shelf order; "recent" lists the templates used before first, the rest A–Z.
 */
export function filterLibrary<T extends LibrarySource>(
  items: readonly LibraryItem<T>[],
  filter: LibraryFilter,
): LibraryItem<T>[] {
  const query = filter.query ?? '';
  const seen = new Set<string>();
  const scored: { item: LibraryItem<T>; score: number }[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (filter.group && item.group !== filter.group) continue;
    if (filter.subgroup && item.subgroup !== filter.subgroup) continue;
    if (filter.classLevel && item.facets.classLevel !== filter.classLevel) continue;
    if (filter.stream && item.facets.stream !== filter.stream) continue;
    const score = matchScore(item, query);
    if (score === 0) continue;
    seen.add(item.id);
    scored.push({ item, score });
  }

  const byName = (a: LibraryItem<T>, b: LibraryItem<T>) =>
    a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
  const recent = new Map((filter.recent ?? []).map((id, index) => [id, index]));
  const sort = filter.sort ?? 'relevance';
  scored.sort((a, b) => {
    switch (sort) {
      case 'relevance':
        return b.score - a.score || byName(a.item, b.item);
      case 'size':
        return b.item.source.counts.topics - a.item.source.counts.topics || byName(a.item, b.item);
      case 'recent': {
        const ra = recent.get(a.item.id) ?? Infinity;
        const rb = recent.get(b.item.id) ?? Infinity;
        return ra === rb ? byName(a.item, b.item) : ra - rb;
      }
      case 'category':
        return shelfOrder(a.item) - shelfOrder(b.item) || byName(a.item, b.item);
      case 'name':
        return byName(a.item, b.item);
    }
  });
  return scored.map(({ item }) => item);
}

/** Position of an item's shelf: groups in declared order, subgroups within them. */
function shelfOrder(item: LibraryItem): number {
  const groupIndex = TEMPLATE_GROUPS.findIndex((group) => group.id === item.group);
  const group = TEMPLATE_GROUPS[groupIndex];
  const subIndex = group?.subgroups.findIndex((sub) => sub.id === item.subgroup) ?? 0;
  return groupIndex * 100 + subIndex;
}

export interface Tally {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/** Groups with how many of `items` each holds, in shelf order, empty ones left out. */
export function countGroups(items: readonly LibraryItem[]): Tally[] {
  return TEMPLATE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    count: items.filter((item) => item.group === group.id).length,
  })).filter((tally) => tally.count > 0);
}

/** A group's subgroups with their counts, empty ones left out. */
export function countSubgroups(items: readonly LibraryItem[], group: string): Tally[] {
  return templateGroup(group)
    .subgroups.map((sub) => ({
      id: sub.id,
      label: sub.label,
      count: items.filter((item) => item.group === group && item.subgroup === sub.id).length,
    }))
    .filter((tally) => tally.count > 0);
}

/** Distinct values of a facet among `items`, with counts, in natural order. */
export function countFacet(items: readonly LibraryItem[], facet: keyof TemplateFacets): Tally[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = item.facets[facet];
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([value, count]) => ({ id: value, label: value, count }));
}
