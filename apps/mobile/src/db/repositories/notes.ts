import { uuidV7 } from '@preppilot/shared';
import { and, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import {
  chapters,
  notes,
  subjects,
  subtopics,
  topics,
  type NoteRow,
  type NoteSource,
} from '../schema';
import { systemClock, type Clock, type Database } from '../types';
import { scopedToTracker } from './tracker-scope';

/** Which level a note was written against. Both are edited the same way. */
export type NoteLevel = 'topic' | 'subtopic';

export interface NoteEntry {
  /** The note's own id. */
  readonly id: string;
  readonly level: NoteLevel;
  readonly topicId: string;
  /** Set when the note belongs to a sub-topic. */
  readonly subtopicId: string | null;
  /** The sub-topic's name for a sub-topic note, otherwise the topic's. */
  readonly topicName: string;
  /** For a sub-topic note, the topic above it — the same substitution the assistant makes. */
  readonly chapterName: string;
  readonly subjectName: string;
  readonly subjectId: string;
  readonly body: string;
  readonly source: NoteSource;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateNoteInput {
  readonly userId: string;
  readonly trackerId?: string | null;
  readonly topicId: string;
  readonly subtopicId?: string | null;
  readonly body: string;
  readonly source?: NoteSource;
}

/**
 * Notes, any number per topic or sub-topic.
 *
 * Each list joins through the syllabus, so a note on a deleted topic, chapter or
 * subject disappears with it, and the subject and chapter names come along
 * because a note is meaningless without knowing what it is about.
 */
export class NoteRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock = systemClock,
  ) {}

  /** A tracker's notes, newest first. See {@link scopedToTracker}. */
  async listByUser(userId: string, trackerId?: string | null): Promise<NoteEntry[]> {
    const rows = await this.db
      .select({
        note: notes,
        topicName: topics.name,
        chapterName: chapters.name,
        subjectName: subjects.name,
        subjectId: subjects.id,
      })
      .from(notes)
      .innerJoin(topics, eq(notes.topicId, topics.id))
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(
        and(
          eq(notes.userId, userId),
          isNull(notes.deletedAt),
          isNull(topics.deletedAt),
          isNull(chapters.deletedAt),
          isNull(subjects.deletedAt),
          ...scopedToTracker(subjects.trackerId, trackerId),
        ),
      )
      .orderBy(desc(notes.updatedAt));

    const subtopicIds = rows
      .map((row) => row.note.subtopicId)
      .filter((id): id is string => id !== null);
    const subtopicRows =
      subtopicIds.length === 0
        ? []
        : await this.db
            .select({ id: subtopics.id, name: subtopics.name, deletedAt: subtopics.deletedAt })
            .from(subtopics)
            .where(inArray(subtopics.id, subtopicIds));
    const subtopicById = new Map(subtopicRows.map((row) => [row.id, row]));

    const entries: NoteEntry[] = [];
    for (const row of rows) {
      const { note } = row;
      if (note.subtopicId === null) {
        entries.push(entry(note, 'topic', row.topicName, row.chapterName, row));
        continue;
      }
      const subtopic = subtopicById.get(note.subtopicId);
      // A note on a deleted sub-topic goes with it.
      if (subtopic === undefined || subtopic.deletedAt !== null) continue;
      entries.push(entry(note, 'subtopic', subtopic.name, row.topicName, row));
    }
    return entries;
  }

  /** Every live note the student has, newest first — the tracker groups them by topic. */
  async listLiveByUser(userId: string): Promise<NoteRow[]> {
    return this.db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), isNull(notes.deletedAt)))
      .orderBy(desc(notes.updatedAt));
  }

  async create({
    userId,
    trackerId = null,
    topicId,
    subtopicId = null,
    body,
    source = 'manual',
  }: CreateNoteInput): Promise<NoteRow> {
    const now = this.clock.now();
    const row: NoteRow = {
      id: uuidV7(),
      userId,
      trackerId,
      topicId,
      subtopicId,
      body: body.trim(),
      source,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };
    await this.db.insert(notes).values(row);
    return row;
  }

  async edit(id: string, body: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ body: body.trim(), updatedAt: this.clock.now(), syncStatus: 'pending' })
      .where(eq(notes.id, id));
  }

  async softDelete(id: string): Promise<void> {
    const now = this.clock.now();
    await this.db
      .update(notes)
      .set({ deletedAt: now, updatedAt: now, syncStatus: 'pending' })
      .where(eq(notes.id, id));
  }

  /**
   * Moves notes written in the old one-per-topic column into this table.
   *
   * The adopted note takes the topic's (or sub-topic's) own id. Two devices
   * adopting the same old note therefore write the same row rather than two
   * copies, and a student who deletes an adopted note leaves a tombstone under
   * that id, so it is not adopted again. Returns how many were adopted.
   */
  async adoptLegacy(userId: string): Promise<number> {
    const legacyTopics = await this.db
      .select({
        id: topics.id,
        note: topics.note,
        updatedAt: topics.updatedAt,
        trackerId: subjects.trackerId,
      })
      .from(topics)
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(and(eq(topics.userId, userId), isNotNull(topics.note), ne(topics.note, '')));

    const legacySubtopics = await this.db
      .select({
        id: subtopics.id,
        topicId: subtopics.topicId,
        note: subtopics.note,
        updatedAt: subtopics.updatedAt,
        trackerId: subjects.trackerId,
      })
      .from(subtopics)
      .innerJoin(topics, eq(subtopics.topicId, topics.id))
      .innerJoin(chapters, eq(topics.chapterId, chapters.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(and(eq(subtopics.userId, userId), isNotNull(subtopics.note), ne(subtopics.note, '')));

    const candidates = [
      ...legacyTopics.map((row) => ({ ...row, topicId: row.id, subtopicId: null })),
      ...legacySubtopics.map((row) => ({ ...row, subtopicId: row.id })),
    ].filter((row) => (row.note ?? '').trim().length > 0);
    if (candidates.length === 0) return 0;

    const existing = await this.db
      .select({ id: notes.id })
      .from(notes)
      .where(
        inArray(
          notes.id,
          candidates.map((row) => row.id),
        ),
      );
    const taken = new Set(existing.map((row) => row.id));

    let adopted = 0;
    for (const row of candidates) {
      if (taken.has(row.id)) continue;
      await this.db.insert(notes).values({
        id: row.id,
        userId,
        trackerId: row.trackerId,
        topicId: row.topicId,
        subtopicId: row.subtopicId,
        body: (row.note ?? '').trim(),
        source: 'manual',
        createdAt: row.updatedAt,
        updatedAt: row.updatedAt,
        deletedAt: null,
        syncStatus: 'pending',
      });
      adopted += 1;
    }
    return adopted;
  }

  // ---------------------------------------------------------------------------
  // Synchronisation
  // ---------------------------------------------------------------------------

  async listAllForSync(userId: string): Promise<NoteRow[]> {
    return this.db.select().from(notes).where(eq(notes.userId, userId));
  }

  async upsertFromSync(row: Record<string, unknown>): Promise<void> {
    await this.db
      .insert(notes)
      .values(row as never)
      .onConflictDoUpdate({ target: notes.id, set: row as never });
  }

  async markSynced(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(notes)
      .set({ syncStatus: 'synced' })
      .where(inArray(notes.id, [...ids]));
  }
}

function entry(
  note: NoteRow,
  level: NoteLevel,
  topicName: string,
  chapterName: string,
  place: { readonly subjectName: string; readonly subjectId: string },
): NoteEntry {
  return {
    id: note.id,
    level,
    topicId: note.topicId,
    subtopicId: note.subtopicId,
    topicName,
    chapterName,
    subjectName: place.subjectName,
    subjectId: place.subjectId,
    body: note.body,
    source: note.source,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
