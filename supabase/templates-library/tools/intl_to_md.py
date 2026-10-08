"""Draft the international exam templates.

Usage: python intl_to_md.py <dir> <out dir>

From official documents (`pdftotext -enc UTF-8` into <dir>):
  cfa1.txt, cfa2.txt, cfa3-<pathway>.txt  CFA Institute 2026 Level I, II, III Topic Outlines
  usmle.txt                               USMLE Content Outline (2026), usmle.org
  mcat.txt                                AAMC "What's on the MCAT Exam?" (2020)
From official web pages, transcribed below (names as the owner publishes them):
  SAT    College Board, Assessment Framework for the Digital SAT Suite, Tables 10 and 16
  GRE    ETS, GRE General Test content pages (Verbal, Quantitative, Analytical Writing)
  GMAT   mba.com, GMAT Focus Edition exam structure and Data Insights pages
  TOEFL  ETS, TOEFL iBT test content page (task types)
  IELTS  ielts.org, IELTS Academic test format pages
  LSAT   LSAC, test format, Logical Reasoning and Reading Comprehension pages
"""

import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import clean, fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402


def read(path: Path) -> str:
    return unicodedata.normalize("NFKC", path.read_text(encoding="utf8")).replace(chr(12), "\n")


# --- CFA ----------------------------------------------------------------------
CFA_TOPICS = ["Quantitative Methods", "Economics", "Corporate Issuers", "Financial Statement Analysis",
              "Equity Investments", "Equity Valuation", "Fixed Income", "Derivatives", "Alternative Investments",
              "Portfolio Management", "Ethical and Professional Standards", "Asset Allocation",
              "Portfolio Construction", "Performance Measurement", "Derivatives and Risk Management",
              "Portfolio Management Pathway", "Private Markets Pathway", "Private Wealth Pathway"]


def cfa_modules(text: str) -> list:
    """[(topic, [learning modules])] in document order."""
    topics, current, previous = {}, None, ""
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line in CFA_TOPICS:
            current = line
            topics.setdefault(current, [])
            previous = ""
            continue
        module = re.match(r"^(.{3,120}?)\s+The candidate should be able to", line)
        if module and current:
            # The end of the previous outcome can run in ("between economies Capital Market ..."):
            # it is lower case, the module name is not.
            name = re.sub(r"^[a-z][^A-Z]*", "", module.group(1))
            topics[current].append(fit(clean(name))[0])
        elif line.startswith("The candidate should be able to") and current and previous \
                and not re.search(r"LEARNING OUTCOMES|CFA Institute|□", previous):
            topics[current].append(fit(clean(previous))[0])  # the module name on the line before
        previous = line
    return [(t, list(dict.fromkeys(m))) for t, m in topics.items() if m]


def cfa3(src: Path) -> list:
    core = cfa_modules(read(src / "cfa3-portfolio-management.txt"))
    out = [(t, m) for t, m in core if "Pathway" not in t]
    for key in ("portfolio-management", "private-markets", "private-wealth"):
        out += [(f"Pathway (choose one): {t.replace(' Pathway', '')}", m)
                for t, m in cfa_modules(read(src / f"cfa3-{key}.txt")) if "Pathway" in t]
    return [("Level III", out)]


# --- USMLE --------------------------------------------------------------------
USMLE_SYSTEMS = ["Human Development", "Immune System", "Blood & Lymphoreticular System", "Behavioral Health",
                 "Nervous System & Special Senses", "Skin & Subcutaneous Tissue", "Musculoskeletal System",
                 "Cardiovascular System", "Respiratory System", "Gastrointestinal System", "Renal & Urinary System",
                 "Pregnancy, Childbirth, & the Puerperium", "Female and Transgender Reproductive System & Breast",
                 "Male and Transgender Reproductive System", "Endocrine System", "Multisystem Processes & Disorders",
                 "Biostatistics, Epidemiology/Population Health, & Interpretation of the Medical Literature",
                 "Social Sciences"]


