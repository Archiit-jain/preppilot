"""
PrepPilot — First Project Presentation
Vidya University, Department of Computer Science & Engineering

Every factual claim in this deck traces to the repository audit in docs/AUDIT.md.
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.dml import MSO_LINE_DASH_STYLE
import os

# ---------------------------------------------------------------- design system

BRANDING = "/home/user/preppilot/docs/assets/branding"
SHOTS = "/home/user/preppilot/docs/assets/screenshots"
OUT = "/home/user/preppilot/docs/PrepPilot_First_Project_Presentation.pptx"

VIDYA_LOGO = f"{BRANDING}/vidya-university-logo.png"
# The bare mark has a white tick, which disappears on a light slide. The app
# icon carries its own dark ground, so it is the one that works here.
PP_LOGO = f"{BRANDING}/preppilot-icon.png"

# The official logo is a horizontal lockup, 1155 x 443 px.
LOGO_RATIO = 443 / 1155
LOGO_W = 1.30                      # corner placement, every slide
LOGO_H = LOGO_W * LOGO_RATIO

# Vidya University brand colours, sampled from the official logo supplied in the
# university's Project Synopsis Format document.
VU_CORAL = RGBColor(0xD8, 0x48, 0x30)
VU_ORANGE = RGBColor(0xF0, 0x78, 0x30)
VU_TEAL = RGBColor(0x3C, 0x90, 0x9C)
VU_DARK = RGBColor(0x29, 0x4A, 0x48)

# Palette — taken from packages/shared/src/theme/tokens.ts
INK = RGBColor(0x0B, 0x0F, 0x14)
NAVY = VU_DARK
ACCENT = RGBColor(0x3B, 0x82, 0xF6)
GREEN = RGBColor(0x10, 0xB9, 0x81)
PURPLE = RGBColor(0xA8, 0x55, 0xF7)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)
RED = RGBColor(0xEF, 0x44, 0x44)
CYAN = RGBColor(0x06, 0xB6, 0xD4)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
SURFACE = RGBColor(0xF7, 0xF9, 0xFC)
SURFACE2 = RGBColor(0xF0, 0xF3, 0xF8)
BORDER = RGBColor(0xDD, 0xE3, 0xEC)
SECONDARY = RGBColor(0x4A, 0x55, 0x68)
MUTED = RGBColor(0x6B, 0x76, 0x84)

# Typography — one font for headings, one for body, one for technical terms.
F_HEAD = "Calibri"
F_BODY = "Calibri"
F_MONO = "Consolas"

SW, SH = 13.333, 7.5
M = 0.72  # page margin
CONTENT_W = SW - 2 * M

prs = Presentation()
prs.slide_width = Inches(SW)
prs.slide_height = Inches(SH)
BLANK = prs.slide_layouts[6]

_page = {"n": 0}


# ------------------------------------------------------------------- primitives


def _tf(shape, wrap=True):
    tf = shape.text_frame
    tf.word_wrap = wrap
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    return tf


def text(slide, x, y, w, h, s, size=16, color=INK, bold=False, font=F_BODY,
         align=PP_ALIGN.LEFT, italic=False, spacing=1.0, anchor=MSO_ANCHOR.TOP,
         caps=False):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = _tf(box)
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    r = p.add_run()
    r.text = s.upper() if caps else s
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.name = font
    r.font.color.rgb = color
    return box


def para_block(slide, x, y, w, h, lines, size=15, color=INK, font=F_BODY,
               spacing=1.25, space_after=6, bullet_color=None):
    """lines: list of (text, bold, color) or plain strings."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = _tf(box)
    for i, item in enumerate(lines):
        if isinstance(item, str):
            body, bold, col = item, False, color
        else:
            body, bold, col = item
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = spacing
        p.space_after = Pt(space_after)
        r = p.add_run()
        r.text = body
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.name = font
        r.font.color.rgb = col
    return box


def bullets(slide, x, y, w, h, items, size=15, color=INK, dot=ACCENT,
            spacing=1.2, gap=10):
    """items: strings, or (lead, rest) where lead is bolded."""
    for i, item in enumerate(items):
        row_y = y + i * (0.42 if size <= 14 else 0.46)
        d = slide.shapes.add_shape(
            MSO_SHAPE.OVAL, Inches(x), Inches(row_y + 0.09), Inches(0.08), Inches(0.08)
        )
        d.fill.solid()
        d.fill.fore_color.rgb = dot
        d.line.fill.background()
        d.shadow.inherit = False

        box = slide.shapes.add_textbox(
            Inches(x + 0.22), Inches(row_y - 0.03), Inches(w - 0.22), Inches(0.5)
        )
        tf = _tf(box)
        p = tf.paragraphs[0]
        p.line_spacing = spacing
        if isinstance(item, tuple):
            lead, rest = item
            r = p.add_run()
            r.text = lead
            r.font.size = Pt(size)
            r.font.bold = True
            r.font.name = F_BODY
            r.font.color.rgb = INK
            r2 = p.add_run()
            r2.text = rest
            r2.font.size = Pt(size)
            r2.font.name = F_BODY
            r2.font.color.rgb = color
        else:
            r = p.add_run()
            r.text = item
            r.font.size = Pt(size)
            r.font.name = F_BODY
            r.font.color.rgb = color


def rect(slide, x, y, w, h, fill=SURFACE, line=BORDER, radius=None, lw=1.0,
         dash=None):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius is not False else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius is not False:
        try:
            s.adjustments[0] = radius if radius else 0.08
        except Exception:
            pass
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(lw)
        if dash:
            s.line.dash_style = dash
    s.shadow.inherit = False
    s.text_frame.text = ""
    return s


def card(slide, x, y, w, h, title=None, body=None, accent=ACCENT,
         title_size=15, body_size=12.5, fill=WHITE, bar=True, tag=None):
    rect(slide, x, y, w, h, fill=fill, line=BORDER)
    if bar:
        b = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x + 0.22), Inches(y + 0.24),
            Inches(0.055), Inches(0.26)
        )
        b.fill.solid()
        b.fill.fore_color.rgb = accent
        b.line.fill.background()
        b.shadow.inherit = False
    tx = x + (0.42 if bar else 0.24)
    if title:
        text(slide, tx, y + 0.19, w - (tx - x) - 0.2, 0.32, title,
             size=title_size, bold=True, color=INK)
    if body:
        para_block(slide, x + 0.24, y + 0.62, w - 0.48, h - 0.8,
                   body if isinstance(body, list) else [body],
                   size=body_size, color=SECONDARY, spacing=1.18, space_after=4)
    if tag:
        pill(slide, x + w - 0.2 - tag[1], y + 0.2, tag[1], 0.26, tag[0], accent)


def pill(slide, x, y, w, h, label, color=ACCENT, text_color=None, size=9.5):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y),
                               Inches(w), Inches(h))
    s.adjustments[0] = 0.5
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()
    s.shadow.inherit = False
    tf = _tf(s)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.name = F_BODY
    r.font.color.rgb = text_color or WHITE
    return s


def block(slide, x, y, w, h, label, sub=None, fill=ACCENT, text_color=WHITE,
          size=13, sub_size=10, radius=0.1, line=None):
    s = rect(slide, x, y, w, h, fill=fill, line=line, radius=radius)
    tf = _tf(s)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = Emu(int(0.08 * 914400))
    tf.margin_right = Emu(int(0.08 * 914400))
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.name = F_BODY
    r.font.color.rgb = text_color
    if sub:
        p2 = tf.add_paragraph()
        p2.alignment = PP_ALIGN.CENTER
        p2.space_before = Pt(2)
        r2 = p2.add_run()
        r2.text = sub
        r2.font.size = Pt(sub_size)
        r2.font.name = F_BODY
        r2.font.color.rgb = text_color
    return s


def arrow(slide, x, y, w, h, color=MUTED, direction="down"):
    shape = {
        "down": MSO_SHAPE.DOWN_ARROW,
        "right": MSO_SHAPE.RIGHT_ARROW,
        "left": MSO_SHAPE.LEFT_ARROW,
        "updown": MSO_SHAPE.UP_DOWN_ARROW,
        "leftright": MSO_SHAPE.LEFT_RIGHT_ARROW,
    }[direction]
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()
    s.shadow.inherit = False
    return s


def notes(slide, s):
    slide.notes_slide.notes_text_frame.text = s


# ------------------------------------------------------------------ slide chrome


def new_slide(title=None, kicker=None, dark=False):
    s = prs.slides.add_slide(BLANK)
    _page["n"] += 1

    bg = s.background.fill
    bg.solid()
    bg.fore_color.rgb = INK if dark else WHITE

    if title:
        if kicker:
            text(s, M, 0.46, CONTENT_W - 1.6, 0.24, kicker, size=10.5,
                 color=VU_CORAL if not dark else VU_ORANGE, bold=True, caps=True,
                 font=F_BODY)
            ty = 0.70
        else:
            ty = 0.52
        text(s, M, ty, CONTENT_W - 1.6, 0.5, title, size=27, bold=True,
             color=WHITE if dark else VU_DARK, font=F_HEAD)
        # accent rule
        rule = s.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(M), Inches(ty + 0.53), Inches(0.62), Inches(0.045)
        )
        rule.fill.solid()
        rule.fill.fore_color.rgb = VU_CORAL
        rule.line.fill.background()
        rule.shadow.inherit = False

    # University logo — REQUIRED on every slide by the university's notice.
    s.shapes.add_picture(VIDYA_LOGO, Inches(SW - M - LOGO_W), Inches(0.42),
                         Inches(LOGO_W), Inches(LOGO_H))

    # Footer
    text(s, M, SH - 0.44, 7.0, 0.24,
         "PrepPilot  ·  Vidya University, Meerut  ·  Dept. of Computer Science & Engineering",
         size=8.5, color=MUTED if not dark else RGBColor(0x6B, 0x76, 0x84))
    text(s, SW - M - 1.2, SH - 0.44, 1.2, 0.24, str(_page["n"]), size=8.5,
         color=MUTED, align=PP_ALIGN.RIGHT)
    return s


