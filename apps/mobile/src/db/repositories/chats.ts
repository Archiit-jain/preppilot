import { uuidV7 } from '@preppilot/shared';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  chatMessages,
  chatThreads,
  type ChatMessageRow,
  type ChatRole,
  type ChatThreadRow,
} from '../schema';
import { systemClock, type Clock, type Database } from '../types';

export interface AddMessageInput {
  readonly userId: string;
  readonly threadId: string;
  readonly role: ChatRole;
  readonly body: string;
  /** The assistant's proposal, as JSON. */
  readonly proposal?: string | null;
  /** A picture on this device. Not synchronised; `hasImage` is. */
  readonly imageUri?: string | null;
}

/** What a follow-up chat follows up on: a topic summary the student was reading. */
export interface FollowUp {
  readonly title: string;
  readonly text: string;
}

/** A stored follow-up source, or null for an ordinary chat or one that cannot be read. */
export function readFollowUp(json: string | null): FollowUp | null {
  if (json === null) return null;
  try {
    const value = JSON.parse(json) as Partial<FollowUp> | null;
    if (typeof value?.text !== 'string' || value.text.trim().length === 0) return null;
    return { title: typeof value.title === 'string' ? value.title : '', text: value.text };
  } catch {
    return null;
  }
}

/** The longest a thread's title is kept; it is a label, not the question. */
export const THREAD_TITLE_LENGTH = 60;

/** A title from the first question: its first line, shortened on a word. */
export function titleFrom(question: string): string {
  const firstLine = question.trim().split('\n')[0]?.trim() ?? '';
  if (firstLine.length === 0) return 'Picture question';
  if (firstLine.length <= THREAD_TITLE_LENGTH) return firstLine;
  const cut = firstLine.slice(0, THREAD_TITLE_LENGTH);
  const space = cut.lastIndexOf(' ');
  return `${(space > 20 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Conversations with the assistant, and their messages.
 *
 * Threads are listed most recently used first: adding a message touches its
 * thread, so the conversation a student was just in is always at the top.
 */
export class ChatRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock = systemClock,
  ) {}

  async listThreads(userId: string): Promise<ChatThreadRow[]> {
    return this.db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.userId, userId), isNull(chatThreads.deletedAt)))
      .orderBy(desc(chatThreads.updatedAt));
  }

  async createThread(
    userId: string,
    title: string,
    followUp: FollowUp | null = null,
  ): Promise<ChatThreadRow> {
    const now = this.clock.now();
    const row: ChatThreadRow = {
      id: uuidV7(),
      userId,
      title: titleFrom(title),
      followUp: followUp === null ? null : JSON.stringify(followUp),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };
    await this.db.insert(chatThreads).values(row);
    return row;
  }

  async listMessages(threadId: string): Promise<ChatMessageRow[]> {
    return this.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.threadId, threadId), isNull(chatMessages.deletedAt)))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
  }

  async addMessage({
    userId,
    threadId,
    role,
    body,
    proposal = null,
    imageUri = null,
  }: AddMessageInput): Promise<ChatMessageRow> {
    // Strictly after the thread's last message. A question and its reply can
    // land in the same millisecond, and a conversation read back in the wrong
    // order has its answer above its question.
    const [last] = await this.db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);
    const now = Math.max(this.clock.now(), (last?.createdAt ?? 0) + 1);
    const row: ChatMessageRow = {
      id: uuidV7(),
      userId,
      threadId,
      role,
      body,
      proposal,
      hasImage: imageUri !== null,
      imageUri,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };
    await this.db.insert(chatMessages).values(row);
    await this.db
      .update(chatThreads)
      .set({ updatedAt: now, syncStatus: 'pending' })
      .where(eq(chatThreads.id, threadId));
    return row;
  }

  /** Deletes a conversation and everything in it. */
  async deleteThread(threadId: string): Promise<void> {
    const now = this.clock.now();
    await this.db
      .update(chatMessages)
      .set({ deletedAt: now, updatedAt: now, syncStatus: 'pending' })
      .where(and(eq(chatMessages.threadId, threadId), isNull(chatMessages.deletedAt)));
    await this.db
      .update(chatThreads)
      .set({ deletedAt: now, updatedAt: now, syncStatus: 'pending' })
      .where(eq(chatThreads.id, threadId));
  }

  // ---------------------------------------------------------------------------
  // Synchronisation — two tables, so two sets of accessors.
  // ---------------------------------------------------------------------------

  async listAllThreadsForSync(userId: string): Promise<ChatThreadRow[]> {
    return this.db.select().from(chatThreads).where(eq(chatThreads.userId, userId));
  }

  async upsertThreadFromSync(row: Record<string, unknown>): Promise<void> {
    await this.db
      .insert(chatThreads)
      .values(row as never)
      .onConflictDoUpdate({ target: chatThreads.id, set: row as never });
  }

  async markThreadsSynced(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(chatThreads)
      .set({ syncStatus: 'synced' })
      .where(inArray(chatThreads.id, [...ids]));
  }

  async listAllMessagesForSync(userId: string): Promise<ChatMessageRow[]> {
    return this.db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
  }

  /**
   * Stores a message from the server without losing this device's picture.
   *
   * The server never has `image_uri`, so a pulled copy of a message this device
   * sent would otherwise overwrite the path to the picture with nothing.
   */
  async upsertMessageFromSync(row: Record<string, unknown>): Promise<void> {
    const { imageUri: _dropped, ...shared } = row;
    await this.db
      .insert(chatMessages)
      .values(row as never)
      .onConflictDoUpdate({ target: chatMessages.id, set: shared as never });
  }

  async markMessagesSynced(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(chatMessages)
      .set({ syncStatus: 'synced' })
      .where(inArray(chatMessages.id, [...ids]));
  }
}
