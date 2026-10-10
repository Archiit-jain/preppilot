import {
  bundledTemplates,
  countTemplate,
  indexTemplate,
  type LibraryItem,
  type LibrarySource,
  type SyllabusTemplate,
  type TemplateCatalogEntry,
} from '@preppilot/shared';
import { useMemo } from 'react';
import { useTrackersStore } from '../trackers/trackers-store';
import { useTemplateLibraryStore } from './template-library-store';

/** A template the library can list: shipped with the app, or in the online catalog. */
export type LibraryTemplate =
  | (LibrarySource & { readonly kind: 'bundled'; readonly template: SyllabusTemplate })
  | (LibrarySource & { readonly kind: 'online'; readonly entry: TemplateCatalogEntry });

export type LibraryTemplateItem = LibraryItem<LibraryTemplate>;

/**
 * The bundled templates, counted and indexed once. Counting walks every topic,
 * so it is done when the module loads, never per render.
 */
const bundledItems: readonly LibraryTemplateItem[] = bundledTemplates.map((template) =>
  indexTemplate<LibraryTemplate>({
    kind: 'bundled',
    template,
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    counts: countTemplate(template),
    subjects: template.subjects.map((subject) => subject.name),
  }),
);
const bundledIds = new Set(bundledItems.map((item) => item.id));

/**
 * Everything the library lists, each template once.
 *
 * Only catalog metadata is held here (names, counts, subject names); an online
 * template's syllabus is downloaded when the student opens its preview.
 */
export function useLibraryItems(): readonly LibraryTemplateItem[] {
  const entries = useTemplateLibraryStore((state) => state.entries);
  return useMemo(
    () => [
      ...bundledItems,
      // A template that also ships with the app is listed once, as the bundled copy.
      ...entries
        .filter((entry) => !bundledIds.has(entry.id))
        .map((entry) =>
          indexTemplate<LibraryTemplate>({
            kind: 'online',
            entry,
            id: entry.id,
            name: entry.name,
            description: entry.description,
            category: entry.category,
            counts: entry.counts,
            subjects: entry.subjects,
          }),
        ),
    ],
    [entries],
  );
}

/**
 * Templates the student has started a course from, most recent first.
 *
 * Read from the courses they have, which record the template each came from; a
 * deleted course drops out with it. Nothing extra is stored.
 */
export function useRecentTemplateIds(): readonly string[] {
  const trackers = useTrackersStore((state) => state.trackers);
  return useMemo(() => {
    const ids: string[] = [];
    for (const tracker of [...trackers].sort((a, b) => b.createdAt - a.createdAt)) {
      if (tracker.templateId !== null && !ids.includes(tracker.templateId))
        ids.push(tracker.templateId);
    }
    return ids;
  }, [trackers]);
}