def body_top(kicker=True):
    return 1.52 if kicker else 1.34

# ============================================================== SLIDE 1 — TITLE

s = prs.slides.add_slide(BLANK)
_page["n"] = 1
s.background.fill.solid()
s.background.fill.fore_color.rgb = WHITE

# Left identity band, in the university's own colours.
band = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(0.34), Inches(SH))
band.fill.solid()
band.fill.fore_color.rgb = VU_CORAL
band.line.fill.background()
band.shadow.inherit = False
band2 = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(SH * 0.55), Inches(0.34),
                           Inches(SH * 0.45))
band2.fill.solid()
band2.fill.fore_color.rgb = VU_TEAL
band2.line.fill.background()
band2.shadow.inherit = False

LM = 0.95  # left margin on the title slide, clear of the band

s.shapes.add_picture(VIDYA_LOGO, Inches(LM), Inches(0.52), Inches(2.75),
                     Inches(2.75 * LOGO_RATIO))

text(s, LM, 1.66, 8.0, 0.28, "VIDYA UNIVERSITY, MEERUT", size=13, bold=True,
     color=VU_DARK)
text(s, LM, 1.96, 8.0, 0.26, "Department of Computer Science & Engineering",
     size=11, color=SECONDARY)

sep = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(LM), Inches(2.42),
                         Inches(SW - LM - M), Inches(0.02))
sep.fill.solid(); sep.fill.fore_color.rgb = BORDER; sep.line.fill.background()
sep.shadow.inherit = False

text(s, LM, 2.64, 9.4, 0.3,
     "First Project Presentation  ·  3rd Semester  ·  CSE (AI & ML)",
     size=11, bold=True, color=VU_CORAL, caps=True)

text(s, LM, 3.00, 9.6, 1.0, "PrepPilot", size=54, bold=True, color=VU_DARK,
     font=F_HEAD)
text(s, LM, 4.02, 8.6, 0.66,
     "An Offline-First, AI-Assisted Study and Examination Preparation Platform",
     size=17, color=SECONDARY, spacing=1.22)

rl = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(LM), Inches(4.86), Inches(0.72),
                        Inches(0.05))
rl.fill.solid()
rl.fill.fore_color.rgb = VU_CORAL
rl.line.fill.background()
rl.shadow.inherit = False

# Team block
text(s, LM, 5.16, 3.2, 0.24, "PRESENTED BY", size=9, bold=True, color=MUTED, caps=True)
team = ["Archit Jain", "Vanshika Rajput", "Lavi Chaudhary", "Jasmine Chaudhary"]
for i, name in enumerate(team):
    col = i % 2
    row = i // 2
    text(s, LM + col * 2.62, 5.46 + row * 0.58, 2.55, 0.26, name, size=13,
         color=INK, bold=True)
    text(s, LM + col * 2.62, 5.73 + row * 0.58, 2.55, 0.2,
         "Roll No. ______________", size=8.5, color=MUTED)

# Guide block
text(s, 8.62, 5.16, 3.0, 0.24, "PROJECT GUIDE", size=9, bold=True, color=MUTED, caps=True)
text(s, 8.62, 5.44, 3.4, 0.3, "Ms. Kareena", size=14.5, bold=True, color=INK)
text(s, 8.62, 5.76, 3.6, 0.24, "Dept. of Computer Science & Engineering",
     size=9, color=MUTED)
text(s, 8.62, 6.14, 3.0, 0.24, "SUBMISSION DATE", size=9, bold=True, color=MUTED, caps=True)
text(s, 8.62, 6.42, 3.0, 0.3, "12 September 2026", size=13, color=INK, bold=True)

s.shapes.add_picture(PP_LOGO, Inches(11.20), Inches(2.72), Inches(1.30), Inches(1.30))

text(s, M, SH - 0.42, 8.0, 0.24,
     "Baghpat Road, Delhi-Meerut Bypass, Meerut, U.P., India-250002",
     size=8.5, color=MUTED)

notes(s, "Good morning. We are presenting PrepPilot, an offline-first, "
         "AI-assisted study and exam preparation platform built for Android. "
         "I am Archit Jain, with Vanshika, Lavi and Jasmine, guided by Ms. Kareena. "
         "Over the next twenty minutes we will cover the problem we set out to "
         "solve, our proposed solution, the architecture behind it, and — "
         "importantly — an honest account of what the system does and does not do.")


# ==================================================== SLIDE 2 — INTRODUCTION

s = new_slide("What is PrepPilot?", "Project Introduction")
y = body_top()

text(s, M, y, 7.5, 0.86,
     "A mobile application that helps a student organise a syllabus, record what "
     "they have genuinely completed, time their study, and revise — with or "
     "without an internet connection.",
     size=16.5, color=INK, spacing=1.26)

y2 = y + 1.02
cards = [
    ("Syllabus at the centre", "Subject → Chapter → Topic → Sub-topic. Every "
     "feature attaches to this structure.", ACCENT),
    ("Offline-first, strictly", "On-device SQLite is the source of truth. The "
     "cloud syncs; it is never required.", GREEN),
    ("Tracker first, AI second", "The assistant supports the workflow. It can "
     "propose, never apply.", PURPLE),
]
cw = (7.5 - 2 * 0.22) / 3
for i, (t, b, c) in enumerate(cards):
    card(s, M + i * (cw + 0.22), y2, cw, 1.68, t, [b], accent=c, title_size=12.5,
         body_size=10.5)

y3 = y2 + 1.88
rect(s, M, y3, 7.5, 1.18, fill=SURFACE, line=BORDER)
text(s, M + 0.3, y3 + 0.18, 7.0, 0.26, "THE ORGANISING IDEA", size=9.5, bold=True,
     color=VU_CORAL, caps=True)
text(s, M + 0.3, y3 + 0.50, 7.0, 0.6,
     "A student's syllabus is a structure, and progress is a measurement over "
     "that structure. Timers, flashcards, notes and reminders all point back to it.",
     size=12.5, color=SECONDARY, spacing=1.2)

y4 = y3 + 1.36
stats = [("22", "syllabus templates"), ("9", "database tables"),
         ("1,799", "tests passing")]
for i, (n, l) in enumerate(stats):
    x = M + i * 2.55
    text(s, x, y4, 2.4, 0.36, n, size=20, bold=True, color=VU_TEAL, font=F_HEAD)
    text(s, x, y4 + 0.38, 2.4, 0.24, l, size=9.5, color=MUTED)

s.shapes.add_picture(f"{SHOTS}/tracker.png", Inches(8.95), Inches(y - 0.08),
                     height=Inches(4.9))

notes(s, "PrepPilot is built around one idea: a syllabus is a structure, and "
         "progress is a measurement over it. Everything hangs off that. Two "
         "commitments shape the engineering — offline-first in the strict sense, "
         "where the local database is authoritative rather than a cache; and the "
         "AI assisting but never driving, able to propose changes but not apply "
         "them. On the right is the tracker screen from the running application.")

# ============================================ SLIDE 3 — PROBLEM STATEMENT + GAP

s = new_slide("Problem Statement", "The problem, and why current tools miss it")
y = body_top()

rect(s, M, y, CONTENT_W, 0.94, fill=VU_DARK, line=None)
text(s, M + 0.34, y + 0.18, CONTENT_W - 0.68, 0.62,
     "Students lack a single, reliable, offline-capable tool that answers "
     "“how much of my syllabus have I actually finished?” honestly — and that "
     "supports the study workflow against that same structure.",
     size=14.5, color=WHITE, spacing=1.22)

