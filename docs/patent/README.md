# Patent draft

**Confidential until a patent application is filed.** Do not publish, present or
upload anything from this folder, or the web build it describes, before the
University's IPR cell or the patent agent says an application has been filed.
See Part C.3 of the draft.

| File                          | What it is                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| `PATENT_DRAFT.md`             | The draft — **the single source**. Edit this, never the `.docx`. |
| `PrepPilot_Patent_Draft.docx` | The same draft as a Word document, generated from the Markdown   |
| `figures/fig1…fig6.png`       | FIG. 1–6: black-and-white drawings with reference numerals       |
| `build_figures.py`            | Draws the figures                                                |
| `build_patent_docx.py`        | Renders the Markdown to Word                                     |

The screenshots in the Annexure live in `docs/assets/screenshots/app/`.

## What the draft contains

- **Front matter** — cover, supervisor's certificate, inventors' declaration and
  acknowledgement, with blanks for signatures, roll numbers and dates.
- **Part A** — the invention disclosure the University's IPR cell needs: what is
  believed new, the known prior disclosures, and the evidence.
- **Part B** — a specification in the layout of Form 2 under the Patents Act,
  1970: field, background, objects, summary, drawings, detailed description, 20
  claims and the abstract.
- **Part C** — notes for the patent professional: patentable subject matter
  (Section 3(k)), the prior-art search still to be done, disclosure timing,
  inventorship, the forms to file, and where each claimed feature lives in the
  code.

It is a draft for a registered patent agent to review, not a filing-ready
application. Several blanks — applicant, addresses, roll numbers and disclosure
dates — are deliberately left for the team to fill in.

## Regenerating

```bash
pip install python-docx pillow
python docs/patent/build_figures.py       # only after changing a figure
python docs/patent/build_patent_docx.py
```

Format the Markdown with `npx prettier --write docs/patent/PATENT_DRAFT.md`
before committing, as CI checks formatting. The Word renderer understands what
Prettier produces (escaped underscores, `_italics_`, single-quoted image titles).

Width hints for images go in the image title, in centimetres:
`![A1 — Tracker](../assets/screenshots/app/tracker.png "w=4.4")`. Several images
on one line are laid out side by side.
