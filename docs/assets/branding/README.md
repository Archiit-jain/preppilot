# Branding assets

## `vidya-university-logo.png` — PLACEHOLDER, REPLACE THIS

**This is not the Vidya University logo.** It is a neutral labelled placeholder,
generated because the real logo file was not available when the presentation was
built.

To use the real logo, **overwrite this file** with the official Vidya University
logo, keeping the same filename:

```
docs/assets/branding/vidya-university-logo.png
```

Then rebuild the presentation. Every slide references this one path, so no
layout changes are needed.

**Requirements for the replacement:**

| Property   | Value                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| Filename   | `vidya-university-logo.png` (exactly)                                   |
| Format     | PNG with a transparent background                                       |
| Shape      | Square, or close to it — it is placed in a 0.52 in square on each slide |
| Resolution | At least 300 × 300 px; 600 × 600 px preferred                           |

The logo appears twice at different sizes: large on the title and closing
slides, and small in the top-right corner of every content slide. A square,
transparent-background PNG works at both.

## `preppilot-logo.png`

PrepPilot's own mark, rendered from `apps/mobile/assets/logo.svg` — the same
file that drives the in-app branding and the Android launcher icon. Regenerate
it from the SVG rather than editing it here.