y2 = y + 1.16
probs = [
    ("No accurate measurement", "Paper, spreadsheets and memory cannot measure a "
     "hierarchical syllabus of unequal parts.", RED),
    ("Connectivity dependence", "Most study apps need a network round-trip — "
     "unusable in libraries, hostels and trains.", AMBER),
    ("Fragmentation", "Tracking, timers, flashcards and notes sit in separate "
     "apps that share no context.", PURPLE),
    ("Misleading metrics", "Naive progress calculations misrepresent how much "
     "work actually remains.", ACCENT),
]
cw = (6.6 - 0.22) / 2
for i, (t, b, c) in enumerate(probs):
    x = M + (i % 2) * (cw + 0.22)
    yy = y2 + (i // 2) * 1.50
    card(s, x, yy, cw, 1.38, t, [b], accent=c, title_size=12, body_size=10)

x2 = M + 6.82
rect(s, x2, y2, CONTENT_W - 6.82, 2.88, fill=SURFACE, line=BORDER)
text(s, x2 + 0.28, y2 + 0.18, 4.6, 0.26, "EXISTING APPROACHES", size=9.5,
     bold=True, color=VU_CORAL, caps=True)
rows = [
    ("Paper checklists", "no computed progress"),
    ("Spreadsheets", "laborious on a phone"),
    ("To-do apps", "no syllabus concept"),
    ("Flashcard apps", "no progress model"),
    ("Pomodoro timers", "time only, no context"),
    ("Coaching portals", "need connectivity"),
]
for i, (a, b) in enumerate(rows):
    yy = y2 + 0.50 + i * 0.31
    text(s, x2 + 0.28, yy, 1.85, 0.26, a, size=10, bold=True, color=INK)
    text(s, x2 + 2.15, yy, 2.5, 0.26, b, size=9.5, color=SECONDARY)

text(s, x2 + 0.28, y2 + 2.98, 4.6, 0.5,
     "No existing tool combines a structured syllabus, honest progress, "
     "offline-first operation and integrated study tooling.",
     size=10, color=MUTED, italic=True, spacing=1.18)

notes(s, "The problem is organisational rather than academic. Four specific "
         "failures on the left. On the right, the six categories of tool "
         "students actually use today — each fails differently, but none holds "
         "the syllabus that everything else should refer to. That gap is what we "
         "set out to close.")

# ====================================================== SLIDE 4 — WHY IT MATTERS

s = new_slide("Why This Problem Matters", "A wrong number is worse than no number")
y = body_top()

text(s, M, y, 11.9, 0.34,
     "Consider a subject with two chapters: one topic complete out of one, and "
     "zero complete out of ninety-nine.",
     size=15, color=SECONDARY)

y2 = y + 0.62
cw = 5.55
rect(s, M, y2, cw, 2.28, fill=RGBColor(0xFE, 0xF2, 0xF2), line=RGBColor(0xFC, 0xA5, 0xA5))
pill(s, M + 0.28, y2 + 0.24, 1.62, 0.3, "THE OBVIOUS WAY", RED)
text(s, M + 0.28, y2 + 0.70, cw - 0.56, 0.3, "Average the chapter percentages",
     size=13.5, bold=True, color=INK)
text(s, M + 0.28, y2 + 1.08, cw - 0.56, 0.4, "( 100%  +  0% )  ÷  2", size=17,
     color=SECONDARY, font=F_MONO)
text(s, M + 0.28, y2 + 1.56, cw - 0.56, 0.5, "= 50% complete", size=26, bold=True,
     color=RED, font=F_HEAD)

x2 = M + cw + 0.5
rect(s, x2, y2, cw, 2.28, fill=RGBColor(0xEC, 0xFD, 0xF5), line=RGBColor(0x6E, 0xE7, 0xB7))
pill(s, x2 + 0.28, y2 + 0.24, 2.25, 0.3, "WHAT PREPPILOT DOES", GREEN)
text(s, x2 + 0.28, y2 + 0.70, cw - 0.56, 0.3, "Weight by topics, not chapters",
     size=13.5, bold=True, color=INK)
text(s, x2 + 0.28, y2 + 1.08, cw - 0.56, 0.4, "1 topic  ÷  100 topics", size=17,
     color=SECONDARY, font=F_MONO)
text(s, x2 + 0.28, y2 + 1.56, cw - 0.56, 0.5, "= 1% complete", size=26, bold=True,
     color=GREEN, font=F_HEAD)

y3 = y2 + 2.52
rect(s, M, y3, CONTENT_W, 1.5, fill=SURFACE, line=BORDER)
text(s, M + 0.32, y3 + 0.20, CONTENT_W - 0.64, 0.28, "WHY THIS IS THE CORE PROMISE",
     size=9.5, bold=True, color=VU_CORAL, caps=True)
text(s, M + 0.32, y3 + 0.56, CONTENT_W - 0.64, 0.8,
     "A student who believes they are halfway through when they are 1% through "
     "will plan their remaining weeks wrongly. The averaging mistake is the "
     "obvious implementation — so our progress engine guards against it with an "
     "explicit regression test.",
     size=13, color=SECONDARY, spacing=1.2)

notes(s, "This is the heart of our motivation. Averaging the chapter percentages "
         "gives fifty percent. The truth is one percent. That difference decides "
         "how a student spends their final weeks. Because averaging is the "
         "obvious implementation, we wrote a regression test specifically to stop "
         "anyone reintroducing it.")

# ========================================================== SLIDE 5 — OBJECTIVES

s = new_slide("Objectives", "What we set out to build")
y = body_top()

objs = [
    ("01", "Model the syllabus", "Four-level hierarchy with per-item completion", ACCENT),
    ("02", "Measure honestly", "Topic-weighted progress that never misrepresents", GREEN),
    ("03", "Work offline", "Local database authoritative; network optional", PURPLE),
    ("04", "Sync deterministically", "Multi-device with predictable conflict rules", CYAN),
    ("05", "Record study accurately", "Survive backgrounding and process death", AMBER),
    ("06", "Integrate AI safely", "No client-side keys; no unconfirmed changes", RED),
]
cw = (CONTENT_W - 2 * 0.26) / 3
for i, (n, t, b, c) in enumerate(objs):
    x = M + (i % 3) * (cw + 0.26)
    yy = y + (i // 3) * 1.62
    rect(s, x, yy, cw, 1.44, fill=WHITE, line=BORDER)
    text(s, x + 0.26, yy + 0.20, 0.8, 0.3, n, size=13, bold=True, color=c, font=F_MONO)
    text(s, x + 0.26, yy + 0.54, cw - 0.5, 0.3, t, size=13.5, bold=True, color=INK)
    text(s, x + 0.26, yy + 0.88, cw - 0.5, 0.44, b, size=11, color=SECONDARY, spacing=1.15)

y2 = y + 3.42
rect(s, M, y2, CONTENT_W, 0.76, fill=RGBColor(0xEC, 0xFD, 0xF5),
     line=RGBColor(0x6E, 0xE7, 0xB7))
text(s, M + 0.32, y2 + 0.20, CONTENT_W - 0.64, 0.4,
     "All twelve project objectives are met. Six further objectives — templates, "
     "multi-course support, revision tooling, data isolation and automated "
     "validation — are listed in the synopsis.",
     size=12.5, color=RGBColor(0x06, 0x5F, 0x46), spacing=1.15)

notes(s, "We set twelve objectives; these are the six principal ones, each "
         "measurable and each met. Objective six is worth noting — integrating AI "
         "safely was an engineering constraint from the start, not something "
         "added afterwards.")

# ==================================================== SLIDE 6 — PROPOSED SOLUTION

s = new_slide("Proposed Solution", "One application, one structure")
y = body_top()

cx = 4.05
block(s, cx, y + 1.42, 2.5, 0.92, "SYLLABUS",
      "Subject → Chapter → Topic", fill=ACCENT, size=14, sub_size=9)

spokes = [
    ("Progress", "topic-weighted", GREEN, 0.62, y),
    ("Sessions", "3 timer modes", PURPLE, 0.62, y + 1.02),
    ("Flashcards", "scheduled review", AMBER, 0.62, y + 2.04),
    ("Notes", "per topic", CYAN, 7.02, y),
    ("Reminders", "student-set only", RED, 7.02, y + 1.02),
    ("AI Assistant", "explain · quiz", ACCENT, 7.02, y + 2.04),
]
for label, sub, col, x, yy in spokes:
    rect(s, x, yy, 2.62, 0.86, fill=WHITE, line=BORDER)
    bar = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x + 0.16),
                             Inches(yy + 0.2), Inches(0.05), Inches(0.46))
    bar.fill.solid(); bar.fill.fore_color.rgb = col; bar.line.fill.background()
    bar.shadow.inherit = False
    text(s, x + 0.34, yy + 0.16, 2.2, 0.28, label, size=12.5, bold=True, color=INK)
    text(s, x + 0.34, yy + 0.46, 2.2, 0.24, sub, size=10, color=MUTED)
    if x < cx:
        arrow(s, x + 2.70, yy + 0.36, 0.68, 0.14, color=BORDER, direction="right")
    else:
        arrow(s, 6.60, yy + 0.36, 0.36, 0.14, color=BORDER, direction="left")

y2 = y + 3.28
commits = [
    ("Local database is the source of truth", GREEN),
    ("Progress computed in exactly one place", ACCENT),
    ("AI may propose, never apply", PURPLE),
    ("Secrets never reach the device", RED),
]
cw = (CONTENT_W - 3 * 0.2) / 4
for i, (t, c) in enumerate(commits):
    x = M + i * (cw + 0.2)
    rect(s, x, y2, cw, 0.78, fill=SURFACE, line=BORDER)
    dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x + 0.2), Inches(y2 + 0.32),
                             Inches(0.11), Inches(0.11))
    dot.fill.solid(); dot.fill.fore_color.rgb = c; dot.line.fill.background()
    dot.shadow.inherit = False
    text(s, x + 0.42, y2 + 0.19, cw - 0.6, 0.48, t, size=11, bold=True, color=INK,
         spacing=1.12)

notes(s, "Our solution is one application in which the syllabus is the central "
         "data structure and every other feature references it. The four "
         "commitments along the bottom are design rules we held to throughout — "
         "each is implemented, not aspirational.")

# =============================================== SLIDE 7 — METHODOLOGY / FLOW

s = new_slide("Methodology and Working Flow", "How the system actually works")
y = body_top()

