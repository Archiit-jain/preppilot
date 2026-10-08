"""Draft UGC NET templates from the official UGC NET Bureau syllabus PDFs.

Usage: python ugcnet_to_md.py <dir with <key>.txt from `pdftotext -enc UTF-8`> <out dir>

Each template has two subjects: Paper I (Teaching and Research Aptitude, common
to every subject) and Paper II (the subject). Units become chapters. A line
written as "Heading: a, b; c" becomes topics "Heading: a", "Heading: b" ... so
each topic keeps its context. The output is a draft, reviewed before commit.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import LIMIT, clean, fit  # noqa: E402

SUBJECTS = {
    "commerce": ("ugc-net-commerce", "UGC NET Commerce", "08"),
    "cs": ("ugc-net-computer-science", "UGC NET Computer Science and Applications", "87"),
    "env": ("ugc-net-environmental-sciences", "UGC NET Environmental Sciences", "89"),
    "law": ("ugc-net-law", "UGC NET Law", "58"),
    "mgmt": ("ugc-net-management", "UGC NET Management", "17"),
    "pe": ("ugc-net-physical-education", "UGC NET Physical Education", "47"),
    "polsci": ("ugc-net-political-science", "UGC NET Political Science", "02"),
    "psych": ("ugc-net-psychology", "UGC NET Psychology", "04"),
    "socio": ("ugc-net-sociology", "UGC NET Sociology", "05"),
}

NOISE = re.compile(
    r"^(UNIVERSITY GRANTS COMMISSION.*|NET BUREAU|NET SYLLABUS|SYLLABUS.*|Subject\s*:.*|"
    r"Code No.*|PAPER[- ]?I+|\d{1,3}|The details of syllabi.*)$",
    re.I,
)
UNIT = re.compile(r"^Unit\s*[-–]?\s*([IVX]+|\d+)\b\s*[:.\-–]?\s*(.*)$", re.I)
NUMBERED = re.compile(r"^(\d{1,2})\.\s+([A-Z][^.]{2,90})$")
HEADED = re.compile(r"^([A-Z][^:;]{1,60}?)\s*:\s*(.+)$")


def items(text: str, separators: str = ";,") -> list:
    """Top-level pieces of a list, split on the separators but never inside brackets."""
    out, depth, current = [], 0, ""
    for ch in text:
        depth += ch in "(["
        depth -= ch in ")]"
        if ch in separators and depth == 0:
            out.append(current)
            current = ""
        else:
            current += ch
    out.append(current)
    return [clean(p) for p in out if clean(p)]


def topics_from(line: str) -> list:
    # An inline numbered list ("1. Nature of law 2. Schools of jurisprudence")
    # is one item per number.
    numbered = [p for p in re.split(r"(?:^|\s)\d{1,2}\.\s+(?=[A-Z])", line) if p.strip()]
    if len(numbered) > 1:
        return [t for part in numbered for t in topics_from(part)]
    topics = []
    line = re.sub(r"\b(vs|etc|e\.g|i\.e)\.\s", lambda m: m.group(1) + " ", line)
    for sentence in re.split(r"\.\s+(?=[A-Z])", line):
        # Semicolons separate whole ideas; commas only list within one. So a
        # sentence is cut at semicolons first. A heading ("Environmental
        # issues: ...") carries on to the parts after it until another heading.
        carry = None
        for clause in items(sentence, ";"):
            headed = HEADED.match(clause)
            if headed:
                carry = clean(headed.group(1))
                parts = items(headed.group(2), ",")
            else:
                parts = items(clause, ",") if clause.count(",") >= 2 else [clause]
            # "Forest Conservation Act, 1980": a year belongs to the piece before it.
            joined = []
            for part in parts:
                if joined and re.match(r"^\d{4}\b", part):
                    joined[-1] = f"{joined[-1]}, {part}"
                else:
                    joined.append(part)
            for part in joined:
                prefixed = f"{carry}: {part}" if carry and part != clause or (carry and not headed) else part
                topics.append(prefixed if len(prefixed) <= LIMIT else part)
    return [t for topic in topics for t in fit(topic)]


def is_heading(line: str) -> bool:
    return bool(UNIT.match(line) or NUMBERED.match(line))


def logical_lines(text: str) -> list:
    """Rejoins lines the PDF wrapped, so one bullet or paragraph is one line."""
    text = text.replace("", "\n•").replace("•", "\n•")
    raw = [l.strip() for l in text.splitlines()]
    raw = [l for l in raw if l and not NOISE.match(l)]
    out = []
    for line in raw:
        bullet = line.startswith("•")
        line = line.lstrip("• ").strip()
        if not line:
            continue
        if out and not bullet and not is_heading(line) and not is_heading(out[-1]):
            prev = out[-1]
            if prev.endswith("-") and line[:1].islower():
                out[-1] = prev + line
                continue
            abbreviation = re.search(r"\b(vs|etc|e\.g|i\.e|viz)\.$", prev)
            if not prev.endswith((".", ":")) or abbreviation or line[:1].islower():
                out[-1] = f"{prev} {line}"
                continue
        out.append(line)
    return out


def units(text: str) -> list:
    lines = logical_lines(text)
    chapters = []  # [name, [topics]]
    pending_name = False
    unit_number = ""

    for line in lines:
        if re.match(r"^NOTE\b", line):
            break  # exam-pattern notes after the last unit are not syllabus
        if not re.search(r"[A-Za-z]", line):
            continue  # a separator line such as "*****"
        if len(re.findall(r"\bUnit\b", line, re.I)) > 1:
            continue  # an overview line listing every unit
        unit = UNIT.match(line)
        numbered = NUMBERED.match(line)
        if unit or numbered:
            unit_number = unit.group(1) if unit else numbered.group(1)
            name = clean(unit.group(2) if unit else numbered.group(2))
            # A unit title that runs on into its content is cut at the first sentence.
            name = fit(name.split(". ")[0])[0] if name else name
            chapters.append([name, []])
            pending_name = not name
            continue
        if not chapters:
            continue  # the introduction before the first unit
        if pending_name:
            pending_name = False
            # A short line after an untitled unit is its title; a long one is
            # already its content, so the unit keeps its number as a name.
            if len(line) <= 60:
                chapters[-1][0] = clean(line)
                continue
            chapters[-1][0] = f"Unit {unit_number}"

        chapters[-1][1].extend(topics_from(line))
    # A unit can run past the validator's limit when its text is long.
    return [[name, topics[:200]] for name, topics in chapters if name and topics]


def render(subject: str, chapters: list) -> list:
    out = [f"# {subject}"]
    for name, topics in chapters:
        out.append(f"## {name}")
        out.extend(f"- {t}" for t in dict.fromkeys(topics))  # drop exact repeats
    return out


if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    paper1 = units((src / "paper1.txt").read_text(encoding="utf8"))
    for key, (template_id, name, code) in SUBJECTS.items():
        paper2 = units((src / f"{key}.txt").read_text(encoding="utf8"))
        subject = name.replace("UGC NET ", "")
        body = render("Paper I: Teaching and Research Aptitude", paper1) + render(
            f"Paper II: {subject}", paper2
        )
        (out / f"{template_id}.md").write_text(
            "---\n"
            f"id: {template_id}\n"
            f"name: {name}\n"
            f"description: Paper I (Teaching and Research Aptitude) and the Paper II syllabus for {subject}.\n"
            "category: exam\n"
            f"source: UGC NET Bureau official syllabus, Paper I and subject code {code}; topics split from the official text.\n"
            "verified: false\n"
            "version: 1\n"
            "---\n" + "\n".join(body) + "\n",
            encoding="utf8",
        )
        print(key, "->", template_id, len(paper2), "units")
