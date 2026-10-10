/**
 * Draft the ENEM template from INEP's Matriz de Referência (annex: objetos de conhecimento).
 *
 * Usage: node enem_to_md.mjs <enem.txt> <out.md>
 *   enem.txt  `pdftotext -enc UTF-8 -layout` of
 *             download.inep.gov.br/enem/outros_documentos/enem_matriz_de_referencia_v1.pdf
 */

import { writeFileSync } from 'node:fs';
import { fit } from './gate_to_md.mjs';
import { front, render } from './numbered_to_md.mjs';
import { index, lstrip, readText, re, rstrip, search, split, strip, title } from './lib/py.mjs';

const AREAS = [
  'LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS',
  'MATEMÁTICA E SUAS TECNOLOGIAS',
  'CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS',
  'CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS',
];
const SUBJECTS = new Set([
  'FÍSICA',
  'QUÍMICA',
  'BIOLOGIA',
  'HISTÓRIA',
  'GEOGRAFIA',
  'FILOSOFIA',
  'SOCIOLOGIA',
  'FILOSOFIA E SOCIOLOGIA',
]);
const NOISE = re(String.raw`VOLTAR PARA|O SUMÁRIO|ENEM MATRIZES DE REFERÊNCIA|^\d+$`);

function parse(text) {
  text = text.slice(index(text, 'ASSOCIADOS ÀS MATRIZES DE'));
  let lines = text.split('\n').map((l) => lstrip(rstrip(l), '\f'));
  lines = lines.map((l) => (search(NOISE, l) ? '' : l));
  // A blank line separates blocks; a wrapped topic line follows its topic directly.
  const collapsed = [];
  for (const l of lines) {
    if (l || (collapsed.length && collapsed.at(-1))) collapsed.push(l);
  }
  lines = collapsed;
  const subjects = [];
  let subject = null;
  let chapter = null;
  let topic = null;
  let pending = [];

  const flushTopic = () => {
    if (topic && chapter !== null) chapter[1].push(...fit(rstrip(topic, '.')));
    topic = null;
  };
  const flushHeading = () => {
    if (pending.length) {
      const name = split(String.raw`:\s`, pending.join(' '), 1)[0]; // keep the short title before the colon
      chapter = [fit(name)[0], []];
      subject[1].push(chapter);
      pending = [];
    }
  };

  // Join wrapped area titles ("LINGUAGENS, CÓDIGOS" / "E SUAS TECNOLOGIAS").
  const joined = [];
  for (let i = 0; i < lines.length;) {
    if (i + 1 < lines.length && AREAS.includes(`${strip(lines[i])} ${strip(lines[i + 1])}`)) {
      joined.push(`${strip(lines[i])} ${strip(lines[i + 1])}`);
      i += 2;
    } else {
      joined.push(lines[i]);
      i += 1;
    }
  }
  let area = null;
  for (let line of joined) {
    const indented = line.startsWith(' ');
    line = strip(line);
    if (!line) continue;
    if (AREAS.includes(line) || SUBJECTS.has(line)) {
      flushTopic();
      flushHeading();
      if (AREAS.includes(line)) {
        area = title(line)
          .replaceAll(' E ', ' e ')
          .replaceAll(' Da ', ' da ')
          .replaceAll(' Suas ', ' suas ');
        subject = [area, []];
      } else {
        subject = [`${area.split(' e suas')[0]}: ${title(line)}`, []];
      }
      subjects.push(subject);
      chapter = null;
      continue;
    }
    if (subject === null) continue;
    if (line.startsWith('•')) {
      flushHeading();
      flushTopic();
      topic = strip(lstrip(line, '• '));
    } else if (topic !== null && indented) {
      topic += ` ${line}`;
    } else {
      flushTopic();
      pending.push(line);
    }
  }
  flushTopic();
  return subjects
    .filter(([, ch]) => ch.some((c) => c[1].length))
    .map(([s, ch]) => [s, ch.filter((c) => c[1].length)]);
}

const [input, output] = process.argv.slice(2);
const subjects = parse(readText(input));
let body = [];
for (const [s, chapters] of subjects) body = body.concat(render(s, chapters));
const head = front(
  'enem',
  'ENEM',
  'Exame Nacional do Ensino Médio: Linguagens, Matemática, Ciências da Natureza e Ciências Humanas, com objetos de conhecimento.',
  'INEP, Matriz de Referência do Enem, anexo: objetos de conhecimento associados às matrizes das provas objetivas (download.inep.gov.br); textos como publicados.',
);
writeFileSync(output, head + body.join('\n') + '\n', 'utf8');
console.log(subjects.map(([s, c]) => [s, c.length, c.reduce((n, [, t]) => n + t.length, 0)]));
