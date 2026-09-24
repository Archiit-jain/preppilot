import type { Repositories } from '../../../db/client';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../../../db/test-support/test-database';
import * as client from '../ai-client';
import { messageFromRow, resetAiStore, useAiStore } from '../ai-store';

jest.mock('../../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));
jest.mock('../ai-client');

const USER = 'user-1';
const mocked = client as jest.Mocked<typeof client>;

let db: ReturnType<typeof createTestDatabase>;
let repositories: Repositories;

const ai = () => useAiStore.getState();

beforeEach(() => {
  db = createTestDatabase();
  repositories = createTestRepositories(db, createTestClock());
  jest.clearAllMocks();
  mocked.ask.mockResolvedValue({ ok: true, reply: { message: 'An answer.', proposal: null } });
  resetAiStore();
});

afterEach(() => {
  db.$close();
});

describe('saved chats in the store', () => {
  it('says so when the saved chats cannot be read', async () => {
    jest.spyOn(repositories.chats, 'listThreads').mockRejectedValueOnce(new Error('disk'));

    await ai().openChats(USER, repositories);

    expect(ai().error).toBe('We could not open your saved chats.');
  });

  it('opens nothing when there is nothing saved', async () => {
    await ai().openChats(USER, repositories);

    expect(ai()).toMatchObject({ threads: [], threadId: null, messages: [] });
  });

  it('does not replace a conversation already on screen', async () => {
    const saved = await repositories.chats.createThread(USER, 'Older');
    await ai().ask('Unsaved so far');

    await ai().openChats(USER, repositories);

    expect(ai().threadId).toBeNull();
    expect(ai().threads.map((thread) => thread.id)).toEqual([saved.id]);
  });

  it('says so when a chat cannot be opened', async () => {
    await ai().openChats(USER, repositories);
    jest.spyOn(repositories.chats, 'listMessages').mockRejectedValueOnce(new Error('disk'));

    await ai().openThread('missing');

    expect(ai().error).toBe('We could not open that chat.');
  });

  it('says so when a chat cannot be deleted', async () => {
    await ai().openChats(USER, repositories);
    jest.spyOn(repositories.chats, 'deleteThread').mockRejectedValueOnce(new Error('disk'));

    await ai().deleteThread('whatever');

    expect(ai().error).toBe('We could not delete that chat.');
  });

  it('keeps the open chat when a different one is deleted', async () => {
    await ai().openChats(USER, repositories);
    await ai().ask('Keep me');
    const other = await repositories.chats.createThread(USER, 'Other');

    await ai().deleteThread(other.id);

    expect(ai().messages).toHaveLength(2);
  });

  it('does nothing with saved chats before they are connected', async () => {
    await ai().openThread('anything');
    await ai().deleteThread('anything');

    expect(ai().error).toBeNull();
  });

  it('keeps the question when the reply cannot be saved', async () => {
    await ai().openChats(USER, repositories);
    const add = repositories.chats.addMessage.bind(repositories.chats);
    jest
      .spyOn(repositories.chats, 'addMessage')
      .mockImplementationOnce(add)
      .mockRejectedValueOnce(new Error('disk'));

    await ai().ask('Question');

    expect(ai().messages.map((message) => message.text)).toEqual(['Question', 'An answer.']);
  });
});

describe('reading a saved message', () => {
  const row = {
    id: 'm1',
    userId: USER,
    threadId: 't1',
    role: 'assistant' as const,
    body: 'Here.',
    proposal: null,
    hasImage: false,
    imageUri: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    syncStatus: 'synced' as const,
  };

  it('shows this device’s picture, or says it is elsewhere', () => {
    expect(messageFromRow({ ...row, hasImage: true, imageUri: 'file:///a.jpg' })).toMatchObject({
      imageUri: 'file:///a.jpg',
    });
    expect(messageFromRow({ ...row, hasImage: true })).toMatchObject({ imageElsewhere: true });
    expect(messageFromRow(row)).not.toHaveProperty('imageElsewhere');
  });

  it('drops a stored proposal the grammar does not allow', () => {
    expect(
      messageFromRow({
        ...row,
        proposal: '{"kind":"deleteTopics","subjectName":"X","chapters":[]}',
      }).proposal,
    ).toBeNull();
  });
});
