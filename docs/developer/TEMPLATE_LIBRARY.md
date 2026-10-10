# The cloud template library

PrepPilot bundles a small core of syllabus templates (JEE, NEET, CBSE, UPSC, CA
and others). Every other template lives in the **cloud library**: JSON in the
public `templates` Supabase Storage bucket. The Templates screen downloads one
only when a student opens it (D111), so the library can grow, and be corrected,
without making the app bigger or waiting for a release. Once imported, a template
is ordinary rows in the student's course and works offline.

```
Templates screen opens   → GET …/storage/v1/object/public/templates/catalog.json
Student taps a template  → GET …/templates/templates/<id>.json → preview → import
```

## Where content comes from

Every template is built from the **official syllabus** published by the body
that sets the exam: the GATE organising institute, UPSC, NTA, ICAI, ICSI, ICMAI,
CISCE, ETS, GMAC, the College Board and so on. Skills that have no official
syllabus, such as programming, languages and music, are built from a named,
recognised curriculum (for example CEFR levels for languages), and the template
says so.

The list of exams to cover was compared against what other study apps offer.
**Only names were compared.** No syllabus content, structure or wording is taken
from any other app. Each file's `source` field names where its content came from.

`verified: true` is set only when a person has checked the template against the
official document. Templates split into topics by a script are `verified: false`
until then, and the app shows that before import.

## Adding or changing a template

1. Write or edit `supabase/templates-library/src/<group>/<id>.md`:

   ```
   ---
   id: gate-civil
   name: GATE Civil Engineering
   description: One line under the name.
   category: exam          # exam | school | custom
   source: GATE 2026 official syllabus (CE), IIT Guwahati.
   verified: false
   version: 1              # bump when the content changes
   ---
   # Subject
   ## Chapter
   - Topic
   ```

   Names are at most 120 characters, the app's limit.

2. Format the sources (CI checks them): `npx prettier --write "supabase/templates-library/src/**/*.md"`.
   Prettier only adds blank lines, which the builder ignores. Then run
   `pnpm --filter @preppilot/shared test`. It builds every source file and
   checks the result with the same validator the app uses.
3. Build: `node supabase/templates-library/build-library.mjs` writes
   `supabase/templates-library/dist/`.
4. Upload from `supabase/templates-library/dist`. `storage cp` will not
   overwrite, so remove changed files first:

```bash
npx supabase storage rm -r ss:///templates/templates --linked --experimental --workdir ../../.. --yes
```

```bash
npx supabase storage rm ss:///templates/catalog.json --linked --experimental --workdir ../../.. --yes
```

```bash
npx supabase storage cp -r templates ss:///templates --linked --experimental --workdir ../../.. --jobs 8
```

```bash
npx supabase storage cp catalog.json ss:///templates/catalog.json --linked --experimental --workdir ../../..
```

No app build is needed.

## Categories in the app

The Templates screen is organised by `packages/shared/src/templates/taxonomy.ts`,
not by the coarse `category` field (exam, school, custom). Every template id, bundled
or online, is placed there once: a category, a subcategory and the aliases students
search by ("JEE", "GATE AI", "C++"). It is metadata only; no syllabus is touched.

When you add a template, add its id to `taxonomy.ts` too. Until you do, the app lists
it under "Other Templates" rather than hiding it, and `taxonomy.test.ts` fails, since it
checks every id in `dist/catalog.json` and every bundled template has a real place.

## Generators

`supabase/templates-library/tools/gate_to_md.mjs` drafts every GATE paper from the
official GATE syllabus PDFs (`pdftotext -enc UTF-8`). It splits the official
"Chapter: topic; topic" text into topics, adds the common General Aptitude
section, and splits or shortens anything over 120 characters. Its output is
reviewed before it is committed.

The others work the same way, each for one official source:

- `ugcnet_to_md.mjs`: UGC NET Paper I and nine Paper II subjects (UGC NET Bureau PDFs).
- `upsc_ese_to_md.mjs`: UPSC ESE, from the notification's "Standard and Syllabi"
  (uses the shared `numbered_to_md.mjs`).
- `csir_net_to_md.mjs`: CSIR NET Chemical, Life (merged CSIR-DBT), Mathematical
  and Physical Sciences, from the CSIR HRDG syllabus PDFs.

- `ssc_je_to_md.mjs`: SSC JE Civil, Electrical and Mechanical (SSC JE 2026 notice).
- `rrb_je_to_md.mjs`: RRB JE Civil, Electrical, Electronics and Mechanical (RRB CEN 05/2025,
  para 13 and Annexure VII A to D).

- `bank_to_md.mjs`: IBPS PO and Clerk, SBI PO and Clerk. These boards publish no topic
  syllabus (D113): stages and sections are official; topics are those listed by at least
  two independent exam analyses, and the script's docstring names them.

- `entrance_to_md.mjs`: NIMCET, BITSAT, IISER IAT, AMU B.Tech and CFTRI M.Sc. Food
  Technology, each from its official syllabus.
