import {
  isReviewable,
  parseProposalJson,
  type AiProposal,
  type ParsedReply,
} from '@preppilot/shared';
import { create } from 'zustand';
import type { Repositories } from '../../db/client';
import type { ChatMessageRow, ChatThreadRow } from '../../db/schema';
import { readFollowUp, type FollowUp } from '../../db/repositories/chats';
import type { ImageAttachment } from './attach-image';
import * as client from './ai-client';
import { activeTrackerId } from '../trackers/trackers-store';

export interface AiMessage {
  readonly id: string;
  readonly role: 'student' | 'assistant';
  readonly text: string;
  /** A picture the student sent with the question, shown in the conversation. */
  readonly imageUri?: string;
  /**
   * The message had a picture that is not on this device — it was sent from
   * another one, and pictures are not synchronised.
   */
  readonly imageElsewhere?: boolean;
  /** Attached to an assistant message that asked to change the tracker. */
  readonly proposal: AiProposal | null;
}

export interface AiState {
  /** Saved conversations, most recently used first. */
  readonly threads: readonly ChatThreadRow[];
  /** The conversation on screen; null for a new one not yet saved. */
  readonly threadId: string | null;
  /**
   * What the conversation on screen follows up on, if it is a follow-up chat.
   * Sent to the assistant with every question in it, never shown as a message.
   */
  readonly followUp: FollowUp | null;
  readonly messages: readonly AiMessage[];
  readonly asking: boolean;
  readonly error: string | null;
  /** The proposal awaiting confirmation, if any. */
  readonly pendingProposal: AiProposal | null;
  readonly applying: boolean;
}

