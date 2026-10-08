"""Draft GATE templates from the official GATE syllabus PDFs.

Usage: python gate_to_md.py <dir with CODE.raw.txt from `pdftotext`> <out dir>

The official syllabus is written as "Section N: Subject" headings followed by
"Chapter: topic; topic, topic" paragraphs. This turns that into the library's
Markdown source. The output is a draft: each file is reviewed before it is
committed, and is marked unverified because the topic split is mechanical.
"""

import re
import sys
from pathlib import Path

PAPERS = {
    "AE": ("gate-aerospace", "GATE Aerospace Engineering"),
    "AG": ("gate-agricultural", "GATE Agricultural Engineering"),
    "AR": ("gate-architecture-planning", "GATE Architecture and Planning"),
    "BM": ("gate-biomedical", "GATE Biomedical Engineering"),
    "BT": ("gate-biotechnology", "GATE Biotechnology"),
    "CH": ("gate-chemical", "GATE Chemical Engineering"),
    "CY": ("gate-chemistry", "GATE Chemistry"),
    "CE": ("gate-civil", "GATE Civil Engineering"),
    "DA": ("gate-data-science-ai", "GATE Data Science and Artificial Intelligence"),
    "EY": ("gate-ecology-evolution", "GATE Ecology and Evolution"),
    "EE": ("gate-electrical", "GATE Electrical Engineering"),
    "EC": ("gate-electronics-communication", "GATE Electronics and Communication Engineering"),
    "ES": ("gate-environmental", "GATE Environmental Science and Engineering"),
    "GE": ("gate-geomatics", "GATE Geomatics Engineering"),
    "MA": ("gate-mathematics", "GATE Mathematics"),
    "ME": ("gate-mechanical", "GATE Mechanical Engineering"),
    "MT": ("gate-metallurgical", "GATE Metallurgical Engineering"),
    "MN": ("gate-mining", "GATE Mining Engineering"),
    "NM": ("gate-naval-marine", "GATE Naval Architecture and Marine Engineering"),
    "PE": ("gate-petroleum", "GATE Petroleum Engineering"),
    "PH": ("gate-physics", "GATE Physics"),
    "ST": ("gate-statistics", "GATE Statistics"),
    "TF": ("gate-textile", "GATE Textile Engineering and Fibre Science"),
    "XL": ("gate-life-sciences", "GATE Life Sciences"),
}

GENERAL_APTITUDE = """# General Aptitude
## Verbal Aptitude
- Basic English grammar: tenses, articles, adjectives, prepositions, conjunctions
- Verb-noun agreement and other parts of speech
- Basic vocabulary: words, idioms and phrases in context
- Reading and comprehension
- Narrative sequencing
## Quantitative Aptitude
- Data interpretation: bar graphs, pie charts and other graphs
- 2- and 3-dimensional plots, maps and tables
- Numerical computation and estimation: ratios, percentages, powers, exponents and logarithms
- Permutations, combinations and series
- Mensuration and geometry
- Elementary statistics and probability
## Analytical Aptitude
- Logic: deduction and induction
- Analogy
- Numerical relations and reasoning
## Spatial Aptitude
- Transformation of shapes: translation, rotation, scaling, mirroring, assembling and grouping
- Paper folding, cutting and patterns in 2 and 3 dimensions
"""

NOISE = re.compile(r"^(GATE 2026|IIT Guwahati.*|Page \d+.*|\d+)$")
SUBJECT = re.compile(
    r"^(?:Section\s*\d+\s*[:.\-–]?\s*|Part[\s-]*[A-Z0-9]+\s*(?:\([^)]*\))?\s*[:.\-–]\s*|XL-[P-U]\s+)(.*)$"
)
CHAPTER = re.compile(r"^([A-Z][^:;]{2,80}?):\s*(.+)$")


def clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip(" .;,:")
    text = re.sub(r"^\(?[ivx]+\)\s*", "", text)
    text = re.sub(r"^(and|or)\s+", "", text, flags=re.I)
    return text[:1].upper() + text[1:] if text else text