flow = [
    ("Sign in", "email · Google · guest", ACCENT),
    ("Set up syllabus", "import a template or add manually", PURPLE),
    ("Study", "tick topics · run a timer · review cards", GREEN),
    ("Write locally", "SQLite, syncStatus = pending", AMBER),
    ("Sync when online", "pull → merge → push", CYAN),
]
bw = (CONTENT_W - 4 * 0.34) / 5
for i, (t, sub, c) in enumerate(flow):
    x = M + i * (bw + 0.34)
    block(s, x, y, bw, 1.0, t, sub, fill=c, size=12.5, sub_size=8.5)
    if i < 4:
        arrow(s, x + bw + 0.06, y + 0.38, 0.22, 0.24, color=BORDER, direction="right")

y2 = y + 1.32
rect(s, M, y2, 6.1, 1.34, fill=RGBColor(0xFF, 0xFB, 0xEB), line=RGBColor(0xFC, 0xD3, 0x4D))
text(s, M + 0.28, y2 + 0.18, 5.5, 0.26, "THE CRITICAL PROPERTY", size=9.5,
     bold=True, color=RGBColor(0x78, 0x35, 0x0F), caps=True)
text(s, M + 0.28, y2 + 0.52, 5.5, 0.66,
     "The local write completes regardless of network state. Synchronisation is a "
     "separate, later concern — so no student action ever waits on connectivity.",
     size=12, color=RGBColor(0x78, 0x35, 0x0F), spacing=1.2)

x2 = M + 6.36
rect(s, x2, y2, CONTENT_W - (x2 - M), 1.34, fill=SURFACE, line=BORDER)
text(s, x2 + 0.28, y2 + 0.18, 5.0, 0.26, "DEVELOPMENT METHODOLOGY", size=9.5,
     bold=True, color=VU_CORAL, caps=True)
text(s, x2 + 0.28, y2 + 0.52, 5.0, 0.66,
     "Incremental and decision-logged: every architectural choice is recorded in "
     "DECISIONS.md with its reasoning and alternatives. CI gates every change.",
     size=12, color=SECONDARY, spacing=1.2)

y3 = y2 + 1.56
text(s, M, y3, CONTENT_W, 0.3, "WHEN THE AI IS ASKED TO CHANGE SOMETHING",
     size=9.5, bold=True, color=PURPLE, caps=True)
sub = [("Reply parsed", ACCENT), ("Proposal shown", PURPLE), ("Student confirms", AMBER),
       ("Applied to syllabus", GREEN), ("Progress recomputed", CYAN)]
bw2 = (CONTENT_W - 4 * 0.3) / 5
for i, (t, c) in enumerate(sub):
    x = M + i * (bw2 + 0.3)
    block(s, x, y3 + 0.34, bw2, 0.58, t, fill=WHITE, text_color=INK, size=11,
          line=BORDER)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y3 + 0.34),
                             Inches(bw2), Inches(0.045))
    bar.fill.solid(); bar.fill.fore_color.rgb = c; bar.line.fill.background()
    bar.shadow.inherit = False
    if i < 4:
        arrow(s, x + bw2 + 0.06, y3 + 0.56, 0.18, 0.16, color=BORDER, direction="right")

notes(s, "This is the mandatory methodology slide. The top row is the everyday "
         "flow. The property we want to highlight is in the amber box: the local "
         "write completes regardless of network state, so no student action waits "
         "on connectivity. The bottom row is the AI path — note that 'student "
         "confirms' sits between the proposal and anything being applied.")

# =================================================== SLIDE 8 — SYLLABUS & PROGRESS

s = new_slide("Syllabus Structure and Progress", "How the hierarchy is counted")
y = body_top()

levels = [
    ("SUBJECT", "Mathematics", ACCENT, 0.0),
    ("CHAPTER", "Trigonometry", PURPLE, 0.44),
    ("TOPIC", "Identities", GREEN, 0.88),
    ("SUB-TOPIC", "optional fourth level", AMBER, 1.32),
]
for i, (lvl, ex, col, ind) in enumerate(levels):
    yy = y + i * 0.78
    rect(s, M + ind, yy, 4.3 - ind, 0.6, fill=WHITE, line=BORDER)
    b = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(M + ind + 0.14),
                           Inches(yy + 0.13), Inches(0.05), Inches(0.34))
    b.fill.solid(); b.fill.fore_color.rgb = col; b.line.fill.background()
    b.shadow.inherit = False
    text(s, M + ind + 0.3, yy + 0.10, 1.5, 0.24, lvl, size=9.5, bold=True, color=col, caps=True)
    text(s, M + ind + 0.3, yy + 0.30, 2.6, 0.26, ex, size=12, color=INK)
    if i < 3:
        arrow(s, M + ind + 0.3, yy + 0.62, 0.14, 0.14, color=BORDER, direction="down")

x2 = 5.35
rules = [
    ("Topic-weighted", "Subject progress is all completed units ÷ all units — "
     "never the mean of chapter percentages.", GREEN),
    ("Empty is not zero", "A chapter with no topics reports “—”, not 0%. "
     "It is unmeasured, not unstarted.", ACCENT),
    ("Sub-topics become the unit", "A topic split into four parts weighs four "
     "times one that is not — it is four times the work.", PURPLE),
    ("Rounding is honest", "9,999 of 10,000 topics displays as 99%, never a "
     "falsely triumphant 100%.", AMBER),
]
for i, (t, b, c) in enumerate(rules):
    card(s, x2, y + i * 0.98, CONTENT_W - (x2 - M), 0.86, t, [b], accent=c,
         title_size=12.5, body_size=10.5)

text(s, M, y + 4.02, 4.3, 0.6,
     "All five figures — topic, chapter, subject, overall and dashboard — are "
     "derived from a single traversal, so they cannot disagree.",
     size=11, color=MUTED, spacing=1.2, italic=True)

notes(s, "The syllabus is four levels deep, the fourth optional. Four rules "
         "govern counting. The second matters more than it looks: an empty "
         "chapter reports an em dash, not zero percent, because a chapter you "
         "have not filled in is unmeasured, not unstarted. All five progress "
         "figures come from one traversal, so they are consistent by construction.")

# ================================================== SLIDE 9 — TIMERS & SESSIONS

s = new_slide("Study Timers and Sessions", "Recording time that actually happened")
y = body_top()

modes = [("Stopwatch", "Counts up, no limit", ACCENT),
         ("Pomodoro", "25 / 5 / 15, configurable", PURPLE),
         ("Custom", "Any countdown, 1–480 min", GREEN)]
cw = (7.4 - 2 * 0.22) / 3
for i, (t, b, c) in enumerate(modes):
    x = M + i * (cw + 0.22)
    rect(s, x, y, cw, 0.98, fill=WHITE, line=BORDER)
    text(s, x + 0.24, y + 0.18, cw - 0.4, 0.3, t, size=14, bold=True, color=c)
    text(s, x + 0.24, y + 0.54, cw - 0.4, 0.26, b, size=10.5, color=SECONDARY)

y2 = y + 1.22
card(s, M, y2, 7.4, 1.46, "Elapsed time is derived, never accumulated",
     ["Time is computed from timestamps — now − startedAt + banked — not by a "
      "counter ticking each second.",
      "Android suspends background processes. A ticking counter stops when the "
      "screen locks and would silently under-report the session. Deriving from a "
      "start timestamp survives backgrounding and process death."],
     accent=ACCENT, title_size=13, body_size=11)

y3 = y2 + 1.66
card(s, M, y3, 3.58, 1.32, "Breaks are not study time",
     ["Pomodoro break phases are excluded from recorded duration. Counting them "
      "would inflate “total time studied” and make the figure meaningless."],
     accent=GREEN, title_size=12.5, body_size=10.5)
card(s, M + 3.82, y3, 3.58, 1.32, "Interrupted sessions survive",
     ["A session killed by the OS is recorded as “abandoned” with the last "
      "heartbeat's duration — a crash costs one interval, not the whole sitting."],
     accent=AMBER, title_size=12.5, body_size=10.5)

s.shapes.add_picture(f"{SHOTS}/timer.png", Inches(8.9), Inches(y - 0.08),
                     height=Inches(4.9))

notes(s, "Three timer modes. The engineering detail worth explaining is how we "
         "measure elapsed time. The naive approach is a counter incremented every "
         "second — but Android suspends background processes, so that counter "
         "stops the moment a student locks their screen. We derive elapsed time "
         "from the start timestamp instead, which survives backgrounding and "
         "process death. We also exclude Pomodoro breaks, because counting rest "
         "as study makes the total meaningless.")

# ======================================= SLIDE 10 — FLASHCARDS, NOTES, REMINDERS

s = new_slide("Flashcards, Notes and Reminders", "Revision tooling bound to the syllabus")
y = body_top()

cw = (CONTENT_W - 2 * 0.26) / 3

card(s, M, y, cw, 1.52, "Flashcards",
     ["Cards are written against a topic. After seeing the answer the student "
      "picks one of four fixed intervals."],
     accent=AMBER, title_size=14, body_size=11)
for i, (lab, col) in enumerate([("5m", RED), ("1d", AMBER), ("2d", ACCENT), ("4d", GREEN)]):
    block(s, M + 0.22 + i * 0.95, y + 1.64, 0.82, 0.44, lab, fill=col, size=11.5)

card(s, M + cw + 0.26, y, cw, 1.52, "Notes",
     ["Free-text notes on any topic or sub-topic, managed from one screen — so "
      "fixing a typo does not mean hunting through a collapsed syllabus."],
     accent=CYAN, title_size=14, body_size=11)

