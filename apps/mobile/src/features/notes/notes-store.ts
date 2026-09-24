import { create } from 'zustand';
import type { Repositories } from '../../db/client';
import type { NoteEntry } from '../../db/repositories/notes';
import type { NoteSource } from '../../db/schema';
import { activeTrackerId } from '../trackers/trackers-store';

/** A topic a note can be attached to, with enough context to tell two apart. */
export interface NoteTarget {
  readonly topicId: string;
  readonly topicName: string;
  readonly chapterName: string;
  readonly subjectName: string;
  /** How many notes it already has. A topic can hold any number. */
  readonly noteCount: number;
}

export interface NewNote {
  readonly topicId: string;
  readonly subtopicId?: string | null;
  readonly body: string;
  readonly source?: NoteSource;
}

export interface NotesState {
  readonly notes: readonly NoteEntry[];
  /** Topics in the current course, for choosing where a new note goes. */
  readonly targets: readonly NoteTarget[];
  readonly loading: boolean;
  readonly error: string | null;
}

export interface NotesActions {
  load: (userId: string, repositories: Repositories) => Promise<void>;
  add: (note: NewNote) => Promise<boolean>;
  edit: (id: string, body: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

const initialState: NotesState = { notes: [], targets: [], loading: false, error: null };

interface Context {
  readonly userId: string;
  readonly repositories: Repositories;
}

let context: Context | null = null;

function requireContext(): Context {
  if (context === null) {
    throw new Error('Notes used before load() — call load(userId, repositories) first.');
  }
  return context;
}

export const EMPTY_NOTE_MESSAGE = 'A note needs something in it.';

/**
 * Adds a note from anywhere in the app — the Notes tab, a topic summary, an
 * assistant reply — and refreshes the Notes tab if it has been opened.
 *
 * Returns whether it was saved; an empty note is refused rather than stored.
 */
export async function addNote(
  userId: string,
  repositories: Repositories,
  { topicId, subtopicId = null, body, source = 'manual' }: NewNote,
): Promise<boolean> {
  if (body.trim().length === 0) return false;
  await repositories.notes.create({
    userId,
    trackerId: activeTrackerId(),
    topicId,
    subtopicId,
    body,
    source,
  });
  if (context !== null && context.userId === userId) {
    await useNotesStore.getState().load(userId, repositories);
  }
  return true;
}

export const useNotesStore = create<NotesState & NotesActions>((set, get) => ({
  ...initialState,

  /**
   * Reads the notes, and the topics one could be written against.
   *
   * The targets come along because writing a note from this tab means choosing
   * where it goes, and a picker that has to fetch its own options would leave
   * the student looking at a spinner after they had already decided. They are
   * read in three bulk queries, not one per chapter.
   *
   * Notes written in the old one-per-topic column are adopted first, so they
   * appear here the first time this version opens.
   */
  async load(userId, repositories) {
    context = { userId, repositories };
    set({ loading: true, error: null });

    try {
      await repositories.notes.adoptLegacy(userId);

      const tracker = activeTrackerId();
      const [notes, subjects, chapters, topics] = await Promise.all([
        repositories.notes.listByUser(userId, tracker),
        repositories.subjects.listByUser(userId, tracker),
        repositories.chapters.listByUser(userId),
        repositories.topics.listByUser(userId),
      ]);

      const counts = new Map<string, number>();
      for (const note of notes) counts.set(note.topicId, (counts.get(note.topicId) ?? 0) + 1);

      const chaptersBySubject = groupBy(chapters, (chapter) => chapter.subjectId);
      const topicsByChapter = groupBy(topics, (topic) => topic.chapterId);

      const targets: NoteTarget[] = [];
      for (const subject of subjects) {
        for (const chapter of chaptersBySubject.get(subject.id) ?? []) {
          for (const topic of topicsByChapter.get(chapter.id) ?? []) {
            targets.push({
              topicId: topic.id,
              topicName: topic.name,
              chapterName: chapter.name,
              subjectName: subject.name,
              noteCount: counts.get(topic.id) ?? 0,
            });
          }
        }
      }

      set({ notes, targets });
    } catch {
      set({ error: 'We could not open your notes. Pull down to try again.' });
    } finally {
      set({ loading: false });
    }
  },

  async add(note) {
    const ctx = requireContext();
    if (note.body.trim().length === 0) {
      set({ error: EMPTY_NOTE_MESSAGE });
      return false;
    }
    try {
      return await addNote(ctx.userId, ctx.repositories, note);
    } catch {
      set({ error: 'We could not save that note. Try again.' });
      return false;
    }
  },

  /**
   * Corrects a note. Returns whether it landed, so the editor can stay open —
   * and keep what the student typed — when it did not.
   */
  async edit(id, body) {
    const ctx = requireContext();
    if (body.trim().length === 0) {
      set({ error: EMPTY_NOTE_MESSAGE });
      return false;
    }
    try {
      await ctx.repositories.notes.edit(id, body);
      await get().load(ctx.userId, ctx.repositories);
      return true;
    } catch {
      set({ error: 'We could not save that note. Try again.' });
      return false;
    }
  },

  async remove(id) {
    const ctx = requireContext();
    try {
      await ctx.repositories.notes.softDelete(id);
      await get().load(ctx.userId, ctx.repositories);
    } catch {
      set({ error: 'We could not delete that note. Try again.' });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list === undefined) map.set(k, [row]);
    else list.push(row);
  }
  return map;
}

/** Test seam: clears the store and its captured context. */
export function resetNotesStore(): void {
  context = null;
  useNotesStore.setState({ ...initialState });
}
