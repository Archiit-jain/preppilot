"""Draft the NIMCET, BITSAT, IISER IAT, AMU B.Tech and CFTRI M.Sc. templates.

Usage: python entrance_to_md.py <dir with *.txt from `pdftotext -enc UTF-8`> <out dir>

Sources (each the official syllabus):
  nimcet.txt  NIMCET revised syllabus (w.e.f. 2026), nimcet.admissions.nic.in
  bitsat.txt  BITSAT-2026 syllabus, admissions.bits-pilani.ac.in
  iat.txt     IAT 2026 Information Brochure, "Syllabi for IAT 2026", iiseradmission.in
  amu.txt     AMU B.Tech. admission test syllabus, amucontrollerexams.com
  cftri.txt   CSIR-CFTRI M.Sc. (Food Technology) 2026-28 entrance syllabus, cftri.res.in
"""

import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from csir_net_to_md import topics  # noqa: E402
from gate_to_md import clean, fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402


def read(path: Path) -> str:
    text = unicodedata.normalize("NFKC", path.read_text(encoding="utf8"))
    # Words hyphenated across lines ("com- bination"), but not "p- d- and f-block".
    return re.sub(r"([a-z]{2})- (?=[a-z]{2})", r"\1", text)


def flat(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


SENTENCE_CASE = r"[A-Z][a-z]+(?: [a-z&]+){0,5}"  # "Breathing and exchange of gases"
TITLE_CASE = r"[A-Z][a-z]+(?: (?:and|of|in|the|&|[A-Z][A-Za-z]+)){0,6}"  # "Dual Nature of Radiation and Matter"


def headed(block: str, inline: str = SENTENCE_CASE) -> list:
    """Lines "Chapter: topics". A line ending in ':' alone heads the lines that follow
    when they have no heading of their own."""
    chapters, group = [], None
    # A chapter name with a colon inside a run-on line starts a chapter too; `inline`
    # is the casing the source uses for chapter names, so sub-headings are not taken.
    small = {"the", "of", "and", "in", "to", "for", "a", "an", "&", "its", "their"}

    def split(match):
        before, space = match.group(1), match.group(2)
        if "\n" in space:
            return before + space
        # Inside a title ("Structure of the Atom:", "Chemical Kinetics:") the word before
        # is a small word or capitalised; after a list item it is lower case or punctuation.
        # Biology lists capitalised items ("Eukaryotic Cells Biomolecules:"), so in
        # sentence-case sources only the small words count.
        if inline == SENTENCE_CASE:
            starts_chapter = before.lower() not in small
        else:
            starts_chapter = before[-1] in ".;)" or (before[:1].islower() and before.lower() not in small)
        return before + ("\n" if starts_chapter else space)

    block = re.sub(rf"(\S+)(\s+)(?={inline}: )", split, block)
    for line in [l.strip() for l in block.splitlines() if l.strip()]:
        heading = re.match(r"^([A-Z][^:]{2,80}?)\s*:\s*(.*)$", line)
        if heading and not heading.group(2):
            group = clean(heading.group(1))
            continue
        if heading and len(heading.group(1).split()) <= 10:
            chapters.append([clean(heading.group(1)), topics(heading.group(2))])
        elif chapters and chapters[-1][0] == group:
            chapters[-1][1] += topics(line)
        elif group:
            chapters.append([group, topics(line)])
        elif chapters:
            chapters[-1][1] += topics(line)
    merged = {}  # a group heading and its first chapter can share a name ("Cell")
    for c, t in chapters:
        merged.setdefault(fit(c)[0], []).extend(t)
    return [(c, list(dict.fromkeys(t))) for c, t in merged.items() if t]


def titled(block: str, titles: list) -> list:
    """Splits a run-on block at known chapter titles, in order."""
    text = flat(block)
    positions, start = [], 0
    for title in titles:
        found = re.search(re.escape(title) + r"\s*:?\s*", text[start:])
        if not found:
            raise ValueError(f"title not found: {title}")
        positions.append((start + found.start(), start + found.end(), title))
        start = start + found.end()
    chapters = []
    for index, (_, content_start, title) in enumerate(positions):
        end = positions[index + 1][0] if index + 1 < len(positions) else len(text)
        chapters.append((title, topics(text[content_start:end])))
    return chapters


def between(text: str, start: str, end: str = None) -> str:
    i = text.index(start) + len(start)
    return text[i : text.index(end, i)] if end else text[i:]


# --- NIMCET -----------------------------------------------------------------
def nimcet(text: str) -> list:
    out = []
    for name, start, end in [
        ("Mathematics", "Mathematics: (50 Questions)", "Analytical Ability"),
        ("Analytical Ability and Logical Reasoning", "Logical Reasoning: (40 Questions)", "Computer Awareness"),
        ("Computer Awareness", "Computer Awareness: (20 Questions)", "General English"),
        ("General English", "General English: (10 Questions)", None),
    ]:
        block = between(text, start, end)
        chapters = headed(block)
        if not chapters:
            chapters = [(name, topics(flat(block)))]
        out.append((name, chapters))
    return out


# --- BITSAT -----------------------------------------------------------------
def bitsat(text: str) -> list:
    text = re.sub(r"\n\s*[IVX]+\s*\n", "\n", text)  # page numbers in roman numerals
    text = flat(text)
    # Part III holds two tests; give each its own part.
    text = text.replace("Part III: (a) English Proficiency and (b) Logical Reasoning (a) English Proficiency",
                        "Part III: English Proficiency").replace("(b) Logical Reasoning", "Part III: Logical Reasoning")
    names = ["Physics", "Chemistry", "English Proficiency", "Logical Reasoning", "Mathematics", "Biology"]
    out = []
    for part in re.split(r"Part [IVX]+:\s*", text)[1:]:
        name = next(n for n in names if part.startswith(n))
        body = part[len(name):]
        chapters = []
        # Chapters are "1. Title" ("1: Title" in Biology); topics are "1.1 ...".
        for chapter in re.split(r"(?<![\d.])(?=\b\d{1,2}[.:]\s+[A-Za-z])", body):
            head = re.match(r"(\d{1,2})[.:]\s+(.*)$", chapter.strip())
            if not head:
                continue
            pieces = re.split(r"\s*\b\d{1,2}\.\d{1,2}\s+", head.group(2))
            title = clean(pieces[0])
            if name == "Logical Reasoning":
                # Each item is "Term: what the question looks like"; the term is the topic.
                found = [clean(p.split(":")[0]) for p in pieces[1:]]
            else:
                found = [t for p in pieces[1:] for t in topics(p)] or topics(title)
            chapters.append((fit(title)[0], list(dict.fromkeys(found))))
        out.append((name, [(c, t) for c, t in chapters if t]))
    return out


# --- IISER IAT --------------------------------------------------------------
def iat(text: str) -> list:
    text = re.sub(r"IISER Aptitude Test \(IAT\) 2026 – Information Brochure|\n\s*\d{1,2}\s*\n", "\n", text)
    text = text[text.index("A. Biology", text.index("SYLLABI FOR IAT 2026") - 200) :]
    text = text.replace("SYLLABI FOR IAT 2026", "")
    out = []
    for letter, name, nxt in [("A", "Biology", "B. Chemistry"), ("B", "Chemistry", "C. Mathematics"),
                              ("C", "Mathematics", "D. Physics"), ("D", "Physics", None)]:
        block = between(text, f"{letter}. {name}", nxt or "ANNEXURE")
        out.append((name, headed(block, SENTENCE_CASE if name == "Biology" else TITLE_CASE)))
    return out


# --- AMU B.Tech -------------------------------------------------------------
AMU_PHYSICS = [
    "Physical World and Measurement", "Kinematics", "Laws of Motion", "Work, Energy and Power",
    "Motion of System of Particles and Rigid Body", "Gravitation", "Properties of Bulk Matter", "Thermodynamics",
    "Behaviour of Perfect Gas and Kinetic Theory", "Oscillations and Waves", "Electrostatics", "Current Electricity",
    "Magnetic Effects of Current and Magnetism", "Electromagnetic Induction and Alternating Currents",
    "Electromagnetic Waves", "Optics", "Dual Nature of Matter and Radiation", "Atoms & Nuclei", "Electronic Devices",
]
AMU_CHEMISTRY = [
    "Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity in Properties",
    "Chemical Bonding and Molecular Structure", "States of Matter : Gases and Liquids", "Chemical Thermodynamics",
    "Equilibrium", "Redox Reactions", "Hydrogen", "s-Block Elements", "Some p-Block Elements",
    "Organic Chemistry – Some Basic Principles and Techniques", "Hydrocarbons", "Environmental Chemistry",
    "Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry",
    "General Principles and Processes of Isolation of Elements", "p-Block Elements", "d and f-Block Elements",
    "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers",
    "Aldehydes, Ketones and Carboxylic Acids", "Organic Compounds Containing Nitrogen", "Biomolecules", "Polymers",
    "Chemistry in Every Day Life",
]
AMU_MATHS = [
    "1. SETS", "2. RELATIONS & FUNCTIONS", "3. TRIGNOMETRIC FUCNTIONS", "1. PRINCIPLE OF MATHEMATICAL INDUCTION",
    "2. COMPLEX NUMBERS AND QUADRATIC EQUATIONS", "3. LINEAR INEQUALITIES", "4. PERMUTATIONS AND COMBINATIONS",
    "5. BINOMIAL THEOREM", "6. SEQUENCE AND SERIES", "1. STRAIGHT LINES", "2. CONIC SECTION",
    "3. INTRODUCTION TO THREE DIMENSIONAL GEOMETRY", "LIMITS AND DERIVATIVES", "1. MATHEMATICAL REASONING",
    "2. PROBABILITY", "1. Relations and Functions", "2. Inverse Trigonometric Functions", "1. Matrices",
    "2. Determinants", "1. Continuity and Differentiability", "2. Applications of Derivatives", "3. Integrals",
    "4. Applications of the Integrals", "5. Differential Equations", "1. Vectors", "2. Three – dimensional Geometry",
    "1. Linear programming", "1. Probability",
]
# The official file misspells two titles; the template uses the right spelling.
AMU_NAMES = {"TRIGNOMETRIC FUCNTIONS": "Trigonometric Functions", "Chemistry in Every Day Life": "Chemistry in Everyday Life",
             "States of Matter : Gases and Liquids": "States of Matter: Gases and Liquids"}


def amu_name(title: str) -> str:
    title = re.sub(r"^\d+\.\s*", "", title)
    title = AMU_NAMES.get(title, title)
    return title.title().replace(" And ", " and ").replace(" Of ", " of ").replace(" To ", " to ") if title.isupper() else title


def amu(text: str) -> list:
    text = flat(text)
    physics = between(text, "Physics", "Chemistry CHEMISTRY")
    chemistry = between(text, "Chemistry CHEMISTRY", "Mathematics UNIT")
    maths_start = text.index("Mathematics UNIT")
    maths = text[maths_start : text.index("B.ARCH", maths_start)]
    second = maths.find("1. SETS", maths.find("1. SETS") + 1)
    maths = maths[:second] if second > 0 else maths
    maths = re.sub(r"UNIT\s*[-–]?\s*[IVX]+\s*:\s*[A-Z &]+?(?=\s+\d\.|\s+[A-Z]{2,})", " ", maths)
    maths = re.sub(r"RECOMMENDED TEXT BOOKS.*?Publication\.\s*", " ", maths)
    out = []
    for name, block, titles in (("Physics", physics, AMU_PHYSICS), ("Chemistry", chemistry, AMU_CHEMISTRY),
                                ("Mathematics", maths, AMU_MATHS)):
        out.append((name, [(amu_name(c), t) for c, t in titled(block, titles) if t]))
    return out


# --- CFTRI ------------------------------------------------------------------
CFTRI = ["Physics", "Chemistry", "Mathematics", "Botany & Zoology", "Microbiology & Biotechnology",
         "Biochemistry & Nutrition", "Agriculture and Dairy Technology", "Food Engineering", "Food Processing",
         "Mental Ability", "General Awareness on health & wellness"]


def cftri(text: str) -> list:
    lines = [l.strip() for l in text.splitlines()]
    body = "\n".join(lines[lines.index("Physics"):])
    body = body.split("*****")[0]
    out = []
    for index, name in enumerate(CFTRI):
        start = body.index("\n" + name + "\n") if index else 0
        end = body.index("\n" + CFTRI[index + 1] + "\n") if index + 1 < len(CFTRI) else len(body)
        block = body[start:end].strip()[len(name):]
        chapters = headed(block) if name == "Agriculture and Dairy Technology" else []
        out.append((name, chapters or [(name, topics(flat(block)))]))
    return out


TEMPLATES = [
    ("nimcet", "nimcet", "NIMCET", nimcet,
     "NIT MCA Common Entrance Test: Mathematics, Analytical Ability and Logical Reasoning, Computer Awareness and General English.",
     "NIMCET revised syllabus (with effect from 2026), nimcet.admissions.nic.in; topics split from the official text."),
    ("bitsat", "bitsat", "BITSAT", bitsat,
     "BITS Admission Test: Physics, Chemistry, Mathematics or Biology, English Proficiency and Logical Reasoning.",
     "BITSAT-2026 official syllabus, BITS Pilani admissions; topics split from the official text."),
    ("iat", "iiser-iat", "IISER IAT", iat,
     "IISER Aptitude Test: Biology, Chemistry, Mathematics and Physics.",
     "IAT 2026 Information Brochure, Syllabi for IAT 2026, iiseradmission.in; topics split from the official text."),
    ("amu", "amu-btech", "AMU B.Tech Entrance (AMUEEE)", amu,
     "Aligarh Muslim University B.Tech admission test: Physics, Chemistry and Mathematics.",
     "AMU Controller of Examinations, B.Tech. admission test syllabus; topics split from the official text."),
    ("cftri", "cftri-msc-food-technology", "CFTRI M.Sc. Food Technology Entrance", cftri,
     "CSIR-CFTRI Mysore M.Sc. (Food Technology) entrance: sciences, food subjects, mental ability and awareness.",
     "CSIR-CFTRI M.Sc. (Food Technology) 2026-28 entrance syllabus, cftri.res.in; topics split from the official text."),
]

if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    only = sys.argv[3:] or None
    for key, template_id, name, parse, description, source in TEMPLATES:
        if only and key not in only:
            continue
        subjects = parse(read(src / f"{key}.txt"))
        body = []
        for subject, chapters in subjects:
            # Drop list numbers and textbook references left by the PDF layout.
            chapters = [(c, [re.sub(r"^\d{1,2}\.\s+", "", x) for x in t
                             if re.search(r"[A-Za-z]{2}", x) and "NCERT Publication" not in x]) for c, t in chapters]
            body += render(subject, [(c, t[:200]) for c, t in chapters if t])
        (out / f"{template_id}.md").write_text(front(template_id, name, description, source) + "\n".join(body) + "\n",
                                               encoding="utf8")
        print(template_id, [(s, len(c), sum(len(t) for _, t in c)) for s, c in subjects])
