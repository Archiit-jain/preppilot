"""Write the CAT, IPMAT Indore, CLAT UG and CLAT PG templates.

Usage: python aptitude_to_md.py <out dir>

These bodies publish what each section tests, not a topic list (decision D113):
- Official: the sections and the skills each section names. Sources: Consortium of
  NLUs, CLAT 2027 UG and PG syllabus pages (consortiumofnlus.ac.in); IIM Indore IPM
  programme page (iimidr.ac.in: aptitude, logical reasoning, English and Mathematics;
  Written Ability Test and Personal Interview); CAT's three sections (VARC, DILR, QA)
  as every analysis below reports them, since iimcat.ac.in could not be read.
- Exam analyses: the topics under each section, included only when at least two
  independent publishers list them. CAT: Physics Wallah, Careers360, iQuanta,
  Quantifiers, Cracku, Oswaal, Collegedunia. IPMAT: iQuanta, Hitbullseye, Careers360.
  CLAT: Careers360, Lloyd Law College, Finology. Names are written in our own words.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from numbered_to_md import front, render  # noqa: E402

ANALYSES = "Topics are from at least two independent exam analyses of recent papers; the body publishes no topic syllabus."


def write(out, template_id, name, description, source, parts):
    body = []
    for subject, chapters in parts:
        body += render(subject, chapters)
    (out / f"{template_id}.md").write_text(front(template_id, name, description, source) + "\n".join(body) + "\n",
                                           encoding="utf8")
    print(template_id, sum(len(t) for _, chs in parts for _, t in chs), "topics")


ARITHMETIC = ("Arithmetic", [
    "Percentages", "Profit and loss", "Simple and compound interest", "Ratio, proportion and variation", "Averages",
    "Time, speed and distance", "Time and work", "Mixtures and alligations",
])
ALGEBRA = ("Algebra", ["Linear and quadratic equations", "Inequalities and modulus", "Functions and graphs",
                       "Progressions and series", "Polynomials", "Logarithms"])
GEOMETRY = ("Geometry and Mensuration", ["Triangles", "Circles", "Quadrilaterals and polygons", "Coordinate geometry",
                                         "Mensuration"])
NUMBERS = ("Number System", ["Divisibility and remainders", "HCF and LCM", "Factors and integral solutions"])
MODERN = ("Modern Mathematics", ["Permutation and combination", "Probability", "Set theory and Venn diagrams"])

if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)

    write(out, "cat", "CAT", "Common Admission Test for the IIMs: VARC, DILR and Quantitative Ability.",
          "Sections: CAT (IIMs). " + ANALYSES,
          [("Verbal Ability and Reading Comprehension (VARC)", [
              ("Reading Comprehension", ["Reading comprehension passages", "Inference and main idea questions"]),
              ("Verbal Ability", ["Para jumbles", "Para summary", "Odd sentence out", "Para completion"])]),
           ("Data Interpretation and Logical Reasoning (DILR)", [
              ("Data Interpretation", ["Tables", "Bar and line charts", "Pie charts", "Mixed and unusual charts",
                                       "Caselets"]),
              ("Logical Reasoning", ["Arrangements: linear, circular and grid", "Distribution and grouping",
                                     "Games and tournaments", "Scheduling", "Networks and routes", "Venn diagrams",
                                     "Binary logic"])]),
           ("Quantitative Ability (QA)", [ARITHMETIC, ALGEBRA, GEOMETRY, NUMBERS, MODERN])])

    write(out, "ipmat-indore", "IPMAT Indore",
          "IIM Indore Integrated Programme in Management aptitude test, then the Written Ability Test and interview.",
          "Sections and later stages: IIM Indore IPM programme page. " + ANALYSES,
          [("Quantitative Ability (MCQ and Short Answer)", [
              ("Arithmetic", ["Percentages", "Profit and loss", "Simple and compound interest",
                              "Ratio, proportion and variation", "Time, speed and distance", "Time and work",
                              "Mean, median and mode"]),
              ("Algebra", ["Linear equations", "Polynomials", "Progressions and series", "Identities", "Modulus",
                           "Maxima and minima"]),
              ("Number System", ["Remainders", "HCF and LCM", "Integral solutions"]),
              ("Geometry", ["Circles", "Quadrilaterals", "Conic sections"]),
              ("Higher Mathematics", ["Set theory and Venn diagrams", "Probability", "Permutation and combination",
                                      "Logarithms", "Matrices and determinants"]),
              ("Data Interpretation", ["Tables and charts", "Arrangements"])]),
           ("Verbal Ability", [
              ("Verbal Ability", ["Reading comprehension", "Sentence completion", "Sentence correction",
                                  "Para jumbles", "Para completion", "Idioms and vocabulary"])]),
           ("Written Ability Test and Interview", [
              ("Written Ability Test and Interview", ["Written Ability Test", "Personal interview"])])])

    write(out, "clat-ug", "CLAT UG",
          "Common Law Admission Test for five-year law programmes: the five sections and what each tests.",
          "Sections and skills: Consortium of NLUs, CLAT 2027 UG syllabus. " + ANALYSES,
          [("English Language", [
              ("Skills Tested", ["Main point and arguments of a passage", "Inferences and conclusions",
                                 "Summarising a passage", "Comparing arguments and viewpoints",
                                 "Meaning of words and phrases in context"]),
              ("Question Types", ["Reading comprehension", "Vocabulary in context", "Author's tone and intent"])]),
           ("Current Affairs, including General Knowledge", [
              ("Areas", ["Contemporary events of significance from India and the world", "Arts and culture",
                         "International affairs", "Historical events of continuing significance"]),
              ("Frequent Themes", ["Legal and policy news", "Constitutional and governance developments",
                                   "Sports"])]),
           ("Legal Reasoning", [
              ("Skills Tested", ["Identifying rules and principles in a passage",
                                 "Applying rules to fact situations",
                                 "How changes to a rule change its application"]),
              ("Frequent Areas of Law", ["Law of contract", "Law of torts", "Criminal law", "Constitutional law",
                                         "Environmental law", "Family law", "Intellectual property law"])]),
           ("Logical Reasoning", [
              ("Skills Tested", ["Arguments: premises and conclusions", "Patterns of reasoning",
                                 "Strengthening and weakening arguments", "Inferences and applying them",
                                 "Analogies, contradictions and equivalence"]),
              ("Question Types", ["Assumptions", "Inferences", "Strengthen and weaken", "Conclusions"])]),
           ("Quantitative Techniques", [
              ("Areas (Class 10 level)", ["Ratios and proportions", "Basic algebra", "Mensuration",
                                         "Statistical estimation"]),
              ("Frequent Question Types", ["Percentages", "Data interpretation: tables and graphs",
                                           "Arithmetic word problems"])])])

    pg_subjects = ["Constitutional Law", "Jurisprudence", "Administrative Law", "Law of Contract", "Law of Torts",
                   "Family Law", "Criminal Law", "Property Law", "Company Law", "Public International Law", "Tax Law",
                   "Environmental Law", "Labour and Industrial Law"]
    write(out, "clat-pg", "CLAT PG",
          "Common Law Admission Test for LL.M.: passages from judgments and statutes across thirteen law subjects.",
          "Subjects and question types: Consortium of NLUs, CLAT 2027 PG syllabus. The Consortium names the subjects "
          "only; topics within each subject are not listed.",
          [("Law Subjects", [(s, ["Concepts and statutory provisions", "Landmark judgments"]) for s in pg_subjects]),
           ("Question Types", [("Question Types", [
               "Comprehending issues and arguments in a judgment or statute extract",
               "Legal issues arising from the passage", "Summarising a passage",
               "Applying knowledge of the field of law"])])])
