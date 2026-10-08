"""Draft the FMGE, INI-CET, BDS, NEET MDS and GPAT templates.

Usage: python med_to_md.py <dir> <out dir>
  <dir>/fmge-l.txt   `pdftotext -enc UTF-8 -layout -f 85 -l 98` of the NBEMS FMGE December
                     2024 Information Bulletin, section 12 "Syllabus and Exam Blueprint"
  <dir>/bds.txt      `pdftotext -enc UTF-8` of the DCI Revised BDS Course Regulations, 2007
                     (text copy hosted by KGMU; the DCI gazette copy is a scanned image)
  <dir>/bpharm.txt   `pdftotext -enc UTF-8` of the PCI "Rules & Syllabus for the B. Pharm
                     Course" (pci.gov.in, Course Wise Regulations)

FMGE's syllabus is NBEMS's extract of the Graduate Medical Education Regulations. INI-CET
(AIIMS) covers "the entire MBBS curriculum" and publishes no list, so it uses the same
official extract. NEET MDS lists its subjects (NEET-MDS 2025 bulletin, para 5.10) and
refers to the DCI BDS regulations for content. GPAT groups questions into five areas
(GPAT 2024 bulletin, para 5.3) over the B. Pharm syllabus; each course is placed in an
area by its name.
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
    return unicodedata.normalize("NFKC", path.read_text(encoding="utf8")).replace(chr(12), chr(10))  # page breaks


# --- FMGE / INI-CET ---------------------------------------------------------
PRE_PARA = ["ANATOMY", "PHYSIOLOGY", "BIOCHEMISTRY", "PATHOLOGY", "MICROBIOLOGY", "PHARMACOLOGY",
            "FORENSIC MEDICINE"]
CLINICAL = ["GENERAL SURGERY", "ANESTHESIA", "ORTHOPEDICS", "RADIO- DIAGNOSIS", "RADIOTHERAPY", "PAEDIATRICS",
            "MEDICINE", "TUBERCULOSIS AND RESPIRATORY DISEASES", "PSYCHIATRY",
            "DERMATOLOGY AND SEXUALLY TRANSMITTED DISEASES", "OPHTHALMOLOGY", "OTORHINOLARYNGOLOGY",
            "OBSTETRICS AND GYNECOLOGY", "COMMUNITY MEDICINE"]
# The Anatomy block's two columns run together in the PDF; this is its text, in order.
FMGE_ANATOMY = [
    ("General Anatomy", ["Basic tissues of the body", "Terminology and nomenclature"]),
    ("Elements of Anatomy", ["Osteology", "Arthrology", "Myology", "Angiology", "Neurology"]),
    ("Regional Anatomy", ["Upper limb", "Lower limb", "Thorax including diaphragm", "Abdomen and pelvis",
                          "Head and neck", "Brain and spinal cord"]),
    ("Embryology", ["Development of individual organs and systems", "Postnatal growth and development"]),
    ("Histology", ["General histology", "Microanatomy of individual organs and systems"]),
    ("Human Genetics", ["Principles of human genetics and molecular biology"]),
    ("Radiological Anatomy", ["Skiagrams", "Special X-rays", "Principles of imaging techniques"]),
    ("Surface Anatomy", ["In cadavers", "In the living"]),
    ("Sectional Anatomy", ["Thorax, abdomen, head, neck and brain"]),
]


def subject_name(heading: str) -> str:
    return {"RADIO- DIAGNOSIS": "Radiodiagnosis", "ANESTHESIA": "Anaesthesia"}.get(
        heading, heading.title().replace(" And ", " and "))


def fmge(text: str) -> list:
    text = text[: text.index("BLUE PRINT")]
    lines = text.splitlines()
    starts = {}
    for i, line in enumerate(lines):
        if line.strip() in PRE_PARA + CLINICAL and line.strip() not in starts:
            starts[line.strip()] = i
    order = sorted(starts, key=starts.get)
    chapters = {}
    for n, heading in enumerate(order):
        end = starts[order[n + 1]] if n + 1 < len(order) else len(lines)
        items = []
        for line in lines[starts[heading] + 1 : end]:
            if not line.strip() or re.search(r"FMGE December|एफ़एमजीई|^\s*\d+\s*$", line):
                continue
            # A continuation is indented deeper or starts in lower case.
            if items and (re.match(r"^\s{7,}", line) or line.strip()[:1].islower()):
                items[-1] += " " + line.strip()
            else:
                items.append(line.strip())
        found = []
        for item in items:
            found += topics(item) if len(item) > 90 else [clean(item)]
        chapters[heading] = [t for t in dict.fromkeys(found) if t]
    chapters["ANATOMY"] = None
    pre = []
    for h in PRE_PARA:
        if h == "ANATOMY":
            pre.append(("Anatomy", [f"{c}: {t}" if len(t) < 60 else t for c, ts in FMGE_ANATOMY for t in ts]))
        else:
            pre.append((subject_name(h), chapters[h]))
    clinical = [(subject_name(h), chapters[h]) for h in CLINICAL]
    return [("Pre-clinical and Para-clinical Subjects", pre), ("Clinical Subjects", clinical)]


# --- BDS / NEET MDS ---------------------------------------------------------
BDS_SUBJECTS = [
    ("HUMAN ANATOMY, EMBRYOLOGY, HISTOLOGY & MEDICAL GENETICS", "Human Anatomy, Embryology, Histology and Medical Genetics"),
    ("HUMAN PHYSIOLOGY", "Human Physiology"),
    ("BIOCHEMISTRY AND NUTRITION", "Biochemistry and Nutrition"),
    ("DENTAL ANATOMY, EMBRYOLOGY AND ORAL HISTOLOGY", "Dental Anatomy, Embryology and Oral Histology"),
    ("GENERAL PATHOLOGY", "General Pathology"),
    ("MICROBIOLOGY", "Microbiology"),
    ("GENERAL AND DENTAL PHARMACOLOGY AND THERAPEUTICS", "General and Dental Pharmacology and Therapeutics"),
    ("DENTAL MATERIALS", "Dental Materials"),
    ("ORAL PATHOLOGY & ORAL MICROBIOLOGY", "Oral Pathology and Oral Microbiology"),
    ("GENERAL MEDICINE", "General Medicine"),
    ("10. GENERAL SURGERY", "General Surgery"),
    ("11. CONSERVATIVE DENTISTRY AND ENDODONTICS", "Conservative Dentistry and Endodontics"),
    ("12. ORAL & MAXILLOFACIAL SURGERY", "Oral and Maxillofacial Surgery"),
    ("13. ORAL MEDICINE AND RADIOLOGY", "Oral Medicine and Radiology"),
    ("14. ORTHODONTICS & DENTAL ORTHOPAEDICS", "Orthodontics and Dentofacial Orthopaedics"),
    ("15. PAEDIATRIC & PREVENTIVE DENTISTRY", "Paediatric and Preventive Dentistry"),
    ("16. PUBLIC HEALTH DENTISTRY", "Public Health Dentistry"),
    ("17. PERIODONTOLOGY", "Periodontology"),
    ("18. PROSTHODONTICS AND CROWN & BRIDGE", "Prosthodontics and Crown and Bridge"),
]
STOP = re.compile(r"^\s*(PRACTICAL|CLINICAL|RECOMMENDED|BOOKS|TEXT ?BOOKS|REFERENCE|LIST OF|DEMONSTRATION|"
                  r"EXERCISES|SKILLS|EXAMINATION|SCHEME OF)", re.I)


def bds_blocks(text: str) -> dict:
    body = text[text.index("SYLLABUS OF STUDY"):]
    lines = body.splitlines()
    starts = []
    for heading, name in BDS_SUBJECTS:
        target = heading.upper()
        index = next((i for i, l in enumerate(lines) if l.strip().upper().startswith(target)
                      and i > (starts[-1][0] if starts else -1)), None)
        if index is None:
            continue
        starts.append((index, name))
    blocks = {}
    for n, (index, name) in enumerate(starts):
        if n + 1 < len(starts):
            end = starts[n + 1][0]
        else:  # the last subject ends where Aesthetic Dentistry or the internship rules begin
            end = next((i for i in range(index + 1, len(lines))
                        if re.match(r"^\s*(19|20|21|22)\.\s+[A-Z]|.*\bINTERNSHIP\b", lines[i])), len(lines))
        blocks[name] = lines[index + 1 : end]
    return blocks


def bds_topics(block: list) -> list:
    """The numbered items of a subject's course content, by their titles."""
    text = re.sub(r"\s+", " ", " ".join(block))
    # The course content, not the goals and objectives before it; "Theory" only as a fallback.
    start = re.search(r"COURSE CONTENTS?|OUTLINE OF THE COURSE CONTENT|THEORY SYLLABUS|DETAILED SYLLABUS|"
                      r"FURTHER DETAILS OF THE COURSE", text, re.I) or re.search(r"\bTHEORY\b", text)
    text = text[start.end():] if start else text
    end = re.search(r"\b(PRACTICALS?|PRACTICAL EXERCISES|RECOMMENDED BOOKS|TEXT ?BOOKS|BOOKS RECOMMENDED|"
                    r"SCHEME OF EXAMINATION|CLINICALS?)\b", text)
    text = text[: end.start()] if end else text
    found = []
    for item in re.split(r"(?<![\d.])\b\d{1,2}[.)]\s+", text)[1:]:
        upper = re.match(r"^([A-Z][A-Z &,/'-]{3,}?)\s+[A-Z][a-z]", item)  # "CHEMISTRY OF X Carbohydrates..."
        title = upper.group(1) if upper else re.split(r"\s+[-–]\s+|:\s|\.\s|;\s|\(", item)[0]
        title = clean(re.sub(r"\s*\d{1,2}\s*$", "", title))
        if re.match(r"(Should|To |Have |Be able|Students?\b|Know|Understand|Prescribe|Observe|Critically|Acquire|"
                    r"Identify|Demonstrate|Describe|Explain|The different|The principles)", title):
            continue  # learning objectives, not course content
        if 3 < len(title) <= 90 and re.search(r"[A-Za-z]{3}", title) and \
                not re.search(r"\b(19|20)\d\d\b|Edition|Publish|\bby\s+[A-Z]", title):
            found.append(title[:1].upper() + title[1:].lower() if title.isupper() else title)
    return list(dict.fromkeys(found))