def topics_of(text: str) -> list:
    out = []
    for piece in re.split(r";|\.\s+(?=[A-Z])", text):
        piece = clean(piece)
        if not piece:
            continue
        if len(piece) > 110 or piece.count(",") >= 2:
            # Long runs of comma-separated items read better one by one, but
            # never split inside brackets.
            parts, depth, current = [], 0, ""
            for ch in piece:
                depth += ch == "("
                depth -= ch == ")"
                if ch == "," and depth == 0:
                    parts.append(current)
                    current = ""
                else:
                    current += ch
            parts.append(current)
            out.extend(clean(p) for p in parts if clean(p))
        else:
            out.append(piece)
    return [p for t in out if t.lower() not in {"etc", "etc."} for p in fit(t)]


LIMIT = 120  # the app's MAX_NAME_LENGTH


def fit(topic: str) -> list:
    """Splits a topic too long for the app at its natural joins; shortens as a last resort."""
    if len(topic) <= LIMIT:
        return [topic]
    # "Heading (a, b, c)" too long as one: each bracketed item under the heading.
    bracketed = re.match(r"^(.{2,60}?)\s*\((.+)\)\s*$", topic)
    if bracketed and "," in bracketed.group(2):
        head = clean(bracketed.group(1))
        return [q for p in bracketed.group(2).split(",") if clean(p) for q in fit(f"{head}: {clean(p)}")]
    for joint in (", ", " and ", "; ", " - "):
        parts = [clean(p) for p in topic.split(joint) if clean(p)]
        if len(parts) > 1:
            return [q for p in parts for q in fit(p)]
    cut = topic[: LIMIT - 1].rsplit(" ", 1)[0]
    return [cut + "…"]


def convert(code: str, raw: str) -> str:
    template_id, name = PAPERS[code]
    # Page headers can land mid-sentence where a paragraph crosses a page.
    raw = re.sub(r"GATE 2026|IIT Guwahati \| Organizing Institute", " ", raw)
    lines = [l.strip() for l in raw.replace("\f", "\n").splitlines()]
    lines = [l for l in lines if l and not NOISE.match(l) and not re.match(rf"^{code}\s", l)]

    subjects = []  # (name, [(chapter, [topics])])
    current = None
    skip_note = False

    def subject(title):
        nonlocal current
        current = (clean(title) or name.replace("GATE ", ""), [])
        subjects.append(current)

    xl = code == "XL"
    for line in lines:
        if re.match(r"^(Important Note|Note\b|In each of the following)", line, re.I):
            skip_note = True
            continue
        if re.match(r"^(Core|Special) Topics:?$", line, re.I):
            continue
        # Life Sciences: the sub-papers (XL-P Chemistry ...) are the subjects,
        # and their numbered sections are chapters.
        if xl:
            sub = re.match(r"^XL-[P-U]\s+(.+?)(?:\s*\(.*\))?$", line)
            if sub:
                subject(sub.group(1))
                continue
            sec = re.match(r"^Section\s*\d+\s*:?\s*(.*)$", line)
            if sec and current is not None:
                current[1].append((clean(sec.group(1)) or f"Section {len(current[1]) + 1}", []))
                continue
        heading = SUBJECT.match(line)
        if heading and len(line) < 120:
            skip_note = False
            subject(heading.group(1) or line)
            continue
        match = CHAPTER.match(line)
        # A note runs until the next heading or chapter.
        if skip_note and not match:
            continue
        skip_note = False
        if current is None:
            subject(name.replace("GATE ", ""))
        if match:
            current[1].append((clean(match.group(1)), topics_of(match.group(2))))
        elif current[1]:
            current[1][-1][1].extend(topics_of(line))
        else:
            current[1].append((current[0], topics_of(line)))

    body = []
    for title, chapters in subjects:
        chapters = [(c, t) for c, t in chapters if t]
        if not chapters:
            continue
        body.append(f"# {title}")
        for chapter, topics in chapters:
            body.append(f"## {chapter}")
            body.extend(f"- {t}" for t in topics)
    return (
        "---\n"
        f"id: {template_id}\n"
        f"name: {name}\n"
        f"description: General Aptitude and the full {name.replace('GATE ', '')} paper syllabus.\n"
        "category: exam\n"
        f"source: GATE 2026 official syllabus ({code}), IIT Guwahati; topics split from the official text.\n"
        "verified: false\n"
        "version: 1\n"
        "---\n" + GENERAL_APTITUDE + "\n".join(body) + "\n"
    )


if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for code in PAPERS:
        text = (src / f"{code}.raw.txt").read_text(encoding="utf8", errors="replace")
        (out / f"{PAPERS[code][0]}.md").write_text(convert(code, text), encoding="utf8")
        print(code, "->", PAPERS[code][0])