def usmle(text: str) -> list:
    body = text[text.index("Human Development\nNormal age-related"):] if "Human Development\nNormal age-related" in text \
        else text[text.rindex("Human Development"):]
    lines = [l.strip() for l in body.splitlines()]
    lines = [l for l in lines if l and not re.match(r"For Public Release|Copyright|^\d+$|^Public$", l)]
    # A long system name wraps onto a second line ("Female and Transgender Reproductive" / "System & Breast").
    joined = []
    for line in lines:
        if joined and f"{joined[-1]} {line}" in USMLE_SYSTEMS:
            joined[-1] = f"{joined[-1]} {line}"
        else:
            joined.append(line)
    lines = joined
    subjects, system, chapter = [], None, None
    for line in lines:
        if line in USMLE_SYSTEMS:
            system = (line.replace(" & ", " and ").replace("&", "and"), [])
            subjects.append(system)
            chapter = None
            continue
        if system is None:
            continue
        if line.startswith("•"):
            if chapter is None:
                chapter = (system[0], [])
                system[1].append(chapter)
            for item in line.split("•")[1:]:
                head = clean(re.split(r"\s+o\s+", item.strip())[0])
                if head and re.search(r"[A-Za-z]{3}", head):
                    chapter[1].extend(fit(head))
        elif line.startswith("o ") and chapter is not None:
            continue  # sub-items: their parent bullet is the topic
        elif len(line) <= 120 and not line.endswith(".") and line[:1].isupper():
            chapter = (fit(clean(line))[0], [])
            system[1].append(chapter)
    return [(s, [(c, list(dict.fromkeys(t))[:200]) for c, t in chs if t]) for s, chs in subjects]


# --- MCAT ---------------------------------------------------------------------
MCAT_SECTIONS = {"1": "Biological and Biochemical Foundations of Living Systems",
                 "2": "Biological and Biochemical Foundations of Living Systems",
                 "3": "Biological and Biochemical Foundations of Living Systems",
                 "4": "Chemical and Physical Foundations of Biological Systems",
                 "5": "Chemical and Physical Foundations of Biological Systems",
                 "6": "Psychological, Social, and Biological Foundations of Behavior",
                 "7": "Psychological, Social, and Biological Foundations of Behavior",
                 "8": "Psychological, Social, and Biological Foundations of Behavior",
                 "9": "Psychological, Social, and Biological Foundations of Behavior",
                 "10": "Psychological, Social, and Biological Foundations of Behavior"}
TAGS = r"\((?:BIO|BC|OC|GC|PHY|PSY|SOC)(?:,\s*(?:BIO|BC|OC|GC|PHY|PSY|SOC))*\)"


def mcat(text: str) -> list:
    sections = {}
    category, heading = None, None
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("©") or re.fullmatch(r"\d+", line):
            continue
        cat = re.match(r"^(\d{1,2})([A-E]):\s+(.{5,140})$", line)
        if cat and cat.group(1) in MCAT_SECTIONS:
            category = (f"{cat.group(1)}{cat.group(2)}: {clean(cat.group(3))}", [])
            sections.setdefault(MCAT_SECTIONS[cat.group(1)], []).append(category)
            heading = None
            continue
        if category is None:
            continue
        head = re.match(rf"^([A-Z][^▪.]{{2,90}}?)\s*{TAGS}\s*$", line)
        if head:
            heading = clean(head.group(1))
            continue
        if heading and line.startswith("▪"):
            for item in line.split("▪")[1:]:
                item = clean(re.sub(rf"\s*{TAGS}", "", re.split(r"\s+o\s+", item.strip())[0]))
                if item and re.search(r"[A-Za-z]{3}", item):
                    category[1].extend(fit(f"{heading}: {item}" if len(heading) + len(item) < 110 else item))
    out = [(name, [(fit(c)[0], list(dict.fromkeys(t))[:200]) for c, t in cats if t]) for name, cats in sections.items()]
    out.append(("Critical Analysis and Reasoning Skills", [("Reasoning Skills", [
        "Foundations of Comprehension", "Reasoning Within the Text", "Reasoning Beyond the Text"]),
        ("Passage Disciplines", ["Humanities", "Social Sciences"])]))
    return out


