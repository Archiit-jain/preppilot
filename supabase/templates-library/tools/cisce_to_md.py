"""Draft the ICSE Class 9 and 10 and ISC Class 11 and 12 templates.

Usage: python cisce_to_md.py <dir> <out dir>
  <dir>/icse-<subject>.raw.txt, isc-<subject>.raw.txt: `pdftotext -enc UTF-8` (reading order) of the
  CISCE subject syllabuses: "Regulations and Syllabuses - ICSE 2027" and "- ISC 2027" (cisce.org).

Each syllabus gives Class IX and X (or XI and XII) separately. A unit is "N. Title"; a unit may
have sub-headings "(i) Title"; a unit opens with a summary sentence and then explains it in
lettered items "(a) ...". Topics are the summary's items and the first clause of each lettered
item. Practical work, projects and internal assessment are left out.
"""

import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from csir_net_to_md import topics  # noqa: E402
from gate_to_md import clean, fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402

STOP = re.compile(r"^\s*(PAPER\s*[-–]?\s*II\b|PAPER II|PRACTICAL WORK|INTERNAL ASSESSMENT|PROJECT WORK|"
                  r"EVALUATION|LIST OF SUGGESTED|SUGGESTED (?:LIST|ASSIGNMENTS|PROJECTS)|"
                  r"PRACTICAL\s*[-–:]|Paper II)", re.I)


def read(path: Path) -> str:
    text = unicodedata.normalize("NFKC", path.read_text(encoding="utf8")).replace(chr(12), "\n")
    text = re.sub(r"(?m)^\s*(?:(?:ISC|ICSE) Examination Year \d{4}|\d{1,3})\s*$", "", text)  # page furniture
    return text


def class_blocks(text: str, first: str, second: str) -> dict:
    """The text for each class, from its heading to the next class heading."""
    marks = [(m.start(), m.group(1)) for m in re.finditer(rf"(?m)^\s*CLASS\s*[-–]?\s*({first}|{second})\s*$", text)]
    blocks = {}
    for n, (start, name) in enumerate(marks):
        end = marks[n + 1][0] if n + 1 < len(marks) else len(text)
        blocks[name] = blocks.get(name, "") + "\n" + text[start:end]
    return blocks


def first_clause(item: str) -> str:
    item = re.sub(r"\s+", " ", item).strip()
    part = re.split(r";|\.\s|:\s|\s[-–]\s", item)[0]
    return clean(part)


def tidy(topic: str) -> str:
    """Drops layout leftovers: page footers, notes in brackets, marks, scraps and broken formulas."""
    topic = re.sub(r"(?:ISC|ICSE) Examination Year \d{4}(?:\s+\d{1,3}\b)?", " ", topic)
    topic = clean(re.sub(r"^\s*\([a-z]\)\s*", "", topic))
    if len(topic) < 5 or re.match(r"(?i)^(note\b|aims\b|e\.g\b|\d+\s*marks)", topic):
        return ""
    if topic.startswith("(") and topic.endswith(")"):
        return ""  # a teaching note, e.g. "(Simple numerical problems only)"
    if re.search(r"[-]", topic) or topic.count("±") + topic.count("−") >= 2:
        return ""  # a formula the PDF text cannot carry
    return topic


