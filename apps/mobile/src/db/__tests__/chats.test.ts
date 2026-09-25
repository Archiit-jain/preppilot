import { THREAD_TITLE_LENGTH, readFollowUp, titleFrom } from '../repositories/chats';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../test-support/test-database';

const USER = 'user-1';

let db: ReturnType<typeof createTestDatabase>;
let repositories: ReturnType<typeof createTestRepositories>;
let clock: ReturnType<typeof createTestClock>;

beforeEach(() => {
  db = createTestDatabase();
  clock = createTestClock();
  repositories = createTestRepositories(db, clock);
});

afterEach(() => {
  db.$close();
});

const chats = () => repositories.chats;

describe('naming a conversation', () => {
  it('uses the first line of the first question', () => {
    expect(titleFrom('What is Ohm’s law?\nAnd why?')).toBe('What is Ohm’s law?');
  });

  it('shortens a long question on a word boundary', () => {
    const title = titleFrom(
      'Explain the difference between speed and velocity with three worked examples please',
    );
    expect(title.length).toBeLessThanOrEqual(THREAD_TITLE_LENGTH + 1);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });

  it('cuts a long unbroken word where it must', () => {
    expect(titleFrom('x'.repeat(100))).toBe(`${'x'.repeat(THREAD_TITLE_LENGTH)}…`);
  });

  it('calls a picture sent on its own a picture question', () => {
    expect(titleFrom('   ')).toBe('Picture question');
  });
});

describe('threads and messages', () => {
  it('keeps the messages of a thread in order', async () => {
    const thread = await chats().createThread(USER, 'Ohm’s law');
    await chats().addMessage({ userId: USER, threadId: thread.id, role: 'student', body: 'Q' });
    clock.advance(10);
    await chats().addMessage({ userId: USER, threadId: thread.id, role: 'assistant', body: 'A' });

    const messages = await chats().listMessages(thread.id);
    expect(messages.map((m) => [m.role, m.body])).toEqual([
      ['student', 'Q'],
      ['assistant', 'A'],
    ]);
  });

  it('keeps a question above its reply even within one millisecond', async () => {
    const thread = await chats().createThread(USER, 'Fast');
    await chats().addMessage({ userId: USER, threadId: thread.id, role: 'student', body: 'Q' });
    await chats().addMessage({ userId: USER, threadId: thread.id, role: 'assistant', body: 'A' });
    await chats().addMessage({ userId: USER, threadId: thread.id, role: 'student', body: 'Q2' });

    expect((await chats().listMessages(thread.id)).map((m) => m.body)).toEqual(['Q', 'A', 'Q2']);
  });

  it('lists the most recently used thread first', async () => {
    const older = await chats().createThread(USER, 'Older');
    clock.advance(10);
    await chats().createThread(USER, 'Newer');
    clock.advance(10);
    await chats().addMessage({ userId: USER, threadId: older.id, role: 'student', body: 'Back' });

    expect((await chats().listThreads(USER)).map((t) => t.title)).toEqual(['Older', 'Newer']);
  });

  it('records a picture as present, with its path kept on this device', async () => {
    const thread = await chats().createThread(USER, 'Picture');
    const row = await chats().addMessage({
      userId: USER,
      threadId: thread.id,
      role: 'student',
      body: '',
      imageUri: 'file:///page.jpg',
    });

    expect(row).toMatchObject({ hasImage: true, imageUri: 'file:///page.jpg' });
  });

  it('deletes a thread with everything in it', async () => {
    const thread = await chats().createThread(USER, 'Gone');
    await chats().addMessage({ userId: USER, threadId: thread.id, role: 'student', body: 'Q' });

    await chats().deleteThread(thread.id);

    expect(await chats().listThreads(USER)).toEqual([]);
    expect(await chats().listMessages(thread.id)).toEqual([]);
    // Tombstones, so the deletion can travel to other devices.
    expect((await chats().listAllMessagesForSync(USER))[0]!.deletedAt).not.toBeNull();
  });

  it('belongs to one account only', async () => {
    await chats().createThread('someone-else', 'Theirs');
    expect(await chats().listThreads(USER)).toEqual([]);
  });
});

describe('synchronisation', () => {
  it('lists and marks both tables', async () => {
    const thread = await chats().createThread(USER, 'T');
    const message = await chats().addMessage({
      userId: USER,
      threadId: thread.id,
      role: 'student',
      body: 'Q',
    });

    await chats().markThreadsSynced([thread.id]);
    await chats().markMessagesSynced([message.id]);
    await chats().markThreadsSynced([]);
    await chats().markMessagesSynced([]);

    expect((await chats().listAllThreadsForSync(USER))[0]!.syncStatus).toBe('synced');
    expect((await chats().listAllMessagesForSync(USER))[0]!.syncStatus).toBe('synced');
  });

  it('stores threads from the server', async () => {
    const row = {
      id: '018f0000-0000-7000-8000-00000000000a',
      userId: USER,
      title: 'From the tablet',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      syncStatus: 'synced',
    };
    await chats().upsertThreadFromSync(row);
    await chats().upsertThreadFromSync({ ...row, title: 'Renamed', updatedAt: 2 });

    expect((await chats().listThreads(USER)).map((t) => t.title)).toEqual(['Renamed']);
  });

  /** The server never has image_uri, so a pulled copy must not wipe this device's. */
  it('keeps this device’s picture when the server sends the message back', async () => {
    const thread = await chats().createThread(USER, 'Picture');
    const sent = await chats().addMessage({
      userId: USER,
      threadId: thread.id,
      role: 'student',
      body: 'Solve this',
      imageUri: 'file:///page.jpg',
    });

    await chats().upsertMessageFromSync({
      ...sent,
      imageUri: undefined,
      body: 'Solve this',
      syncStatus: 'synced',
      updatedAt: sent.updatedAt + 1,
    });

    const [row] = await chats().listMessages(thread.id);
    expect(row).toMatchObject({
      imageUri: 'file:///page.jpg',
      hasImage: true,
      syncStatus: 'synced',
    });
  });

  it('stores a message from another device without a picture path', async () => {
    const thread = await chats().createThread(USER, 'T');
    await chats().upsertMessageFromSync({
      id: '018f0000-0000-7000-8000-00000000000b',
      userId: USER,
      threadId: thread.id,
      role: 'student',
      body: 'From the tablet',
      proposal: null,
      hasImage: true,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      syncStatus: 'synced',
    });

    const [row] = await chats().listMessages(thread.id);
    expect(row).toMatchObject({ hasImage: true, imageUri: null });
  });
});

describe('follow-up chats', () => {
  it('stores what the chat follows up on', async () => {
    const thread = await chats().createThread(USER, 'Degree', {
      title: 'Degree',
      text: 'The highest power.',
    });

    expect(readFollowUp(thread.followUp)).toEqual({ title: 'Degree', text: 'The highest power.' });
    expect((await chats().createThread(USER, 'Plain')).followUp).toBeNull();
  });

  it('reads nothing from a missing, empty or broken source', () => {
    expect(readFollowUp(null)).toBeNull();
    expect(readFollowUp('{broken')).toBeNull();
    expect(readFollowUp(JSON.stringify({ title: 'T', text: '  ' }))).toBeNull();
    expect(readFollowUp(JSON.stringify({ text: 'Body' }))).toEqual({ title: '', text: 'Body' });
  });
});
