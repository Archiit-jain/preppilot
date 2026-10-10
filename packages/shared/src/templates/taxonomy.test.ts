import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledTemplates } from './bundled';
import { countTemplate } from './template';
// @ts-expect-error -- a plain .mjs build script, imported for its parser.
import { parseSource } from '../../../../supabase/templates-library/build-library.mjs';
import { parseLibraryTemplate } from './template-library';
import {
  PLACED_TEMPLATE_IDS,
  TEMPLATE_GROUPS,
  countFacet,
  countGroups,
  countSubgroups,
  filterLibrary,
  indexTemplate,
  normalizeSearch,
  placeTemplate,
  type LibrarySource,
} from './taxonomy';

// The online library, built from its sources the way build-library.mjs builds
// it (dist/ is not committed, so the sources are what CI can see).
const SRC = join(__dirname, '..', '..', '..', '..', 'supabase', 'templates-library', 'src');
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : name.endsWith('.md') ? [path] : [];
  });
}
const online: LibrarySource[] = sources(SRC).map((file) => {
  const { version: _version, ...body } = parseSource(readFileSync(file, 'utf8'), file);
  const template = parseLibraryTemplate(body);
  return {
    ...template,
    counts: countTemplate(template),
    subjects: template.subjects.map((subject) => subject.name),
  };
});
const bundled: LibrarySource[] = bundledTemplates.map((template) => ({
  ...template,
  counts: countTemplate(template),
  subjects: template.subjects.map((subject) => subject.name),
}));
// What the app lists: bundled first, an online template with a bundled id shown once.
const bundledIds = new Set(bundled.map((t) => t.id));
const all = [...bundled, ...online.filter((t) => !bundledIds.has(t.id))].map(indexTemplate);

const ids = (query: string, extra: Parameters<typeof filterLibrary>[1] = {}) =>
  filterLibrary(all, { query, ...extra }).map((item) => item.id);

describe('the catalog the app holds', () => {
  it('is the 193 online templates plus the 24 bundled ones, with no id shared', () => {
    expect(online).toHaveLength(193);
    expect(bundled).toHaveLength(24);
    expect(online.filter((t) => bundledIds.has(t.id))).toEqual([]);
    expect(all).toHaveLength(217);
  });

  it('gives every template a real category: none is left on the "Other" shelf', () => {
    expect(all.filter((item) => item.group === 'other').map((item) => item.id)).toEqual([]);
  });

  it('places nothing that does not exist', () => {
    const present = new Set(all.map((item) => item.id));
    expect(PLACED_TEMPLATE_IDS.filter((id) => !present.has(id))).toEqual([]);
  });

  it('places every template on a subgroup its group declares', () => {
    for (const item of all) {
      const group = TEMPLATE_GROUPS.find((g) => g.id === item.group);
      expect(
        group?.subgroups.some((s) => s.id === item.subgroup),
        item.id,
      ).toBe(true);
    }
  });

  it('declares no empty subgroup apart from the fallback', () => {
    for (const group of TEMPLATE_GROUPS.filter((g) => g.id !== 'other')) {
      for (const sub of group.subgroups) {
        expect(
          all.some((item) => item.subgroup === sub.id),
          `${group.id}/${sub.id}`,
        ).toBe(true);
      }
    }
  });

  it('counts add up to the whole catalog', () => {
    const groups = countGroups(all);
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(all.length);
    for (const group of groups) {
      const subs = countSubgroups(all, group.id);
      expect(subs.reduce((n, s) => n + s.count, 0)).toBe(group.count);
    }
  });

  it('matches the expected shelf sizes', () => {
    expect(Object.fromEntries(countGroups(all).map((g) => [g.id, g.count]))).toEqual({
      school: 20,
      engineering: 32,
      medical: 15,
      government: 22,
      research: 13,
      professional: 12,
      'management-law': 5,
      international: 6,
      technology: 28,
      'maths-science': 20,
      'medical-learning': 20,
      languages: 8,
      creative: 16,
    });
  });

  it('puts an unknown template on the fallback shelf instead of hiding it', () => {
    expect(placeTemplate('brand-new-template')).toMatchObject({
      group: 'other',
      subgroup: 'other',
    });
  });
});