card(s, M + 2 * (cw + 0.26), y, cw, 1.52, "Reminders",
     ["Student-created only — PrepPilot never invents schedules. Repeat rules: "
      "none, daily, weekdays, weekly."],
     accent=PURPLE, title_size=14, body_size=11)

y2 = y + 2.26
rect(s, M, y2, CONTENT_W, 1.62, fill=RGBColor(0xFF, 0xFB, 0xEB),
     line=RGBColor(0xFC, 0xD3, 0x4D))
pill(s, M + 0.28, y2 + 0.2, 2.1, 0.3, "STATED ACCURATELY", AMBER)
text(s, M + 0.28, y2 + 0.62, 5.8, 0.9,
     "PrepPilot implements fixed-interval spaced repetition — not SM-2. A full, "
     "tested SM-2 implementation exists in our shared package and its statistics "
     "are maintained under every review, but the review screen does not call it.",
     size=11, color=RGBColor(0x78, 0x35, 0x0F), spacing=1.2)
text(s, M + 6.4, y2 + 0.62, 5.5, 0.9,
     "Reminders on Android are held by the operating system and fire reliably. "
     "In the browser build they are a timer inside the tab — they stop when the "
     "tab closes, and the screen says so.",
     size=11, color=RGBColor(0x78, 0x35, 0x0F), spacing=1.2)

y3 = y2 + 1.80
text(s, M, y3, CONTENT_W, 0.44,
     "Why fixed intervals: an adaptive schedule changes its button labels every "
     "review, so “1 day” is not a day on a mature card. Fixed labels say exactly "
     "what they do.",
     size=10.5, color=MUTED, spacing=1.2, italic=True)

notes(s, "Three revision features, and the amber panel is the one we most expect "
         "to be questioned on. Many apps say 'spaced repetition' and mean SM-2, "
         "the Anki algorithm. We implemented SM-2 fully and tested it, but our "
         "review screen uses four fixed intervals instead, because fixed labels "
         "tell the student exactly what will happen. We maintain the SM-2 "
         "statistics underneath, so switching is a one-line change. On the right, "
         "the reminder limitation is platform-specific and stated in the app.")

# ============================================== SLIDE 11 — FOCUS MODE / HONESTY

s = new_slide("Focus Mode — Honesty by Design", "The app states its own limits, in the interface")
y = body_top()

s.shapes.add_picture(f"{SHOTS}/focus.png", Inches(M + 0.4), Inches(y - 0.1),
                     height=Inches(5.0))

x2 = 5.2
text(s, x2, y + 0.06, CONTENT_W - (x2 - M), 0.86,
     "Focus Mode gives a distraction-free screen, keeps the display awake, and "
     "counts the times a student leaves the app. It ships with a capability list.",
     size=15, color=INK, spacing=1.24)

items = [
    ("✓", "Full-screen focus timer", GREEN),
    ("✓", "PrepPilot stays quiet — your own reminders will not interrupt", GREEN),
    ("✗", "Blocking other apps — Android forbids it without privileges the Play Store restricts", RED),
    ("✗", "Silencing other apps' notifications — needs a permission we do not request", RED),
]
for i, (mark, label, col) in enumerate(items):
    yy = y + 1.10 + i * 0.62
    text(s, x2, yy, 0.3, 0.3, mark, size=15, bold=True, color=col)
    text(s, x2 + 0.34, yy + 0.02, CONTENT_W - (x2 - M) - 0.4, 0.56, label,
         size=11.5, color=SECONDARY, spacing=1.16)

y3 = y + 3.72
rect(s, x2, y3, CONTENT_W - (x2 - M), 1.14, fill=SURFACE, line=BORDER)
text(s, x2 + 0.28, y3 + 0.2, 6.6, 0.26, "WHY THIS MATTERS", size=9.5, bold=True,
     color=VU_CORAL, caps=True)
text(s, x2 + 0.28, y3 + 0.52, 6.6, 0.52,
     "A student planning months of preparation around a tool needs that tool to "
     "be accurate about itself.",
     size=12.5, color=SECONDARY, spacing=1.2)

notes(s, "This screenshot is from the running application. Two ticks and two "
         "crosses, each with a reason. Focus Mode does not block other apps — "
         "Android does not permit that without an accessibility service or device "
         "administrator rights, both restricted by Play Store policy. If asked why "
         "we did not implement app blocking, the answer is that it is not a matter "
         "of effort, it is a platform restriction. Rather than let a student "
         "discover this by being let down, the app says so up front.")

# ============================================== SLIDE 12 — OFFLINE-FIRST

s = new_slide("Offline-First Architecture", "The local database is authoritative")
y = body_top()

text(s, M, y, CONTENT_W, 0.34,
     "“Offline-first” here does not mean “caches data for offline viewing”. It "
     "means the local database is the source of truth and the network is optional.",
     size=14, color=SECONDARY, spacing=1.2)

y2 = y + 0.62
rect(s, M, y2, 5.6, 2.5, fill=RGBColor(0xFF, 0xFB, 0xEB), line=RGBColor(0xFC, 0xD3, 0x4D))
pill(s, M + 0.26, y2 + 0.2, 1.28, 0.3, "OFFLINE", AMBER)
for i, t in enumerate(["Student ticks a topic",
                       "Write to local SQLite   ·   syncStatus = 'pending'",
                       "Progress updates immediately"]):
    yy = y2 + 0.62 + i * 0.62
    block(s, M + 0.26, yy, 5.08, 0.5, t, fill=WHITE, text_color=INK, size=11.5,
          line=BORDER)
    if i < 2:
        arrow(s, M + 2.72, yy + 0.51, 0.14, 0.10, color=BORDER, direction="down")

x2 = M + 5.86
rect(s, x2, y2, CONTENT_W - 5.86, 2.5, fill=RGBColor(0xEC, 0xFD, 0xF5),
     line=RGBColor(0x6E, 0xE7, 0xB7))
pill(s, x2 + 0.26, y2 + 0.2, 2.5, 0.3, "CONNECTIVITY RETURNS", GREEN)
for i, t in enumerate(["PULL rows changed since watermark",
                       "MERGE conflicts deterministically",
                       "PUSH rows marked pending"]):
    yy = y2 + 0.62 + i * 0.62
    block(s, x2 + 0.26, yy, CONTENT_W - 5.86 - 0.52, 0.5, t, fill=WHITE,
          text_color=INK, size=11.5, line=BORDER)
    if i < 2:
        arrow(s, x2 + 2.72, yy + 0.51, 0.14, 0.10, color=BORDER, direction="down")

y3 = y2 + 2.74
props = [
    ("Client-generated UUIDv7 ids",
     "A row created offline has its final identity at once — so it arrives as a "
     "conflict, not a duplicate.", ACCENT),
    ("Tombstones, never hard deletes",
     "A deleted row is marked, not removed. Otherwise the next pull cannot tell "
     "“deleted here” from “not yet seen” and resurrects it.", PURPLE),
    ("Server-side watermark",
     "The next pull resumes from the server's clock. A fast device clock would "
     "otherwise bookmark the future and skip rows forever.", GREEN),
]
cw = (CONTENT_W - 2 * 0.24) / 3
for i, (t, b, c) in enumerate(props):
    card(s, M + i * (cw + 0.24), y3, cw, 1.38, t, [b], accent=c, title_size=12,
         body_size=10.5)

notes(s, "Offline-first is a precise claim, so let us be precise. The local "
         "SQLite database is authoritative — writes complete there regardless of "
         "network state. Three design properties make this work, each addressing "
         "a specific failure mode. Client-generated ids mean an offline row is "
         "recognised as the same row, not a duplicate. Tombstones mean deletions "
         "survive a sync. And taking the watermark from the server's clock "
         "prevents a device with a fast clock silently skipping rows forever.")

# ============================================== SLIDE 13 — SYNC & CONFLICTS

s = new_slide("Synchronisation and Conflict Resolution", "Deterministic, and the same on every device")
y = body_top()

seq = [("PULL", "remote rows since watermark", ACCENT),
       ("MERGE", "resolve conflicts", PURPLE),
       ("PUSH", "send agreed version", GREEN)]
for i, (t, sub, c) in enumerate(seq):
    x = M + i * 2.62
    block(s, x, y, 2.34, 0.78, t, sub, fill=c, size=14, sub_size=9.5)
    if i < 2:
        arrow(s, x + 2.38, y + 0.30, 0.2, 0.18, color=BORDER, direction="right")

text(s, M, y + 0.94, 7.6, 0.5,
     "Pulling before pushing is deliberate: pushing first would overwrite the "
     "server with a local row that has not been reconciled, destroying changes "
     "made elsewhere.",
     size=11, color=MUTED, spacing=1.2, italic=True)

