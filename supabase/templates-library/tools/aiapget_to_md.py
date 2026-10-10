"""Draft the AIAPGET Ayurveda template from NCISM's BAMS course curricula (Table 2 of each subject).

AIAPGET's bulletin says the syllabus is the subjects of the graduate-level regulations of NCISM (Ayurveda)
and NCH (Homoeopathy). NCISM publishes one PDF per BAMS subject (ncismindia.org, 1st to 3rd professional).

Usage: python aiapget_to_md.py <dir> <out.md>
  <dir>/<CODE>.txt  `pdftotext -enc UTF-8 -layout` of each subject PDF, CODE as in SUBJECTS below

Table 2 comes in three shapes: numbered topics ("2.1 ..."), "1 Title: details. details." rows, and a title
row followed by one indented topic per line. Each is reduced to chapter -> topics; long sentences are
split at full stops and semicolons and shortened by fit().
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402

SUBJECTS = [
    ("PV", "Padartha Vijnanam"), ("SN", "Samskritam evam Ayurved Ithihas"), ("KS", "Kriya Sharira"),
    ("RS", "Rachana Sharira"), ("DG", "Dravyaguna Vijnana"), ("RB", "Rasashastra evam Bhaishajyakalpana"),
    ("RN", "Roga Nidana evam Vikriti Vijnana"), ("AT", "Agada Tantra evam Vidhi Vaidyaka"),
    ("SW", "Swasthavritta evam Yoga"), ("SA2", "Samhita Adhyayan 2"), ("KC", "Kayachikitsa"),
    ("PK", "Panchakarma evam Upakarma"), ("ST", "Shalya Tantra"), ("SL", "Shalakya Tantra"),
    ("PS", "Prasuti Tantra evam Stri Roga"), ("KB", "Kaumarabhritya"), ("SA3", "Samhita Adhyayan 3"),
]
HEADER = re.compile(r"^(Sr\.?|No|Paper|PART|Part|Term|hours|A2|B2|Lecture|Non-|List of Topics|Theory|Practica|l$|Table|Page|NCISM|.*BAMS\s*\(Ayurvedacharya\))")
CHAPTER = re.compile(r"^(\d{1,2})\.?\s+(?!\d)(\S.*)$")
PRACTICAL = re.compile(r"^(Demonstrat|Hands[- ]on|Video|Observe|Perform|Practical|Clinical posting|Visit|Case (?:taking|presentation)|Skill|Importance of Simulation)", re.I)
FOOTER = re.compile(r"AyUG-?\w+\s*-\s*I+\s*BAMS|^NCISM\s*\d|\d+\s*/\s*\d*$", re.I)
TOPIC = re.compile(r"^(\d{1,2})\.(\d{1,2})\.?\s+(.+)$")


def table2(text: str) -> str:
    starts = [m.end() for m in re.finditer(r"Table\s*2\s*:\s*Contents of Course[^\n]*\n", text)]
    if not starts:
        return ""
    body = text[starts[1] if len(starts) > 1 else starts[0]:]
    end = re.search(r"Table\s*3\s*:", body)
    return body[: end.start()] if end else body


def left_cell(raw: str) -> tuple:
    """(indent, text of the first column) with term numerals and stray figures removed."""
    indent = len(raw) - len(raw.lstrip())
    text = re.split(r"\s{3,}", raw.strip())[0]
    text = re.sub(r"\s+(?:I{1,3}|\d{1,3})$", "", text).strip()
    text = re.sub(r"^(\d{1,2})\s+\1\.\s+", r"\1 ", text)  # "1 1. Title" -> "1 Title"
    return indent, text


def sentences(text: str) -> list:
    out = []
    for part in re.split(r"(?<=[a-z\)])\.\s+|;\s+", text):
        part = part.strip(" .,:-")
        if len(part) > 3 and re.search(r"[A-Za-z]{3}", part):
            out.extend(fit(part))
    return out


def parse(text: str) -> list:
    """Chapter blocks: a numbered row at the margin starts a chapter; everything up to the next one
    belongs to it. Topics are the block's numbered items (N.M or an indented "N."), or else its
    sentences. The chapter name is the text before the first item, or before the first colon."""
    rows = [left_cell(r) for r in table2(text).split("\n") if r.strip()]
    rows = [(i, l) for i, l in rows
            if l and not HEADER.match(l) and not re.fullmatch(r"[\d\s./]+", l) and not FOOTER.search(l)]
    blocks = []
    for indent, left in rows:
        c = CHAPTER.match(left)
        if c and indent <= 2 and not TOPIC.match(left) and len(c.group(2)) > 3:
            blocks.append([c.group(2)])
        elif blocks:
            blocks[-1].append((indent, left))
    chapters = []
    for block in blocks:
        head, lines = block[0], block[1:]
        if PRACTICAL.match(head):
            continue
        items, title_tail = [], []
        for indent, left in lines:
            t = TOPIC.match(left)
            c = CHAPTER.match(left)
            if t:
                items.append(t.group(3))
            elif c and indent > 2:
                items.append(c.group(2))
            elif items:
                items[-1] += " " + left
            else:
                title_tail.append(left)
        title = " ".join([head] + title_tail)
        if items:
            name = re.split(r":\s", title, maxsplit=1)[0]
            topics = []
            for it in items:
                if PRACTICAL.match(it):
                    continue
                first = re.split(r"(?<=[a-z\)])\.\s+", it.strip(), maxsplit=1)[0]
                topics.extend(fit(first.strip(" .:-")))
        else:
            name, _, rest = title.partition(":")
            if not rest and "(" in name and name.index("(") > 8:
                # "Title (details, details)": the bracket is the content.
                pass
            topics = sentences(rest) if rest.strip() else sentences(name)[1:] or []
            if not topics:
                topics = [fit(name.strip(" .:-"))[0]]
        name = fit(re.sub(r"\s+", " ", name).strip(" .:-"))[0]
        topics = [t for t in dict.fromkeys(topics) if t and t != name]
        if topics:
            chapters.append((name, topics))
        else:
            chapters.append((name, [name]))
    return chapters


if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    body = []
    for code, name in SUBJECTS:
        chapters = parse((src / f"{code}.txt").read_text(encoding="utf8"))
        print(code, len(chapters), sum(len(t) for _, t in chapters))
        # The app allows at most 120 chapters in a subject; split longer ones into parts.
        parts = [chapters[i:i + 100] for i in range(0, len(chapters), 100)] or [[]]
        for k, part in enumerate(parts, 1):
            body += render(name if len(parts) == 1 else f"{name} (Part {k})", part)
    head = front("aiapget-ayurveda", "AIAPGET Ayurveda", "All India AYUSH PG Entrance Test (Ayurveda): the BAMS subjects of the first to third professional years.",
                 "NTA AIAPGET 2026 bulletin (syllabus = NCISM graduate-level BAMS curriculum); topics from NCISM's BAMS course curricula, Table 2 of each subject, ncismindia.org.")
    out.write_text(head + "\n".join(body) + "\n", encoding="utf8")