NEET_MDS_PARTS = {
    "Part A": [("General Anatomy including Embryology and Histology", ["Human Anatomy, Embryology, Histology and Medical Genetics"]),
               ("General Human Physiology and Biochemistry", ["Human Physiology", "Biochemistry and Nutrition"]),
               ("Dental Anatomy, Embryology and Oral Histology", ["Dental Anatomy, Embryology and Oral Histology"]),
               ("General Pathology and Microbiology", ["General Pathology", "Microbiology"]),
               ("General and Dental Pharmacology and Therapeutics", ["General and Dental Pharmacology and Therapeutics"]),
               ("General Medicine", ["General Medicine"]),
               ("General Surgery", ["General Surgery"])],
    "Part B": [("Dental Materials", ["Dental Materials"]),
               ("Oral Pathology and Oral Microbiology", ["Oral Pathology and Oral Microbiology"]),
               ("Oral Medicine and Radiology", ["Oral Medicine and Radiology"]),
               ("Pedodontics and Preventive Dentistry", ["Paediatric and Preventive Dentistry"]),
               ("Orthodontics and Dentofacial Orthopedics", ["Orthodontics and Dentofacial Orthopaedics"]),
               ("Periodontology", ["Periodontology"]),
               ("Prosthodontics and Crown and Bridge", ["Prosthodontics and Crown and Bridge"]),
               ("Conservative Dentistry and Endodontics", ["Conservative Dentistry and Endodontics"]),
               ("Oral and Maxillofacial Surgery", ["Oral and Maxillofacial Surgery"]),
               ("Public Health Dentistry", ["Public Health Dentistry"])],
}
BDS_YEARS = {
    "First Year": ["Human Anatomy, Embryology, Histology and Medical Genetics", "Human Physiology",
                   "Biochemistry and Nutrition", "Dental Anatomy, Embryology and Oral Histology"],
    "Second Year": ["General Pathology", "Microbiology", "General and Dental Pharmacology and Therapeutics",
                    "Dental Materials"],
    "Third Year": ["Oral Pathology and Oral Microbiology", "General Medicine", "General Surgery"],
    "Final Year": ["Conservative Dentistry and Endodontics", "Oral and Maxillofacial Surgery",
                   "Oral Medicine and Radiology", "Orthodontics and Dentofacial Orthopaedics",
                   "Paediatric and Preventive Dentistry", "Public Health Dentistry", "Periodontology",
                   "Prosthodontics and Crown and Bridge"],
}


