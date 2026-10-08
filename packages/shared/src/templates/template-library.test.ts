import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain .mjs build script, imported for its parser.
import { parseSource } from '../../../../supabase/templates-library/build-library.mjs';
import {
  parseLibraryTemplate,
  parseTemplateCatalog,
  searchCatalog,
  TemplateLibraryError,
  type TemplateCatalogEntry,
} from './template-library';

const SRC = join(__dirname, '..', '..', '..', '..', 'supabase', 'templates-library', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : name.endsWith('.md') ? [path] : [];
  });
}

const minimal = {
  format: 1,
  id: 'tiny',
  name: 'Tiny',
  description: 'A tiny template.',
  category: 'exam',
  source: 'Test fixture',
  verified: false,
  subjects: [{ name: 'Subject', chapters: [{ name: 'Chapter', topics: ['Topic'] }] }],
};

describe('every template in the repository', () => {
  const files = sources(SRC);

  it('exists', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [file.slice(SRC.length + 1), file]))(
    '%s builds into a valid template',
    (_name, file) => {
      const built = parseSource(readFileSync(file, 'utf8'), file);
      const { version: _version, ...body } = built;

      const template = parseLibraryTemplate(body);

      expect(template.id).toBe(built.id);
      expect(template.source.length).toBeGreaterThan(10);
    },
  );

  it('uses each id once', () => {
    const ids = files.map((file) => parseSource(readFileSync(file, 'utf8'), file).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the source format', () => {
  const head = '---\nid: tiny\nname: Tiny\ndescription: D\ncategory: exam\nsource: S\n---\n';

  it('reads subjects, chapters and topics', () => {
    const built = parseSource(`${head}# A\n## B\n- c\n- d\n<!-- note -->\n`);
    expect(built.subjects).toEqual([{ name: 'A', chapters: [{ name: 'B', topics: ['c', 'd'] }] }]);
    expect(built.verified).toBe(false);
    expect(built.version).toBe(1);
  });

  it.each([
    ['no front matter', '# A'],
    ['unclosed front matter', '---\nid: x'],
    ['a missing field', '---\nid: tiny\n---\n# A\n## B\n- c'],
    ['a bad id', head.replace('id: tiny', 'id: Bad Id') + '# A\n## B\n- c'],
    ['a bad category', head.replace('exam', 'quiz') + '# A\n## B\n- c'],
    ['a chapter first', `${head}## B\n- c`],
    ['a topic first', `${head}# A\n- c`],
    ['a stray line', `${head}# A\n## B\nhello`],
    ['an empty chapter', `${head}# A\n## B\n`],
    ['an empty subject', `${head}# A\n`],
    ['no subjects', head],
    ['an overlong name', `${head}# A\n## B\n- ${'x'.repeat(121)}`],
  ])('refuses %s', (_why, text) => {
    expect(() => parseSource(text)).toThrow();
  });
});

describe('parseLibraryTemplate', () => {
  it('accepts a well-formed template', () => {
    expect(parseLibraryTemplate(minimal).subjects[0]!.chapters[0]!.topics).toEqual([
      { name: 'Topic' },
    ]);
  });

  it.each([
    ['not an object', null],
    ['a newer format', { ...minimal, format: 2 }],
    ['a bad id', { ...minimal, id: 'Bad Id' }],
    ['a bad category', { ...minimal, category: 'quiz' }],
    ['an empty name', { ...minimal, name: ' ' }],
    ['a long description', { ...minimal, description: 'x'.repeat(401) }],
    ['subjects that are not a list', { ...minimal, subjects: 'x' }],
    ['too many subjects', { ...minimal, subjects: Array(61).fill(minimal.subjects[0]) }],
    [
      'a nameless topic',
      { ...minimal, subjects: [{ name: 'S', chapters: [{ name: 'C', topics: [''] }] }] },
    ],
    ['no subjects', { ...minimal, subjects: [] }],
  ])('refuses %s', (_why, value) => {
    expect(() => parseLibraryTemplate(value)).toThrow(TemplateLibraryError);
  });
});

describe('the catalog', () => {
  const entry = (id: string): Record<string, unknown> => ({
    id,
    name: `Template ${id}`,
    description: 'A template.',
    category: 'exam',
    source: 'Official syllabus',
    verified: true,
    counts: { subjects: 1, chapters: 2, topics: 3 },
    subjects: ['Accountancy'],
    version: 1,
    path: `templates/${id}.json`,
  });

  it('keeps good entries and drops bad or repeated ones', () => {
    const catalog = parseTemplateCatalog({
      format: 1,
      templates: [
        entry('one'),
        { ...entry('two'), path: '../secrets.json' },
        { ...entry('three'), counts: { subjects: -1, chapters: 0, topics: 0 } },
        'nonsense',
        entry('one'),
      ],
    });
    expect(catalog.templates.map((t) => t.id)).toEqual(['one']);
  });

  it('refuses a newer format', () => {
    expect(() => parseTemplateCatalog({ format: 2, templates: [] })).toThrow(/newer version/);
  });

  it('searches names, descriptions and subjects', () => {
    const entries = parseTemplateCatalog({
      format: 1,
      templates: [entry('aa'), { ...entry('bb'), subjects: ['Physics'] }],
    }).templates as TemplateCatalogEntry[];

    expect(searchCatalog(entries, 'accountancy').map((e) => e.id)).toEqual(['aa']);
    expect(searchCatalog(entries, '')).toHaveLength(2);
    expect(searchCatalog(entries, 'template physics').map((e) => e.id)).toEqual(['bb']);
  });
});
