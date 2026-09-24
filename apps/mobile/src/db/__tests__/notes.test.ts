import { NoteRepository } from '../repositories/notes';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../test-support/test-database';

const USER = 'user-1';
const OTHER = 'user-2';

let db: ReturnType<typeof createTestDatabase>;
let repositories: ReturnType<typeof createTestRepositories>;
let notes: NoteRepository;
let clock: ReturnType<typeof createTestClock>;

beforeEach(() => {
  db = createTestDatabase();
  clock = createTestClock();
  repositories = createTestRepositories(db, clock);
  notes = repositories.notes;
});

afterEach(() => {
  db.$close();
});

async function topic(name: string, userId = USER) {
  const subject = await repositories.subjects.create({ userId, name: 'Physics' });
  const chapter = await repositories.chapters.create({
    userId,
    subjectId: subject.id,
    name: 'Electricity',
  });
  const row = await repositories.topics.create({ userId, chapterId: chapter.id, name });
  return { subject, chapter, topic: row };
}

describe('writing notes', () => {
  it('keeps several notes on one topic', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    await notes.create({ userId: USER, topicId: ohm.id, body: 'V = IR' });
    clock.advance(1000);
    await notes.create({ userId: USER, topicId: ohm.id, body: 'Ohmic conductors only' });

    const entries = await notes.listByUser(USER);
    expect(entries.map((entry) => entry.body)).toEqual(['Ohmic conductors only', 'V = IR']);
  });

  it('trims what was typed, and remembers where it came from', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    await notes.create({ userId: USER, topicId: ohm.id, body: '  A summary  ', source: 'summary' });

    const [entry] = await notes.listByUser(USER);
    expect(entry).toMatchObject({ body: 'A summary', source: 'summary', level: 'topic' });
  });

  it('corrects a note, newest edit first', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    const first = await notes.create({ userId: USER, topicId: ohm.id, body: 'Old' });
    clock.advance(1000);
    await notes.create({ userId: USER, topicId: ohm.id, body: 'Other' });
    clock.advance(1000);
    await notes.edit(first.id, ' New ');

    expect((await notes.listByUser(USER)).map((entry) => entry.body)).toEqual(['New', 'Other']);
  });

  it('deletes one note and leaves the others', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    const doomed = await notes.create({ userId: USER, topicId: ohm.id, body: 'Doomed' });
    await notes.create({ userId: USER, topicId: ohm.id, body: 'Kept' });
    await notes.softDelete(doomed.id);

    expect((await notes.listByUser(USER)).map((entry) => entry.body)).toEqual(['Kept']);
    expect((await notes.listLiveByUser(USER)).map((row) => row.body)).toEqual(['Kept']);
  });
});

describe('reading notes', () => {
  it('carries the subject and chapter, so a note has context', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    await notes.create({ userId: USER, topicId: ohm.id, body: 'V = IR' });

    const [entry] = await notes.listByUser(USER);

    expect(entry).toMatchObject({
      topicName: "Ohm's law",
      chapterName: 'Electricity',
      subjectName: 'Physics',
      body: 'V = IR',
    });
  });

  it('names a sub-topic note after the sub-topic, with its topic as the chapter', async () => {
    const { topic: light } = await topic('Light');
    const refraction = await repositories.subtopics.create({
      userId: USER,
      topicId: light.id,
      name: 'Refraction',
    });
    await notes.create({
      userId: USER,
      topicId: light.id,
      subtopicId: refraction.id,
      body: 'Snell',
    });

    const [entry] = await notes.listByUser(USER);
    expect(entry).toMatchObject({
      level: 'subtopic',
      topicName: 'Refraction',
      chapterName: 'Light',
    });
  });

  it('drops a note whose sub-topic was deleted', async () => {
    const { topic: light } = await topic('Light');
    const refraction = await repositories.subtopics.create({
      userId: USER,
      topicId: light.id,
      name: 'Refraction',
    });
    await notes.create({ userId: USER, topicId: light.id, subtopicId: refraction.id, body: 'x' });
    await repositories.subtopics.softDelete(refraction.id);

    expect(await notes.listByUser(USER)).toEqual([]);
  });

  it('belongs to one account only', async () => {
    const mine = await topic('Mine');
    const theirs = await topic('Theirs', OTHER);
    await notes.create({ userId: USER, topicId: mine.topic.id, body: 'My note' });
    await notes.create({ userId: OTHER, topicId: theirs.topic.id, body: 'Their note' });

    expect((await notes.listByUser(USER)).map((entry) => entry.body)).toEqual(['My note']);
  });

  it('drops a note whose topic, chapter or subject was deleted', async () => {
    const a = await topic('A');
    const b = await topic('B');
    const c = await topic('C');
    for (const t of [a, b, c]) {
      await notes.create({ userId: USER, topicId: t.topic.id, body: t.topic.name });
    }
    await repositories.topics.softDelete(a.topic.id);
    await repositories.chapters.softDelete(b.chapter.id);
    await repositories.subjects.softDelete(c.subject.id);

    expect(await notes.listByUser(USER)).toEqual([]);
  });

  it('finds nothing for an account with no notes at all', async () => {
    expect(await notes.listByUser('nobody')).toEqual([]);
  });
});

