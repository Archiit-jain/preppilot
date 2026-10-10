"""Draft the AIAPGET Homoeopathy template from the BHMS syllabus published by NCH (nch.org.in/upload/bhms_syllabus.pdf).

AIAPGET's bulletin says the syllabus is the subjects of NCH's graduate-level (BHMS) regulations. NCH's newer
competency-based curriculum so far covers only the first BHMS year, so the full BHMS syllabus is used.

Usage: python bhms_to_md.py <bhms.txt> <out.md>   (`pdftotext -enc UTF-8 -layout` of the PDF)
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402

# Subject headings as printed (an all-caps line on its own), with the name used in the template.
SUBJECTS = [
    ("ANATOMY", "Anatomy"), ("PHYSIOLOGY", "Physiology"),
    ("ORGANON OF MEDICINE WITH HOMOEOPATHIC PHILOSOPHY", "Organon of Medicine and Homoeopathic Philosophy"),
    ("HOMOEOPATHIC PHARMACY", "Homoeopathic Pharmacy"), ("HOMOEOPATHIC MATERIA MEDICA", "Homoeopathic Materia Medica"),
    ("PATHOLOGY", "Pathology and Microbiology"), ("FORENSIC MEDICINE AND TOXIOCOLOGY", "Forensic Medicine and Toxicology"),
    ("REPERTORY", "Repertory"), ("SURGERY", "Surgery"), ("GYNAECOLOGY AND OBSTETRICS", "Obstetrics and Gynaecology"),
    ("COMMUNITY MEDICINE", "Community Medicine"), ("PRACTICE OF MEDICINE", "Practice of Medicine"),
]
HEAD = re.compile(r"^\s{0,12}\(?(?:\d{1,2}|[IVX]{1,5}|[A-Za-z]|[ivx]{1,4})[.)]\s+(.{3,}?)\s*[:;-]?\s*$")
STOP = re.compile(r"^\s*(?:[B-Z]\.\s*)?(?:Practical|Examination|Distribution of marks|Clinical|C\. )", re.I)


def subject_blocks(text: str) -> list:
    lines = text.split("\n")
    starts = []
    for i, l in enumerate(lines):
        s = re.sub(r"^Instructions:\s*", "", l.strip()).rstrip(".")
        for head, name in SUBJECTS:
            if s == head and name not in [n for _, n in starts]:
                starts.append((i, name))
    starts.sort()
    out = []
    for k, (i, name) in enumerate(starts):
        end = starts[k + 1][0] if k + 1 < len(starts) else len(lines)
        out.append((name, lines[i + 1:end]))
    return out


def parse(lines: list) -> list:
    # Start at the theory part when the subject has one.
    for k, l in enumerate(lines):
        if re.match(r"^\s*(?:A\.\s*)?Theory\b", l.strip(), re.I):
            lines = lines[k + 1:]
            break
    chapters, cur = [], None
    for raw in lines:
        if not raw.strip():
            continue
        if STOP.match(raw) and chapters:
            break
        indent = len(raw) - len(raw.lstrip())
        h = HEAD.match(raw)
        text = raw.strip()
        is_head = h and len(h.group(1)) < 90 and (text.endswith((":", ":-", "-")) or (indent <= 2 and not text.endswith(".")))
        if h and not is_head and cur is not None:
            cur[1].append(h.group(1))
            continue
        if is_head:
            cur = (fit(h.group(1).strip(" .:;-"))[0], [])
            chapters.append(cur)
        elif cur is not None and indent > 12:
            if cur[1] and (text[:1].islower() or cur[1][-1].endswith((",", "-", "and", "of"))):
                cur[1][-1] = cur[1][-1] + " " + text
            else:
                cur[1].append(text)
    result = []
    for name, items in chapters:
        topics = []
        for it in items:
            it = re.sub(r"^\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s*", "", it)
            for part in re.split(r";\s+|(?<=[a-z\)])\.\s+", it):
                part = re.sub(r"^\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s*", "", part).strip(" .,:-")
                if len(part) > 2 and re.search(r"[A-Za-z]{3}", part):
                    topics.extend(fit(part))
        result.append((name, list(dict.fromkeys(topics)) or [name]))
    return result


if __name__ == "__main__":
    text = Path(sys.argv[1]).read_text(encoding="utf8").replace("\x0c", "\n")
    body = []
    for name, lines in subject_blocks(text):
        chapters = [(name if c == "Theory" else c, t) for c, t in parse(lines)]
        print(name, len(chapters), sum(len(t) for _, t in chapters))
        if chapters:
            body += render(name, chapters)
    head = front("aiapget-homoeopathy", "AIAPGET Homoeopathy", "All India AYUSH PG Entrance Test (Homoeopathy): the BHMS subjects from Anatomy to Practice of Medicine.",
                 "NTA AIAPGET 2026 bulletin (syllabus = NCH graduate-level BHMS regulations); topics from the BHMS syllabus published by NCH, nch.org.in.")
    Path(sys.argv[2]).write_text(head + "\n".join(body) + "\n", encoding="utf8")
