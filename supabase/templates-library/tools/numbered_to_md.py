"""Shared parsing for syllabi written as numbered chapters under paper headings.

Many official syllabi (UPSC ESE, CSIR NET and others) read:

    PAPER - I
    1. Building Materials: Stone, Lime, Glass; Cement: Types, Composition ...
    2. Solid Mechanics: Elastic constants, Stress ...

`papers(text)` turns that into [(paper, [(chapter, [topics])])], using the same
topic splitting as the UGC NET converter, so a line "Cement: Types, Uses"
becomes topics "Cement: Types", "Cement: Uses".
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import clean, fit  # noqa: E402
from ugcnet_to_md import topics_from  # noqa: E402

PAPER = re.compile(r"^PAPER\s*[-–]?\s*(I{1,3}|\d)\b\s*(.*)$", re.I)
CHAPTER = re.compile(r"^(\d{1,2})\.\s*([^:]{2,90}?)\s*:\s*(.*)$")
PAGE = re.compile(r"^\d{1,3}$")


def joined(lines: list) -> list:
    """Rejoins wrapped lines: a new logical line starts at a paper or a numbered chapter."""
    out = []
    for line in lines:
        line = line.strip()
        if not line or PAGE.match(line):
            continue
        if PAPER.match(line) or CHAPTER.match(line) or not out:
            out.append(line)
        elif out[-1].endswith("-") and line[:1].islower():
            out[-1] += line
        else:
            out[-1] += " " + line
    return out


def papers(text: str, first_paper: str = "Paper I") -> list:
    result = []
    current = None
    for line in joined(text.splitlines()):
        paper = PAPER.match(line)
        if paper:
            current = (f"Paper {paper.group(1).upper()}", [])
            result.append(current)
            line = paper.group(2).strip()
            if not line:
                continue
        chapter = CHAPTER.match(line)
        if current is None:
            current = (first_paper, [])
            result.append(current)
        if chapter:
            name = fit(clean(chapter.group(2)))[0]
            current[1].append((name, topics_from(chapter.group(3))))
        elif current[1]:
            current[1][-1][1].extend(topics_from(line))
    return [(p, [(c, list(dict.fromkeys(t))[:200]) for c, t in chs if t]) for p, chs in result]


def render(subject: str, chapters: list) -> list:
    out = [f"# {subject}"]
    for name, topics in chapters:
        out.append(f"## {name}")
        out.extend(f"- {t}" for t in topics)
    return out


def front(template_id, name, description, source, category="exam"):
    return (
        "---\n"
        f"id: {template_id}\n"
        f"name: {name}\n"
        f"description: {description}\n"
        f"category: {category}\n"
        f"source: {source}\n"
        "verified: false\n"
        "version: 1\n"
        "---\n"
    )
