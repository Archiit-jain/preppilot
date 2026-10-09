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

## Generators

`supabase/templates-library/tools/gate_to_md.py` drafts every GATE paper from the
official GATE syllabus PDFs (`pdftotext -enc UTF-8`). It splits the official
"Chapter: topic; topic" text into topics, adds the common General Aptitude
section, and splits or shortens anything over 120 characters. Its output is
reviewed before it is committed.

The others work the same way, each for one official source:

- `ugcnet_to_md.py`: UGC NET Paper I and nine Paper II subjects (UGC NET Bureau PDFs).
- `upsc_ese_to_md.py`: UPSC ESE, from the notification's "Standard and Syllabi"
  (uses the shared `numbered_to_md.py`).
- `csir_net_to_md.py`: CSIR NET Chemical, Life (merged CSIR-DBT), Mathematical
  and Physical Sciences, from the CSIR HRDG syllabus PDFs.

- `ssc_je_to_md.py`: SSC JE Civil, Electrical and Mechanical (SSC JE 2026 notice).
- `rrb_je_to_md.py`: RRB JE Civil, Electrical, Electronics and Mechanical (RRB CEN 05/2025,
  para 13 and Annexure VII A to D).

- `bank_to_md.py`: IBPS PO and Clerk, SBI PO and Clerk. These boards publish no topic
  syllabus (D113): stages and sections are official; topics are those listed by at least
  two independent exam analyses, and the script's docstring names them.

- `entrance_to_md.py`: NIMCET, BITSAT, IISER IAT, AMU B.Tech and CFTRI M.Sc. Food
  Technology, each from its official syllabus.
- `aptitude_to_md.py`: CAT, IPMAT Indore, CLAT UG and CLAT PG (D113, like the banking exams).
- `med_to_md.py`: FMGE and INI-CET (NBEMS extract of the MBBS curriculum), BDS and NEET MDS
  (DCI BDS regulations; NBEMS subject list), GPAT (PCI B. Pharm syllabus in GPAT's five areas).
  The DCI gazette PDF is a scanned image, so the change check can only compare its bytes.

- `cs_cma_to_md.py`: CS Executive and Professional (the syllabus page of each ICSI study material)
  and CMA Foundation, Intermediate and Final (ICMAI prospectus, Syllabus 2022).
- `cisce_to_md.py`: ICSE Class 9 and 10 and ISC Class 11 and 12 (Science, Commerce, Humanities),
  from the ICSE 2027 and ISC 2027 subject syllabuses. English is transcribed in the script.

- `intl_to_md.py`: CFA Levels I-III (CFA Institute topic outlines), USMLE (content outline), MCAT
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

The maths topics (`src/maths/`) each follow one MIT OpenCourseWare course: 18.01SC (Calculus),
18.06 (Linear Algebra), 6.042J (Discrete Mathematics), 18.314 (Combinatorics and Graph Theory),
6.254 (Game Theory), 24.241 (Logic), 18.781 (Number Theory), 6.041 (Probability), 18.650
(Statistics) and 18.901 (Topology).

## Syllabus change check

`supabase/templates-library/sources.json` lists the official document behind each
template, with fingerprints of the copy the template was built from.
`tools/check_sources.py` downloads each one again (a PDF, or a web page compared by its
visible text) and compares:

- **unchanged**: nothing to do.
- **changed**: the text differs. Rebuild the listed templates from the new
  document, bump their `version`, upload, then record the new copy:
  `python tools/check_sources.py --record <dir with <key>.pdf>`.
- **re-saved**: the file differs but its text does not. Nothing to do.
- **unreachable**: the site did not answer. Check it by hand if it keeps happening.

The **Syllabus check** workflow runs it every Monday and can be started by hand
from the Actions tab. A failed run means a syllabus changed; its summary lists the
templates. GitHub emails a failed scheduled run to the repository owner.

Some sources are not watched because their pages are built in the browser or change on every
load: Apple's Develop in Swift, Material Design 3, and the EC-Council CEH page. Design Patterns
follows a book. Check these by hand when you revise those templates.

It only watches documents it knows. When an exam publishes a new cycle's
notification at a new address, add that address to `sources.json` and rebuild.
When adding a template, add its source and record it.