y2 = y + 1.62
rules = [
    ("1", "A tombstone wins", "Deletion is sticky. Resurrecting something a "
     "student deleted is worse than losing an edit to it.", RED),
    ("2", "Completion resolves on its own timestamp", "So renaming a topic on "
     "one device cannot revert a tick made on another.", GREEN),
    ("3", "A tie on completion resolves to completed", "Silently un-ticking "
     "finished work is the failure a student would never forgive.", ACCENT),
    ("4", "Everything else is last-write-wins", "On updatedAt, with the local "
     "copy winning an exact tie so a device never churns its own rows.", PURPLE),
]
cw = (CONTENT_W - 0.26) / 2
for i, (n, t, b, c) in enumerate(rules):
    x = M + (i % 2) * (cw + 0.26)
    yy = y2 + (i // 2) * 1.24
    rect(s, x, yy, cw, 1.08, fill=WHITE, line=BORDER)
    circ = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x + 0.22), Inches(yy + 0.22),
                              Inches(0.36), Inches(0.36))
    circ.fill.solid(); circ.fill.fore_color.rgb = c; circ.line.fill.background()
    circ.shadow.inherit = False
    tf = _tf(circ); tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = n; r.font.size = Pt(12); r.font.bold = True
    r.font.name = F_BODY; r.font.color.rgb = WHITE
    text(s, x + 0.7, yy + 0.20, cw - 0.9, 0.28, t, size=12.5, bold=True, color=INK)
    text(s, x + 0.7, yy + 0.52, cw - 0.9, 0.46, b, size=10.5, color=SECONDARY,
         spacing=1.16)

y3 = y2 + 2.56
rect(s, M, y3, CONTENT_W, 0.66, fill=SURFACE, line=BORDER)
text(s, M + 0.3, y3 + 0.17, CONTENT_W - 0.6, 0.36,
     "Eight tables synchronise. Preferences deliberately do not — a theme choice "
     "belongs to a device, not to an account.",
     size=11.5, color=SECONDARY)

notes(s, "Synchronisation runs pull, merge, then push — the order matters. Four "
         "conflict rules applied identically on every device. Rule two is the "
         "subtle one: topics carry a separate completedChangedAt column so "
         "completion resolves independently of the rest of the row. Without it, "
         "renaming a topic on your tablet would silently revert a tick made on "
         "your phone. Rule three settles genuine ties in favour of completed, "
         "because un-ticking finished work is the error a student would never "
         "forgive.")

# ============================================== SLIDE 14 — AI INTEGRATION & SAFETY

s = new_slide("AI Integration and Safety", "The client never holds the Gemini key")
y = body_top()

nodes = [
    ("PrepPilot Client", "React Native", ACCENT),
    ("Supabase Edge Function", "ask-gemini · Deno", PURPLE),
    ("Google Gemini API", "gemini-3.6-flash", GREEN),
]
bw = 3.42
for i, (t, sub, c) in enumerate(nodes):
    x = M + i * (bw + 0.72)
    block(s, x, y, bw, 0.9, t, sub, fill=c, size=13, sub_size=9.5)
    if i < 2:
        arrow(s, x + bw + 0.12, y + 0.33, 0.48, 0.24, color=BORDER, direction="right")
text(s, M + bw + 0.06, y + 0.96, 0.82, 0.3, "JWT", size=9, bold=True,
     color=MUTED, align=PP_ALIGN.CENTER)
text(s, M + 2 * bw + 0.78, y + 0.96, 0.8, 0.3, "API key", size=9, bold=True,
     color=MUTED, align=PP_ALIGN.CENTER)

y2 = y + 1.38
rect(s, M, y2, CONTENT_W, 0.62, fill=RGBColor(0xEC, 0xFD, 0xF5),
     line=RGBColor(0x6E, 0xE7, 0xB7))
text(s, M + 0.3, y2 + 0.15, CONTENT_W - 0.6, 0.34,
     "The Gemini key is read from a Supabase secret inside the Edge Function and "
     "never returned to a client. No key appears anywhere in the app bundle.",
     size=12, bold=True, color=RGBColor(0x06, 0x5F, 0x46))

y3 = y2 + 0.82
rect(s, M, y3, 5.9, 2.28, fill=VU_DARK, line=None)
text(s, M + 0.3, y3 + 0.2, 5.3, 0.28, "THE PROPOSAL GRAMMAR", size=9.5, bold=True,
     color=CYAN, caps=True)
text(s, M + 0.3, y3 + 0.56, 5.3, 0.3, "Exactly two verbs exist:", size=11.5,
     color=RGBColor(0x9B, 0xA7, 0xB4))
for i, verb in enumerate(["addChapters", "addTopics"]):
    text(s, M + 0.5, y3 + 0.90 + i * 0.32, 3.0, 0.3, "•  " + verb, size=12.5,
         color=WHITE, font=F_MONO, bold=True)
text(s, M + 0.3, y3 + 1.60, 5.3, 0.56,
     "There is no verb for deleting, completing, renaming or reordering. Such a "
     "request cannot be represented — so it cannot be applied.",
     size=10.5, color=RGBColor(0x9B, 0xA7, 0xB4), spacing=1.18)

x2 = M + 6.16
steps = [("AI Proposal", PURPLE), ("User Review", ACCENT),
         ("Confirmation", AMBER), ("Apply", GREEN)]
text(s, x2, y3, CONTENT_W - (x2 - M), 0.26, "PROPOSE → REVIEW → CONFIRM → APPLY",
     size=9.5, bold=True, color=VU_CORAL, caps=True)
sw = (CONTENT_W - (x2 - M) - 3 * 0.14) / 4
for i, (t, c) in enumerate(steps):
    block(s, x2 + i * (sw + 0.14), y3 + 0.34, sw, 0.5, t, fill=c, size=10)

guards = [
    ("Structural, not a prompt instruction",
     "Safety comes from the program's shape, not from asking the model nicely.", GREEN),
    ("Model output is untrusted input",
     "Names from the model are validated exactly as typed input is.", ACCENT),
    ("Rate limited · thinking capped",
     "20 requests per hour per account; reasoning capped at 512 tokens.", AMBER),
]
gw = CONTENT_W - (x2 - M)
for i, (t, b, c) in enumerate(guards):
    yy = y3 + 0.98 + i * 0.44
    rect(s, x2, yy, gw, 0.40, fill=WHITE, line=BORDER)
    bar = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x2 + 0.16),
                             Inches(yy + 0.09), Inches(0.05), Inches(0.22))
    bar.fill.solid(); bar.fill.fore_color.rgb = c; bar.line.fill.background()
    bar.shadow.inherit = False
    box = s.shapes.add_textbox(Inches(x2 + 0.32), Inches(yy + 0.045),
                               Inches(gw - 0.46), Inches(0.32))
    tf = _tf(box)
    para = tf.paragraphs[0]
    para.line_spacing = 1.08
    r1 = para.add_run(); r1.text = t + "  "
    r1.font.size = Pt(9.5); r1.font.bold = True; r1.font.name = F_BODY
    r1.font.color.rgb = INK
    r2 = para.add_run(); r2.text = b
    r2.font.size = Pt(8.5); r2.font.name = F_BODY; r2.font.color.rgb = SECONDARY

notes(s, "Two things on one slide: how the AI is reached, and what stops it "
         "wrecking a syllabus. The client never talks to Gemini directly — if we "
         "had put the key in the app, anyone who downloaded the APK could extract "
         "it and spend our quota. On safety, the answer is not that we asked the "
         "model nicely. A reply is parsed into an inert proposal, and the grammar "
         "admits exactly two verbs — add chapters and add topics. A request to "
         "delete or complete something cannot even be represented in our data "
         "structure, so it cannot be applied.")

# ============================================== SLIDE 15 — ARCHITECTURE & DATA

s = new_slide("System Architecture and Data Model", "Layered client, managed cloud backend")
y = body_top()

rect(s, M, y, 6.2, 3.62, fill=SURFACE, line=BORDER)
text(s, M + 0.26, y + 0.16, 5.0, 0.28, "MOBILE CLIENT — REACT NATIVE / EXPO",
     size=9.5, bold=True, color=VU_CORAL, caps=True)
layers = [
    ("Presentation", "Expo Router screens · design system", ACCENT),
    ("State", "Zustand stores, one per feature", PURPLE),
    ("Domain — packages/shared", "progress · timer · merge · AI parsing", CYAN),
    ("Repository", "typed data access", AMBER),
    ("SQLite via Drizzle ORM", "expo-sqlite on device · sql.js in browser", GREEN),
]
for i, (t, sub, c) in enumerate(layers):
    yy = y + 0.52 + i * 0.60
    block(s, M + 0.26, yy, 5.68, 0.5, t, sub, fill=WHITE, text_color=INK,
          size=11.5, sub_size=8, line=BORDER)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(M + 0.26), Inches(yy),
                             Inches(0.055), Inches(0.5))
    bar.fill.solid(); bar.fill.fore_color.rgb = c; bar.line.fill.background()
    bar.shadow.inherit = False

x2 = M + 6.56
rect(s, x2, y, CONTENT_W - 6.56, 1.92, fill=RGBColor(0xEC, 0xFD, 0xF5),
     line=RGBColor(0x6E, 0xE7, 0xB7))
text(s, x2 + 0.26, y + 0.16, 4.0, 0.28, "SUPABASE — BACKEND PLATFORM",
     size=9.5, bold=True, color=RGBColor(0x06, 0x5F, 0x46), caps=True)
for i, (t, sub) in enumerate([("Supabase Auth", "email · Google · phone OTP"),
                              ("PostgreSQL", "Row Level Security on every table"),
                              ("Edge Functions", "ask-gemini · delete-account")]):
    yy = y + 0.52 + i * 0.46
    block(s, x2 + 0.26, yy, CONTENT_W - 6.56 - 0.52, 0.38, t, sub, fill=WHITE,
          text_color=INK, size=10.5, sub_size=7.5, line=BORDER)

