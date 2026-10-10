/**
 * Shared parsing for syllabi written as numbered chapters under paper headings.
 *
 * Many official syllabi (UPSC ESE, CSIR NET and others) read:
 *
 *     PAPER - I
 *     1. Building Materials: Stone, Lime, Glass; Cement: Types, Composition ...
 *     2. Solid Mechanics: Elastic constants, Stress ...
 *
 * `papers(text)` turns that into [[paper, [[chapter, [topics]]]]], using the same
 * topic splitting as the UGC NET converter, so a line "Cement: Types, Uses"
 * becomes topics "Cement: Types", "Cement: Uses".
 */

import { clean, fit } from './gate_to_md.mjs';
import { topicsFrom } from './ugcnet_to_md.mjs';
import { islower, match, slice, splitlines, strip, unique } from './lib/py.mjs';

const PAPER = String.raw`^PAPER\s*[-–]?\s*(I{1,3}|\d)\b\s*(.*)$`;
const CHAPTER = String.raw`^(\d{1,2})\.\s*([^:]{2,90}?)\s*:\s*(.*)$`;
const PAGE = String.raw`^\d{1,3}$`;

/** Rejoins wrapped lines: a new logical line starts at a paper or a numbered chapter. */
export function joined(lines) {
  const out = [];
  for (let line of lines) {
    line = strip(line);
    if (!line || match(PAGE, line)) continue;
    if (match(PAPER, line, 'i') || match(CHAPTER, line) || !out.length) out.push(line);
    else if (out[out.length - 1].endsWith('-') && islower(slice(line, 0, 1)))
      out[out.length - 1] += line;
    else out[out.length - 1] += ` ${line}`;
  }
  return out;
}

export function papers(text, firstPaper = 'Paper I') {
  const result = [];
  let current = null;
  for (let line of joined(splitlines(text))) {
    const paper = match(PAPER, line, 'i');
    if (paper) {
      current = [`Paper ${paper.group(1).toUpperCase()}`, []];
      result.push(current);
      line = strip(paper.group(2));
      if (!line) continue;
    }
    const chapter = match(CHAPTER, line);
    if (current === null) {
      current = [firstPaper, []];
      result.push(current);
    }
    if (chapter) {
      const name = fit(clean(chapter.group(2)))[0];
      current[1].push([name, topicsFrom(chapter.group(3))]);
    } else if (current[1].length) {
      current[1][current[1].length - 1][1].push(...topicsFrom(line));
    }
  }
  return result.map(([p, chs]) => [
    p,
    chs.filter(([, t]) => t.length).map(([c, t]) => [c, unique(t).slice(0, 200)]),
  ]);
}

export function render(subject, chapters) {
  const out = [`# ${subject}`];
  for (const [name, topics] of chapters) {
    out.push(`## ${name}`);
    out.push(...topics.map((t) => `- ${t}`));
  }
  return out;
}

export function front(templateId, name, description, source, category = 'exam') {
  return (
    '---\n' +
    `id: ${templateId}\n` +
    `name: ${name}\n` +
    `description: ${description}\n` +
    `category: ${category}\n` +
    `source: ${source}\n` +
    'verified: false\n' +
    'version: 1\n' +
    '---\n'
  );
}