# --- SMLE ---------------------------------------------------------------------
SMLE_SECTIONS = ["Medicine", "Pediatrics", "Obstetrics And Gynecology", "Surgery",
                 "Patient Safety, Preventive Medicine, & Ethics"]


def smle(text: str) -> list:
    """SCFHS SMLE Applicant Guide 2024, Appendix B content outline (`pdftotext -layout`)."""
    text = text[text.index("SMLE Content Outline"):]
    subjects, specialty = [], None
    for raw in text.splitlines():
        line = re.sub(r"\s{2,}(Mastery level|\d)\s*$", "", raw.rstrip())
        line = re.sub(r"\s{2,}(Topic|Mastery level)\s*$", "", line)
        stripped = line.strip()
        if not stripped or re.fullmatch(r"\d+|Topic|Mastery level", stripped):
            continue
        section = next((s for s in SMLE_SECTIONS if stripped.startswith(s)), None)
        if section and not raw.startswith(" "):
            subjects.append((section.replace("And", "and").replace(", &", " and"), []))
            specialty = None
            continue
        if not subjects:
            continue
        head = re.match(r"^([A-Z][A-Za-z ,&/'-]+?):\s*(.*)$", line)
        if head and not raw.startswith(" ") and not head.group(2):
            specialty = (clean(head.group(1)).title().replace(" And ", " and "), [])
            subjects[-1][1].append(specialty)
            continue
        if raw.startswith(" ") and not raw.startswith("  ") and re.match(r"[A-Z0-9]", stripped):
            if len(stripped) > 90:
                if subjects[-1][0].startswith("Patient Safety") and specialty and specialty[1]:
                    break  # the prose after the outline ends it
                continue
            if specialty is None:
                specialty = (subjects[-1][0], [])
                subjects[-1][1].append(specialty)
            specialty[1].append(clean(stripped))
        elif head and specialty is not None:  # "Epidemiology/Biostatistics: Measures Of Health Status"
            specialty[1].append(clean(stripped))
        elif specialty is not None and specialty[1] and not raw.startswith(" "):
            specialty[1][-1] = clean(specialty[1][-1] + " " + stripped)  # a wrapped topic
    return [(s, [(c, list(dict.fromkeys(t))) for c, t in chs if t]) for s, chs in subjects]


# --- GCSE ---------------------------------------------------------------------
GCSE_MATHS_AREAS = ["Number", "Algebra", "Ratio, proportion and rates of change", "Geometry and measures",
                    "Probability", "Statistics"]


def gcse_maths(text: str) -> list:
    start = text.index("should require students to")  # the content list, after the aims
    end = text.find("Assessment objectives", start)
    text = text[start: end if end > 0 else len(text)]
    chapters, area, current = [], None, None
    for line in text.splitlines():
        line = line.strip()
        if not line or re.fullmatch(r"\d+", line):
            continue
        if line in GCSE_MATHS_AREAS:
            area = line
            continue
        item = re.match(r"^(\d{1,3})\.\s+(.*)$", line)
        if item and area:
            clause = re.split(r";|\s\(|\.\s|,\s(?:including|e\.g)", item.group(2))[0]
            current[1].extend(fit(clean(clause))) if current else None
            continue
        if area and len(line) <= 60 and line[:1].isupper() and not line.endswith(".") and not item:
            current = (f"{area}: {clean(line)}", [])
            chapters.append(current)
    return [(c, list(dict.fromkeys(t))) for c, t in chapters if t]


GCSE_SCIENCE_AREAS = {
    "Biology": ["Cell biology", "Transport systems", "Health, disease and the development of medicines",
                "Coordination and control", "Photosynthesis", "Ecosystems", "Inheritance, variation and evolution"],
    "Chemistry": ["Atomic structure and the Periodic Table", "Structure, bonding and the properties of matter",
                  "Chemical changes", "Energy changes in chemistry", "Rate and extent of chemical change",
                  "Chemical analysis", "Chemical and allotropic forms of carbon", "Earth and atmospheric science"],
    "Physics": ["Energy", "Forces", "Forces and motion", "Waves in matter", "Light and electromagnetic waves",
                "Electricity", "Magnetism and electromagnetism", "Particle model of matter", "Atomic structure"],
}


