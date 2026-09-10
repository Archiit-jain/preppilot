# Branding assets

## `vidya-university-logo.png`

The **official Vidya University logo**, extracted from the university's own
_Project Synopsis Format_ document (`word/media/image1.jpeg` inside that file).

The source was a 195 × 80 JPEG on a white background. It has been upscaled 6×
with Lanczos resampling and the white background keyed out to transparency, so
it sits correctly on any slide or page colour. Final size 1155 × 443 px.

This is the file referenced by both deliverables:

- **Every slide** of `docs/PrepPilot_First_Project_Presentation.pptx`, as the
  university's presentation notice requires.
- The title page of `docs/PrepPilot_Synopsis.docx`.

If a higher-resolution original becomes available, replace this file, keeping
the same filename and a similar aspect ratio (2.6 : 1), and rebuild.

## `vidya-university-mark.png`

The 'V' device alone, cropped from the lockup. Not currently used — kept for
tight placements where the full horizontal lockup will not fit legibly.

## `preppilot-icon.png`

PrepPilot's Android launcher icon, taken from
`apps/mobile/assets/images/icon.png` with rounded corners applied. **This is the
mark to use on light backgrounds**, because it carries its own dark ground.

## `preppilot-logo.png`

The bare PrepPilot mark rendered from `apps/mobile/assets/logo.svg` — the same
file that drives the in-app branding. Note its tick is **white**, so it
disappears against a light background; use `preppilot-icon.png` there instead.
Regenerate from the SVG rather than editing this file.
