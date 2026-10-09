"""Draft the ENEM template from INEP's Matriz de Referência (annex: objetos de conhecimento).

Usage: python enem_to_md.py <enem.txt> <out.md>
  enem.txt  `pdftotext -enc UTF-8 -layout` of
            download.inep.gov.br/enem/outros_documentos/enem_matriz_de_referencia_v1.pdf
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gate_to_md import fit  # noqa: E402
from numbered_to_md import front, render  # noqa: E402

AREAS = ["LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS", "MATEMÁTICA E SUAS TECNOLOGIAS",
         "CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS", "CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS"]
SUBJECTS = {"FÍSICA", "QUÍMICA", "BIOLOGIA", "HISTÓRIA", "GEOGRAFIA", "FILOSOFIA", "SOCIOLOGIA",
            "FILOSOFIA E SOCIOLOGIA"}
NOISE = re.compile(r"VOLTAR PARA|O SUMÁRIO|ENEM MATRIZES DE REFERÊNCIA|^\d+$")


def parse(text: str) -> list:
    text = text[text.index("ASSOCIADOS ÀS MATRIZES DE"):]
    lines = [l.rstrip().lstrip("\x0c") for l in text.split("\n")]
    lines = ["" if NOISE.search(l) else l for l in lines]
    # A blank line separates blocks; a wrapped topic line follows its topic directly.
    collapsed = []
    for l in lines:
        if l or (collapsed and collapsed[-1]):
            collapsed.append(l)
    lines = collapsed
    subjects, subject, chapter, topic, pending = [], None, None, None, []

    def flush_topic():
        nonlocal topic
        if topic and chapter is not None:
            chapter[1].extend(fit(topic.rstrip(".")))
        topic = None

    def flush_heading():
        nonlocal chapter, pending
        if pending:
            name = " ".join(pending)
            name = re.split(r":\s", name, maxsplit=1)[0]  # keep the short title before the colon
            chapter = (fit(name)[0], [])
            subject[1].append(chapter)
            pending = []

    i, joined = 0, []
    # Join wrapped area titles ("LINGUAGENS, CÓDIGOS" / "E SUAS TECNOLOGIAS").
    while i < len(lines):
        if i + 1 < len(lines) and f"{lines[i].strip()} {lines[i + 1].strip()}" in AREAS:
            joined.append(f"{lines[i].strip()} {lines[i + 1].strip()}")
            i += 2
        else:
            joined.append(lines[i])
            i += 1
    area = None
    for line in joined:
        indented = line.startswith(" ")
        line = line.strip()
        if not line:
            continue
        if line in AREAS or line in SUBJECTS:
            flush_topic()
            flush_heading()
            if line in AREAS:
                area = line.title().replace(" E ", " e ").replace(" Da ", " da ").replace(" Suas ", " suas ")
                subject = (area, [])
            else:
                subject = (f"{area.split(' e suas')[0]}: {line.title()}", [])
            subjects.append(subject)
            chapter = None
            continue
        if subject is None:
            continue
        if line.startswith("•"):
            flush_heading()
            flush_topic()
            topic = line.lstrip("• ").strip()
        elif topic is not None and indented:
            topic += " " + line
        else:
            flush_topic()
            pending.append(line)
    flush_topic()
    return [(s, [c for c in ch if c[1]]) for s, ch in subjects if any(c[1] for c in ch)]


if __name__ == "__main__":
    subjects = parse(Path(sys.argv[1]).read_text(encoding="utf8"))
    body = []
    for s, chapters in subjects:
        body += render(s, chapters)
    head = front("enem", "ENEM", "Exame Nacional do Ensino Médio: Linguagens, Matemática, Ciências da Natureza e Ciências Humanas, com objetos de conhecimento.",
                 "INEP, Matriz de Referência do Enem, anexo: objetos de conhecimento associados às matrizes das provas objetivas (download.inep.gov.br); textos como publicados.")
    Path(sys.argv[2]).write_text(head + "\n".join(body) + "\n", encoding="utf8")
    print([(s, len(c), sum(len(t) for _, t in c)) for s, c in subjects])
