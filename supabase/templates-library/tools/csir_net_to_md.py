"""Draft the four CSIR NET templates from the CSIR HRDG syllabus PDFs.

Usage: python csir_net_to_md.py <dir with chem/life/math/phys.txt from `pdftotext -enc UTF-8`> <out dir>

Sources (csirhrdg.res.in, CSIR-UGC JRF NET EXAM > Syllabus):
  chem  20201221135711180chemical_science_syllabus.pdf
  life  20260121115025355Merged_Syllabus_CSIR-DBT_21Jan2026.pdf (Life Sciences and
        Biotechnology, merged with DBT-BET from the December 2026 cycle)
  math  20201221140054469mathmeticascience_syllbus.pdf
  phys  20201221140202824physicalscience_syllbus.pdf

Every template starts with Part A (common to all subjects). Each subject's PDF
has its own layout, so each has its own small parser; topic splitting is shared.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import LIMIT, clean, fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402
from ugcnet_to_md import items, topics_from  # noqa: E402

# The scheme on each subject's CSIR HRDG page describes Part A.
PART_A = [
    "# Part A: General Aptitude",
    "## General Aptitude",
    "- General Science",
    "- Quantitative Reasoning and Analysis",
    "- Research Aptitude",
]

KEEP_WHOLE = 90  # a sentence this short stays one topic


def topics(text: str) -> list:
    out = []
    text = re.sub(r"\b(vs|etc|eg|e\.g|i\.e)\.\s", lambda m: m.group(1) + " ", text)
    for sentence in re.split(r"(?<=[.;])\s+(?=[A-Z(])", text):
        sentence = clean(sentence)
        if not sentence:
            continue
        if len(sentence) <= KEEP_WHOLE:
            out.append(sentence)
            continue
        # A long list is split at its commas, but a piece of one or two short
        # words ("finite", "Lagrange") stays with the piece before it.
        merged = []
        for piece in topics_from(sentence):
            short = len(piece) <= 15 and len(piece.split()) <= 2 and ":" not in piece
            if merged and short and len(merged[-1]) + len(piece) + 2 <= LIMIT:
                lower = piece[:1].lower() + piece[1:]
                merged[-1] = f"{merged[-1]}, {lower if lower in sentence else piece}"
            else:
                merged.append(piece)
        out.extend(merged)
    return list(dict.fromkeys(t for t in out if t.lower() not in {"etc", "etc."}))


def flat(text: str) -> str:
    """One line of text without page numbers or the site footer."""
    lines = [l.strip() for l in text.replace("\f", "\n").splitlines()]
    lines = [l for l in lines if l and not re.fullmatch(r"\d{1,2}|csirh?r?dg\.res\.in", l)]
    joined = ""
    for line in lines:
        if joined.endswith("-") and line[:1].islower():
            joined += line
        else:
            joined += " " + line
    return re.sub(r"\s+", " ", joined).strip()


def chemistry(text: str) -> list:
    text = flat(text)
    text = text.replace("Analytical chemistry- ", "Analytical chemistry: ")
    text = text.replace("Pericyclic reactions – ", "Pericyclic reactions: ")
    text = text.replace("exactlysolvable", "exactly solvable").replace("DebyeHuckel", "Debye-Huckel")
    text = text.replace("Electron- transfer", "Electron-transfer").replace("electron- transfer", "electron-transfer")
    areas = ["Inorganic Chemistry", "Physical Chemistry:", "Organic Chemistry", "Interdisciplinary topics"]
    subjects = []
    for index, area in enumerate(areas):
        start = text.index(area) + len(area)
        end = text.index(areas[index + 1]) if index + 1 < len(areas) else len(text)
        chapters = []
        for item in re.split(r"(?:^|\s)\d{1,2}\.\s+", text[start:end]):
            item = clean(item)
            if not item:
                continue
            headed = re.match(r"^([^:]{3,70}):\s*(.+)$", item)
            if headed:
                chapters.append((clean(headed.group(1)), topics(headed.group(2))))
            else:
                # No heading: a long item is named by its first clause.
                name = re.split(r" by | involving ", items(item, ";,")[0])[0] if len(item) > 60 else item
                chapters.append((fit(clean(name))[0], topics(item)))
        if all(len(t) == 1 and t[0] == c for c, t in chapters):
            # A list of one-line items (Interdisciplinary topics) is one chapter.
            chapters = [(area, [c for c, _ in chapters])]
        subjects.append((area.rstrip(":"), chapters))
    return subjects


def physics(text: str) -> list:
    text = flat(text)
    for wrong, right in (
        ("dynamicsmoment", "dynamics: moment"),
        ("relativityLorentz", "relativity: Lorentz"),
        ("Timeindependent", "Time-independent"),
        ("RungeKutta", "Runge-Kutta"),
        ("Gellmann", "Gell-Mann"),
    ):
        text = text.replace(wrong, right)
    core = text.index("CORE") + len("CORE")
    advanced = text.index("P AR T ‘ B’")
    subjects = []
    for name, part in (("Core", text[core:advanced]), ("Advanced", text[text.index("ADVANCED", advanced) + 8 :])):
        chapters = []
        pieces = re.split(r"(?:^|\s)([IVX]{1,4})\.\s+", part)
        for body in pieces[2::2]:
            title = re.match(
                r"^(Mathematical Methods of Physics|Classical Mechanics|Electromagnetic Theory|Quantum Mechanics|"
                r"Thermodynamic and Statistical Physics|Electronics and Experimental Methods|"
                r"Atomic & Molecular Physics|Condensed Matter Physics|Nuclear and Particle Physics)\s*(.*)$",
                body,
            )
            chapters.append((title.group(1), topics(title.group(2))))
        subjects.append((f"Physical Sciences: {name}", chapters))
    return subjects


MATH_HEADINGS = [
    "Analysis", "Linear Algebra", "Complex Analysis", "Algebra", "Topology",
    "Ordinary Differential Equations (ODEs)", "Partial Differential Equations (PDEs)",
    "Numerical Analysis", "Calculus of Variations", "Linear Integral Equations", "Classical Mechanics",
]


def mathematics(text: str) -> list:
    text = text[text.index("UNIT") :]
    subjects = []
    units = re.split(r"UNIT\s*–\s*(\d)", text)
    for number, body in zip(units[1::2], units[2::2]):
        body = body.split("All students are expected")[0]
        heading = "|".join(re.escape(h) for h in MATH_HEADINGS)
        parts = re.split(rf"(?:^|\n|(?<=\. ))({heading})\s*:", body)
        chapters = []
        if parts[0].strip():
            # Unit 4 has no headings; its own note calls it the statistics unit.
            chapters.append(("Statistics", lines_to_topics(parts[0])))
        for title, content in zip(parts[1::2], parts[2::2]):
            chapters.append((title, lines_to_topics(content)))
        subjects.append((f"Unit {number}", chapters))
    return subjects


def lines_to_topics(block: str) -> list:
    block = block.replace("Ø- function", "Ø-function")
    # A line the PDF wrapped ends in "and" or a comma; join it to the next.
    block = re.sub(r"(,| and)\s*\n\s*(?:\d{1,2}\s*\n\s*)?", r"\1 ", block)
    out = []
    for line in block.split("\n"):
        out.extend(topics(line))
    # Wrapped lines leave fragments; rejoin a piece that starts in lower case.
    fixed = []
    for t in out:
        if fixed and t[:1].islower():
            fixed[-1] = f"{fixed[-1]} {t}"
        else:
            fixed.append(t)
    return [p for t in fixed for p in fit(t)]


# Life Sciences: lettered items run their title straight into the content
# ("Cell signaling Hormones and their receptors ..."). These titles are written
# in title case or are a single word, so they are listed; others are found by case.
LIFE_TITLES = [
    "Structure and function of biomolecules", "Photosynthesis", "Cancer", "Plant hormones",
    "Evolution of Life and Life Forms", "Principles & Methods of Taxonomy", "Microbial Life", "Protists",
    "Fungi", "Plant Life", "Animal Life", "Introduction to Ecology", "Population Ecology", "Community Ecology",
    "Ecosystem Ecology", "Human Impacts on Ecosystems", "Biodiversity and Conservation", "Act and policies",
    "Behavioural Ecology", "Major Bioinformatic Resources", "Basic Concepts of Sequence Analysis",
    "Gene annotation", "Molecular Modelling and Dynamics", "Classification and comparison of protein 3D structures",
    "Drug design", "Systems Biology", "Introductory Mathematics", "Engineering Principles",
    "Thermodynamics in Biological Systems", "Bioprocess Engineering and Technology",
    "Enzymes and microbial technology", "Downstream processing in biotechnology", "Bioprocess Plant Design",
    "Molecular Biology Techniques", "Biophysical Methods",
    "Genomics, Transcriptomics, Proteomics and Metabolomics", "Radiolabeling techniques",
    "Histochemical and Immunotechniques", "Microscopic techniques", "Electrophysiological methods",
    "Methods in field biology", "Statistical Methods", "IPR, Biosafety and Bioethics",
    "Cell wall and cell membrane: structure and function",
    "Structural organization and function of intracellular organelles", "Medical Biotechnology",
    "Recombinant DNA technology", "Animal Biotechnology", "Agriculture Biotechnology", "Marine Biotechnology",
    "Environmental Biotechnology", "Microbial Physiology", "Metabolic Engineering and Synthetic Biology",
]


def life_item(item: str, statements: bool):
    # Section 1 lists whole sentences: "Conformation of proteins (Ramachandran plot, ...)."
    if statements:
        bracketed = re.match(r"^(.+?)\s*\((.+)\)\.$", item)
        if bracketed:
            parts = [p for p in items(bracketed.group(2)) if p.lower() not in {"etc", "etc."}]
            return bracketed.group(1), parts
        return item.rstrip("."), item
    for title in LIFE_TITLES:
        if item.startswith(title + " ") or item == title:
            return title, item[len(title) :]
    headed = re.match(r"^([^:]{3,60}):\s*(.+)$", item)
    if headed:
        return headed.group(1), headed.group(2)
    words = item.split(" ")
    for i in range(2, len(words)):
        if words[i][:1].isupper() and words[i - 1][:1].islower():
            return " ".join(words[:i]), " ".join(words[i:])
    return item, ""


def life(text: str) -> list:
    text = flat(text)
    for wrong, right in (
        ("Bio-Technolgy", "Bio-Technology"),
        ("Antigenantibody", "Antigen-antibody"),
        ("MetapopulationsHabitat", "Metapopulations: Habitat"),
        ("variationpolymorphism", "variation: polymorphism"),
        ("selforganizing", "self-organizing"),
    ):
        text = text.replace(wrong, right)
    text = text[text.index("1. STRUCTURE AND FUNCTION OF BIOMOLECULES") :]
    sections = re.split(r"(?:^|\s)(\d{1,2})\.\s+([A-Z][A-Z ,&\-–]+?)(?=\s+[A-Z]\.\s)", text)
    subjects = []
    for number, title, body in zip(sections[1::3], sections[2::3], sections[3::3]):
        chapters = []
        for item in re.split(r"(?:^|(?<=[\s.]))[A-L]\.\s+(?=[A-Z])", body):
            item = item.strip()
            if not clean(item):
                continue
            name, content = life_item(item, number == "1")
            name = clean(name)
            if isinstance(content, list):
                content_topics = content
            else:
                content_topics = topics(content) if clean(content) else [name]
            chapters.append((fit(name)[0], content_topics))
        subjects.append((title.strip().title().replace(" And ", " and ").replace(" Of ", " of ").replace(" In ", " in "), chapters))
    return subjects


TEMPLATES = {
    "chem": ("csir-net-chemical-sciences", "CSIR NET Chemical Sciences", chemistry,
             "Part A General Aptitude and the Chemical Sciences syllabus: inorganic, physical, organic and interdisciplinary.",
             "CSIR HRDG official syllabus, Chemical Sciences (revised exam scheme from June 2017); topics split from the official text."),
    "life": ("csir-net-life-sciences", "CSIR NET Life Sciences and Biotechnology", life,
             "Part A General Aptitude and the merged CSIR-DBT Life Sciences and Biotechnology syllabus (from December 2026).",
             "CSIR HRDG official merged CSIR-DBT syllabus, Life Sciences and Bio-Technology (21 January 2026); topics split from the official text."),
    "math": ("csir-net-mathematical-sciences", "CSIR NET Mathematical Sciences", mathematics,
             "Part A General Aptitude and Units 1 to 4 of the Mathematical Sciences syllabus.",
             "CSIR HRDG official syllabus, Mathematical Sciences; topics split from the official text."),
    "phys": ("csir-net-physical-sciences", "CSIR NET Physical Sciences", physics,
             "Part A General Aptitude and the core and advanced Physical Sciences syllabus.",
             "CSIR HRDG official syllabus, Physical Sciences; topics split from the official text."),
}


if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for key, (template_id, name, parse, description, source) in TEMPLATES.items():
        subjects = parse((src / f"{key}.txt").read_text(encoding="utf8"))
        body = list(PART_A)
        for subject, chapters in subjects:
            body += render(subject, [(c, t[:200]) for c, t in chapters if t])
        (out / f"{template_id}.md").write_text(
            # clean() capitalises the first letter, which breaks "pH".
            front(template_id, name, description, source) + "\n".join(body).replace("- PH\n", "- pH\n") + "\n",
            encoding="utf8",
        )
        print(template_id, [(s, len(c)) for s, c in subjects])
