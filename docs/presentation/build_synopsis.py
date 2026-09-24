"""
Renders the PrepPilot synopsis to .docx and .md from one source of content.

Typography follows the university's SPECIFICATIONS FOR SYNOPSIS exactly:
  Times New Roman, 12 pt body, British English, A4
  Headings 14 pt bold, sub-headings 12 pt normal
  One side only, double spaced
  Margins: left 3.5 cm, top 2.5 cm, right 1.25 cm, bottom 1.25 cm
  Figure captions BELOW the figure; table captions ABOVE the table
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Resolved from this file, so the script runs from any directory on any OS.
DOCS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn

from synopsis_content import (TITLE, TEAM, GUIDE, BRANCH, BLANK,
                              DETAILS_ROWS, TOC_ROWS, BODY)

DOCX_OUT = f"{DOCS}/PrepPilot_Synopsis.docx"
MD_OUT = f"{DOCS}/SYNOPSIS.md"
BRANDING = f"{DOCS}/assets/branding"
DIAGRAMS = f"{DOCS}/assets/diagrams"

BODY_PT, HEAD_PT, FONT = 12, 14, "Times New Roman"
C = WD_ALIGN_PARAGRAPH.CENTER

# ================================================================ DOCX

doc = Document()

for section in doc.sections:
    section.page_width, section.page_height = Cm(21.0), Cm(29.7)
    section.left_margin = Cm(3.5)
    section.top_margin = Cm(2.5)
    section.right_margin = Cm(1.25)
    section.bottom_margin = Cm(1.25)

normal = doc.styles["Normal"]
normal.font.name = FONT
normal.font.size = Pt(BODY_PT)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
normal.paragraph_format.space_after = Pt(0)


def rf(run, size=BODY_PT, bold=False, italic=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    return run


def para(text="", size=BODY_PT, bold=False, align=None, spacing="double",
         after=0, before=0, italic=False):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    f = p.paragraph_format
    f.line_spacing_rule = {"double": WD_LINE_SPACING.DOUBLE,
                           "single": WD_LINE_SPACING.SINGLE}[spacing]
    f.space_after, f.space_before = Pt(after), Pt(before)
    if text:
        rf(p.add_run(text), size=size, bold=bold, italic=italic)
    return p


def simple_table(rows, widths=None):
    t = doc.add_table(rows=0, cols=len(rows[0]))
    t.style = "Table Grid"
    for r_i, row in enumerate(rows):
        cells = t.add_row().cells
        for c_i, val in enumerate(row):
            cells[c_i].text = ""
            p = cells[c_i].paragraphs[0]
            p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            rf(p.add_run(str(val)), size=11, bold=(r_i == 0))
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Cm(w)
    return t


# ---- title page (single spaced; it is a cover, not body text)

tp = doc.add_paragraph()
tp.alignment = C
tp.paragraph_format.space_after = Pt(6)
tp.add_run().add_picture(f"{BRANDING}/vidya-university-logo.png", width=Cm(6.5))


def tl(text, size=BODY_PT, bold=False, after=0, before=0):
    return para(text, size=size, bold=bold, align=C, spacing="single",
                after=after, before=before)


tl("A", size=14, after=2, before=4)
tl("Project Report", size=16, bold=True, after=2)
tl("on", size=14, after=6)
tl("PrepPilot — An Offline-First, AI-Assisted Study and", size=15, bold=True)
tl("Examination Preparation Platform", size=15, bold=True, after=12)
tl("Submitted in partial fulfillment of the requirements")
tl("for the award of the degree of", after=10)
tl("Bachelor of Technology", size=15, bold=True, after=2)
tl("in", size=13, after=2)
tl("Computer Science and Engineering", size=14, bold=True)
tl("(Artificial Intelligence and Machine Learning)", size=12, bold=True, after=12)
tl("by", size=13, after=6)
for name in TEAM:
    tl(f"{name}  (University Roll No. {BLANK})", after=2)
tl("", after=8)
tl("Under the Supervision of", size=13, after=4)
tl(GUIDE, size=15, bold=True, after=16)
tl("DEPARTMENT OF ENGINEERING", size=13, bold=True)
tl("FACULTY OF COMPUTER SCIENCE & ENGINEERING", size=13, bold=True)
tl("VIDYA UNIVERSITY, MEERUT", size=13, bold=True, after=6)
tl("Baghpat Road, Delhi-Meerut Bypass, Meerut U.P.", size=11)
tl("India-250002", size=11, after=14)
tl("September, 2026", size=13, bold=True)

doc.add_page_break()

# ---- student details + contents (table captions ABOVE, per the specification)

para("Student Details", size=HEAD_PT, bold=True, spacing="single", after=6)
para("Table 1: Candidate and project particulars", spacing="single", after=4, bold=True)
simple_table(DETAILS_ROWS, widths=[4.5, 11.0])

para("Table of Contents", size=HEAD_PT, bold=True, spacing="single",
     before=14, after=6)
para("Table 2: Contents", spacing="single", after=4, bold=True)
simple_table(TOC_ROWS, widths=[2.0, 10.5, 3.0])

# ---- body

for blk in BODY:
    kind = blk[0]
    if kind == "pb":
        doc.add_page_break()
    elif kind == "h1":
        para(blk[1], size=HEAD_PT, bold=True, spacing="single", before=10, after=6)
    elif kind == "h2":
        para(blk[1], size=BODY_PT, spacing="single", before=8, after=4)
    elif kind == "p":
        para(blk[1])
    elif kind == "bl":
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(6)
        rf(p.add_run(blk[1]), bold=True)
        rf(p.add_run(blk[2]))
    elif kind == "num":
        for item in blk[1]:
            p = doc.add_paragraph(style="List Number")
            p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
            p.paragraph_format.space_after = Pt(0)
            rf(p.add_run(item))
    elif kind == "refs":
        for item in blk[1]:
            p = doc.add_paragraph()
            p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.left_indent = Cm(1.0)
            p.paragraph_format.first_line_indent = Cm(-1.0)
            rf(p.add_run(item))
    elif kind == "fig":
        _, fname, caption, width = blk
        p = doc.add_paragraph()
        p.alignment = C
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(4)
        p.add_run().add_picture(f"{DIAGRAMS}/{fname}", width=Cm(width))
        # Caption BELOW the figure, as the specification requires.
        c = doc.add_paragraph()
        c.alignment = C
        c.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        c.paragraph_format.space_after = Pt(10)
        rf(c.add_run(caption), bold=True)

doc.save(DOCX_OUT)
print("Saved:", DOCX_OUT)

# ================================================================ MARKDOWN

md = []
md.append('<div align="center">\n')
md.append('<img src="assets/branding/vidya-university-logo.png" width="300" '
          'alt="Vidya University" />\n')
md.append("### A\n")
md.append("# Project Report\n")
md.append("### on\n")
md.append(f"# **{TITLE}**\n")
md.append("Submitted in partial fulfillment of the requirements\n")
md.append("for the award of the degree of\n")
md.append("## Bachelor of Technology\n")
md.append("### in\n")
md.append(f"### {BRANCH}\n")
md.append("**by**\n")
for name in TEAM:
    md.append(f"{name} (University Roll No. \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_)\n")
md.append("**Under the Supervision of**\n")
md.append(f"## {GUIDE}\n")
md.append("**DEPARTMENT OF ENGINEERING**\n")
md.append("**FACULTY OF COMPUTER SCIENCE & ENGINEERING**\n")
md.append("**VIDYA UNIVERSITY, MEERUT**\n")
md.append("Baghpat Road, Delhi-Meerut Bypass, Meerut U.P.\n")
md.append("India-250002\n")
md.append("**September, 2026**\n")
md.append("</div>\n")
md.append("\n---\n")


def md_table(rows):
    out = ["| " + " | ".join(str(c) for c in rows[0]) + " |",
           "| " + " | ".join([":---"] * len(rows[0])) + " |"]
    for r in rows[1:]:
        out.append("| " + " | ".join(str(c).replace("_", "\\_") for c in r) + " |")
    return "\n".join(out) + "\n"


md.append("\n## Student Details\n")
md.append("**Table 1: Candidate and project particulars**\n")
md.append(md_table(DETAILS_ROWS))
md.append("\n## Table of Contents\n")
md.append("**Table 2: Contents**\n")
md.append(md_table(TOC_ROWS))
md.append("\n---\n")

for blk in BODY:
    kind = blk[0]
    if kind == "pb":
        continue
    elif kind == "h1":
        md.append(f"\n# {blk[1]}\n")
    elif kind == "h2":
        md.append(f"\n### {blk[1]}\n")
    elif kind == "p":
        md.append(blk[1] + "\n")
    elif kind == "bl":
        md.append(f"**{blk[1]}**{blk[2]}\n")
    elif kind == "num":
        for i, item in enumerate(blk[1], 1):
            md.append(f"{i}. {item}")
        md.append("")
    elif kind == "refs":
        for item in blk[1]:
            md.append(item + "\n")
    elif kind == "fig":
        _, fname, caption, width = blk
        md.append(f'\n<div align="center">\n')
        md.append(f'<img src="assets/diagrams/{fname}" width="600" alt="{caption}" />\n')
        md.append(f"**{caption}**\n")
        md.append("</div>\n")

md.append("\n---\n")
md.append('<div align="center">\n')
md.append("**PrepPilot** · Department of Computer Science & Engineering\n")
md.append("**Vidya University, Meerut** · September 2026\n")
md.append("</div>\n")

with open(MD_OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(md))
print("Saved:", MD_OUT)