def chapters_of(block: str) -> list:
    lines = [l.rstrip() for l in block.splitlines()]
    # Units are numbered 1, 2, 3...; numbering restarts at 1 for the next section (Civics, then
    # History) or after an overview table that lists the unit titles. A run after a SECTION
    # heading adds to the units; any other restart replaces the run before it if it has more text.
    runs, units, expected, section_seen, run_after_section = [], [], 1, False, False
    current = None
    for line in lines:
        # Theory only: stop at the practical or project section (the introduction's
        # mention of "Paper II" comes before the first unit, so only check after it).
        if current is not None and STOP.match(line):
            break
        if re.match(r"^\s*(SECTION|PART)\s+[A-Z]\b", line):
            section_seen = True
        unit = re.match(r"^\s*(\d{1,2})\.\s+([A-Z].*)$", line)
        listing = re.search(r"\s\d{1,2}\.\s+[A-Z]", unit.group(2)) if unit else None  # an overview of all units
        if unit and int(unit.group(1)) == 1 and units and expected > 1 and not listing:
            runs.append((units, run_after_section))
            units, expected, run_after_section = [], 1, section_seen
        if unit and int(unit.group(1)) in (expected, expected + 1) and not listing:
            # A title may run on into its content: "Emergence of the Colonial Economy (i) Development..."
            title, _, rest = re.split(r"(?=\s\((?:i|a)\)\s)|(?<=[a-z)])\s*:\s+", unit.group(2), maxsplit=1)[0], "", ""
            rest = unit.group(2)[len(title):]
            if len(title) > 90:
                title, rest = title[:90].rsplit(" ", 1)[0], title[len(title[:90].rsplit(" ", 1)[0]):] + rest
            current = [clean(title), [rest] if rest.strip() else []]
            units.append(current)
            expected = int(unit.group(1)) + 1
            section_seen = False  # a SECTION heading counts only before the next restart
            continue
        if current is not None:
            current[1].append(line)
    runs.append((units, run_after_section))
    size = lambda run: sum(len(" ".join(body)) for _, body in run)  # noqa: E731
    units = []
    for run, after_section in runs:
        if after_section or not units:
            units = units + run
        elif size(run) > size(units):
            units = run
    chapters = []
    for title, body in units:
        sections, sub = [], [title, []]
        for line in body:
            heading = re.match(r"^\s*\(([ivx]+)\)\s+([A-Z][^.;:]{2,80})$", line)
            if heading:
                if sub[1]:
                    sections.append(sub)
                sub = [f"{title}: {clean(heading.group(2))}", []]
                continue
            sub[1].append(line)
        sections.append(sub)
        for name, text_lines in sections:
            text = " ".join(l.strip() for l in text_lines if l.strip())
            summary, _, detail = text.partition("(a)")
            found = topics(summary) if summary.strip() else []
            for item in re.split(r"\([a-z]\)\s*", "(a)" + detail)[1:] if detail else []:
                clause = first_clause(item)
                if 3 < len(clause) and re.search(r"[A-Za-z]{3}", clause):
                    found += fit(clause)
            found = [tidy(t) for t in found]
            found = [t for t in dict.fromkeys(found) if t]
            if found:
                chapters.append((fit(name)[0], found[:200]))
    return chapters


# English is laid out as question types and prescribed texts, not numbered units; these are
# transcribed from the ICSE 2027 and ISC 2027 English syllabuses.
ICSE_LANGUAGE = ("Paper 1: English Language", [
    "Composition (300-350 words)", "Letter writing: formal and informal", "Notice writing", "E-mail writing",
    "Unseen prose passage: comprehension and vocabulary", "Summary writing",
    "Functional grammar: prepositions, conjunctions, verbs and sentence structure"])
ISC_LANGUAGE = ("English Language", [
    "Composition (400-450 words)", "Directed writing: article, review, blog, report", "Proposal writing",
    "Grammar: transformation of sentences, phrasal verbs, verbs and tenses",
    "Comprehension: analysis, vocabulary and inference", "Summary writing"])
ENGLISH = {
    ("icse", "IX"): [ICSE_LANGUAGE, ("Paper 2: Literature - Drama", ["Julius Caesar (Acts I and II) - William Shakespeare"]),
                     ("Paper 2: Literature - Prose (Treasure Chest)", [
                         "Bonku Babu's Friend - Satyajit Ray", "Oliver Asks for More - Charles Dickens",
                         "The Model Millionaire - Oscar Wilde", "Home-coming - Rabindranath Tagore",
                         "The Boy who Broke the Bank - Ruskin Bond"]),
                     ("Paper 2: Literature - Poetry (Treasure Chest)", [
                         "The Night Mail - W.H. Auden", "Skimbleshanks: The Railway Cat - T.S. Eliot",
                         "I Remember, I Remember - Thomas Hood",
                         "A Doctor's Journal Entry for August 6, 1945 - Vikram Seth",
                         "A Work of Artifice - Marge Piercy"])],
    ("icse", "X"): [ICSE_LANGUAGE, ("Paper 2: Literature - Drama", ["Julius Caesar (Acts III, IV and V) - William Shakespeare"]),
                    ("Paper 2: Literature - Prose (Treasure Chest)", [
                        "With the Photographer - Stephen Leacock", "The Elevator - William Sleator",
                        "The Girl Who Can - Ama Ata Aidoo", "The Pedestrian - Ray Bradbury",
                        "The Last Lesson - Alphonse Daudet"]),
                    ("Paper 2: Literature - Poetry (Treasure Chest)", [
                        "Haunted Houses - H.W. Longfellow", "The Glove and the Lions - Leigh Hunt",
                        "When Great Trees Fall - Maya Angelou", "A Considerable Speck - Robert Frost",
                        "The Power of Music - Sukumar Ray"])],
    ("isc", "XI"): [ISC_LANGUAGE, ("Literature - Drama", ["Macbeth (Acts I and II) - William Shakespeare"]),
                    ("Literature - Short Stories (Prism)", [
                        "A Living God - Lafcadio Hearn", "Advice to Youth - Mark Twain",
                        "The Paper Menagerie - Ken Liu", "The Great Automatic Grammatizator - Roald Dahl",
                        "Thank You, Ma'am - Langston Hughes"]),
                    ("Literature - Poetry (Rhapsody)", [
                        "Abhisara: The Tryst - Rabindranath Tagore", "Why I Like the Hospital - Tony Hoagland",
                        "Sonnet 116 - William Shakespeare", "Death of a Naturalist - Seamus Heaney",
                        "Strange Meeting - Wilfred Owen"])],
    ("isc", "XII"): [ISC_LANGUAGE, ("Literature - Drama", ["Macbeth (Acts III, IV and V) - William Shakespeare"]),
                     ("Literature - Short Stories (Prism)", [
                         "Atithi / Guest - Rabindranath Tagore", "The Cookie Lady - Philip K. Dick",
                         "There Will Come Soft Rains - Ray Bradbury", "Indigo - Satyajit Ray",
                         "The Medicine Bag - Virginia Driving Hawk Sneve"]),
                     ("Literature - Poetry (Rhapsody)", [
                         "Telephone Conversation - Wole Soyinka", "Tithonus - Alfred, Lord Tennyson",
                         "Beethoven - Shane Koyczan", "Small Towns and the River - Mamang Dai",
                         "Death be not Proud - John Donne"])],
}

