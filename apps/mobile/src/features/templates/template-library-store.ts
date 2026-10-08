import {
  parseLibraryTemplate,
  parseTemplateCatalog,
  type SyllabusTemplate,
  type TemplateCatalogEntry,
} from '@preppilot/shared';
import { create } from 'zustand';
import { templatesBaseUrl } from '../../config/env';

/**
 * The cloud template library (DECISIONS.md, D111).
 *
 * The list is fetched when the Templates screen opens; a template's full
 * syllabus is fetched only when a student opens it. Nothing is stored on the
 * device until it is imported, at which point it becomes ordinary rows in their
 * course and works offline like everything else.
 */

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable';

interface TemplateLibraryState {
  readonly entries: readonly TemplateCatalogEntry[];
  readonly status: LibraryStatus;
  /** Id of the template being downloaded, so its card can say so. */
  readonly opening: string | null;
  load: () => Promise<void>;
  /** The full template, or null with `error` set when it could not be fetched. */
  open: (entry: TemplateCatalogEntry) => Promise<SyllabusTemplate | null>;
  readonly error: string | null;
  clearError: () => void;
}

export const LIBRARY_TIMEOUT_MS = 20_000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIBRARY_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Fetched templates, kept for the session so reopening one is instant. */
const fetched = new Map<string, SyllabusTemplate>();

export const useTemplateLibraryStore = create<TemplateLibraryState>((set, get) => ({
  entries: [],
  status: 'idle',
  opening: null,
  error: null,

  async load() {
    const base = templatesBaseUrl();
    if (base === null) {
      set({ status: 'unavailable' });
      return;
    }
    set({ status: 'loading' });
    try {
      const catalog = parseTemplateCatalog(await fetchJson(`${base}catalog.json`));
      set({ entries: catalog.templates, status: 'ready' });
    } catch {
      set({ status: 'failed' });
    }
  },

  async open(entry) {
    const cached = fetched.get(`${entry.id}@${entry.version}`);
    if (cached !== undefined) return cached;

    const base = templatesBaseUrl();
    if (base === null || get().opening !== null) return null;

    set({ opening: entry.id, error: null });
    try {
      const template = parseLibraryTemplate(await fetchJson(`${base}${entry.path}`));
      if (template.id !== entry.id) throw new Error('The template does not match the list');
      fetched.set(`${entry.id}@${entry.version}`, template);
      return template;
    } catch {
      set({ error: `Couldn't download ${entry.name}. Check your connection and try again.` });
      return null;
    } finally {
      set({ opening: null });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

/** Test seam. */
export function resetTemplateLibraryStore(): void {
  fetched.clear();
  useTemplateLibraryStore.setState({ entries: [], status: 'idle', opening: null, error: null });
}
