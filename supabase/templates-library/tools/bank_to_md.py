"""Write the IBPS PO, IBPS Clerk, SBI PO and SBI Clerk templates.

Usage: python bank_to_md.py <out dir>

IBPS and SBI publish the exam structure (stages, sections, the descriptive paper)
but no topic syllabus. So each template has two kinds of content:

- Official: stages, section names, the descriptive paper, the final stage, and the
  question types named in SBI's "Acquaint Yourself" handouts. Sources:
  IBPS CRP PO/MT-XVI and CRP CSA-XVI notifications (ibps.in), SBI PO 2026 and
  Junior Associates 2026 advertisements and handouts (sbi.bank.in).
- Exam analyses: the topics under each section. A topic is included only when at
  least two independent publishers list it in their topic-wise analyses of the
  2019-2025 papers: IIT Kanpur SATHEE, PracticeMock, Physics Wallah, Adda247
  (Bankersadda/Careerpower), Oliveboard, T.I.M.E. Names are written in our own words.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from numbered_to_md import front, render  # noqa: E402

PUZZLES = ("Puzzles and Seating Arrangement", [
    "Linear seating arrangement (single and double row)",
    "Circular seating arrangement",
    "Floor and flat based puzzles",
    "Box and stack puzzles",
    "Month, date and year based puzzles",
    "Category and designation based puzzles",
])
VERBAL = ("Logical Reasoning Topics", [
    "Syllogism",
    "Inequality (direct and coded)",
    "Coding-decoding",
    "Blood relations",
    "Direction sense",
    "Order and ranking",
    "Alphanumeric and word series",
    "Meaningful word formation",
])
MAINS_REASONING = ("Mains Reasoning", [
    "Multi-row and mixed seating arrangement",
    "Machine input-output",
    "Data sufficiency",
    "Critical reasoning: statement and argument, assumption, inference, course of action",
])
COMPUTER = ("Computer Aptitude", [
    "Computer fundamentals and generations of computers",
    "Hardware: input, output and storage devices",
    "Software and operating systems",
    "MS Office: Word, Excel and PowerPoint",
    "Networking: LAN, WAN, devices and protocols",
    "Internet and e-mail",
    "Database basics",
    "Computer security: viruses, malware and firewalls",
    "Abbreviations and keyboard shortcuts",
])
DI = ("Data Interpretation", [
    "Table DI", "Bar graph DI", "Line graph DI", "Pie chart DI", "Caselet DI", "Mixed graph DI",
])
CALCULATION = ("Calculation", ["Simplification", "Approximation"])
SERIES = ("Number Series", ["Missing number series", "Wrong number series"])
ALGEBRA = ("Equations and Comparison", ["Quadratic equations", "Quantity comparison"])
ARITHMETIC = ("Arithmetic", [
    "Percentage", "Ratio and proportion", "Average", "Profit and loss", "Simple and compound interest",
    "Partnership", "Mixture and alligation", "Time and work", "Time, speed and distance",
    "Boats and streams", "Mensuration", "Probability", "Permutation and combination",
])
QUANT_DS = ("Mains Quantitative Topics", ["Data sufficiency (two and three statements)", "Arithmetic caselets"])
ENGLISH_HANDOUT = ("Question Types Named in the Handout", [
    "Grammar", "Vocabulary", "Sentence completion", "Synonyms", "Antonyms", "Comprehension of a passage",
])
ENGLISH = ("English Language Topics", [
    "Reading comprehension",
    "Cloze test",
    "Error detection",
    "Fillers (single, double and paragraph)",
    "Sentence rearrangement and para jumbles",
    "Phrase replacement",
    "Word swap and word rearrangement",
    "Misspelt words and word usage",
    "Match the column",
    "Connectors",
    "Odd one out (Mains)",
    "Paragraph summary (Mains)",
])
AWARENESS = [
    ("Current Affairs", ["National and international news of the last six months", "Appointments, awards and sports",
                         "Government schemes"]),
    ("Banking and Financial Awareness", ["RBI circulars and monetary policy", "Banking terms and products",
                                         "Digital banking and payment systems", "Financial institutions and regulators",
                                         "Financial inclusion"]),
    ("Economy", ["Indian economy", "Economic and financial news"]),
    ("Static General Knowledge", ["Indian geography, history and polity", "General science"]),
]


def subject(name, chapters):
    return render(name, chapters)


def write(out, template_id, name, description, source, parts):
    body = []
    for subject_name, chapters in parts:
        body += subject(subject_name, chapters)
    (out / f"{template_id}.md").write_text(
        front(template_id, name, description, source) + "\n".join(body) + "\n", encoding="utf8"
    )
    print(template_id, sum(len(t) for _, chs in parts for _, t in chs), "topics")


ANALYSES = ("Topics are from at least two independent analyses of the 2019-2025 papers "
            "(IIT Kanpur SATHEE, PracticeMock, Physics Wallah, Adda247, Oliveboard, T.I.M.E.); "
            "the board publishes no topic syllabus.")

if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    quant = [DI, CALCULATION, SERIES, ALGEBRA, ARITHMETIC]

    write(out, "ibps-po", "IBPS PO",
          "Probationary Officers: prelims and mains sections, the descriptive paper and the interview.",
          "Stages and sections: IBPS CRP PO/MT-XVI notification (2026). " + ANALYSES,
          [("Reasoning Ability and Computer Aptitude", [PUZZLES, VERBAL, MAINS_REASONING, COMPUTER]),
           ("Quantitative Aptitude and Data Analysis and Interpretation", quant + [QUANT_DS]),
           ("English Language", [ENGLISH]),
           ("General, Economy and Banking Awareness (Mains)", [
               ("Official Components", ["General awareness", "Economy", "Banking awareness", "Digital awareness",
                                        "Financial awareness", "RBI circulars"])] + AWARENESS),
           ("Descriptive Paper (Mains)", [
               ("Essay and Comprehension", ["Essay", "Comprehension"]),
               ("Themes", ["Economic and social issues", "Emerging trends in banking and technology",
                           "Current events", "Ethics"])]),
           ("Interview", [("Interview", ["Personal interview"])])])

    write(out, "ibps-clerk", "IBPS Clerk",
          "Customer Service Associate: prelims and mains sections.",
          "Stages and sections: IBPS CRP CSA-XVI notification (2026). " + ANALYSES,
          [("Reasoning Ability", [PUZZLES, VERBAL, MAINS_REASONING]),
           ("Numerical Ability and Quantitative Aptitude", quant),
           ("English Language and General English", [ENGLISH]),
           ("General and Financial Awareness (Mains)", AWARENESS)])

    write(out, "sbi-po", "SBI PO",
          "Probationary Officers: prelims, mains with the descriptive paper, and Phase III.",
          "Stages, sections and handout question types: SBI PO 2026 advertisement and prelims handout. " + ANALYSES,
          [("Reasoning and Computer Aptitude", [PUZZLES, VERBAL, MAINS_REASONING, COMPUTER]),
           ("Quantitative Aptitude and Data Analysis and Interpretation", quant + [QUANT_DS]),
           ("English Language", [ENGLISH_HANDOUT, ENGLISH]),
           ("General, Economy and Banking Knowledge (Mains)", AWARENESS),
           ("Descriptive Paper: Communication Skills (Mains)", [
               ("Communication Skills", ["E-mail writing", "Situation analysis", "Report writing", "Precis writing"])]),
           ("Phase III", [("Phase III", ["Psychometric test", "Group exercise", "Personal interview"])])])

    write(out, "sbi-clerk", "SBI Clerk",
          "Junior Associates (Customer Support and Sales): prelims, mains and the local language test.",
          "Stages, sections and handout question types: SBI Junior Associates 2026 advertisement and handout. "
          + ANALYSES,
          [("Reasoning Ability and Computer Aptitude", [PUZZLES, VERBAL, MAINS_REASONING, COMPUTER]),
           ("Numerical Ability and Quantitative Aptitude", quant),
           ("English Language and General English", [ENGLISH_HANDOUT, ENGLISH]),
           ("General and Financial Awareness (Mains)", AWARENESS),
           ("Local Language Test", [("Local Language Test", ["Test of the opted local language"])])])
