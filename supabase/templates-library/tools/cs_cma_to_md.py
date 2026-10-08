"""Draft the CS Executive, CS Professional and CMA Foundation, Intermediate and Final templates.

CSEET's syllabus is a two-column table that does not extract cleanly; src/professional/cseet.md
is written by hand from it.

Usage: python cs_cma_to_md.py <dir> <out dir>
  <dir>/cs/<paper>.txt `pdftotext -enc UTF-8 -l 30` of each ICSI Syllabus 2022 study material
                      (icsi.edu Executive and Professional Programme pages); each opens with the
                      paper's official syllabus ("SYLLABUS" ... "ARRANGEMENT OF STUDY LESSONS")
  <dir>/cma.txt       `pdftotext -enc UTF-8` of ICMAI CMA Prospectus with Syllabus 2022
                      (icmai.in, Syllabus 2022 page)
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
    return unicodedata.normalize("NFKC", path.read_text(encoding="utf8")).replace(chr(12), "\n")


def bullets(text: str) -> list:
    """ICSI lists sub-topics after a bullet that extracts as a lone "l"."""
    out = []
    for item in re.split(r"(?:^|\s)l\s+(?=[A-Z0-9(])", re.sub(r"\s+", " ", text)):
        item = clean(item)
        if item and re.search(r"[A-Za-z]{3}", item):
            out += [item] if len(item) <= 110 else topics(item)
    return list(dict.fromkeys(out))


# --- ICSI Executive and Professional -----------------------------------------
EXECUTIVE = [("e1", "Paper 1: Jurisprudence, Interpretation and General Laws"),
             ("e2", "Paper 2: Company Law and Practice"),
             ("e3", "Paper 3: Setting Up of Business, Industrial and Labour Laws"),
             ("e4", "Paper 4: Corporate Accounting and Financial Management"),
             ("e5", "Paper 5: Capital Market and Securities Laws"),
             ("e6", "Paper 6: Economic, Commercial and Intellectual Property Laws"),
             ("e7", "Paper 7: Tax Laws and Practice")]
PROFESSIONAL = [("p1", "Paper 1: Environmental, Social and Governance (ESG) - Principles and Practice"),
                ("p2", "Paper 2: Drafting, Pleadings and Appearances"),
                ("p3", "Paper 3: Compliance Management, Audit and Due Diligence"),
                ("p41", "Elective Paper 4.1: CSR and Social Governance"),
                ("p42", "Elective Paper 4.2: Internal and Forensic Audit"),
                ("p43", "Elective Paper 4.3: Intellectual Property Rights - Law and Practice"),
                ("p44", "Elective Paper 4.4: AI, Data Analytics and Cyber Security - Laws and Practice"),
                ("p45", "Elective Paper 4.5: Advanced Direct Tax Laws and Practice"),
                ("p46", "Elective Paper 4.6: IFSCA - Regulations, Listing and Compliances"),
                ("p5", "Paper 5: Strategic Management and Corporate Finance"),
                ("p6", "Paper 6: Corporate Restructuring, Valuation and Insolvency"),
                ("p71", "Elective Paper 7.1: Arbitration, Mediation and Conciliation"),
                ("p72", "Elective Paper 7.2: GST and Corporate Tax Planning"),
                ("p73", "Elective Paper 7.3: Labour Laws and Practice"),
                ("p74", "Elective Paper 7.4: Banking and Insurance - Laws and Practice"),
                ("p75", "Elective Paper 7.5: Insolvency and Bankruptcy - Law and Practice")]


def icsi_paper(text: str) -> list:
    # "SYLLABUS", "SYLLABUS*" or "SYLLABUS OBJECTIVES: ..." at the start of a line.
    start = re.search(r"(?m)^\s*SYLLABUS\b\*?", text) or re.search(r"Level of Knowledge", text)
    end = re.search(r"ARRANGEMENT OF STUDY|LESSON WISE SUMMARY", text[start.end():])
    block = text[start.end(): start.end() + end.start()] if end else text[start.end():]
    block = re.sub(r"\(\s*[ivxl]+\s*\)", " ", block)  # page numbers in roman numerals
    block = re.sub(r"\s+", " ", block)
    # Lesson titles, from the "Arrangement of Study Lessons" list, for papers whose syllabus
    # runs a title straight into its contents without a colon.
    arrangement = re.search(r"ARRANGEMENT OF STUDY LESSONS(.{0,3000})", re.sub(r"\s+", " ", text))
    lessons = []
    if arrangement:
        lessons = [clean(t) for t in re.split(r"(?<![\d.])\b\d{1,2}\.\s+", arrangement.group(1))[1:] if clean(t)]
    chapters = []
    for item in re.split(r"(?<![\d.])\b(?=\d{1,2}\.\s+[A-Z])", block):
        head = re.match(r"(\d{1,2})\.\s+([^:]{3,140}?)\s*:\s*(.*)$", item.strip())
        plain = re.match(r"(\d{1,2})\.\s+(.*)$", item.strip())
        if plain and lessons:
            match = next((l for l in lessons if plain.group(2).startswith(l[:40]) and len(l) > 5), None)
            if match and (not head or len(head.group(2)) > len(match) + 20):
                rest = plain.group(2)[len(match):] if plain.group(2).startswith(match) else plain.group(2)[40:]
                head = re.match(r"(\d+)\.\s+(.*?)\s*:\s*(.*)$", f"{plain.group(1)}. {match}: {rest}")
        if not head:
            continue
        found = bullets(head.group(3))
        if len(found) <= 1 and ";" in head.group(3):  # some papers list sub-topics with semicolons
            found = [t for p in head.group(3).split(";") for t in fit(clean(p)) if re.search(r"[A-Za-z]{3}", t)]
        if found:
            chapters.append((fit(clean(head.group(2)))[0], found))
    return chapters


def icsi(src: Path, papers: list) -> list:
    return [(name, icsi_paper(read(src / "cs" / f"{key}.txt"))) for key, name in papers]


# --- ICMAI CMA ---------------------------------------------------------------
CMA_LEVELS = {"cma-foundation": range(1, 5), "cma-intermediate": range(5, 13), "cma-final": range(13, 21)}


def cma_papers(text: str) -> dict:
    papers = {}
    # The case-study, reading-list and fee pages follow the last paper.
    text = text[: text.index("APPLICATIONS OF LEARNING POINTS")]
    # "PAPER - 5 BUSINESS LAWS...", "PAPER - 3" (title on the next lines), "PAPER - 20 A STRATEGIC..."
    heads = list(re.finditer(r"(?m)^PAPER\s*-\s*(\d{1,2})\s?([A-C])?\b[ \t]*([A-Z][A-Z ,&()\-]*?)?[ \t]*$", text))
    for n, head in enumerate(heads):
        end = heads[n + 1].start() if n + 1 < len(heads) else len(text)
        body = text[head.end():end]
        title_more = re.match(r"\s*([A-Z][A-Z ,&()\-]+)\n(?:\s*([A-Z][A-Z ,&()\-]+)\n)?", body)  # wrapped titles
        title = " ".join(t for t in [head.group(3) or ""] + list(title_more.groups() if title_more else []) if t)
        title = re.sub(r"\s*\(SECTION\s*-\s*[AB]\)", "", title)
        number = int(head.group(1))
        key = f"{number}{head.group(2) or ''}"
        # The whole paper body: the PDF's page order can put later modules before "SECTION A".
        # Only "N. Title" followed by "N.M" items counts, so the weight table is skipped.
        body = re.sub(r"\s+", " ", body)
        body = re.sub(r"www\.icmai\.in|CMA Prospectus - \d{4}|\d+ The Institute of Cost Accountants of India", " ",
                      body)
        chapters = []
        for item in re.split(r"(?<![\d.,])\b(?=\d{1,2}\.\s+[A-Z])", body):
            head2 = re.match(r"(\d{1,2})\.\s+(.*)$", item.strip())
            if not head2:
                continue
            pieces = re.split(r"\s*\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s+", head2.group(2))
            title2 = re.split(r"\s+SECTION\s+[A-Z]\s*:", pieces[0])[0]
            found = [clean(re.split(r"\s+SECTION\s+[A-Z]\s*:", p)[0]) for p in pieces[1:]]
            found = [t for f in found for t in fit(f) if re.search(r"[A-Za-z]{3}", t)]
            if found:
                chapters.append((fit(clean(title2))[0], list(dict.fromkeys(found))))
        merged = {}
        for c, t in chapters:  # a module split by a page break appears twice
            merged.setdefault(c, []).extend(t)
        chapters = [(c, list(dict.fromkeys(t))) for c, t in merged.items()]
        name = re.sub(r"\s*\([A-Z]+\)\s*$", "", title).title().replace(" And ", " and ").replace(" Of ", " of ")
        papers.setdefault(key, (f"Paper {key}: {name}", chapters))
    return papers


def cma(text: str, numbers) -> list:
    papers = cma_papers(text)
    return [papers[k] for k in sorted(papers, key=lambda k: (int(re.match(r"\d+", k).group()), k))
            if int(re.match(r"\d+", k).group()) in numbers]


TEMPLATES = [
    ("cs-executive", "CS Executive", "ICSI Executive Programme (Syllabus 2022): Groups 1 and 2, seven papers.",
     "ICSI Syllabus 2022, the syllabus page of each paper's official study material, icsi.edu.",
     lambda src: icsi(src, EXECUTIVE)),
    ("cs-professional", "CS Professional",
     "ICSI Professional Programme (Syllabus 2022): core papers and both elective papers' options.",
     "ICSI Syllabus 2022, the syllabus page of each paper's official study material, icsi.edu.",
     lambda src: icsi(src, PROFESSIONAL)),
    ("cma-foundation", "CMA Foundation", "ICMAI CMA Foundation (Syllabus 2022): Papers 1 to 4.",
     "ICMAI CMA Prospectus, Syllabus 2022, detailed contents; topics from the official text.",
     lambda src: cma(read(src / "cma.txt"), CMA_LEVELS["cma-foundation"])),
    ("cma-intermediate", "CMA Intermediate", "ICMAI CMA Intermediate (Syllabus 2022): Groups I and II, Papers 5 to 12.",
     "ICMAI CMA Prospectus, Syllabus 2022, detailed contents; topics from the official text.",
     lambda src: cma(read(src / "cma.txt"), CMA_LEVELS["cma-intermediate"])),
    ("cma-final", "CMA Final", "ICMAI CMA Final (Syllabus 2022): Groups III and IV, Papers 13 to 20 with electives.",
     "ICMAI CMA Prospectus, Syllabus 2022, detailed contents; topics from the official text.",
     lambda src: cma(read(src / "cma.txt"), CMA_LEVELS["cma-final"])),
]

if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    only = sys.argv[3:] or None
    for template_id, name, description, source, parse in TEMPLATES:
        if only and template_id not in only:
            continue
        subjects = parse(src)
        body = []
        for subject, chapters in subjects:
            body += render(subject, [(c, t[:200]) for c, t in chapters if t])
        (out / f"{template_id}.md").write_text(front(template_id, name, description, source) + "\n".join(body) + "\n",
                                               encoding="utf8")
        print(template_id, [(s[:30], len(c), sum(len(t) for _, t in c)) for s, c in subjects])