def gcse_science(text: str) -> list:
    out = []
    lines = [l.strip() for l in text.splitlines()]
    for science, areas in GCSE_SCIENCE_AREAS.items():
        start = next(i for i, l in enumerate(lines) if l.startswith(f"{science} is the science"))
        chapters, current = [], None
        for line in lines[start:]:
            if line.startswith(("Biology is the science", "Chemistry is the science", "Physics is the science")) \
                    and not line.startswith(science):
                break
            if line in areas:
                current = (line, [])
                chapters.append(current)
                continue
            if current is None or not line or line.startswith("•") or re.fullmatch(r"\d+", line):
                continue
            if line == "Use of mathematics":
                current = None  # the maths-skills lists repeat across topics
                continue
            if len(line) <= 70 and line[:1].isupper() and not line.endswith((".", ":")):
                current[1].append(clean(line))
        out.append((f"Combined Science: {science}", [(c, list(dict.fromkeys(t))) for c, t in chapters if t]))
    return out


GCSE_TEXT = [
    ("English Language", [
        ("Critical Reading and Comprehension", [
            "Identifying and interpreting themes, ideas and information", "Drawing inferences and justifying them",
            "Identifying bias and misuse of evidence", "Summary and synthesis",
            "Evaluating a writer's choice of vocabulary, form, grammar and structure", "Comparing texts"]),
        ("Writing", ["Writing for different purposes and audiences: describe, narrate, explain, instruct, argue",
                     "Using language imaginatively and creatively", "Accurate spelling, punctuation and grammar"]),
        ("Spoken Language", ["Presenting information and ideas", "Responding to questions and feedback",
                             "Using spoken Standard English"])]),
    ("English Literature", [
        ("Detailed Study", ["A play by Shakespeare", "A 19th century novel",
                            "Poetry since 1789, including Romantic poetry",
                            "Fiction or drama from the British Isles from 1914 onwards"]),
        ("Reading Critically", ["Literal and inferential comprehension", "Critical reading and themes",
                                "Evaluating language, structure and form", "Comparing texts", "Unseen texts"])]),
    ("Geography", [
        ("Place: processes and relationships", ["Geography of the UK"]),
        ("Physical geography: processes and change", ["Geomorphic processes and landscape",
                                                     "Changing weather and climate"]),
        ("People and environment: processes and interactions", ["Global ecosystems and biodiversity",
                                                                "Resources and their management"]),
        ("Human geography: processes and change", ["Cities and urban society", "Global economic development issues"]),
        ("Skills", ["Locational knowledge", "Maps, atlases, OS maps and GIS", "Fieldwork in two contrasting environments",
                    "Graphical, numerical and statistical skills"])]),
    ("History", [
        ("Studies Required", ["British depth study", "Period study (at least 50 years)", "Thematic study",
                              "European or wider world depth study", "The historic environment: a site study"]),
        ("Eras", ["Medieval (500-1500)", "Early Modern (1450-1750)", "Modern (1700-present day)"])]),
]

