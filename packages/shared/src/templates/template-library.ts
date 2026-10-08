import { isValidName } from '../domain/types';
import {
  TEMPLATE_CATEGORIES,
  validateTemplate,
  type SyllabusTemplate,
  type TemplateCategory,
  type TemplateCounts,
} from './template';

/**
 * The cloud template library.
 *
 * The templates bundled with the app are a small core. The rest live as JSON
 * in the project's public `templates` Storage bucket, listed in a catalog and
 * fetched only when a student picks one, so the library can grow (and be
 * corrected) without growing the app or waiting for a release. Once imported,
 * a template is ordinary rows in the student's course and works offline.
 *
 * Everything here arrives from the network, so it is checked as strictly as
 * hand-edited data: a malformed entry is dropped, a malformed template refused.
 */

export const TEMPLATE_LIBRARY_FORMAT = 1;

/** Generous for a full syllabus, small enough that a bad file cannot flood a phone. */
const LIMITS = { subjects: 60, chapters: 120, topics: 200, entries: 500, text: 400 } as const;
const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const PATH = /^templates\/[a-z0-9][a-z0-9-]{1,63}\.json$/;

export interface TemplateCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: TemplateCategory;
  /** What the content was built from, shown before download. */
  readonly source: string;
  readonly verified: boolean;
  readonly counts: TemplateCounts;
  /** Subject names, so a search for "accountancy" finds a template before it is fetched. */
  readonly subjects: readonly string[];
  readonly version: number;
  /** Relative to the library root, e.g. `templates/gate-civil.json`. */
  readonly path: string;
}

export interface TemplateCatalog {
  readonly format: typeof TEMPLATE_LIBRARY_FORMAT;
  readonly templates: readonly TemplateCatalogEntry[];
}

export class TemplateLibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateLibraryError';
  }
}

type Json = Record<string, unknown>;

function object(value: unknown, path: string): Json {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TemplateLibraryError(`${path} must be an object`);
  }
  return value as Json;
}

function list(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new TemplateLibraryError(`${path} must be a list`);
  if (value.length > max) throw new TemplateLibraryError(`${path} has more than ${max} items`);
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > LIMITS.text) {
    throw new TemplateLibraryError(`${path} must be text of at most ${LIMITS.text} characters`);
  }
  return value.trim();
}

function name(value: unknown, path: string): string {
  if (!isValidName(value)) throw new TemplateLibraryError(`${path} is not a valid name`);
  return value.trim();
}

function count(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100_000) {
    throw new TemplateLibraryError(`${path} must be a whole number`);
  }
  return value;
}

function category(value: unknown, path: string): TemplateCategory {
  if (!(TEMPLATE_CATEGORIES as readonly unknown[]).includes(value)) {
    throw new TemplateLibraryError(`${path} must be one of ${TEMPLATE_CATEGORIES.join(', ')}`);
  }
  return value as TemplateCategory;
}

function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !ID.test(value)) {
    throw new TemplateLibraryError(`${path} is not a valid id`);
  }
  return value;
}

/** Validates a downloaded template. Throws `TemplateLibraryError` naming the first problem. */
export function parseLibraryTemplate(value: unknown): SyllabusTemplate {
  const raw = object(value, 'template');
  if (raw.format !== TEMPLATE_LIBRARY_FORMAT) {
    throw new TemplateLibraryError('This template needs a newer version of PrepPilot');
  }

  const template: SyllabusTemplate = {
    id: id(raw.id, 'id'),
    name: name(raw.name, 'name'),
    description: text(raw.description, 'description'),
    category: category(raw.category, 'category'),
    source: text(raw.source, 'source'),
    verified: raw.verified === true,
    subjects: list(raw.subjects, 'subjects', LIMITS.subjects).map((subject, s) => {
      const subjectRaw = object(subject, `subjects[${s}]`);
      return {
        name: name(subjectRaw.name, `subjects[${s}].name`),
        chapters: list(subjectRaw.chapters, `subjects[${s}].chapters`, LIMITS.chapters).map(
          (chapter, c) => {
            const chapterRaw = object(chapter, `subjects[${s}].chapters[${c}]`);
            return {
              name: name(chapterRaw.name, `subjects[${s}].chapters[${c}].name`),
              topics: list(
                chapterRaw.topics,
                `subjects[${s}].chapters[${c}].topics`,
                LIMITS.topics,
              ).map((topic, t) => ({
                name: name(topic, `subjects[${s}].chapters[${c}].topics[${t}]`),
              })),
            };
          },
        ),
      };
    }),
  };

  const check = validateTemplate(template);
  if (!check.valid) throw new TemplateLibraryError(check.message);
  return template;
}

/** Validates the catalog. Entries that fail are dropped, not fatal. */
export function parseTemplateCatalog(value: unknown): TemplateCatalog {
  const raw = object(value, 'catalog');
  if (raw.format !== TEMPLATE_LIBRARY_FORMAT) {
    throw new TemplateLibraryError('This template list needs a newer version of PrepPilot');
  }

  const seen = new Set<string>();
  const templates: TemplateCatalogEntry[] = [];
  for (const [index, item] of list(raw.templates, 'templates', LIMITS.entries).entries()) {
    try {
      const entry = object(item, `templates[${index}]`);
      const counts = object(entry.counts, 'counts');
      const path = entry.path;
      if (typeof path !== 'string' || !PATH.test(path)) {
        throw new TemplateLibraryError('path is not valid');
      }
      const parsed: TemplateCatalogEntry = {
        id: id(entry.id, 'id'),
        name: name(entry.name, 'name'),
        description: text(entry.description, 'description'),
        category: category(entry.category, 'category'),
        source: text(entry.source, 'source'),
        verified: entry.verified === true,
        counts: {
          subjects: count(counts.subjects, 'counts.subjects'),
          chapters: count(counts.chapters, 'counts.chapters'),
          topics: count(counts.topics, 'counts.topics'),
        },
        subjects: list(entry.subjects, 'subjects', LIMITS.subjects).map((subject, s) =>
          name(subject, `subjects[${s}]`),
        ),
        version: count(entry.version, 'version'),
        path,
      };
      if (seen.has(parsed.id)) continue;
      seen.add(parsed.id);
      templates.push(parsed);
    } catch (error) {
      if (!(error instanceof TemplateLibraryError)) throw error;
    }
  }

  return { format: TEMPLATE_LIBRARY_FORMAT, templates };
}

/** Catalog entries matching a search, with the same rules as the bundled library. */
export function searchCatalog(
  entries: readonly TemplateCatalogEntry[],
  query: string,
): readonly TemplateCatalogEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = [entry.name, entry.description, ...entry.subjects].join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