describe('searching', () => {
  it.each([
    ['JEE', ['jee-advanced-2026', 'jee-main-2026']],
    ['IELTS', ['ielts']],
    ['Python', ['python']],
    ['C++', ['cpp']],
    ['cpp', ['cpp']],
  ])('"%s" puts the right templates first', (query, expected) => {
    expect(ids(query).slice(0, expected.length).sort()).toEqual(expected);
  });

  it('finds GATE Data Science and AI from "GATE AI"', () => {
    expect(ids('GATE AI')[0]).toBe('gate-data-science-ai');
  });

  it('finds every Class 12 commerce template from "class 12 commerce"', () => {
    expect(ids('class 12 commerce').slice(0, 2).sort()).toEqual([
      'cbse-class-12-commerce',
      'isc-class-12-commerce',
    ]);
  });

  it('tells C from C++', () => {
    expect(ids('C')[0]).toBe('c-language');
    expect(ids('C++')).not.toContain('c-language');
  });

  it('ignores case, punctuation and spacing', () => {
    expect(ids('  gate   CS ')[0]).toBe('gate-cs-it');
    expect(ids('btech')).toContain('amu-btech');
    expect(ids('ca-final')[0]).toBe('ca-final');
  });

  it('finds a template by a subject inside it', () => {
    expect(ids('accountancy')).toContain('cbse-class-12-commerce');
  });

  it('finds a whole subgroup by its name', () => {
    expect(ids('railways').sort()).toEqual([
      'rrb-je-civil',
      'rrb-je-electrical',
      'rrb-je-electronics',
      'rrb-je-mechanical',
    ]);
  });

  it('finds nothing for nonsense', () => {
    expect(ids('underwater basket weaving')).toEqual([]);
  });

  it('normalises accents and ampersands', () => {
    expect(normalizeSearch('Matemática & Física')).toBe('matematica and fisica');
  });
});

describe('filtering and sorting', () => {
  it('filters by category', () => {
    const items = filterLibrary(all, { group: 'languages' });
    expect(items).toHaveLength(8);
    expect(items.every((item) => item.group === 'languages')).toBe(true);
  });

  it('filters by subcategory', () => {
    expect(ids('', { group: 'technology', subgroup: 'programming-languages' }).sort()).toEqual([
      'c-language',
      'cpp',
      'java',
      'javascript',
      'python',
    ]);
  });

  it('filters school templates by class and stream', () => {
    expect(ids('', { group: 'school', classLevel: 'Class 12', stream: 'Commerce' }).sort()).toEqual(
      ['cbse-class-12-commerce', 'isc-class-12-commerce'],
    );
    const school = filterLibrary(all, { group: 'school' });
    expect(countFacet(school, 'classLevel').map((f) => f.id)).toEqual([
      'Class 9',
      'Class 10',
      'Class 11',
      'Class 12',
    ]);
  });

  it('combines search with filters', () => {
    expect(ids('gate', { group: 'engineering', subgroup: 'gate-science' })).toHaveLength(6);
    expect(ids('gate', { group: 'school' })).toEqual([]);
  });

  it('restores everything when the filters are cleared', () => {
    expect(filterLibrary(all, {})).toHaveLength(all.length);
  });

  it('never lists a template twice', () => {
    const doubled = [...all, ...all];
    const items = filterLibrary(doubled, {});
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items).toHaveLength(all.length);
  });

  it('sorts A to Z, by size and by recent use', () => {
    const names = filterLibrary(all, { sort: 'name' }).map((item) => item.name);
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })),
    );

    const sizes = filterLibrary(all, { sort: 'size' }).map((item) => item.source.counts.topics);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));

    const shelved = filterLibrary(all, { sort: 'category' });
    expect(shelved[0]!.group).toBe('school');
    expect(shelved.at(-1)!.group).toBe('creative');

    const recent = filterLibrary(all, { sort: 'recent', recent: ['python', 'gate-civil'] });
    expect(recent.slice(0, 2).map((item) => item.id)).toEqual(['python', 'gate-civil']);
  });

  it('stays fast over the whole catalog', () => {
    const started = performance.now();
    for (const query of [
      'g',
      'ga',
      'gat',
      'gate',
      'gate c',
      'gate ci',
      'gate civ',
      'class 12',
      'python',
      'neet',
    ]) {
      filterLibrary(all, { query });
    }
    expect(performance.now() - started).toBeLessThan(250);
  });
});