arrow(s, M + 6.16, y + 2.90, 0.32, 0.18, color=GREEN, direction="leftright")
text(s, M + 5.28, y + 2.62, 1.15, 0.24, "sync engine", size=8, color=MUTED,
     align=PP_ALIGN.CENTER)

y2 = y + 2.10
text(s, x2, y2, CONTENT_W - (x2 - M), 0.26, "NINE LOCAL TABLES, EIGHT SYNCHRONISED",
     size=9.5, bold=True, color=VU_CORAL, caps=True)
tables = ["trackers", "subjects", "chapters", "topics", "subtopics",
          "flashcards", "study_sessions", "reminders", "preferences"]
tw = (CONTENT_W - (x2 - M) - 2 * 0.12) / 3
for i, t in enumerate(tables):
    x = x2 + (i % 3) * (tw + 0.12)
    yy = y2 + 0.34 + (i // 3) * 0.42
    synced = t != "preferences"
    rect(s, x, yy, tw, 0.34, fill=WHITE if synced else SURFACE2, line=BORDER)
    text(s, x + 0.12, yy + 0.07, tw - 0.24, 0.22, t, size=8.5, bold=True,
         color=INK if synced else MUTED, font=F_MONO)

y3 = y + 3.80
rect(s, M, y3, CONTENT_W, 0.74, fill=SURFACE, line=BORDER)
text(s, M + 0.3, y3 + 0.16, CONTENT_W - 0.6, 0.46,
     "Soft references: study sessions and flashcards carry no foreign key to the "
     "syllabus — only ids plus a name snapshot. Deleting a subject must not shrink "
     "“total time studied”; the student really did spend that time.",
     size=11, color=SECONDARY, spacing=1.18)

notes(s, "Five client layers, each with one job. The domain layer in "
         "packages/shared is deliberately free of React Native imports, which "
         "means identical code runs in the Android app, the browser build and the "
         "test suite — so they cannot disagree about a percentage. Supabase is our "
         "backend; there is no Node server anywhere. Nine tables locally, eight "
         "synchronised; preferences stays on the device. The panel at the bottom "
         "is a decision worth defending: sessions and flashcards have no foreign "
         "key to the syllabus, because deleting a subject would otherwise shrink "
         "your total study time — and you really did spend those hours.")

# ============================================== SLIDE 16 — AUTH & SECURITY

s = new_slide("Authentication and Security", "Isolation enforced at the database")
y = body_top()

methods = [("Email + password", "Implemented", GREEN),
           ("Google OAuth", "PKCE via system browser", GREEN),
           ("Phone OTP", "Behind a feature flag", AMBER),
           ("Guest mode", "Local only; no AI", ACCENT)]
cw = (CONTENT_W - 3 * 0.22) / 4
for i, (t, sub, c) in enumerate(methods):
    x = M + i * (cw + 0.22)
    rect(s, x, y, cw, 0.86, fill=WHITE, line=BORDER)
    text(s, x + 0.22, y + 0.14, cw - 0.4, 0.28, t, size=12, bold=True, color=INK)
    text(s, x + 0.22, y + 0.46, cw - 0.4, 0.26, sub, size=9.5, color=c, bold=True)

y2 = y + 1.10
rect(s, M, y2, 6.2, 2.42, fill=VU_DARK, line=None)
text(s, M + 0.28, y2 + 0.2, 5.6, 0.28, "ROW LEVEL SECURITY", size=9.5, bold=True,
     color=CYAN, caps=True)
for i, r in enumerate([
        "Enabled AND forced on every table — forcing applies policies to the owner too",
        "Policies for select, insert and update, each scoped to auth.uid()",
        "No delete policy anywhere — deletion is by tombstone, enforced at the database"]):
    yy = y2 + 0.58 + i * 0.56
    d = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(M + 0.3), Inches(yy + 0.08),
                           Inches(0.09), Inches(0.09))
    d.fill.solid(); d.fill.fore_color.rgb = CYAN; d.line.fill.background()
    d.shadow.inherit = False
    text(s, M + 0.52, yy - 0.02, 5.4, 0.5, r, size=11, color=WHITE, spacing=1.18)

x2 = M + 6.46
secrets = [
    ("Supabase anon key", "In the bundle — correct. Publishable and bounded "
     "entirely by RLS.", GREEN),
    ("Service-role key", "Server-side only, inside the delete-account Edge "
     "Function.", RED),
    ("Gemini API key", "Server-side only, read from a Supabase secret.", RED),
]
for i, (t, b, c) in enumerate(secrets):
    card(s, x2, y2 + i * 0.82, CONTENT_W - (x2 - M), 0.72, t, [b], accent=c,
         title_size=11.5, body_size=9.5)

y3 = y2 + 2.62
rect(s, M, y3, CONTENT_W, 0.7, fill=RGBColor(0xFE, 0xF2, 0xF2),
     line=RGBColor(0xFC, 0xA5, 0xA5))
text(s, M + 0.3, y3 + 0.19, CONTENT_W - 0.6, 0.36,
     "Known limitation: the local SQLite database is not encrypted, and the AI "
     "rate limit is in-memory per instance rather than a durable quota.",
     size=11.5, color=RGBColor(0x99, 0x1B, 0x1B))

notes(s, "Four sign-in methods. The security model rests on row-level security: "
         "enabled and forced on every table — forcing matters, because without it "
         "the policies do not apply to the table owner. Note the third bullet: "
         "there is deliberately no delete policy anywhere. Deletion happens by "
         "tombstone, and the absence of that policy enforces it at the database "
         "rather than trusting client code. The anon key being in the bundle is "
         "correct and intentional; its power is bounded by RLS.")

# ============================================== SLIDE 17 — TECHNOLOGY STACK

s = new_slide("Technology Stack", "As built, with versions")
y = body_top()

cols = [
    ("Language & Frontend", [
        ("TypeScript", "strict, everywhere"),
        ("React Native 0.86", "Android primary"),
        ("Expo SDK 57", "runtime & build"),
        ("Expo Router", "file-based routing"),
        ("Zustand 5", "state management"),
        ("NativeWind", "styling"),
    ], ACCENT),
    ("Data Layer", [
        ("SQLite", "expo-sqlite on device"),
        ("sql.js (WASM)", "in the browser"),
        ("Drizzle ORM 0.45", "typed schema & queries"),
        ("PostgreSQL", "cloud, with RLS"),
    ], GREEN),
    ("Backend & AI", [
        ("Supabase", "the backend platform"),
        ("Supabase Auth", "authentication"),
        ("Edge Functions", "Deno runtime"),
        ("Google Gemini", "gemini-3.6-flash"),
    ], PURPLE),
    ("Build & Tooling", [
        ("EAS Build", "Android APK"),
        ("GitHub Actions", "CI on every PR"),
        ("Jest · Vitest · Deno", "test runners"),
        ("Node.js 22 · pnpm", "toolchain only"),
    ], AMBER),
]
cw = (CONTENT_W - 3 * 0.24) / 4
for i, (head, items, c) in enumerate(cols):
    x = M + i * (cw + 0.24)
    rect(s, x, y, cw, 3.5, fill=WHITE, line=BORDER)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y),
                             Inches(cw), Inches(0.055))
    bar.fill.solid(); bar.fill.fore_color.rgb = c; bar.line.fill.background()
    bar.shadow.inherit = False
    text(s, x + 0.22, y + 0.24, cw - 0.44, 0.28, head, size=12, bold=True, color=INK)
    for j, (t, d) in enumerate(items):
        yy = y + 0.66 + j * 0.46
        text(s, x + 0.22, yy, cw - 0.44, 0.24, t, size=10.5, bold=True, color=SECONDARY)
        text(s, x + 0.22, yy + 0.20, cw - 0.44, 0.22, d, size=8.5, color=MUTED)

y2 = y + 3.74
rect(s, M, y2, CONTENT_W, 0.78, fill=RGBColor(0xFF, 0xFB, 0xEB),
     line=RGBColor(0xFC, 0xD3, 0x4D))
text(s, M + 0.3, y2 + 0.16, CONTENT_W - 0.6, 0.5,
     "Terminology: Node.js is our development toolchain — it runs the bundler, "
     "the test runners and the formatter. It is not this project's backend; there "
     "is no Node server in the repository. Supabase is the backend.",
     size=11.5, color=RGBColor(0x78, 0x35, 0x0F), spacing=1.18)

notes(s, "The stack as actually built, with versions from our package manifests. "
         "The note at the bottom pre-empts a common question. It is easy to list "
         "Node.js as a backend; in our case that would be wrong. Node runs our "
         "bundler, test runners and formatter, but there is no Node server "
         "anywhere in the repository. Our backend is Supabase.")

# ============================================== SLIDE 18 — TESTING

s = new_slide("Testing and Validation", "Evidence that it works")
y = body_top()

stats = [("1,799", "tests passing", ACCENT), ("80", "test suites", PURPLE),
         ("6", "CI stages per change", GREEN), ("2", "bundle builds verified", AMBER)]
cw = (CONTENT_W - 3 * 0.24) / 4
for i, (n, l, c) in enumerate(stats):
    x = M + i * (cw + 0.24)
    rect(s, x, y, cw, 1.12, fill=WHITE, line=BORDER)
    text(s, x + 0.24, y + 0.16, cw - 0.48, 0.52, n, size=30, bold=True, color=c,
         font=F_HEAD)
    text(s, x + 0.24, y + 0.72, cw - 0.48, 0.28, l, size=11, color=SECONDARY)