def bds(text: str) -> list:
    blocks = {name: bds_topics(lines) for name, lines in bds_blocks(text).items()}
    return [(year, [(s, blocks.get(s) or [s]) for s in subjects]) for year, subjects in BDS_YEARS.items()]


def neet_mds(text: str) -> list:
    blocks = {name: bds_topics(lines) for name, lines in bds_blocks(text).items()}
    out = []
    for part, chapters in NEET_MDS_PARTS.items():
        rows = []
        for title, sources in chapters:
            found = [t for s in sources for t in (blocks.get(s) or [s])]
            rows.append((title, list(dict.fromkeys(found))))
        out.append((part, rows))
    return out


# --- GPAT -------------------------------------------------------------------
GPAT_AREAS = [
    ("Pharmacognosy and Allied Subjects", r"PHARMACOGNOSY|HERBAL"),
    ("Pharmaceutical Chemistry and Allied Subjects", r"(?<!BIO)CHEMISTRY|ANALYSIS|INSTRUMENTAL"),
    ("Pharmaceutics and Allied Subjects", r"PHARMACEUTICS|INDUSTRIAL PHARMACY|BIOPHARMACEUTICS|DRUG DELIVERY|"
                                          r"PHARMACEUTICAL ENGINEERING|COSMETIC"),
    ("Pharmacology and Allied Subjects", r"PHARMACOLOGY|TOXICOLOGY|PATHOPHYSIOLOGY"),
    ("Other Subjects of B. Pharm", r"."),
]


