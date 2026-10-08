"""Draft the SSC JE Civil, Electrical and Mechanical templates.

Usage: python ssc_je_to_md.py <je.txt from `pdftotext -enc UTF-8`> <out dir>

Source: SSC "Notice of Junior Engineer Examination, 2026" (ssc.gov.in, notice board,
Notice_of_adv_je_2026.pdf), para 14 Indicative Syllabus. Paper I is General
Intelligence and Reasoning, General Awareness and the engineering part; Paper II is
the engineering part in detail, so the engineering topics come from Paper II and
cover both papers.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from csir_net_to_md import topics  # noqa: E402
from gate_to_md import clean, fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402

PARTS = [
    ("Part-A (Civil & Structural Engineering):", "ssc-je-civil", "Civil"),
    ("Part-B (Electrical Engineering):", "ssc-je-electrical", "Electrical"),
    ("Part- C (Mechanical Engineering):", "ssc-je-mechanical", "Mechanical"),
]
END = "Part-D (Computer Science and Information Technology):"


def paper_one(text: str) -> list:
    start = text.index("14.2 PAPER-I:")
    block = re.sub(r"\s+", " ", text[start : text.index("Part-A (Civil Engineering):", start)])
    reasoning = block[block.index("General Intelligence & Reasoning:") :].split("14.2.2")[0]
    awareness = block[block.index("General Awareness:") :]
    out = []
    for name, para in (("General Intelligence and Reasoning", reasoning), ("General Awareness", awareness)):
        body = para.split(":", 1)[1]
        # The list of question types is the syllabus; the sentences around it describe the test.
        listed = re.search(r"questions on (.+?)(?:, etc)?\.", body) or re.search(
            r"pertaining to (.+?)(?:, etc)?\.", body
        )
        items = [clean(x) for x in listed.group(1).replace("problemsolving", "problem-solving").split(",") if clean(x)]
        if name == "General Awareness":
            items = ["Current events", "Everyday observation and experience in their scientific aspect"] + [
                f"India and its neighbouring countries: {i}" for i in items
            ]
        out.append((f"Paper I: {name}", [(name, items)]))
    return out


def engineering(text: str, heading: str) -> list:
    start = text.index(heading, text.index("14.3 PAPER II:")) + len(heading)
    following = [p for p, _, _ in PARTS if text.find(p, start) > 0]
    end = min([text.index(p, start) for p in following] + [text.index(END, start)])
    block = text[start:end]
    block = re.sub(r"\n\s*14\.3\.\d\s*\n", "\n", block)  # para numbers between wrapped lines
    lines = [l.strip() for l in block.splitlines() if l.strip() and not re.fullmatch(r"Page \d+.*|\d+", l.strip())]
    joined = []
    for line in lines:
        if joined and not re.search(r"[.:;]$", joined[-1]) and not re.match(r"^[A-Z][^:]{2,60}:", line):
            joined[-1] += " " + line
        else:
            joined.append(line)
    chapters = []
    for line in joined:
        headed = re.match(r"^([A-Z][^:]{2,70}):\s*(.*)$", line)
        if headed and not headed.group(2):
            continue  # a group heading ("Construction Materials and Management:"); its lines follow
        content = headed.group(2) if headed else line
        for wrong, right in (("A.C. Circuits", "AC circuits"), ("StarDelta", "Star-Delta"), ("CAD/CAM", "CAD-CAM"), ("reuse/ recycle", "reuse, recycle")):
            content = content.replace(wrong, right)
        content = re.sub(r"\s*/\s*", "; ", content)  # Mechanical lists its topics with slashes
        found = topics(content)
        if headed:
            chapters.append((fit(clean(headed.group(1)))[0], found))
        elif chapters:
            chapters[-1][1].extend(found)
    return [(c, list(dict.fromkeys(t))) for c, t in chapters]


if __name__ == "__main__":
    text = Path(sys.argv[1]).read_text(encoding="utf8")
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    common = paper_one(text)
    for heading, template_id, branch in PARTS:
        chapters = engineering(text, heading)
        body = []
        for subject, chs in common:
            body += render(subject, chs)
        body += render(f"{branch} Engineering (Papers I and II)", chapters)
        (out / f"{template_id}.md").write_text(
            front(
                template_id,
                f"SSC JE {branch}",
                f"Junior Engineer ({branch}): reasoning and general awareness, and the {branch.lower()} engineering syllabus of Papers I and II.",
                "SSC Notice of Junior Engineer Examination 2026, para 14 Indicative Syllabus; topics split from the official text.",
            )
            + "\n".join(body)
            + "\n",
            encoding="utf8",
        )
        print(template_id, len(chapters), "chapters", sum(len(t) for _, t in chapters), "topics")