SUBJECTS = {
    "icse": [("english", "English"), ("history", "History and Civics"), ("geography", "Geography"),
             ("maths", "Mathematics"), ("physics", "Physics"), ("chemistry", "Chemistry"), ("biology", "Biology"),
             ("computer", "Computer Applications")],
    "isc-science": [("english", "English"), ("physics", "Physics"), ("chemistry", "Chemistry"),
                    ("maths", "Mathematics"), ("biology", "Biology"), ("computer", "Computer Science")],
    "isc-commerce": [("english", "English"), ("accountancy", "Accountancy"), ("commerce", "Commerce"),
                     ("economics", "Economics"), ("business", "Business Studies"), ("maths", "Mathematics")],
    "isc-humanities": [("english", "English"), ("history", "History"), ("polsci", "Political Science"),
                       ("geography", "Geography"), ("economics", "Economics"), ("psychology", "Psychology"),
                       ("sociology", "Sociology")],
}

TEMPLATES = [
    ("icse-class-9", "ICSE Class 9", "icse", "icse", "IX", "X", "IX"),
    ("icse-class-10", "ICSE Class 10", "icse", "icse", "IX", "X", "X"),
    ("isc-class-11-science", "ISC Class 11 - Science", "isc", "isc-science", "XI", "XII", "XI"),
    ("isc-class-11-commerce", "ISC Class 11 - Commerce", "isc", "isc-commerce", "XI", "XII", "XI"),
    ("isc-class-11-humanities", "ISC Class 11 - Humanities", "isc", "isc-humanities", "XI", "XII", "XI"),
    ("isc-class-12-science", "ISC Class 12 - Science", "isc", "isc-science", "XI", "XII", "XII"),
    ("isc-class-12-commerce", "ISC Class 12 - Commerce", "isc", "isc-commerce", "XI", "XII", "XII"),
    ("isc-class-12-humanities", "ISC Class 12 - Humanities", "isc", "isc-humanities", "XI", "XII", "XII"),
]

if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for template_id, name, board, group, first, second, which in TEMPLATES:
        body, counts = [], []
        for key, subject in SUBJECTS[group]:
            if key == "english":
                chapters = ENGLISH[(board, which)]
            else:
                blocks = class_blocks(read(src / f"{board}-{key}.raw.txt"), first, second)
                chapters = chapters_of(blocks.get(which, ""))
            counts.append((subject, len(chapters), sum(len(t) for _, t in chapters)))
            body += render(subject, chapters)
        exam = "ICSE 2027" if board == "icse" else "ISC 2027"
        subjects = ", ".join(s for _, s in SUBJECTS[group])
        (out / f"{template_id}.md").write_text(
            front(template_id, name, f"CISCE Class {which} theory syllabus: {subjects}.",
                  f"CISCE Regulations and Syllabuses - {exam}, Class {which} theory of each subject (cisce.org); "
                  "topics from the official text.", category="school")
            + "\n".join(body) + "\n", encoding="utf8")
        print(template_id, counts)