def gpat(text: str) -> list:
    text = text[text.index("BP101T. HUMAN ANATOMY"):]
    # Headings are written several ways: "BP101T.", "BP 303 T.", "BP503.T.", "BP606TPHARMA...".
    heading = r"BP\s*(\d)\s*(\d)\s*(\d)\s*\.?\s*(RBT|RMT|ET|T)?\s*[.:]?\s*([A-Z][^\n(]*?)\s*\(\s*Theory\s*\)"
    starts = [m.start() for m in re.finditer(rf"(?m)^{heading}", text)] + [len(text)]
    courses = [text[a:b] for a, b in zip(starts, starts[1:])]
    areas = {name: [] for name, _ in GPAT_AREAS}
    for course in courses:
        head = re.match(heading, course)
        code, kind, name = "".join(head.group(1, 2, 3)), head.group(4) or "T", head.group(5)
        if "E" in kind or "R" in kind or int(code) >= 803:
            continue  # electives (BP803 onwards) and remedial courses
        head_title = name
        title = clean(name).title().replace(" And ", " and ").replace(" Of ", " of ")
        title = re.sub(r"\bIi\b", "II", re.sub(r"\bIii\b", "III", re.sub(r"(?<=[a-z])(I{1,3})\b", r" \1", title)))
        title = re.sub(r"\s*[–-]\s*(?=I)", " ", title).replace("Biostatisitcs", "Biostatistics")
        title = re.sub(r"Pharmacy(i{1,2})$", lambda m: "Pharmacy " + m.group(1).upper(), title)
        head = type("H", (), {"group": staticmethod(lambda n, c=code, t=head_title: {1: c, 3: t}[n])})
        if re.search(r"COMMUNICATION|COMPUTER APPLICATIONS|ENVIRONMENTAL SCIENCES|REMEDIAL", head.group(3).upper()):
            continue  # not pharmacy subjects
        content = course.split("Course Content", 1)[-1]
        content = re.split(r"\n\s*(?:BP\s*\d\s*\d\s*\d\s*\.?\s*[A-Z]*\s*P\b|Recommended Books)|\(\s*Practical\s*\)",
                           content)[0]
        content = re.sub(r"\b\d{1,2}\s*Hours?\b|\n\s*\d{1,3}\s*\n", " ", content, flags=re.I)
        content = re.sub(r"[•▪]", ". ", content)  # PDF bullets
        content = re.sub(r"\(([a-h]|[ivx]+)\)\s*|\b[ivx]+\)\s*", ". ", content)
        found = []
        for unit in re.split(r"UNIT\s*[-–]?\s*[IVX]+\s*:?", content, flags=re.I)[1:]:
            found += topics(re.sub(r"\s+", " ", unit))
        # Strip list letters left at the end ("... tolerance. b") and stray full stops.
        found = [clean(re.sub(r"(?:\.\s*|\s+)[a-h]$", "", t)) for t in found]
        found = [t for t in dict.fromkeys(found) if re.search(r"[A-Za-z]{3}", t) and "Practical" not in t]
        area = next(name for name, pattern in GPAT_AREAS if re.search(pattern, head.group(3).upper()))
        areas[area].append((fit(f"BP{head.group(1)} {title}")[0], found[:200]))
    return [(name, chapters) for name, chapters in areas.items() if chapters]