export interface AiActions {
  /**
   * Connects the assistant to the student's saved chats and reopens the most
   * recent one. Until this is called, a conversation lives in memory only.
   */
  openChats: (userId: string, repositories: Repositories) => Promise<void>;
  openThread: (threadId: string) => Promise<void>;
  /** Starts a fresh conversation; it is saved when the first question is asked. */
  newChat: () => void;
  /**
   * Starts a follow-up chat about a summary the student was reading. The chat
   * is named after the topic and saved, with its summary, on the first question.
   */
  startFollowUp: (title: string, summary: string) => void;
  deleteThread: (threadId: string) => Promise<void>;
  /** Asks a question, optionally about a picture. A picture alone is enough. */
  ask: (question: string, image?: ImageAttachment) => Promise<void>;
  reviewProposal: (proposal: AiProposal) => void;
  dismissProposal: () => void;
  /** Applies a reviewed proposal. Only reachable after explicit confirmation. */
  applyProposal: (userId: string, repositories: Repositories) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState: AiState = {
  threads: [],
  threadId: null,
  followUp: null,
  messages: [],
  asking: false,
  error: null,
  pendingProposal: null,
  applying: false,
};

/** What a picture sent on its own is taken to be asking. */
export const IMAGE_ONLY_QUESTION =
  'Read this image and help me study it: explain what it shows, and answer any question in it.';

let counter = 0;
const nextId = () => `m${(counter += 1)}`;

/** Supplied by the screen so the assistant can refer to the student's own subjects. */
let subjectNames: readonly string[] = [];

/** Where conversations are saved, once the screen has connected them. */
let chats: { readonly userId: string; readonly repositories: Repositories } | null = null;

/** A saved message as the conversation shows it. */
export function messageFromRow(row: ChatMessageRow): AiMessage {
  return {
    id: row.id,
    role: row.role,
    text: row.body,
    ...(row.imageUri !== null ? { imageUri: row.imageUri } : {}),
    ...(row.hasImage && row.imageUri === null ? { imageElsewhere: true } : {}),
    proposal: parseProposalJson(row.proposal),
  };
}

/**
 * Saves a message, when conversations are connected.
 *
 * A failed save must not cost the student their answer, so the message is
 * shown either way; only its id tells whether it reached the database.
 */
async function saveMessage(
  threadId: string | null,
  role: 'student' | 'assistant',
  text: string,
  extra: { proposal?: AiProposal | null; imageUri?: string } = {},
): Promise<string> {
  if (chats === null || threadId === null) return nextId();
  try {
    const row = await chats.repositories.chats.addMessage({
      userId: chats.userId,
      threadId,
      role,
      body: text,
      proposal: extra.proposal != null ? JSON.stringify(extra.proposal) : null,
      imageUri: extra.imageUri ?? null,
    });
    return row.id;
  } catch {
    return nextId();
  }
}

export function setSubjectContext(names: readonly string[]): void {
  subjectNames = names;
}

export const useAiStore = create<AiState & AiActions>((set, get) => ({
  ...initialState,

  async openChats(userId, repositories) {
    chats = { userId, repositories };
    try {
      const threads = await repositories.chats.listThreads(userId);
      set({ threads });
      // Coming back to the assistant continues the last conversation; "New
      // chat" is one tap away. A follow-up just started is left alone.
      const latest = threads[0];
      const idle =
        get().threadId === null && get().messages.length === 0 && get().followUp === null;
      if (idle && latest !== undefined) {
        await get().openThread(latest.id);
      }
    } catch {
      set({ error: 'We could not open your saved chats.' });
    }
  },

  async openThread(threadId) {
    if (chats === null) return;
    try {
      const rows = await chats.repositories.chats.listMessages(threadId);
      const thread = get().threads.find((entry) => entry.id === threadId);
      set({
        threadId,
        followUp: readFollowUp(thread?.followUp ?? null),
        messages: rows.map(messageFromRow),
        pendingProposal: null,
        error: null,
      });
    } catch {
      set({ error: 'We could not open that chat.' });
    }
  },

  newChat() {
    set({ threadId: null, followUp: null, messages: [], pendingProposal: null, error: null });
  },

  startFollowUp(title, summary) {
    set({
      threadId: null,
      followUp: { title, text: summary },
      messages: [],
      pendingProposal: null,
      error: null,
    });
  },

  async deleteThread(threadId) {
    if (chats === null) return;
    try {
      await chats.repositories.chats.deleteThread(threadId);
      set({ threads: await chats.repositories.chats.listThreads(chats.userId) });
      if (get().threadId === threadId) get().newChat();
    } catch {
      set({ error: 'We could not delete that chat.' });
    }
  },

  async ask(question, image) {
    const trimmed = question.trim();
    if ((trimmed.length === 0 && image === undefined) || get().asking) return;

    set({ asking: true, error: null });

    // A follow-up remembers what it follows up on, and the turns so far, so
    // "and what about the second one?" has something to refer to.
    const followUp = get().followUp;
    const history = get()
      .messages.filter((message) => message.text.length > 0)
      .slice(-6)
      .map((message) => ({ role: message.role, text: message.text }));

    // The first question of a new conversation names it — or, for a follow-up,
    // the topic it follows up on.
    let threadId = get().threadId;
    if (threadId === null && chats !== null) {
      try {
        const thread = await chats.repositories.chats.createThread(
          chats.userId,
          followUp?.title ?? trimmed,
          followUp,
        );
        threadId = thread.id;
        set({ threadId, threads: [thread, ...get().threads] });
      } catch {
        // Unsaved, but still answered.
      }
    }

    const studentId = await saveMessage(threadId, 'student', trimmed, {
      ...(image !== undefined ? { imageUri: image.uri } : {}),
    });
    set({
      messages: [
        ...get().messages,
        {
          id: studentId,
          role: 'student',
          text: trimmed,
          ...(image !== undefined ? { imageUri: image.uri } : {}),
          proposal: null,
        },
      ],
    });

    const result = await client.ask({
      // A picture sent without a question still needs one for the model.
      question: trimmed.length > 0 ? trimmed : IMAGE_ONLY_QUESTION,
      subjectNames,
      ...(image !== undefined ? { image } : {}),
      ...(followUp !== null ? { followUp, history } : {}),
    });

    if (!result.ok) {
      set({ error: result.message, asking: false });
      return;
    }

    const reply: ParsedReply = result.reply;
    const replyId = await saveMessage(threadId, 'assistant', reply.message, {
      proposal: reply.proposal,
    });
    if (chats !== null && threadId !== null) {
      // The thread moved to the top when the reply was saved.
      const current = get().threads;
      const thread = current.find((entry) => entry.id === threadId);
      if (thread !== undefined) {
        set({ threads: [thread, ...current.filter((entry) => entry.id !== threadId)] });
      }
    }
    set({
      messages: [
        ...get().messages,
        {
          id: replyId,
          role: 'assistant',
          text: reply.message,
          // A proposal is attached, never applied. PRD §14 requires review and
          // confirmation before anything reaches the tracker.
          proposal: reply.proposal,
        },
      ],
      asking: false,
    });
  },

  reviewProposal(proposal) {
    set({ pendingProposal: proposal });
  },

  dismissProposal() {
    set({ pendingProposal: null });
  },

  async applyProposal(userId, repositories) {
    const proposal = get().pendingProposal;
    if (proposal === null || get().applying) return;

    if (!isReviewable(proposal)) {
      set({
        error: 'That suggestion is too large to apply at once. Ask for a smaller part of it.',
      });
      return;
    }

    set({ applying: true, error: null });

    try {
      // Added to the named subject if it exists, otherwise created — the student
      // has already seen and confirmed what this will add.
      const existing = await repositories.subjects.listByUser(userId, activeTrackerId());
      const match = existing.find(
        (subject) => subject.name.toLowerCase() === proposal.subjectName.toLowerCase(),
      );
      const subject =
        match ??
        (await repositories.subjects.create({
          userId,
          name: proposal.subjectName,
          trackerId: activeTrackerId(),
        }));

      for (const proposedChapter of proposal.chapters) {
        const chapter = await repositories.chapters.create({
          userId,
          subjectId: subject.id,
          name: proposedChapter.name,
        });

        if (proposedChapter.topics.length === 0) continue;
        await repositories.topics.createMany(
          proposedChapter.topics.map((name) => ({ userId, chapterId: chapter.id, name })),
        );
      }

      set({ pendingProposal: null });
    } catch {
      set({ error: 'We could not add that to your tracker. Try again.' });
    } finally {
      set({ applying: false });
    }
  },

  clearError() {
    set({ error: null });
  },

  reset() {
    set({ ...initialState });
  },
}));

/** Test seam: clears the store, its subject context and its saved-chat connection. */
export function resetAiStore(): void {
  subjectNames = [];
  chats = null;
  useAiStore.setState({ ...initialState });
}