MRCS = [
    ("Paper 1: Applied Basic Sciences", [
        ("Applied Surgical Anatomy", ["Thorax", "Abdomen: wall, cavity, viscera and vessels", "Pelvis", "Perineum",
                                      "Upper limb and breast", "Lower limb", "Spine", "Head and neck",
                                      "Brain", "Autonomic nervous system",
                                      "Surgically related embryology and development", "Surface and imaging anatomy"]),
        ("Applied Surgical Physiology", ["General physiological principles", "Cardiovascular system",
                                         "Respiratory system", "Gastrointestinal system", "Urinary system",
                                         "Endocrine system", "Neurological system"]),
        ("Applied Surgical Pathology", ["Surgical immunology", "Surgical haematology", "Surgical clinical chemistry",
                                        "Principles of neoplasia and oncology", "Cardiovascular system",
                                        "Respiratory system", "Digestive system", "Genitourinary system",
                                        "Central and peripheral neurological systems", "Skin cancer",
                                        "Lymphoreticular system", "Musculoskeletal system",
                                        "Pathology of the breast", "Pathology of the endocrine glands"]),
        ("Other Sciences", ["Pharmacology as applied to surgical practice",
                            "Microbiology as applied to surgical practice", "Imaging", "Data interpretation and audit"])]),
    ("Paper 2: Principles of Surgery in General", [
        ("Common Congenital and Acquired Surgical Conditions", [
            "Gastrointestinal disease", "Breast disease", "Vascular disease", "Cardiovascular and pulmonary disease",
            "Genitourinary disease", "Orthopaedic conditions", "Diseases of the skin, head and neck",
            "Neurology and neurosurgery", "Endocrine disease", "The lymphoreticular system",
            "Principles of cancer therapy and palliative care", "Acute emergencies"]),
        ("Perioperative Management", ["Preoperative assessment and management", "Intraoperative care",
                                      "Perioperative care", "Postoperative care", "Nutritional management",
                                      "Haemostasis and blood products",
                                      "Coagulation, deep vein thrombosis and embolism",
                                      "Metabolic and endocrine disorders"]),
        ("Trauma, including the Multiply Injured Patient", ["General", "Shock", "Wounds and soft tissue injuries",
                                                            "Burns", "Fractures and dislocations",
                                                            "Organ-specific trauma"]),
        ("Other Areas", ["Surgical care of children", "Medico-legal aspects of surgical practice"])]),
]