describe('adopting notes from the old one-per-topic column', () => {
  it('brings them across under the topic’s own id, once', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    await repositories.topics.setNote(ohm.id, 'Written long ago');

    expect(await notes.adoptLegacy(USER)).toBe(1);
    expect(await notes.adoptLegacy(USER)).toBe(0);

    const [entry] = await notes.listByUser(USER);
    expect(entry).toMatchObject({ id: ohm.id, body: 'Written long ago', source: 'manual' });
  });

  it('adopts sub-topic notes too', async () => {
    const { topic: light } = await topic('Light');
    const refraction = await repositories.subtopics.create({
      userId: USER,
      topicId: light.id,
      name: 'Refraction',
    });
    await repositories.subtopics.setNote(refraction.id, 'Bends towards the normal');

    expect(await notes.adoptLegacy(USER)).toBe(1);
    const [entry] = await notes.listByUser(USER);
    expect(entry).toMatchObject({ id: refraction.id, level: 'subtopic', topicId: light.id });
  });

  /** A deleted adopted note leaves a tombstone under that id, so it stays deleted. */
  it('does not bring back an adopted note the student deleted', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    await repositories.topics.setNote(ohm.id, 'Written long ago');
    await notes.adoptLegacy(USER);
    await notes.softDelete(ohm.id);

    expect(await notes.adoptLegacy(USER)).toBe(0);
    expect(await notes.listByUser(USER)).toEqual([]);
  });

  it('ignores topics with no old note', async () => {
    await topic('Bare');
    expect(await notes.adoptLegacy(USER)).toBe(0);
  });
});

describe('synchronisation', () => {
  it('lists every row, deleted ones included, and marks them synced', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    const kept = await notes.create({ userId: USER, topicId: ohm.id, body: 'Kept' });
    const gone = await notes.create({ userId: USER, topicId: ohm.id, body: 'Gone' });
    await notes.softDelete(gone.id);

    const all = await notes.listAllForSync(USER);
    expect(all).toHaveLength(2);
    expect(all.every((row) => row.syncStatus === 'pending')).toBe(true);

    await notes.markSynced([kept.id, gone.id]);
    await notes.markSynced([]);
    expect((await notes.listAllForSync(USER)).every((row) => row.syncStatus === 'synced')).toBe(
      true,
    );
  });

  it('stores a row from the server, and updates it in place', async () => {
    const { topic: ohm } = await topic("Ohm's law");
    const row = {
      id: '018f0000-0000-7000-8000-000000000001',
      userId: USER,
      trackerId: null,
      topicId: ohm.id,
      subtopicId: null,
      body: 'From another phone',
      source: 'manual',
      createdAt: 1,
      updatedAt: 2,
      deletedAt: null,
      syncStatus: 'synced',
    };
    await notes.upsertFromSync(row);
    await notes.upsertFromSync({ ...row, body: 'Edited there', updatedAt: 3 });

    expect((await notes.listByUser(USER)).map((entry) => entry.body)).toEqual(['Edited there']);
  });
});