y2 = y + 1.4
rect(s, M, y2, 6.1, 2.4, fill=SURFACE, line=BORDER)
text(s, M + 0.28, y2 + 0.18, 5.6, 0.26, "TEST BREAKDOWN", size=9.5, bold=True,
     color=VU_CORAL, caps=True)
for i, (a, b, c) in enumerate([("packages/shared", "15 suites", "512 tests"),
                               ("apps/mobile", "65 suites", "1,287 tests"),
                               ("Total", "80 suites", "1,799 tests")]):
    yy = y2 + 0.58 + i * 0.52
    bold = i == 2
    if bold:
        rect(s, M + 0.2, yy - 0.06, 5.7, 0.46, fill=WHITE, line=BORDER, radius=0.06)
    text(s, M + 0.32, yy, 2.4, 0.3, a, size=11.5, bold=bold, color=INK, font=F_MONO)
    text(s, M + 3.0, yy, 1.3, 0.3, b, size=11.5, bold=bold, color=SECONDARY)
    text(s, M + 4.4, yy, 1.5, 0.3, c, size=11.5, bold=bold,
         color=GREEN if bold else SECONDARY)
text(s, M + 0.28, y2 + 2.08, 5.6, 0.26,
     "Measured by running the suite from a clean install.", size=9.5, color=MUTED,
     italic=True)

x2 = M + 6.36
text(s, x2, y2 + 0.02, 5.0, 0.26, "CI RUNS ON EVERY CHANGE", size=9.5, bold=True,
     color=VU_CORAL, caps=True)
ci = ["Formatting check", "Type-check every package",
      "Full suite with coverage thresholds", "Deno tests for the Edge Functions",
      "Android bundle build", "Web bundle build"]
for i, item in enumerate(ci):
    yy = y2 + 0.36 + i * 0.37
    n = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x2), Inches(yy + 0.02),
                           Inches(0.26), Inches(0.26))
    n.fill.solid(); n.fill.fore_color.rgb = GREEN; n.line.fill.background()
    n.shadow.inherit = False
    tf = _tf(n); tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = str(i + 1); r.font.size = Pt(9); r.font.bold = True
    r.font.name = F_BODY; r.font.color.rgb = WHITE
    text(s, x2 + 0.4, yy + 0.03, 4.6, 0.3, item, size=11.5, color=SECONDARY)

y3 = y2 + 2.6
rect(s, M, y3, CONTENT_W, 0.62, fill=RGBColor(0xEC, 0xFD, 0xF5),
     line=RGBColor(0x6E, 0xE7, 0xB7))
text(s, M + 0.3, y3 + 0.15, CONTENT_W - 0.6, 0.34,
     "The Android APK has been built via EAS and tested on a physical device. "
     "Supabase and the deployed AI function are live.",
     size=11.5, bold=True, color=RGBColor(0x06, 0x5F, 0x46))

notes(s, "Our evidence base. Seventeen hundred and ninety-nine tests across "
         "eighty suites, all passing — measured, not estimated: we ran the suite "
         "from a clean install while preparing this presentation. CI runs six "
         "stages on every change. Two are worth explaining: we build the Android "
         "and web bundles in CI, because a green test suite does not prove the app "
         "still bundles through a pnpm workspace — a failure mode we hit and now "
         "guard against.")

# ============================================== SLIDE 19 — LIMITATIONS & FUTURE

s = new_slide("Limitations and Future Scope", "What it does not do, and what comes next")
y = body_top()

text(s, M, y, 6.1, 0.28, "LIMITATIONS — STATED PLAINLY", size=9.5, bold=True,
     color=RED, caps=True)
lims = [
    ("Platform restrictions", "Focus Mode cannot block other apps · Do Not "
     "Disturb is not toggled · web reminders stop when the tab closes", RED),
    ("Implementation gaps", "Flashcards use fixed intervals, not adaptive SM-2 · "
     "reordering is menu-based · the local database is not encrypted", AMBER),
    ("Scope and verification", "Sign-in is required before first offline use · "
     "device testing is not systematic across Android versions · iOS is untested",
     PURPLE),
]
for i, (t, b, c) in enumerate(lims):
    card(s, M, y + 0.36 + i * 1.14, 6.1, 1.02, t, [b], accent=c, title_size=12,
         body_size=10)

x2 = M + 6.36
text(s, x2, y, CONTENT_W - (x2 - M), 0.28, "FUTURE SCOPE", size=9.5, bold=True,
     color=GREEN, caps=True)
fut = [
    ("Adaptive review scheduling", "Wire the existing, tested SM-2 "
     "implementation to the review screen — the history it needs is already "
     "recorded.", GREEN),
    ("Drag-and-drop reordering", "The repositories already support arbitrary "
     "reordering; only the gesture layer is missing.", ACCENT),
    ("Encryption, iOS and device matrix", "SQLCipher for data at rest, an iOS "
     "release, and systematic testing across Android versions.", CYAN),
]
for i, (t, b, c) in enumerate(fut):
    card(s, x2, y + 0.36 + i * 1.14, CONTENT_W - (x2 - M), 1.02, t, [b], accent=c,
         title_size=12, body_size=10)

y2 = y + 3.86
rect(s, M, y2, CONTENT_W, 0.72, fill=VU_DARK, line=None)
text(s, M + 0.3, y2 + 0.19, CONTENT_W - 0.6, 0.38,
     "Every limitation is documented in docs/developer/LIMITATIONS.md, and the "
     "platform restrictions are stated inside the application itself.",
     size=12, color=WHITE)

notes(s, "We would rather present this ourselves than have it discovered in "
         "questioning. On the left, three categories. The first are platform "
         "restrictions — not things we ran out of time for, but things Android "
         "does not permit. The second are genuine gaps we would close with more "
         "time. The third is scope. On the right, our near-term work is "
         "deliberately unglamorous because the groundwork is already in place: "
         "the SM-2 implementation exists and is tested, so switching is a small, "
         "safe change rather than a rewrite.")

# ============================================== SLIDE 20 — CONCLUSION

s = new_slide("Conclusion", "What PrepPilot demonstrates")
y = body_top()

text(s, M, y, CONTENT_W, 0.4,
     "PrepPilot demonstrates that a student-facing application can be both "
     "technically rigorous and honest about its own limits.",
     size=16.5, color=INK, spacing=1.24)

y2 = y + 0.66
contribs = [
    ("Offline-first, genuinely", "The local database is authoritative — made "
     "workable by client-generated ids, tombstone deletion and a server-side "
     "watermark, each addressing a specific failure mode.", ACCENT),
    ("Measurement that does not flatter", "Topic-weighted rather than averaged, "
     "unmeasured rather than zero, and rounded honestly.", GREEN),
    ("AI safety that is structural", "The proposal grammar has no verb for "
     "destruction, so unsafe operations are not discouraged — they are "
     "inexpressible.", PURPLE),
]
cw = (CONTENT_W - 2 * 0.26) / 3
for i, (t, b, c) in enumerate(contribs):
    card(s, M + i * (cw + 0.26), y2, cw, 1.72, t, [b], accent=c, title_size=13,
         body_size=10.5)

y3 = y2 + 1.94
rect(s, M, y3, CONTENT_W, 1.1, fill=VU_DARK, line=None)
text(s, M + 0.34, y3 + 0.18, CONTENT_W - 0.68, 0.26, "AND WHAT IT DECLINES TO CLAIM",
     size=9.5, bold=True, color=CYAN, caps=True)
text(s, M + 0.34, y3 + 0.48, CONTENT_W - 0.68, 0.54,
     "Focus Mode does not pretend to block apps it cannot block. Web reminders "
     "say they will stop when the tab closes. The flashcard scheduler is "
     "described as what it is.",
     size=12.5, color=WHITE, spacing=1.2)

y4 = y3 + 1.30
text(s, M, y4, 6.0, 0.42, "Thank You", size=26, bold=True, color=VU_DARK,
     font=F_HEAD)
text(s, M, y4 + 0.46, 6.0, 0.26, "Questions are welcome", size=12, color=SECONDARY)

text(s, 6.9, y4 + 0.02, 5.8, 0.26,
     "Archit Jain  ·  Vanshika Rajput  ·  Lavi Chaudhary  ·  Jasmine Chaudhary",
     size=10.5, bold=True, color=INK, align=PP_ALIGN.RIGHT)
text(s, 6.9, y4 + 0.28, 5.8, 0.24, "Guided by Ms. Kareena", size=10,
     color=SECONDARY, align=PP_ALIGN.RIGHT)
text(s, 6.9, y4 + 0.52, 5.8, 0.24,
     "Vidya University, Meerut  ·  12 September 2026", size=10, color=MUTED,
     align=PP_ALIGN.RIGHT)

notes(s, "To conclude. Three technical contributions: a genuinely offline-first "
         "architecture, a progress model that refuses to flatter the user, and an "
         "AI integration whose safety is structural rather than advisory. Equally "
         "deliberate is what we decline to claim — a student planning months of "
         "preparation around a tool needs that tool to be accurate about itself. "
         "Thank you; we are happy to take questions.")

# --------------------------------------------------------------------- save

os.makedirs(os.path.dirname(OUT), exist_ok=True)
prs.save(OUT)
print(f"Saved: {OUT}")
print(f"Slides: {len(prs.slides._sldIdLst)}")