TEMPLATES = [
    ("fmge", "fmge-l.txt", fmge, "Foreign Medical Graduate Examination",
     "Screening test for foreign medical graduates: pre-clinical, para-clinical and clinical subjects.",
     "NBEMS FMGE December 2024 Information Bulletin, section 12 Syllabus (extract of the Graduate Medical "
     "Education Regulations); topics from the official text."),
    ("ini-cet", "fmge-l.txt", fmge, "INI-CET",
     "AIIMS Institute of National Importance Combined Entrance Test: the MBBS curriculum.",
     "AIIMS: INI-CET covers the entire MBBS curriculum. Topic list: NBEMS official extract of the Graduate "
     "Medical Education Regulations (FMGE bulletin)."),
    ("bds", "bds.txt", bds, "BDS",
     "Bachelor of Dental Surgery: the DCI syllabus, year by year.",
     "DCI Revised BDS Course Regulations, 2007, Syllabus of Study; topics are the numbered items of each subject."),
    ("neet-mds", "bds.txt", neet_mds, "NEET MDS",
     "National Eligibility cum Entrance Test for MDS: Part A (7 subjects) and Part B (10 subjects).",
     "Subjects: NBEMS NEET-MDS 2025 Information Bulletin, para 5.10. Topics: DCI Revised BDS Course "
     "Regulations, 2007, to which the bulletin refers."),
    ("gpat", "bpharm.txt", gpat, "GPAT",
     "Graduate Pharmacy Aptitude Test: the B. Pharm syllabus in GPAT's five question areas.",
     "Areas: NBEMS GPAT 2024 Information Bulletin, para 5.3. Topics: PCI Rules and Syllabus for the B. Pharm "
     "course, theory courses (unit contents)."),
]

if __name__ == "__main__":
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    only = sys.argv[3:] or None
    for template_id, file, parse, name, description, source in TEMPLATES:
        if only and template_id not in only:
            continue
        subjects = parse(read(src / file))
        body = []
        for subject, chapters in subjects:
            body += render(subject, [(c, t[:200]) for c, t in chapters if t])
        (out / f"{template_id}.md").write_text(front(template_id, name, description, source) + "\n".join(body) + "\n",
                                               encoding="utf8")
        print(template_id, [(s, len(c), sum(len(t) for _, t in c)) for s, c in subjects])