# --- Exams transcribed from official pages ------------------------------------
SAT = [
    ("Reading and Writing", [
        ("Information and Ideas", ["Central Ideas and Details", "Command of Evidence: Textual",
                                   "Command of Evidence: Quantitative", "Inferences"]),
        ("Craft and Structure", ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"]),
        ("Expression of Ideas", ["Rhetorical Synthesis", "Transitions"]),
        ("Standard English Conventions", ["Boundaries", "Form, Structure, and Sense"])]),
    ("Math", [
        ("Algebra", ["Linear equations in one variable", "Linear equations in two variables", "Linear functions",
                     "Systems of two linear equations in two variables",
                     "Linear inequalities in one or two variables"]),
        ("Advanced Math", ["Equivalent expressions",
                           "Nonlinear equations in one variable and systems of equations in two variables",
                           "Nonlinear functions"]),
        ("Problem-Solving and Data Analysis", [
            "Ratios, rates, proportional relationships, and units", "Percentages",
            "One-variable data: distributions and measures of center and spread",
            "Two-variable data: models and scatterplots", "Probability and conditional probability",
            "Inference from sample statistics and margin of error",
            "Evaluating statistical claims: observational studies and experiments"]),
        ("Geometry and Trigonometry", ["Area and volume", "Lines, angles, and triangles",
                                       "Right triangles and trigonometry", "Circles"])]),
]
GRE = [
    ("Verbal Reasoning", [("Question Types", ["Reading Comprehension", "Text Completion", "Sentence Equivalence"])]),
    ("Quantitative Reasoning", [
        ("Arithmetic", ["Properties and types of integers: divisibility, factorization, primes, remainders",
                        "Arithmetic operations, exponents and roots",
                        "Estimation, percent, ratio and rate", "Absolute value and the number line",
                        "Decimal representation and sequences of numbers"]),
        ("Algebra", ["Operations with exponents", "Factoring and simplifying algebraic expressions",
                     "Relations, functions, equations and inequalities",
                     "Linear and quadratic equations and inequalities", "Simultaneous equations and inequalities",
                     "Setting up equations to solve word problems",
                     "Coordinate geometry: graphs, intercepts and slopes"]),
        ("Geometry", ["Parallel and perpendicular lines", "Circles", "Triangles, including special triangles",
                      "Quadrilaterals and other polygons", "Congruent and similar figures",
                      "Three-dimensional figures", "Area, perimeter and volume", "Pythagorean theorem",
                      "Angle measurement in degrees"]),
        ("Data Analysis", ["Descriptive statistics: mean, median, mode, range, standard deviation, quartiles",
                           "Interpretation of tables and graphs", "Elementary probability",
                           "Random variables and probability distributions, including normal distributions",
                           "Counting methods: combinations, permutations and Venn diagrams"]),
        ("Question Types", ["Quantitative Comparison", "Multiple-choice: select one",
                            "Multiple-choice: select one or more", "Numeric Entry", "Data Interpretation sets"])]),
    ("Analytical Writing", [("Analytical Writing", ["Analyze an Issue task"])]),
]
GMAT = [
    # Official: Problem Solving on arithmetic and elementary algebra. The topics are those that
    # independent prep analyses agree on (D113): Physics Wallah, Target Test Prep, CrackVerbal, e-GMAT.
    ("Quantitative Reasoning", [
        ("Arithmetic", ["Number properties: divisibility, factors and multiples", "Fractions, decimals and percentages",
                        "Ratios and proportions", "Word problems: rates, work and interest", "Statistics",
                        "Counting methods and probability"]),
        ("Algebra", ["Linear and quadratic equations", "Inequalities", "Equivalent expressions"])]),
    ("Verbal Reasoning", [("Question Types", ["Reading Comprehension", "Critical Reasoning"])]),
    ("Data Insights", [("Question Types", ["Data Sufficiency", "Multi-Source Reasoning", "Table Analysis",
                                          "Graphics Interpretation", "Two-Part Analysis"])]),
]
TOEFL = [
    ("Reading", [("Task Types", ["Complete the Words", "Read in Daily Life", "Read an Academic Passage"])]),
    ("Listening", [("Task Types", ["Listen and Choose a Response", "Listen to a Conversation",
                                   "Listen to an Announcement", "Listen to an Academic Talk"])]),
    ("Writing", [("Task Types", ["Build a Sentence", "Write an Email", "Write for an Academic Discussion"])]),
    ("Speaking", [("Task Types", ["Listen and Repeat", "Take an Interview"])]),
]
IELTS = [
    ("Listening", [
        ("Recordings", ["Part 1: conversation in an everyday social setting", "Part 2: talk in an everyday social setting",
                        "Part 3: discussion in an educational or training setting", "Part 4: lecture on an academic subject"]),
        ("Question Types", ["Multiple choice", "Matching", "Plan/map/diagram labelling",
                            "Form/note/table/flow chart completion", "Sentence completion", "Short-answer questions"])]),
    ("Reading (Academic)", [("Question Types", [
        "Multiple choice", "Identifying information (True/False/Not given)",
        "Identifying writer's views/claims (Yes/No/Not given)", "Matching information", "Matching headings",
        "Matching features", "Matching sentence endings", "Sentence completion",
        "Summary/note/table/flow chart completion", "Diagram label completion", "Short-answer questions"])]),
    ("Writing (Academic)", [
        ("Tasks", ["Task 1: describe a graph, chart, table or diagram (150 words)",
                   "Task 2: respond to a point of view, argument or problem (250 words)"]),
        ("Assessment Criteria", ["Task achievement / Task response", "Coherence and cohesion", "Lexical resource",
                                 "Grammatical range and accuracy"])]),
    ("Speaking", [
        ("Parts", ["Part 1: introduction and interview", "Part 2: long turn", "Part 3: discussion"]),
        ("Assessment Criteria", ["Fluency and coherence", "Lexical resource", "Grammatical range and accuracy",
                                 "Pronunciation"])]),
]
LSAT = [
    ("Logical Reasoning", [("Skills", [
        "Recognizing the parts of an argument and their relationships",
        "Recognizing similarities and differences between patterns of reasoning", "Drawing well-supported conclusions",
        "Reasoning by analogy", "Recognizing misunderstandings or points of disagreement",
        "Determining how additional evidence affects an argument", "Detecting assumptions made by particular arguments",
        "Identifying and applying principles or rules", "Identifying flaws in arguments", "Identifying explanations"])]),
    ("Reading Comprehension", [("What Questions Ask About", [
        "The main idea or primary purpose", "Information that is explicitly stated",
        "Information or ideas that can be inferred", "The meaning or purpose of words or phrases in context",
        "The organization or structure", "Applying information to a new context",
        "Principles that function in the selection", "Analogies to claims or arguments in the selection",
        "The author's attitude as revealed in tone or language",
        "The impact of new information on claims or arguments"])]),
    ("LSAT Argumentative Writing", [("Argumentative Writing", [
        "Prewriting analysis of the perspectives", "Writing a position essay addressing other perspectives"])]),
]

TEMPLATES = [
    ("cfa-level-1", "CFA Level I", "CFA Program Level I: the ten topics and their learning modules (2026 curriculum).",
     "CFA Institute, 2026 Level I Topic Outlines; learning modules as named.",
     lambda src: [("Level I", cfa_modules(read(src / "cfa1.txt")))]),
    ("cfa-level-2", "CFA Level II", "CFA Program Level II: topics and learning modules (2026 curriculum).",
     "CFA Institute, 2026 Level II Topic Outlines; learning modules as named.",
     lambda src: [("Level II", cfa_modules(read(src / "cfa2.txt")))]),
    ("cfa-level-3", "CFA Level III", "CFA Program Level III: core topics and the three pathways (2026 curriculum).",
     "CFA Institute, 2026 Level III Topic Outlines (core and pathways); learning modules as named.", cfa3),
    ("usmle", "USMLE", "United States Medical Licensing Examination: the content outline shared by all Steps.",
     "USMLE Content Outline (2026), usmle.org; topics are the outline's first-level items.",
     lambda src: usmle(read(src / "usmle.txt"))),
    ("mcat", "MCAT", "Medical College Admission Test: the four sections, by content category.",
     "AAMC, What's on the MCAT Exam? (2020); topics are the outline's first-level items.",
     lambda src: mcat(read(src / "mcat.txt"))),
    ("sat", "SAT", "Digital SAT: Reading and Writing and Math, by content domain and skill.",
     "College Board, Assessment Framework for the Digital SAT Suite, Tables 10 and 16.", lambda src: SAT),
    ("gre-general", "GRE General", "GRE General Test: Verbal Reasoning, Quantitative Reasoning, Analytical Writing.",
     "ETS, GRE General Test content pages.", lambda src: GRE),
    ("gmat", "GMAT", "GMAT Focus Edition: Quantitative Reasoning, Verbal Reasoning, Data Insights.",
     "Sections and question types: mba.com, GMAT Focus Edition pages. Quant topics: at least two independent prep analyses (mba.com publishes no topic list).", lambda src: GMAT),
    ("toefl", "TOEFL iBT", "TOEFL iBT: Reading, Listening, Writing and Speaking task types.",
     "ETS, TOEFL iBT test content page.", lambda src: TOEFL),
    ("ielts", "IELTS Academic", "IELTS Academic: Listening, Reading, Writing and Speaking.",
     "ielts.org, IELTS Academic test format pages.", lambda src: IELTS),
    ("smle", "SMLE", "Saudi Medical Licensing Exam: the SCFHS content outline by section and specialty.",
     "SCFHS SMLE Applicant Guide 2024, Appendix B blueprint and content outline.",
     lambda src: smle(read(src / "smle-l.txt"))),
    ("mrcs-part-a", "MRCS Part A", "Intercollegiate MRCS Part A: Applied Basic Sciences and Principles of Surgery in General.",
     "Intercollegiate MRCS content guide (Royal Colleges of Surgeons), Part A content areas; transcribed.",
     lambda src: MRCS),
    ("gcse", "GCSE (UK)", "GCSE core subjects: English Language and Literature, Mathematics, Combined Science, Geography, History.",
     "UK Department for Education GCSE subject content (gov.uk); Maths and Combined Science headings from the "
     "documents, the other subjects transcribed.",
     lambda src: GCSE_TEXT[:2] + [("Mathematics", gcse_maths(read(src / "gcse-maths.txt")))]
     + gcse_science(read(src / "gcse-science.txt")) + GCSE_TEXT[2:]),
    ("lsat", "LSAT","Law School Admission Test: Logical Reasoning, Reading Comprehension, Argumentative Writing.",
     "LSAC, LSAT test format, Logical Reasoning and Reading Comprehension pages.", lambda src: LSAT),
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
