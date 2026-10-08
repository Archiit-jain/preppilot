"""Draft the four UPSC ESE templates from the ESE notification's "Standard and Syllabi".

Usage: python upsc_ese_to_md.py <ese.raw.txt from `pdftotext -enc UTF-8`> <out dir>

Each template: Paper I General Studies and Engineering Aptitude (common), then the
discipline's Paper I and Paper II, which together form the Prelims Paper II and
the two Mains papers.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import clean, fit  # noqa: E402
from numbered_to_md import front, papers, render  # noqa: E402

DISCIPLINES = [
    ("Civil Engineering", "upsc-ese-civil"),
    ("Mechanical Engineering", "upsc-ese-mechanical"),
    ("Electrical Engineering", "upsc-ese-electrical"),
    ("Electronics & Telecommunication Engineering", "upsc-ese-electronics-telecom"),
]


def general_studies(section: str) -> list:
    line = next(l for l in section.splitlines() if l.startswith("1. Current issues"))
    items = re.split(r",?\s*\d{1,2}\.\s+", " " + line)
    return [t for item in items if clean(item) for t in fit(clean(item))]


if __name__ == "__main__":
    text = Path(sys.argv[1]).read_text(encoding="utf8")
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    syllabi = text[text.index("Section-III Standard and Syllabi") :]
    syllabi = syllabi[: syllabi.index("Appendix-IIA")]
    # Three Electrical chapters are printed without a colon after their title.
    for title in ("Engineering Mathematics", "Electrical Materials", "Electric Circuits and Fields"):
        syllabi = re.sub(rf"(\n\d\. {re.escape(title)}) (?=[A-Z])", r"\1: ", syllabi)
    gs = general_studies(syllabi)

    starts = [
        re.search(rf"\n\s*{re.escape(name)}\s*\n\s*Contents for syllabi", syllabi).start()
        for name, _ in DISCIPLINES
    ]
    for index, (name, template_id) in enumerate(DISCIPLINES):
        end = starts[index + 1] if index + 1 < len(starts) else len(syllabi)
        block = syllabi[starts[index] : end]
        block = block[block.index("PAPER") :]
        parsed = papers(block)
        body = ["# Prelims Paper I: General Studies and Engineering Aptitude",
                "## General Studies and Engineering Aptitude"] + [f"- {t}" for t in gs]
        for paper, chapters in parsed:
            body += render(f"{name}: {paper}", chapters)
        (out / f"{template_id}.md").write_text(
            front(
                template_id,
                f"UPSC ESE {name.replace('&', 'and')}",
                f"Engineering Services: General Studies and Engineering Aptitude, and both {name} papers.",
                "UPSC Engineering Services Examination 2027 notification, Section III Standard and Syllabi; topics split from the official text.",
            )
            + "\n".join(body)
            + "\n",
            encoding="utf8",
        )
        print(template_id, [(p, len(c)) for p, c in parsed])
