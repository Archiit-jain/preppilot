import type { Repositories } from '../../../db/client';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../../../db/test-support/test-database';
import { addNote, resetNotesStore, useNotesStore } from '../notes-store';

const USER = 'user-1';

let db: ReturnType<typeof createTestDatabase>;
let repositories: Repositories;

const notes = () => useNotesStore.getState();

beforeEach(() => {
  db = createTestDatabase();
  repositories = createTestRepositories(db, createTestClock());
  resetNotesStore();
});

afterEach(() => {
  db.$close();
});

const seedTopic = async () => {
  const subject = await repositories.subjects.create({ userId: USER, name: 'Physics' });
  const chapter = await repositories.chapters.create({
    userId: USER,
    subjectId: subject.id,
    name: 'Light',
  });
  return repositories.topics.create({ userId: USER, chapterId: chapter.id, name: 'Refraction' });
};

it('refuses to be used before it has been loaded', async () => {
  await expect(notes().add({ topicId: 't', body: 'x' })).rejects.toThrow(/load\(\)/);
});

it('adds from elsewhere without the Notes tab having been opened', async () => {
  const topic = await seedTopic();

  expect(await addNote(USER, repositories, { topicId: topic.id, body: 'Snell' })).toBe(true);
  expect(await addNote(USER, repositories, { topicId: topic.id, body: '  ' })).toBe(false);

  expect((await repositories.notes.listLiveByUser(USER)).map((note) => note.body)).toEqual([
    'Snell',
  ]);
  expect(notes().notes).toEqual([]);
});

it('refreshes the Notes tab when a note is added from elsewhere', async () => {
  const topic = await seedTopic();
  await notes().load(USER, repositories);

  await addNote(USER, repositories, {
    topicId: topic.id,
    body: 'From a summary',
    source: 'summary',
  });

  expect(notes().notes.map((note) => note.body)).toEqual(['From a summary']);
  expect(notes().targets[0]?.noteCount).toBe(1);
});

it('refuses to empty a note through an edit', async () => {
  await notes().load(USER, repositories);

  expect(await notes().edit('any', '   ')).toBe(false);
  expect(notes().error).toBe('A note needs something in it.');
});

it('says so when a note cannot be deleted', async () => {
  await notes().load(USER, repositories);
  jest.spyOn(repositories.notes, 'softDelete').mockRejectedValueOnce(new Error('disk'));

  await notes().remove('any');

  expect(notes().error).toBe('We could not delete that note. Try again.');
});

it('says so when the notes cannot be read', async () => {
  jest.spyOn(repositories.notes, 'listByUser').mockRejectedValueOnce(new Error('disk'));

  await notes().load(USER, repositories);

  expect(notes().error).toBe('We could not open your notes. Pull down to try again.');
  expect(notes().loading).toBe(false);
});
