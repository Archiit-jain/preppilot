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

UPSC CDS, NDA and CMSE are written by hand from their notifications.
