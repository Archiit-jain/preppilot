"""
Build the PrepPilot Detailed Project Report (DPR) as Word and PDF.

    python docs/dpr/build_dpr.py

Writes docs/PrepPilot_DPR.docx and docs/PrepPilot_DPR.pdf. The PDF is made by
LibreOffice (`soffice`). The build runs twice: the first PDF is read back with
`pdftotext` to find the page each heading, figure and table landed on, and the
second build writes those page numbers into the contents lists.

Requires: pip install python-docx pillow; soffice and pdftotext on PATH.
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.dirname(HERE)
ASSETS = os.path.join(DOCS, "assets")
OUT_DOCX = os.path.join(DOCS, "PrepPilot_DPR.docx")
OUT_PDF = os.path.join(DOCS, "PrepPilot_DPR.pdf")

TITLE = "PrepPilot"
SUBTITLE = "An Offline-First, AI-Assisted Study and Examination Preparation Platform"
AUTHOR = "Archit Jain"
DATE = "October 2026"

BODY_FONT = "Times New Roman"
MONO_FONT = "Courier New"
ACCENT = RGBColor(0x1F, 0x4E, 0x9C)
GREY = RGBColor(0x55, 0x55, 0x55)

SHOT_W = Inches(1.5)  # four portrait phone screens per row
LAND_W = Inches(2.05)  # three landscape timer faces per row

REPO = "captured 24 Sep 2026"
WEB = "web demo, 6 Oct 2026"


def shot(rel):
    return os.path.join(ASSETS, "screenshots", rel)


def diagram(name):
    return os.path.join(ASSETS, "diagrams", name)


# --------------------------------------------------------------------------
# Document helpers
# --------------------------------------------------------------------------


class Report:
    def __init__(self, pages, header="PrepPilot — Detailed Project Report"):
        self.header = header
        self.pages = pages  # {"text to find": page number} from the previous pass
        self.doc = Document()
        self.chapter = 0
        self.fig = 0
        self.tab = 0
        self.toc = []  # (level, text)
        self.figures = []
        self.tables = []
        self._setup()

    # ---- page setup and styles
    def _setup(self):
        sec = self.doc.sections[0]
        sec.page_width, sec.page_height = Inches(8.27), Inches(11.69)  # A4
        sec.left_margin = Inches(1.1)
        sec.right_margin = Inches(0.9)
        sec.top_margin = sec.bottom_margin = Inches(0.9)
        sec.different_first_page_header_footer = True

        normal = self.doc.styles["Normal"]
        normal.font.name = BODY_FONT
        normal.font.size = Pt(11)
        normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
        pf = normal.paragraph_format
        pf.space_after = Pt(4)
        pf.line_spacing = 1.15

        for name, size in (("Heading 1", 15), ("Heading 2", 12.5), ("Heading 3", 11.5)):
            st = self.doc.styles[name]
            st.font.name = BODY_FONT
            st.font.size = Pt(size)
            st.font.bold = True
            st.font.color.rgb = RGBColor(0, 0, 0) if name != "Heading 1" else ACCENT
            rpr = st.element.get_or_add_rPr()
            rfonts = rpr.find(qn("w:rFonts"))
            if rfonts is None:
                rfonts = OxmlElement("w:rFonts")
                rpr.append(rfonts)
            for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
                rfonts.set(qn(attr), BODY_FONT)
            st.paragraph_format.space_before = Pt(16 if name == "Heading 1" else 8)
            st.paragraph_format.space_after = Pt(4)
            st.paragraph_format.keep_with_next = True

        # Footer: centred page number, not on the cover.
        p = sec.footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        self._field(p, "PAGE")
        hp = sec.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = hp.add_run(self.header)
        r.font.size = Pt(9)
        r.font.color.rgb = GREY

    @staticmethod
    def _field(paragraph, code):
        run = paragraph.add_run()
        for tag, text in (("begin", None), (None, code), ("separate", None), (None, "1"), ("end", None)):
            if tag:
                el = OxmlElement("w:fldChar")
                el.set(qn("w:fldCharType"), tag)
            elif text == code:
                el = OxmlElement("w:instrText")
                el.set(qn("xml:space"), "preserve")
                el.text = f" {code} "
            else:
                el = OxmlElement("w:t")
                el.text = text
            run._r.append(el)

    # ---- text
    def page_break(self):
        self.doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    def h1(self, text, numbered=True, new_page=False):
        if numbered:
            self.chapter += 1
            self.fig = 0
            self.tab = 0
            text = f"{self.chapter}. {text}"
        h = self.doc.add_heading(text, level=1)
        h.paragraph_format.page_break_before = new_page
        self.toc.append((1, text))
        self.sub = 0

    def h2(self, text):
        self.sub += 1
        label = f"{self.chapter}.{self.sub} {text}" if self.chapter else text
        self.doc.add_heading(label, level=2)
        self.toc.append((2, label))
        self.subsub = 0

    def h3(self, text):
        self.doc.add_heading(text, level=3)

    def para(self, text, align=WD_ALIGN_PARAGRAPH.JUSTIFY, size=None, italic=False):
        p = self.doc.add_paragraph()
        p.alignment = align
        self._rich(p, text, size=size, italic=italic)
        return p

    def _rich(self, p, text, size=None, italic=False):
        # **bold** and `code` inline markup
        for part in re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text):
            if not part:
                continue
            if part.startswith("**"):
                r = p.add_run(part[2:-2])
                r.bold = True
            elif part.startswith("`"):
                r = p.add_run(part[1:-1])
                r.font.name = MONO_FONT
                r.font.size = Pt(10.5)
            else:
                r = p.add_run(part)
            if size:
                r.font.size = Pt(size)
            if italic:
                r.italic = True

    def bullets(self, items, numbered=False):
        style = "List Number" if numbered else "List Bullet"
        for it in items:
            p = self.doc.add_paragraph(style=style)
            p.paragraph_format.space_after = Pt(3)
            self._rich(p, it)

    def code(self, text):
        t = self.doc.add_table(rows=1, cols=1)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = t.rows[0].cells[0]
        self._shade(cell, "F3F4F6")
        cell.paragraphs[0].text = ""
        lines = text.strip("\n").split("\n")
        for i, line in enumerate(lines):
            p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            r = p.add_run(line)
            r.font.name = MONO_FONT
            r.font.size = Pt(9)
        self.doc.add_paragraph()

    @staticmethod
    def _shade(cell, hex_fill):
        tcpr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), hex_fill)
        tcpr.append(shd)

    # ---- tables
    def table(self, caption, rows, widths=None, size=10):
        self.tab += 1
        label = f"Table {self.chapter}.{self.tab}: {caption}"
        self.tables.append(label)
        cp = self.doc.add_paragraph()
        cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cp.paragraph_format.keep_with_next = True
        r = cp.add_run(label)
        r.bold = True
        r.font.size = Pt(10.5)

        t = self.doc.add_table(rows=len(rows), cols=len(rows[0]))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, row in enumerate(rows):
            for j, val in enumerate(row):
                cell = t.rows[i].cells[j]
                cell.text = ""
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(1)
                p.paragraph_format.line_spacing = 1.05
                self._rich(p, str(val), size=size)
                if i == 0:
                    for run in p.runs:
                        run.bold = True
                    self._shade(cell, "DCE6F2")
                if widths:
                    cell.width = Inches(widths[j])
        if widths:
            self._fix_widths(t, widths)
        self.doc.add_paragraph()
        return t

    @staticmethod
    def _fix_widths(table, widths):
        table.autofit = False
        tbl = table._tbl
        grid = tbl.tblGrid
        for j, gc in enumerate(grid.findall(qn("w:gridCol"))):
            gc.set(qn("w:w"), str(int(widths[j] * 1440)))
        tbl_pr = tbl.tblPr
        tw = tbl_pr.find(qn("w:tblW"))
        if tw is None:
            tw = OxmlElement("w:tblW")
            tbl_pr.append(tw)
        tw.set(qn("w:w"), str(int(sum(widths) * 1440)))
        tw.set(qn("w:type"), "dxa")
        layout = OxmlElement("w:tblLayout")
        layout.set(qn("w:type"), "fixed")
        tbl_pr.append(layout)
        for row in table.rows:
            for j, cell in enumerate(row.cells):
                cell.width = Inches(widths[j])

    # ---- figures
    def _caption(self, caption, source=None):
        self.fig += 1
        label = f"Figure {self.chapter}.{self.fig}: {caption}"
        self.figures.append(label)
        return label + (f" ({source})" if source else "")

    def figure(self, path, caption, width=Inches(5.6), source=None):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.keep_with_next = True
        p.add_run().add_picture(path, width=width)
        c = self.doc.add_paragraph()
        c.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = c.add_run(self._caption(caption, source))
        r.italic = True
        r.font.size = Pt(10)

    def grid(self, items, cols=4, width=SHOT_W):
        """items: list of (path, caption, source). Laid out in a borderless table."""
        cols = min(cols, len(items))
        if self.doc.paragraphs:
            self.doc.paragraphs[-1].paragraph_format.keep_with_next = True
        for start in range(0, len(items), cols):
            chunk = items[start : start + cols]
            t = self.doc.add_table(rows=1, cols=cols)
            t.alignment = WD_TABLE_ALIGNMENT.CENTER
            self._no_borders(t)
            row = t.rows[0]
            self._keep_row(row)
            for j, (path, caption, source) in enumerate(chunk):
                cell = row.cells[j]
                pp = cell.paragraphs[0]
                pp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                pp.paragraph_format.space_after = Pt(2)
                pp.add_run().add_picture(path, width=width)
                cp = cell.add_paragraph()
                cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                cp.paragraph_format.line_spacing = 1.0
                r = cp.add_run(self._caption(caption))
                r.italic = True
                r.font.size = Pt(9)
                s = cp.add_run(f"\n{source}")
                s.font.size = Pt(8)
                s.font.color.rgb = GREY
            self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    @staticmethod
    def _no_borders(table):
        tbl_pr = table._tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            el = OxmlElement(f"w:{edge}")
            el.set(qn("w:val"), "nil")
            borders.append(el)
        tbl_pr.append(borders)

    @staticmethod
    def _keep_row(row):
        tr_pr = row._tr.get_or_add_trPr()
        cant = OxmlElement("w:cantSplit")
        tr_pr.append(cant)

    # ---- contents lists, filled from the previous pass's page numbers
    def contents_line(self, text, indent=0.0, bold=False, size=11.5):
        p = self.doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(indent)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.1
        p.paragraph_format.tab_stops.add_tab_stop(Inches(6.25), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        r = p.add_run(text)
        r.bold = bold
        r.font.size = Pt(size)
        page = self.pages.get(text, "")
        r2 = p.add_run(f"\t{page}")
        r2.font.size = Pt(size)
        r2.bold = bold

    def save(self, path):
        self.doc.save(path)


# --------------------------------------------------------------------------
# Content
# --------------------------------------------------------------------------


def build(pages, planned):
    """`planned` carries the headings, figures and tables of the previous pass so the
    contents pages can list them before the body that defines them is written."""
    R = Report(pages)
    d = R.doc

    # ---------------------------------------------------------- cover
    for _ in range(3):
        d.add_paragraph()
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(os.path.join(ASSETS, "branding", "preppilot-icon.png"), width=Inches(1.4))
    for text, size, bold, color in (
        ("DETAILED PROJECT REPORT", 14, True, GREY),
        (TITLE, 34, True, ACCENT),
        (SUBTITLE, 16, False, RGBColor(0x22, 0x22, 0x22)),
    ):
        p = d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(10)
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.bold = bold
        r.font.color.rgb = color
    for _ in range(8):
        d.add_paragraph()
    for text, size, bold in (("Prepared by", 12, False), (AUTHOR, 18, True), (DATE, 12, False)):
        p = d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.bold = bold

    # ---------------------------------------------------------- abstract
    R.h1("Abstract", numbered=False, new_page=True)
    R.para(
        "PrepPilot is a mobile application that helps a student organise an examination "
        "syllabus, record what has genuinely been completed, time their study and revise, "
        "with or without an internet connection. A syllabus is modelled as a hierarchy of "
        "Subject → Chapter → Topic → optional Sub-topic, and every other feature — study "
        "timers, flashcards, notes, quizzes, reminders and an AI assistant — is attached to "
        "that hierarchy rather than living in a separate tool."
    )
    R.para(
        "The application is offline-first: the SQLite database on the device is the source of "
        "truth, every read and write completes locally, and a synchronisation engine later "
        "reconciles the device with a Supabase (PostgreSQL) backend using client-generated "
        "UUIDv7 identifiers, tombstones and deterministic conflict rules. Progress is computed "
        "topic-weighted — a subject with one finished chapter of one topic and an unfinished "
        "chapter of ninety-nine topics is reported as 1% complete, not 50%. AI assistance is "
        "provided by Google Gemini through a server-side Edge Function, so the API key never "
        "reaches a device, and any syllabus change the assistant proposes must be reviewed and "
        "confirmed by the student before it is applied."
    )
    R.para(
        "The system is built with React Native and Expo in TypeScript, as a monorepo of about "
        "36,000 lines of non-test source. It is verified by an automated suite of 2,283 tests "
        "(2,231 executed for this report, all passing), has been built as an Android APK, and "
        "is also published as a browser demonstration. This report describes the problem, the "
        "requirements, the design and implementation, the evidence of testing, and the known "
        "limitations of the delivered system."
    )
    R.para("**Keywords:** offline-first, local-first software, study tracking, React Native, "
           "SQLite, Supabase, Row Level Security, synchronisation, Google Gemini, spaced repetition.")

    # ---------------------------------------------------------- contents
    R.h1("Table of Contents", numbered=False, new_page=True)
    for level, text in planned["toc"]:
        if text in ("Abstract", "Table of Contents", "List of Figures", "List of Tables"):
            continue
        R.contents_line(text, indent=0 if level == 1 else 0.3, bold=level == 1, size=11.5 if level == 1 else 11)

    R.h1("List of Figures", numbered=False, new_page=True)
    for text in planned["figures"]:
        R.contents_line(text, size=10.5)

    R.h1("List of Tables", numbered=False)
    for text in planned["tables"]:
        R.contents_line(text, size=10.5)

    # ---------------------------------------------------------- 1 introduction
    R.h1("Introduction", new_page=True)
    R.h2("Project overview")
    R.para(
        "PrepPilot is an offline-first, AI-assisted study tracking application for students "
        "preparing for school board examinations, competitive entrance examinations and "
        "professional qualifications. Its organising idea is that a syllabus is a structure and "
        "progress is a measurement over that structure. The student loads a syllabus — from one "
        "of 22 bundled templates or built from scratch — ticks off topics as they are genuinely "
        "finished, times study sessions against a subject, chapter or topic, and sees honest "
        "progress figures on the tracker, the dashboard and the sessions history."
    )
    R.para(
        "The guiding principle of the product is **Tracker first, AI second.** The tracker is "
        "complete and useful without any network connection; the Gemini-powered assistant "
        "supports the workflow — explaining, summarising, quizzing and suggesting additions — "
        "but never drives it and can never change the syllabus without the student's explicit "
        "confirmation. PrepPilot is a tool for individual self-improvement and has no social "
        "features."
    )
    R.para("Android is the primary platform. The same codebase is exported to the web with "
           "`react-native-web` as a demonstration build, hosted at "
           "`https://preppilottdemo.netlify.app`.")

    R.h2("Problem statement")
    R.para(
        "Students commonly use several unrelated applications for syllabus tracking, timing, "
        "reminders, revision and AI help, none of which holds the syllabus they should all "
        "refer to. A CBSE Class 12, JEE Main or UPSC Civil Services syllabus contains hundreds of "
        "individually learnable topics; paper cannot compute a percentage, spreadsheets are "
        "laborious on a phone, and memory is least reliable when it matters most. Study also "
        "frequently happens without connectivity — in libraries, hostels and on trains — so a "
        "tool that needs a network round-trip to tick a box fails exactly where it is needed."
    )
    R.para(
        "A more serious problem is inaccurate measurement. Averaging chapter percentages — the "
        "obvious implementation — reports a subject with a 1-of-1 chapter and a 0-of-99 chapter "
        "as (100% + 0%) ÷ 2 = 50% complete, when the truthful figure is 1 ÷ 100 = 1%. A student "
        "who believes they are halfway through a subject they have barely begun will plan their "
        "remaining weeks wrongly. PrepPilot therefore treats correct measurement as its central "
        "obligation."
    )

    R.h2("Objectives")
    R.bullets([
        "**Accurate measurement** — model a syllabus as a hierarchy and compute progress "
        "topic-weighted; report an empty portion as unmeasured (—), never as 0%.",
        "**Offline-first data** — every read and write completes against the device database; "
        "changes on several devices reconcile later by a deterministic rule.",
        "**Safe AI** — keep the AI credential server-side and require human review and "
        "confirmation for any change the assistant proposes.",
        "**One integrated workflow** — bind timers, flashcards, notes, quizzes and reminders to "
        "the same syllabus so effort, revision and progress stay connected.",
    ], numbered=True)

    R.h2("Scope")
    R.para("**In scope:** an Android application and a browser demonstration build covering "
           "syllabus tracking, progress, timers and study sessions, dashboard and history, "
           "templates and a course builder, multiple courses, notes, flashcards, quizzes, "
           "reminders, Focus Mode, downloadable themes, an AI assistant, authentication, "
           "cloud synchronisation and account deletion.")
    R.para("**Out of scope:** social or collaborative features, teacher or institution "
           "dashboards, an iOS release, blocking other applications (not permitted on Android "
           "without restricted privileges) and payments.")

    R.h2("Organisation of the report")
    R.para(
        "Chapter 2 reviews related work and existing applications. Chapter 3 assesses "
        "feasibility. Chapter 4 specifies requirements. Chapter 5 presents the system design and "
        "Chapter 6 its implementation. Chapter 7 walks through the user interface with "
        "screenshots. Chapter 8 reports testing, Chapter 9 results, Chapter 10 limitations and "
        "Chapter 11 future scope; Chapter 12 concludes."
    )

    # ---------------------------------------------------------- 2 literature
    R.h1("Literature Review and Existing Systems")
    R.h2("The spacing effect")
    R.para(
        "Ebbinghaus [1] showed that retention decays predictably over time and that review "
        "restores it. Cepeda et al. [2] synthesised distributed-practice studies and confirmed "
        "that material reviewed at spaced intervals is retained substantially better than "
        "material reviewed in a single massed session. This justifies a spaced review facility "
        "and informs PrepPilot's flashcard module."
    )
    R.h2("The SM-2 scheduling algorithm")
    R.para(
        "Wozniak and Gorzelanczyk [3] proposed SM-2, which keeps an ease factor and interval "
        "per item, lengthening the interval on successful recall and resetting it on failure; it "
        "underlies widely used software such as Anki. PrepPilot implements SM-2 in full and keeps "
        "its statistics up to date, but its review screen deliberately offers three fixed "
        "intervals (1, 2 and 4 days) so that each button says exactly what it will do. The "
        "scheduling PrepPilot performs today is therefore fixed-interval spaced repetition, not "
        "SM-2 scheduling."
    )
    R.h2("Local-first software")
    R.para(
        "Kleppmann et al. [4] argue that applications should keep primary data on the user's own "
        "device while still supporting synchronisation, and set out ideals including that the "
        "network should be optional. PrepPilot follows this directly: the device database is "
        "authoritative and the server is a copy."
    )
    R.h2("Conflict resolution between replicas")
    R.para(
        "Shapiro et al. [5] introduced Conflict-free Replicated Data Types (CRDTs), which converge "
        "without coordination but carry implementation and storage overhead. For PrepPilot's "
        "data — independently owned fields, infrequent edits — last-write-wins with tombstones, "
        "plus a separate timestamp for topic completion, converges deterministically at far lower "
        "cost. The review therefore informed a deliberate decision not to adopt CRDTs."
    )
    R.h2("Review of existing applications")
    R.table("Comparison with existing applications", [
        ["Application type", "Example", "Syllabus structure", "Weighted progress", "Works offline", "Study tooling"],
        ["Flashcard apps", "Anki, Quizlet", "No", "No", "Yes (Anki)", "Revision only"],
        ["Task managers", "Todoist", "Flat lists", "No", "Partly", "None"],
        ["Focus timers", "Forest (Pomodoro [6])", "No", "No", "Yes", "Time only"],
        ["Coaching portals", "Institute apps", "Their own", "Varies", "No", "Varies"],
        ["PrepPilot", "—", "4 levels, any syllabus", "Topic-weighted", "Yes", "Timers, cards, notes, quizzes, AI"],
    ], widths=[1.15, 1.1, 1.05, 1.0, 0.85, 1.25], size=9.5)
    R.para(
        "No reviewed application combines a structured syllabus, an honest progress calculation, "
        "offline-first operation and integrated study tooling. That gap is what PrepPilot "
        "addresses."
    )

    # ---------------------------------------------------------- 3 feasibility
    R.h1("Feasibility Study")
    R.h2("Technical feasibility")
    R.para(
        "Expo provides a mature cross-platform runtime with modules for local SQLite storage, "
        "secure credential storage, notifications, image picking and screen orientation, while "
        "Supabase supplies managed PostgreSQL, authentication, file storage and serverless "
        "Edge Functions, so no custom server has to be operated. The principal technical risks "
        "were addressed in the design: identifier collisions on offline creation are prevented "
        "by client-generated UUIDv7 keys, lost deletions by tombstones, and device clock skew by "
        "rewinding the synchronisation watermark. Two platform limits are genuine and are stated "
        "in the app: Android does not let one app block another without privileges restricted "
        "by Play Store policy, and no available module exposes the permission needed to toggle "
        "Do Not Disturb."
    )
    R.h2("Economic feasibility")
    R.para(
        "Every framework and library used is open source, and Supabase and Gemini both offer "
        "free tiers adequate for development and demonstration. The only cost that grows with "
        "use is the Gemini API. The figures below are the project's own estimates from what the "
        "app sends, using Google's published paid-tier prices as checked on 24 September 2026; "
        "they should be re-checked before being relied on."
    )
    R.table("Development and running cost", [
        ["Item", "Cost", "Notes"],
        ["React Native, Expo, SQLite, Drizzle ORM, PostgreSQL", "Free", "Open-source licences"],
        ["Supabase (database, auth, storage, functions)", "Free tier", "Adequate at project scale"],
        ["Gemini API — free tier", "Free", "~20 requests/day on the main model, ~500 on Flash-Lite, shared by all users; content may be used by Google"],
        ["Gemini API — paid tier, per busy student", "≈ US$2.40 / month", "20 questions + 2 quizzes a day on Gemini 3.6 Flash at 2026 prices; about half on Flash-Lite"],
        ["Expo Application Services (APK builds)", "Free tier", "Used to build the Android package"],
        ["Hosting of the web demo (Netlify)", "Free tier", "Static files only"],
    ], widths=[2.4, 1.2, 2.65], size=9.5)
    R.para(
        "Uncontrolled spending is bounded by a per-account limit of 20 AI requests an hour in "
        "the Edge Function. That limit is held in memory per function instance, so it bounds "
        "runaway use rather than acting as a durable quota."
    )
    R.h2("Operational feasibility")
    R.para(
        "The primary interaction — expand a subject, tick a topic — needs no instruction. "
        "Because the app works without connectivity it places no dependency on an institution's "
        "network, and bundled templates remove most of the initial setup, which is where such "
        "tools are usually abandoned. Synchronisation runs automatically, so the student never "
        "has to remember to back up."
    )

    # ---------------------------------------------------------- 4 requirements
    R.h1("Requirements Specification")
    R.h2("Functional requirements")
    R.table("Functional requirements and delivery status", [
        ["ID", "Requirement", "Delivered as"],
        ["FR-1", "Authentication", "Email and password with confirmation link, Forgot password reset link, native Google sign-in, guest use; phone OTP implemented behind a flag"],
        ["FR-2", "Syllabus management", "Create, rename, reorder and delete subjects, chapters, topics and optional sub-topics; several courses"],
        ["FR-3", "Topic completion and progress", "Checkboxes; topic-weighted progress for chapter, subject, course"],
        ["FR-4", "Timers and study sessions", "Stopwatch, Pomodoro (25/5/15 min, long break every 4) and custom; full-screen landscape timer with six faces"],
        ["FR-5", "History and statistics", "Dashboard: completion, today, total, streak, last 7 days, time by subject; Sessions history"],
        ["FR-6", "Templates and custom syllabus", "22 bundled templates plus 2 examples; preview, pick subjects, import; Build from scratch"],
        ["FR-7", "Revision", "Flashcards with 1d / 2d / 4d review; quizzes of 1–15 questions at four difficulties saved to a Quiz deck"],
        ["FR-8", "Notes", "Any number of notes per topic or sub-topic, including saved AI summaries and replies"],
        ["FR-9", "Reminders", "Student-created weekday and one-off reminders"],
        ["FR-10", "Focus Mode", "1–240 min, up to six presets, end alert choice, keep-screen-on, pause"],
        ["FR-11", "AI assistance", "Ask, summarise, quiz, photo questions, saved chats, follow-ups, propose-then-confirm additions"],
        ["FR-12", "Offline operation and sync", "SQLite on device; Supabase sync on sign-in, every 5 min, on leaving the app, on reconnecting"],
        ["FR-13", "Themes", "Classic built in; Notebook, Flight deck and Bold bento downloaded on demand"],
        ["FR-14", "Account deletion", "Removes local data and, through an Edge Function, the server account"],
    ], widths=[0.55, 1.65, 4.05], size=9.5)

    R.h2("Non-functional requirements")
    R.table("Non-functional requirements", [
        ["Quality", "How it is met"],
        ["Offline capability", "All reads and writes go to local SQLite; sync is a separate, later step"],
        ["Correctness", "Progress, timer, scheduling and merge logic are pure functions in a shared package, tested exhaustively"],
        ["Security", "Row Level Security on every table; server-only AI key; sessions in the device keystore; validated input"],
        ["Performance", "The tracker reads a course in four queries; sync pulls in pages of 1,000 rows"],
        ["Accessibility", "Tests query by accessibility role and name, so unreachable controls fail the suite; theme packs checked for WCAG contrast"],
        ["Maintainability", "TypeScript throughout; decision log (entries D1–D110); CI on every change; coverage thresholds"],
        ["Portability", "One codebase for Android and the browser"],
    ], widths=[1.6, 4.65], size=9.5)

    R.h2("Hardware and software requirements")
    R.table("Development and runtime environment", [
        ["Category", "Requirement"],
        ["Development machine", "At least 8 GB RAM; Windows, macOS or Linux"],
        ["Test device", "Physical Android phone, Android 8.0 or later (notifications, keep-awake, keystore and app-state changes cannot be verified reliably in an emulator or browser)"],
        ["Runtime and tools", "Node.js 22, pnpm 10+, Expo CLI and EAS, Supabase CLI, Deno (Edge Functions), Git and GitHub"],
        ["Cloud accounts", "Supabase project; Google AI Studio key for Gemini; Google Cloud OAuth clients for sign-in"],
        ["End user", "Android phone; internet needed only for first sign-in, sync, AI and theme downloads"],
    ], widths=[1.6, 4.65], size=9.5)

    # ---------------------------------------------------------- 5 design
    R.h1("System Design")
    R.h2("Architecture")
    R.para(
        "The client is layered. Expo Router screens and design-system components form the "
        "presentation layer; one Zustand store per feature holds state; repositories give typed "
        "access to SQLite through Drizzle ORM; and a framework-independent domain package "
        "(`packages/shared`) holds the progress engine, timer, scheduling, merge rules, AI "
        "parsing and design tokens. Because the Android app and the web build use the same "
        "domain package and tokens, they cannot disagree about a percentage or a colour. The "
        "backend is Supabase: PostgreSQL with Row Level Security, authentication, a public "
        "read-only Storage bucket for themes, and two Deno Edge Functions, `ask-gemini` and "
        "`delete-account`."
    )
    R.figure(diagram("architecture.png"), "System architecture", width=Inches(4.1))
    R.figure(diagram("solution.png"), "Every feature attaches to the syllabus hierarchy", width=Inches(5.8))

    R.h2("Working flow")
    R.para(
        "A student signs in, imports or builds a syllabus and works against it. Every action "
        "writes to the local database immediately and is marked pending; the synchronisation "
        "engine later pulls remote changes, merges them and pushes the agreed result. No "
        "student action waits on the network."
    )
    R.figure(diagram("workflow.png"), "Working flow of the system", width=Inches(3.4))

    R.h2("Data model")
    R.para(
        "The device holds 13 SQLite tables; the server mirrors the 12 synchronised ones and adds "
        "`profiles`. Every synchronised row carries a client-generated UUIDv7 `id`, a "
        "denormalised `user_id`, `created_at`, `updated_at`, a `deleted_at` tombstone and, "
        "locally only, a `sync_status` of pending or synced."
    )
    R.table("Database tables", [
        ["Table", "Purpose", "Synced"],
        ["trackers", "Courses (a student may have several)", "Yes"],
        ["subjects, chapters, topics, subtopics", "The syllabus hierarchy; topics carry a second timestamp for completion", "Yes"],
        ["study_sessions", "Timed sessions; no foreign keys and name snapshots so history survives deletes and renames", "Yes"],
        ["flashcards", "Cards with due date and SM-2 statistics", "Yes"],
        ["notes", "Any number per topic; source manual, summary or assistant", "Yes"],
        ["reminders", "Student reminders; the scheduled notification id stays local", "Yes"],
        ["chat_threads, chat_messages", "Saved assistant conversations; pictures stay on the device", "Yes"],
        ["quiz_attempts", "Finished quizzes with settings, answers and score", "Yes"],
        ["preferences", "Device settings, including the sync watermark", "No"],
        ["profiles", "Server only; created by a trigger on sign-up", "Server"],
    ], widths=[1.9, 3.6, 0.75], size=9.5)
    R.figure(diagram("erd.png"), "Entity relationships of the core syllabus tables (notes, chats and quizzes, added later, are listed in Table 5.1)", width=Inches(3.7))

    R.h2("Synchronisation design")
    R.para(
        "For each table, in dependency order so that a chapter never arrives before its subject, "
        "the engine pulls rows changed since a watermark, reconciles them with local rows by id, "
        "merges conflicts and writes the winner locally, then pushes everything still pending. "
        "Pulling before pushing is essential: pushing first would upload an unreconciled row and "
        "silently overwrite a change made elsewhere. The watermark is rewound 60 seconds on each "
        "pull to absorb clock differences and advanced only after a successful pass; every write "
        "is an idempotent upsert, so a failed pass can always be repeated."
    )
    R.table("Conflict resolution rules", [
        ["Situation", "Winner", "Reason"],
        ["Either side tombstoned", "The tombstone", "Resurrecting a deleted row is worse than losing an edit"],
        ["topics.completed differs", "Later completed_changed_at", "A rename on one device must not undo a tick on another"],
        ["Completion timestamps equal", "Completed", "Un-ticking finished work is the least forgivable outcome"],
        ["Anything else", "Later updated_at", "Last write wins"],
        ["updated_at exactly equal", "Local", "Prevents devices rewriting rows they agree on"],
    ], widths=[1.8, 1.8, 2.65], size=9.5)
    R.figure(diagram("offline.png"), "Offline write and later synchronisation", width=Inches(4.6))
    R.figure(diagram("conflict.png"), "Conflict resolution decision flow", width=Inches(2.9))

    R.h2("AI assistant design")
    R.para(
        "The app calls the `ask-gemini` Edge Function, which holds the Gemini key as a Supabase "
        "secret, applies the per-user rate limit, and never forwards an upstream error body. It "
        "asks Gemini 3.6 Flash, retries once on 429 or 503, then falls back to Gemini 3.5 "
        "Flash-Lite and Gemini 3.1 Flash-Lite. A reply that suggests syllabus changes is parsed "
        "into an inert proposal whose grammar has only two verbs, `addChapters` and `addTopics`; "
        "there is no way to express deleting or completing anything. The student sees exactly "
        "what would be added and must confirm, and proposals over 200 topics are refused."
    )
    R.figure(diagram("ai-flow.png"), "AI request flow through the Supabase Edge Function", width=Inches(3.8))

    R.h2("Security design")
    R.bullets([
        "**Row Level Security** is enabled and forced on every table, every policy is scoped to "
        "`auth.uid()`, and no delete privilege is granted anywhere — rows are tombstoned.",
        "**Secrets:** only the publishable Supabase key is in the app; the service-role key is "
        "nowhere in the repository and the Gemini key exists only as a server secret.",
        "**Sessions** are stored in the device keystore through `expo-secure-store`, with an "
        "adapter that chunks values over its 2,048-byte limit.",
        "**Sign-in** uses PKCE for email links and password reset, and Google ID tokens from "
        "Android's account picker verified by Supabase.",
        "**Input validation** happens before any request; passwords are capped at 72 bytes "
        "because bcrypt ignores everything after that.",
        "**Errors never leak:** tests assert that keys, constraint names and driver errors never "
        "appear on screen.",
    ])

    # ---------------------------------------------------------- 6 implementation
    R.h1("Implementation")
    R.h2("Technology stack")
    R.table("Technology stack", [
        ["Layer", "Technology"],
        ["Language", "TypeScript"],
        ["Mobile framework", "React Native 0.86, Expo SDK 57, Expo Router"],
        ["State", "Zustand"],
        ["Local database", "SQLite via Drizzle ORM — expo-sqlite on Android, sql.js (WebAssembly) in the browser"],
        ["Backend", "Supabase: PostgreSQL, Auth, Storage, Edge Functions (Deno)"],
        ["AI", "Google Gemini 3.6 Flash, with 3.5 and 3.1 Flash-Lite fallbacks"],
        ["Testing", "Jest with React Native Testing Library (app), Vitest (shared), Deno test (functions)"],
        ["Build and CI", "pnpm workspaces, GitHub Actions, Expo Application Services, Netlify"],
    ], widths=[1.6, 4.65], size=9.5)

    R.h2("Repository structure")
    R.table("Repository layout and size (non-test source lines, 6 Oct 2026)", [
        ["Path", "Contents", "Lines"],
        ["apps/mobile", "The Expo app: screens, features, stores, repositories, web build", "25,138"],
        ["packages/shared", "Progress engine, timer, scheduling, sync merge, AI parsing, templates, theme validation, tokens", "10,482"],
        ["supabase/functions", "Edge Functions ask-gemini and delete-account", "773"],
        ["supabase/migrations", "PostgreSQL schema, policies and grants", "832"],
        ["docs", "Product, technical and developer documentation; this report", "—"],
    ], widths=[1.5, 3.9, 0.85], size=9.5)

    R.h2("Progress engine")
    R.para(
        "Progress is the product's core promise, so it lives in one pure module and is tested "
        "exhaustively. Subject progress sums completed and total topic units across all of the "
        "subject's chapters, rather than averaging chapter percentages; a topic split into "
        "sub-topics contributes its sub-topics. An explicit regression test fails if averaging "
        "is ever introduced. The excerpt below is from `packages/shared/src/progress/progress.ts`."
    )
    R.code("""
