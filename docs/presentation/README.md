# Regenerating the presentation and synopsis

Both deliverables are generated from these scripts, so a change is made once, in
one place, and both outputs stay consistent.

| Script                | Produces                                                           |
| --------------------- | ------------------------------------------------------------------ |
| `build_deck.py`       | `docs/PrepPilot_First_Project_Presentation.pptx` (20 slides, 16:9) |
| `synopsis_content.py` | The synopsis text — the single source for both formats below       |
| `build_synopsis.py`   | `docs/PrepPilot_Synopsis.docx` **and** `docs/SYNOPSIS.md`          |

## Requirements

```bash
pip install python-pptx python-docx pillow numpy
```

## Regenerate

```bash
python3 docs/presentation/build_deck.py
python3 docs/presentation/build_synopsis.py
```

## Editing the presentation

**The `.pptx` is fully editable in PowerPoint** — every heading, bullet, card and
diagram box is a native shape, not a picture. For small changes (fixing a word,
moving a box, recolouring a card) just edit the file directly.

Use the script instead when you want a change applied consistently — renaming the
team, changing the accent colour everywhere, or adding a slide that matches the
existing layout. Note that regenerating **overwrites** the `.pptx`, so any manual
edits made in PowerPoint are lost.

The design system lives at the top of `build_deck.py`:

- **Colours** — `VU_CORAL`, `VU_TEAL`, `VU_DARK` are sampled from the official
  university logo; `ACCENT`, `GREEN`, `PURPLE`, `AMBER` come from the app's own
  theme tokens.
- **Typography** — `F_HEAD`, `F_BODY` and `F_MONO`. Calibri is used deliberately
  because it is present on every machine with Office installed; the app's own
  Inter would substitute unpredictably on a college computer.
- **Layout** — `M` is the page margin, `CONTENT_W` the usable width, and
  `new_slide()` draws the title, accent rule, footer, page number and the
  university logo that the presentation notice requires on every slide.

Helper functions — `card()`, `block()`, `pill()`, `bullets()`, `arrow()`,
`rect()` — keep spacing and styling consistent, so a new slide built from them
matches the rest without any manual measuring.

## Editing the synopsis

Edit `synopsis_content.py`, never the `.docx` or the `.md` — those are outputs
and are overwritten on the next run. Content is a list of typed blocks:

| Block                              | Meaning                           |
| ---------------------------------- | --------------------------------- |
| `("h1", text)`                     | Section heading — 14 pt bold      |
| `("h2", text)`                     | Sub-heading — 12 pt normal        |
| `("p", text)`                      | Body paragraph                    |
| `("bl", lead, rest)`               | Paragraph with a bold lead-in     |
| `("num", [items])`                 | Numbered list                     |
| `("fig", file, caption, width_cm)` | Figure, caption rendered below it |
| `("pb",)`                          | Page break                        |

`build_synopsis.py` enforces the university's typography: Times New Roman 12 pt,
A4, double spacing, margins of 3.5 / 2.5 / 1.25 / 1.25 cm, 14 pt bold headings,
figure captions below and table captions above.

**Watch the length.** The format caps several sections at one page. After any
edit, check the result:

```bash
soffice --headless --convert-to pdf docs/PrepPilot_Synopsis.docx
pdfinfo PrepPilot_Synopsis.pdf | grep Pages     # currently 12
```

## Diagrams

The diagrams in `docs/assets/diagrams/` are rendered from the Mermaid sources
embedded in `docs/SYNOPSIS.md`, using `@mermaid-js/mermaid-cli`. Edit the Mermaid
source, re-render, and both documents pick up the new image.
