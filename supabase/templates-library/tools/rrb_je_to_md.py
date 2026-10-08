"""Draft the RRB JE Civil, Electrical, Electronics and Mechanical templates.

Usage: python rrb_je_to_md.py <je.txt> <ann.txt> <out dir>
  je.txt   `pdftotext -enc UTF-8` of the whole notice (para 13, CBT syllabus)
  ann.txt  `pdftotext -enc UTF-8 -layout -f 76 -l 80` (Annexure VII A to D)

Source: RRB Centralised Employment Notice CEN 05/2025 (JE/DMS/CMA), published on every
RRB website (this copy from rrbsecunderabad.gov.in). CBT-1 is common to all posts;
CBT-2 has four common sections and Technical Abilities from the exam group's annexure.
"""

import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from csir_net_to_md import topics  # noqa: E402
from gate_to_md import clean  # noqa: E402
from numbered_to_md import front, render  # noqa: E402

GROUPS = {
    "A": ("rrb-je-civil", "Civil", [
        "Engineering Mechanics", "Building Construction", "Building materials", "Construction of substructure",
        "Construction of superstructure", "Building finishes", "Building maintenance", "Building drawing",
        "Concrete Technology", "Surveying", "Computer Aided Design", "Geo Technical Engineering", "Hydraulics",
        "Irrigation Engineering", "Mechanics of Structures", "Theory of structures", "Design of Concrete Structures",
        "Design of Steel Structures", "Transportation Engineering", "Highway Engineering",
        "Environmental Engineering", "Advanced Construction Techniques and Equipment", "Estimating and Costing",
        "Contracts and Accounts",
    ]),
    "B": ("rrb-je-electrical", "Electrical", [
        "Basic concepts", "Circuit law", "Magnetic Circuit", "AC Fundamentals",
        "Measurement and measuring instruments", "Electrical Machines", "Synchronous Machines",
        "Generation, Transmission and Distribution", "Switchgears and Protection", "Estimation and costing",
        "Utilization of Electrical Energy", "Basic Electronics",
    ]),
    "C": ("rrb-je-electronics", "Electronics", [
        "Electronic Components & Materials", "Electronic Devices and circuits", "Digital Electronics",
        "Linear Integrated Circuit", "Microprocessor and Microcontroller", "Electronic Measurements",
        "Communication Engineering", "Data communication and Network", "Computer Programming",
        "Basic Electrical Engg.",
    ]),
    "D": ("rrb-je-mechanical", "Mechanical", [
        "Engineering Mechanics", "Material Science", "Strength of Materials", "Machining", "Welding",
        "Grinding & Finishing Process", "Metrology", "Fluid Mechanics & Hydraulic Machinery",
        "Industrial Management", "Thermal Engineering",
    ]),
}

# Abbreviations whose full stops would read as sentence ends.
ABBREVIATIONS = {
    "D.C.": "DC", "R.M.S.": "RMS", "O.C.": "OC", "S.C.": "SC", "R.L. and C": "R L and C", "H.R.C.": "HRC",
    "e.m.f.": "emf", "e.g.": "eg", "R-Land": "R-L and", "Engg.": "Engineering",
    "gyration of : (a) ": "gyration of ", "Z- Section": "Z-Section",
}


def listed(text: str, label: str, stop: str, separator: str = ",") -> list:
    block = text[text.index(label) + len(label) :]
    block = re.sub(r"\s+", " ", block[: block.index(stop)])
    block = re.sub(r"\s*etc\.?\s*$", "", block.strip().rstrip("."))
    return [clean(x) for x in block.split(separator) if clean(x)]