- `aptitude_to_md.mjs`: CAT, IPMAT Indore, CLAT UG and CLAT PG (D113, like the banking exams).
- `med_to_md.mjs`: FMGE and INI-CET (NBEMS extract of the MBBS curriculum), BDS and NEET MDS
  (DCI BDS regulations; NBEMS subject list), GPAT (PCI B. Pharm syllabus in GPAT's five areas).
  The DCI gazette PDF is a scanned image, so the change check can only compare its bytes.

- `cs_cma_to_md.mjs`: CS Executive and Professional (the syllabus page of each ICSI study material)
  and CMA Foundation, Intermediate and Final (ICMAI prospectus, Syllabus 2022).
- `cisce_to_md.mjs`: ICSE Class 9 and 10 and ISC Class 11 and 12 (Science, Commerce, Humanities),
  from the ICSE 2027 and ISC 2027 subject syllabuses. English is transcribed in the script.

- `intl_to_md.mjs`: CFA Levels I-III (CFA Institute topic outlines), USMLE (content outline), MCAT
  (AAMC outline), SMLE (SCFHS guide), GCSE (DfE subject content), and SAT, GRE, GMAT, TOEFL, IELTS,
  LSAT and MRCS Part A transcribed from the owners' pages. GMAT's Quant topics follow D113.

UPSC CDS, NDA, CMSE, SSC CHSL and GD, and CSEET are written by hand from their notices.

The programming and tech templates (`src/programming/`) are also written by hand, each from one
named official curriculum: a certification's exam objectives (AWS CLF-C02, AZ-900, Cloud Digital
Leader, Python Institute PCEP and PCAP, JS Institute JSE and JSA, C++ Institute CLE, CLA, CPE and
CPA, EC-Council CEH, Unity Certified Associate) or the owner's own learning path (react.dev, the
Next.js Learn course, the Express, FastAPI, Flask, Flutter, Firebase and Node.js docs, dev.java,
the MDN Curriculum, Android Basics with Compose, Apple's Develop in Swift, Google's ML Crash
Course, Material Design 3). Data Structures and Algorithms follows MIT OCW 6.006, Data Science the
ACM 2021 data science competencies, and Design Patterns the pattern catalogue of Gamma et al.
Each file's `source` line names its curriculum.

The medical specialities in `src/medical/` follow the National Medical Commission's competency-based
postgraduate guidelines (MD, MS, DM and MCh). Where NMC has none online (Cardiology,
Gastroenterology, Nephrology, Neurology, Medical Oncology) they follow the NBEMS DrNB curriculum.
The three MBBS phase templates regroup the bundled MBBS template's subjects.

Languages (`src/languages/`): the five European languages follow the CEFR levels (Council of Europe
self-assessment grid, in our words) with each language's official exam per level; Japanese follows
the JLPT level summaries, Chinese the new HSK levels, Korean the TOPIK structure. Music
(`src/music/`): piano, violin, flute and saxophone follow Trinity College London's graded syllabuses
(technical work per grade); drums, guitar and singing follow Trinity Rock & Pop. Marketing
(`src/marketing/`): Meta's Digital Marketing Associate exam (Facebook Ads), Google's SEO Starter
Guide, HubSpot Academy certification courses (content, email, social, digital marketing), and Google
Ads by D113. The generators for these live outside the repo; the Node port will bring them in.

The maths topics (`src/maths/`) each follow one MIT OpenCourseWare course: 18.01SC (Calculus),
18.06 (Linear Algebra), 6.042J (Discrete Mathematics), 18.314 (Combinatorics and Graph Theory),
6.254 (Game Theory), 24.241 (Logic), 18.781 (Number Theory), 6.041 (Probability), 18.650
(Statistics) and 18.901 (Topology).

School-level Arithmetic, Algebra, Geometry, Trigonometry and Set Theory, and the four starters
(Mathematics, Physics, Chemistry, Biology), are in `src/ncert/`. They regroup the NCERT chapters
already in the bundled CBSE subjects (Arithmetic adds the Ganita Prakash number chapters for
Classes 6 to 8), so when a CBSE subject changes, regenerate these from it.

Hard sources: `tools/enem_to_md.mjs` (INEP Matriz de Referência, kept in Portuguese), `tools/aiapget_to_md.mjs`
(AIAPGET Ayurveda from NCISM's BAMS subject curricula; ncismindia.org needs a browser cookie, so these PDFs
are not watched), `tools/bhms_to_md.mjs` (AIAPGET Homoeopathy from NCH's BHMS syllabus). MDCAT is written by
hand from PMDC's 2025 curriculum (copy on Khyber Medical University's site). NORCET and Salesforce Admin
follow D113 (no official topic list reachable). The app allows at most 120 chapters per subject, so long
subjects are split into parts; `pnpm --filter @preppilot/shared test` catches this, the builder does not.

## Syllabus change check

`supabase/templates-library/sources.json` lists the official document behind each
template, with fingerprints of the copy the template was built from.
`tools/check_sources.mjs` downloads each one again (a PDF, or a web page compared by its
visible text) and compares:

- **unchanged**: nothing to do.
- **changed**: the text differs. Rebuild the listed templates from the new
  document, bump their `version`, upload, then record the new copy:
  `node tools/check_sources.mjs --record <dir with <key>.pdf>`.
- **re-saved**: the file differs but its text does not. Nothing to do.
- **unreachable**: the site did not answer. Check it by hand if it keeps happening.

The **Syllabus check** workflow runs it every Monday and can be started by hand
from the Actions tab. A failed run means a syllabus changed; its summary lists the
templates. GitHub emails a failed scheduled run to the repository owner.

Some sources are not watched because their pages are built in the browser or change on every
load: Apple's Develop in Swift, Material Design 3, the EC-Council CEH page, the Google Cloud
Digital Leader exam guide and the HubSpot Academy courses. Design Patterns
follows a book. Check these by hand when you revise those templates.

It only watches documents it knows. When an exam publishes a new cycle's
notification at a new address, add that address to `sources.json` and rebuild.
When adding a template, add its source and record it.