export function makeProgress(completed: number, total: number): Progress {
  ...
  return {
    completed,
    total,
    percent: total === 0 ? null : (completed / total) * 100,
    isEmpty: total === 0,
  };
}

export function calculateSubjectProgress(subject: SubjectLike): Progress {
  let completed = 0;
  let total = 0;
  for (const chapter of subject.chapters) {
    for (const topic of chapter.topics) {
      const units = topicUnits(topic);
      completed += units.completed;
      total += units.total;
    }
  }
  return makeProgress(completed, total);
}
""")
    R.para(
        "Rounding is also honest: 9,999 of 10,000 topics displays as 99%, never 100%, and a "
        "chapter with no topics shows — instead of 0%."
    )

    R.h2("Feature modules")
    R.table("Feature modules", [
        ["Module", "Implementation notes"],
        ["Tracker", "Expandable subjects and chapters, per-level progress rings and bars, play button per row, options menu (rename, summarise, test me, sub-topic, note, move, delete)"],
        ["Timers", "Stopwatch, Pomodoro and custom modes from a pure timer state machine; Pomodoro breaks are excluded from study time; full-screen landscape view with Flip cards, Minimal, Ring, Time wedge, Hourglass and Rising tide faces"],
        ["Focus Mode", "Configurable countdown; an in-app capability list states what the platform does and does not allow"],
        ["Templates", "22 syllabi: JEE Main, JEE Advanced, NEET UG; ten CBSE streams (classes 9–12); UPSC CSE, SSC CGL, GATE CS & IT, NEET PG, CA Foundation, Intermediate and Final, MBBS, DevOps"],
        ["Flashcards", "Review with 1d / 2d / 4d buttons; SM-2 statistics maintained underneath"],
        ["Quizzes", "1–15 multiple-choice questions, Easy / Medium / Hard / Competitive, optional multi-answer; each question validated separately; finished quizzes saved to the Quiz deck and can be redone offline"],
        ["AI assistant", "Photo questions resized on the device to 1,600 px JPEG; Markdown and LaTeX rendered as formatted text by an in-house parser; saved chats; follow-ups that send the summary and last six messages"],
        ["Themes", "JSON packs and fonts validated whole before use (colours, ranges, font paths, WCAG contrast), downloaded to the device, restored before the first frame"],
        ["Sync", "Runs on sign-in and launch, every 5 minutes in the foreground, on leaving the app, on reconnecting, and from Settings"],
    ], widths=[1.3, 4.95], size=9.5)

    R.h2("Development timeline")
    R.table("Milestones, from the repository history and decision log", [
        ["Date (2026)", "Milestone"],
        ["30 Aug", "Repository history begins"],
        ["10 Sep", "Repository audit, synopsis and first project presentation added"],
        ["12 Sep", "APK confirmed working on a physical Android phone against the live backend"],
        ["21 Sep", "All tables live on the hosted Supabase project; reinstall restores data"],
        ["23 Sep", "Native Google sign-in configured on the live project"],
        ["24 Sep", "Several notes per topic, saved chats, configurable quizzes and the Quiz deck"],
        ["25 Sep", "Follow-up questions on summaries; second Flash-Lite fallback"],
        ["26 Sep", "Forgot password and branded authentication emails"],
        ["2 Oct", "Downloadable themes: Notebook, Flight deck, Bold bento"],
        ["3 Oct", "Full-screen landscape timer and configurable Focus Mode"],
        ["4 Oct", "Continue-tracking card removed; web build deployable to Netlify"],
    ], widths=[1.2, 5.05], size=9.5)

    # ---------------------------------------------------------- 7 UI
    R.h1("User Interface and Screenshots")
    R.para(
        "This chapter walks through the application screen by screen. Screenshots come from two "
        "sources, named under each one: screens **captured 24 Sep 2026** are the set already "
        "kept in the repository (`docs/assets/screenshots/app`); screens marked **web demo, "
        "6 Oct 2026** were captured for this report from the browser build of the same code at a "
        "phone-sized viewport, to cover features added since then. The browser build runs in "
        "demo mode with a small seeded syllabus, so its figures (such as 10.00%) are sample "
        "data. Sign-in, registration and password-reset screens are not shown because demo mode "
        "bypasses authentication."
    )

    R.h2("Syllabus tracker")
    R.para("The tracker is the home screen: the course selector, overall completion ring, and "
           "one card per subject with its own progress ring and a play button that starts a "
           "timer. Expanding a subject shows chapters with progress bars, and expanding a "
           "chapter shows topics with checkboxes.")
    R.grid([
        (shot("app/tracker.png"), "Tracker with the JEE Main 2026 template", REPO),
        (shot("app/subject-detail.png"), "A subject expanded into chapters", REPO),
        (shot("web/tracker-expanded-demo.png"), "Chapter expanded into topics", WEB),
        (shot("web/topic-menu.png"), "Topic options menu", WEB),
        (shot("web/quiz-settings.png"), "Quiz settings: count, difficulty, multi-answer", WEB),
        (shot("web/classic-light-tracker.png"), "Tracker in light mode", WEB),
    ])

    R.h2("Templates and building a course")
    R.grid([
        (shot("app/templates.png"), "Template library", REPO),
        (shot("app/template-preview.png"), "Template preview before import", REPO),
        (shot("app/build-from-scratch.png"), "Build a course from scratch", REPO),
    ])

    R.h2("Timers")
    R.para("Starting a timer from any row opens the timer sheet with Stopwatch, Pomodoro and "
           "Custom modes. Full screen turns the phone to landscape; a tap pauses or resumes, and "
           "while paused the student can pick one of six faces.")
    R.grid([
        (shot("app/timer.png"), "Timer sheet", REPO),
        (shot("web/timer-pomodoro.png"), "Pomodoro mode before starting", WEB),
        (shot("web/timer-running.png"), "Pomodoro interval running", WEB),
    ])
    R.grid([
        (shot("web/fs-paused-flip.png"), "Full-screen timer, Flip cards face (paused)", WEB),
        (shot("web/fs-minimal.png"), "Minimal face", WEB),
        (shot("web/fs-ring.png"), "Ring face", WEB),
        (shot("web/fs-wedge.png"), "Time wedge face", WEB),
        (shot("web/fs-hourglass.png"), "Hourglass face", WEB),
        (shot("web/fs-tide.png"), "Rising tide face", WEB),
    ], cols=3, width=LAND_W)

    R.h2("Focus Mode")
    R.para("Focus Mode is a countdown of 1 to 240 minutes with presets, a choice of end alert and "
           "a keep-screen-on option. Its capability list says plainly what it cannot do on the "
           "current platform — the browser build marks screen-on and departure counting as app "
           "only, and app blocking as impossible.")
    R.grid([
        (shot("web/focus-setup.png"), "Focus Mode set-up", WEB),
        (shot("web/focus-capabilities.png"), "End alert and capability list", WEB),
        (shot("app/focus.png"), "Focus Mode", REPO),
    ])

    R.h2("Dashboard and sessions")
    R.grid([
        (shot("app/dashboard.png"), "Dashboard", REPO),
        (shot("app/sessions.png"), "Sessions history", REPO),
        (shot("web/classic-light-sessions.png"), "Sessions with Quiz deck, light mode", WEB),
    ])

    R.h2("Revision, notes and reminders")
    R.grid([
        (shot("app/flashcard-review.png"), "Flashcard review with 1d / 2d / 4d", REPO),
        (shot("app/notes.png"), "Notes by topic", REPO),
        (shot("app/reminders.png"), "Reminders", REPO),
    ])

    R.h2("AI assistant")
    R.para("The assistant answers questions, can read a photographed page, formats its replies, "
           "and turns a request for new material into a proposal the student must confirm.")
    R.grid([
        (shot("app/assistant-attach.png"), "Attach a photo or screenshot", REPO),
        (shot("app/assistant-picture-attached.png"), "Picture attached to a question", REPO),
        (shot("app/assistant-picture-reply.png"), "Answer about the picture", REPO),
        (shot("app/assistant-formatted-reply.png"), "Formatted reply", REPO),
        (shot("app/assistant-proposal-review.png"), "Proposal review before adding", REPO),
        (shot("app/settings.png"), "Settings", REPO),
    ])

    R.h2("Downloadable themes")
    R.para("Settings → Themes lists Classic and three downloadable looks. Each downloads only "
           "when chosen (340–770 KB) and then works offline. For these captures the theme files "
           "were built from the repository and served locally.")
    R.grid([
        (shot("web/settings-themes.png"), "Theme list in Settings", WEB),
        (shot("web/theme-notebook-tracker.png"), "Notebook theme, dark", WEB),
        (shot("web/theme-notebook-dashboard.png"), "Notebook dashboard, dark", WEB),
        (shot("web/theme-flightdeck-tracker.png"), "Flight deck theme, dark", WEB),
        (shot("web/theme-bento-tracker.png"), "Bold bento theme, dark", WEB),
        (shot("web/theme-notebook-light-tracker.png"), "Notebook theme, light", WEB),
        (shot("web/theme-flightdeck-light-tracker.png"), "Flight deck theme, light", WEB),
        (shot("web/theme-bento-light-tracker.png"), "Bold bento theme, light", WEB),
    ])

    # ---------------------------------------------------------- 8 testing
    R.h1("Testing and Validation")
    R.h2("Strategy")
    R.para(
        "Verification is automated. Pure logic in the shared package is tested with Vitest; the "
        "app's screens, stores and repositories with Jest and React Native Testing Library; and "
        "the Edge Functions with Deno's test runner, stubbing Gemini. Tests find controls by "
        "accessibility role and name rather than test IDs, so a control that a screen reader "
        "cannot reach fails the ordinary suite."
    )
    R.h2("Test results")
    R.table("Automated test results", [
        ["Package", "Runner", "Suites", "Tests", "Result"],
        ["apps/mobile", "Jest", "86", "1,658", "All passed (run 6 Oct 2026)"],
        ["packages/shared", "Vitest", "17", "573", "All passed (run 6 Oct 2026)"],
        ["supabase/functions", "Deno test", "2", "52", "Counted from source; run in CI, not re-run for this report"],
        ["Total", "", "105", "2,283", ""],
    ], widths=[1.45, 0.9, 0.65, 0.75, 2.5], size=9.5)
    R.para(
        "These figures are higher than the 2,073 tests recorded in the repository's README, "
        "which predates the themes and full-screen timer work."
    )
    R.h2("What is tested against something real")
    R.bullets([
        "Repository tests run the **generated migrations** against in-memory SQLite "
        "(`better-sqlite3`), so they execute the SQL the app ships, including constraints and "
        "cascades.",
        "The sync engine runs the real local database against an in-memory server that behaves "
        "as PostgREST does, covering tombstones, rename-versus-tick, repeated passes and failed "
        "passes.",
        "The server schema was applied to a real PostgreSQL database and RLS isolation checked "
        "in both directions.",
        "Theme packs are checked against the validator, including WCAG contrast in both modes.",
    ])
    R.h2("Continuous integration")
    R.para("Every push runs a GitHub Actions pipeline that checks formatting, type-checks every "
           "package, runs the tests with coverage thresholds (95% statements, 90% branches, 95% "
           "functions, 95% lines), runs the Edge Function tests, and verifies that both the "
           "Android and web bundles still build.")
    R.h2("Device testing")
    R.para(
        "The Android APK (about 41 MB, arm64) has been run on a physical phone against the live "
        "Supabase project: sign-in by email and by Google, restoring data after a reinstall, and "
        "the assistant including picture questions. This is recorded in the project's "
        "documentation as the developer's confirmation. Testing has not been systematic across "
        "Android versions, manufacturers' battery-optimisation policies or locales."
    )

    # ---------------------------------------------------------- 9 results
    R.h1("Results and Discussion")
    R.table("Objectives against outcomes", [
        ["Objective", "Outcome"],
        ["Accurate measurement", "Achieved. Topic-weighted progress in one pure module, protected by a regression test; empty portions shown as —"],
        ["Offline-first data", "Achieved. Local SQLite is authoritative; automatic sync with deterministic merge; reinstall restore observed on the live project. A two-device conflict has been verified only by engine tests"],
        ["Safe AI", "Achieved. Key server-side only; proposals limited to additions and always reviewed; 200-topic cap"],
        ["Integrated workflow", "Achieved. Timers, flashcards, notes, quizzes and reminders all reference the syllabus"],
    ], widths=[1.6, 4.65], size=9.5)
    R.para(
        "Beyond the original objectives, the delivered system adds photo questions to the "
        "assistant, saved conversations and follow-ups, a Quiz deck, a full-screen timer with six "
        "faces, a configurable Focus Mode and downloadable themes that do not enlarge the app "
        "download. Engineering decisions are recorded with their reasoning — entries D1–D110 in "
        "`DECISIONS.md` — so the system can be examined for why it was built as it was, not only "
        "for what it does."
    )

    # ---------------------------------------------------------- 10 limitations
    R.h1("Limitations")
    R.bullets([
        "**Flashcard scheduling is fixed-interval**, not SM-2, although SM-2 statistics are kept.",
        "**Focus Mode cannot block other apps or toggle Do Not Disturb** on Android; it says so "
        "in the app.",
        "**The local database is not encrypted.** The session token is in the keystore; the "
        "syllabus is not.",
        "**The AI rate limit is in memory** and resets when the function cold-starts.",
        "**The Gemini key is on the free tier**, shared by all users, and free-tier content may "
        "be used by Google; a long competitive quiz can take 30–60 seconds.",
        "**Only follow-up chats send earlier messages**; an ordinary chat sends each question "
        "alone. One picture per question; pictures do not sync.",
        "**Weekday reminders are re-armed by the app**, so they stop if the app is never opened.",
        "**Phone OTP** is implemented behind a flag but untested with a real SMS provider.",
        "**Sign-in is required once**: offline-first applies after the first successful sign-in.",
        "**A two-device conflict** has not been observed end to end on the hosted project.",
        "**No penetration test or security audit** has been carried out.",
        "**The APK is about 41 MB**; a Play Store app bundle would reduce the download.",
    ])

    # ---------------------------------------------------------- 11 future scope
    R.h1("Future Scope")
    R.bullets([
        "Switch flashcard review to adaptive SM-2 scheduling, using the statistics already kept.",
        "Move the AI rate limit into the database and log real token counts; move to Gemini's "
        "paid tier before real users arrive.",
        "Encrypt the local database.",
        "Systematic device testing across Android versions and manufacturers, and an observed "
        "two-device conflict test against the hosted project.",
        "Drag-to-reorder in the tracker (repositories already support reordering).",
        "Phone OTP with a real SMS provider; an iOS build; a Play Store release as an app bundle.",
        "More templates and community-contributed syllabi.",
    ])

    # ---------------------------------------------------------- 12 conclusion
    R.h1("Conclusion")
    R.para(
        "PrepPilot shows that a study tracker can be both offline-first and honest about "
        "progress. By making the device database authoritative, it works where students "
        "actually study; by computing progress topic-weighted and showing an empty portion as "
        "unmeasured, it gives students a figure they can plan with; and by keeping the AI key on "
        "the server and limiting the assistant to reviewed additions, it adds AI help without "
        "giving up control of the student's work. The system is implemented, runs on Android "
        "and in the browser, and is supported by more than two thousand automated tests and a "
        "documented record of its design decisions and limitations."
    )

    # ---------------------------------------------------------- references
    R.h1("References", numbered=False)
    refs = [
        "H. Ebbinghaus, Memory: A Contribution to Experimental Psychology. New York: Teachers College, Columbia University, 1913 (orig. 1885).",
        "N. J. Cepeda, H. Pashler, E. Vul, J. T. Wixted and D. Rohrer, “Distributed practice in verbal recall tasks: A review and quantitative synthesis,” Psychological Bulletin, vol. 132, no. 3, pp. 354–380, 2006.",
        "P. A. Wozniak and E. J. Gorzelanczyk, “Optimization of repetition spacing in the practice of learning,” Acta Neurobiologiae Experimentalis, vol. 54, no. 1, pp. 59–62, 1994.",
        "M. Kleppmann, A. Wiggins, P. van Hardenberg and M. McGranaghan, “Local-first software: You own your data, in spite of the cloud,” in Proc. Onward! 2019, pp. 154–178.",
        "M. Shapiro, N. Preguiça, C. Baquero and M. Zawirski, “Conflict-free replicated data types,” in Proc. SSS 2011, pp. 386–400.",
        "F. Cirillo, The Pomodoro Technique. London: Virgin Books, 2018.",
        "Meta Platforms, “React Native documentation.” https://reactnative.dev/",
        "Expo, “Expo documentation.” https://docs.expo.dev/",
        "Supabase, “Supabase documentation.” https://supabase.com/docs",
        "Drizzle Team, “Drizzle ORM documentation.” https://orm.drizzle.team/",
        "Google, “Gemini API documentation.” https://ai.google.dev/docs",
        "K. Davis, B. Peabody and P. Leach, Universally Unique IDentifiers (UUIDs), IETF RFC 9562, 2024.",
    ]
    for i, ref in enumerate(refs, 1):
        p = d.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.4)
        p.paragraph_format.first_line_indent = Inches(-0.4)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(f"[{i}]  {ref}")
        r.font.size = Pt(11)

    # ---------------------------------------------------------- appendix
    R.h1("Appendix A: Glossary", numbered=False)
    rows = [
        ["Term", "Meaning"],
        ["Offline-first", "The device database is the source of truth; the network is optional and sync happens later"],
        ["Tombstone", "A row marked deleted (deleted_at) instead of removed, so the deletion can be synchronised"],
        ["UUIDv7", "A time-ordered unique identifier generated on the device, so offline records have their final id at once"],
        ["Row Level Security (RLS)", "PostgreSQL rules attached to rows, so each user can read and write only their own data"],
        ["Watermark", "The time of the last successful sync; the next pull asks for rows changed since then"],
        ["Edge Function", "A small server-side function on Supabase, used here to hold the AI key and delete accounts"],
        ["Proposal", "An inert, parsed AI suggestion that can only add chapters or topics and needs confirmation"],
        ["Demo mode", "A browser build with a fixed local account and seeded data, no backend and no sync"],
    ]
    t = d.add_table(rows=len(rows), cols=2)
    t.style = "Table Grid"
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            c = t.rows[i].cells[j]
            c.text = ""
            r = c.paragraphs[0].add_run(val)
            r.font.size = Pt(10)
            r.bold = i == 0
            c.width = Inches(1.8 if j == 0 else 4.45)
    Report._fix_widths(t, [1.8, 4.45])

    return R


# --------------------------------------------------------------------------
# Two-pass build
# --------------------------------------------------------------------------


def to_pdf(docx_path, out_dir):
    subprocess.run(
        ["soffice", "--headless", "--convert-to", "pdf", "--outdir", out_dir, docx_path],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return os.path.join(out_dir, os.path.splitext(os.path.basename(docx_path))[0] + ".pdf")


def page_texts(pdf):
    text = subprocess.run(["pdftotext", "-layout", pdf, "-"], check=True, capture_output=True, text=True).stdout
    return [re.sub(r"\s+", " ", page) for page in text.split("\f")]


def locate(pages_text, items, first_body_page):
    """Find the first page at or after the body start containing each item."""
    found = {}
    for item in items:
        needle = re.sub(r"\s+", " ", item)
        for n in range(first_body_page, len(pages_text)):
            if needle in pages_text[n]:
                found[item] = n + 1
                break
    return found


def main():
    for tool in ("soffice", "pdftotext"):
        if shutil.which(tool) is None:
            sys.exit(f"{tool} is required")

    planned = {"toc": [], "figures": [], "tables": []}
    pages = {}
    with tempfile.TemporaryDirectory() as tmp:
        for _ in range(3):  # third pass settles page numbers once the lists have their final length
            R = build(pages, planned)
            planned = {"toc": R.toc, "figures": R.figures, "tables": R.tables}
            draft = os.path.join(tmp, "draft.docx")
            R.save(draft)
            texts = page_texts(to_pdf(draft, tmp))
            # Body starts after the List of Tables page(s): find "1. Introduction" heading page.
            start = next(i for i, t in enumerate(texts) if "1.1 Project overview PrepPilot is" in t)
            pages = locate(texts, [t for _, t in R.toc] + R.figures + R.tables, start)
            pages.update(locate(texts, ["Abstract"], 0))

    R.save(OUT_DOCX)
    produced = to_pdf(OUT_DOCX, DOCS)
    assert produced == OUT_PDF
    missing = [t for _, t in R.toc if t not in pages and t not in ("Table of Contents", "List of Figures", "List of Tables")]
    print(f"Wrote {OUT_DOCX}\nWrote {OUT_PDF}")
    print(f"{len(R.toc)} headings, {len(R.figures)} figures, {len(R.tables)} tables")
    if missing:
        print("Page not found for:", missing)


if __name__ == "__main__":
    main()