def annexure(ann: str, letter: str, titles: list) -> list:
    start = ann.index(f"Annexure-VII {letter}")
    following = [ann.find(f"Annexure-VII {c}", start + 1) for c in "BCDE"]
    end = min(p for p in following if p > start)
    lines = []
    for line in ann[start:end].splitlines():
        if re.search(r"CEN No\.|Page \d+ of|Annexure-VII|Syllabus for|^\s*S\.\s*N\.?|^\s*Subject\s*$", line):
            continue
        lines.append(re.sub(r"^\s*\d{1,2}(\s+|$)", "", line).strip())
    text = re.sub(r"\s+", " ", " ".join(lines))
    for wrong, right in ABBREVIATIONS.items():
        text = text.replace(wrong, right)
    positions = []
    for title in titles:
        title = ABBREVIATIONS.get(title, title.replace("Engg.", "Engineering"))
        found = re.search(re.escape(title) + r"\s*(?:-|:|–)\s*", text)
        if not found:
            raise ValueError(f"Annexure VII {letter}: title not found: {title}")
        positions.append((found.start(), found.end(), title))
    positions.sort()
    chapters = []
    for index, (_, content_start, title) in enumerate(positions):
        content_end = positions[index + 1][0] if index + 1 < len(positions) else len(text)
        content = text[content_start:content_end]
        # "(b) 1 phase transformers" after a full stop starts a part; inside a list it is a comma.
        content = re.sub(r"\.\s*\([a-f]\)\s*", ". ", content)
        content = re.sub(r":?\s*\([a-f]\)\s*", ", ", content)
        chapters.append((title, topics(content)))
    return chapters


def common(text: str) -> list:
    maths = listed(text, "a. Mathematics:", "b. General Intelligence")
    reasoning = listed(text, "b. General Intelligence and Reasoning:", "c. General Awareness")
    awareness = listed(text, "c. General Awareness:", "d. General Science")
    awareness = [a.replace("Knowledge of Current affairs", "Current affairs") for a in awareness]
    computers = listed(text.replace("Storage devices, Networking,", "Storage devices; Networking;"), "c) Basics of Computers and Applications:", "d) Basics of Environment", ";")
    environment = listed(text, "d) Basics of Environment and Pollution Control:", "e) Technical Abilities", ";")
    return [
        ("CBT 1: Mathematics", [("Mathematics", maths)]),
        ("CBT 1: General Intelligence and Reasoning", [("General Intelligence and Reasoning", reasoning)]),
        ("General Awareness (CBT 1 and 2)", [("General Awareness", awareness)]),
        ("General Science (CBT 1) and Physics and Chemistry (CBT 2)", [
            ("Physics", ["Physics up to Class 10 (CBSE syllabus)"]),
            ("Chemistry", ["Chemistry up to Class 10 (CBSE syllabus)"]),
            ("Life Sciences", ["Life Sciences up to Class 10 (CBSE syllabus, CBT 1 only)"]),
        ]),
        ("CBT 2: Basics of Computers and Applications", [("Basics of Computers and Applications", computers)]),
        ("CBT 2: Basics of Environment and Pollution Control",
         [("Basics of Environment and Pollution Control", environment)]),
    ]


if __name__ == "__main__":
    # NFKC turns PDF ligatures ("ﬁ") back into letters.
    text = unicodedata.normalize("NFKC", Path(sys.argv[1]).read_text(encoding="utf8"))
    ann = unicodedata.normalize("NFKC", Path(sys.argv[2]).read_text(encoding="utf8"))
    out = Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    shared = common(text)
    for letter, (template_id, branch, titles) in GROUPS.items():
        chapters = annexure(ann, letter, titles)
        body = []
        for subject, chs in shared:
            body += render(subject, chs)
        body += render(f"CBT 2: Technical Abilities ({branch} and Allied)", chapters)
        (out / f"{template_id}.md").write_text(
            front(
                template_id,
                f"RRB JE {branch}",
                f"Railway Junior Engineer ({branch} and allied exam group): CBT 1, and CBT 2 with its technical syllabus.",
                f"RRB CEN 05/2025 (JE/DMS/CMA), para 13 and Annexure VII {letter}; topics split from the official text.",
            )
            + "\n".join(body)
            + "\n",
            encoding="utf8",
        )
        print(template_id, len(chapters), "chapters", sum(len(t) for _, t in chapters), "topics")
