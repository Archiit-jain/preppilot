# Regenerating the Detailed Project Report

`build_dpr.py` produces `docs/PrepPilot_DPR.docx` and `docs/PrepPilot_DPR.pdf`
from one source, so the two never disagree.

```bash
pip install python-docx pillow
python docs/dpr/build_dpr.py
```

It also needs LibreOffice Writer (`soffice`) and `pdftotext` (poppler-utils) on
the `PATH`. The build runs three times: each PDF is read back to find the page
each heading, figure and table landed on, and the next pass writes those page
numbers into the contents lists.

`build_quick.py` produces the 5-page summary, `docs/PrepPilot_Quick_Report.docx`
and `.pdf`, reusing the same layout helpers:

```bash
python docs/dpr/build_quick.py
```

Edit the scripts, never the `.docx` or `.pdf` — those are overwritten on the
next run.

## Screenshots

- `docs/assets/screenshots/app/` — the set already in the repository, captured
  24 September 2026.
- `docs/assets/screenshots/web/` — captured 6 October 2026 from the web demo
  (`pnpm --filter @preppilot/mobile web:demo`) at a 390 × 844 viewport, 2×
  scale, to cover themes, the full-screen timer, Focus Mode and quiz settings.
  The theme screens were taken with the packs built by
  `supabase/themes/build-themes.mjs` and served locally, with
  `EXPO_PUBLIC_SUPABASE_URL` pointed at that local server.
