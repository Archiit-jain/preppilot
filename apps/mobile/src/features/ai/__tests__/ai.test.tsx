import type { AiProposal } from '@preppilot/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Repositories } from '../../../db/client';
import { getRepositories } from '../../../db/client';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../../../db/test-support/test-database';
import { getInModal, renderWithTheme } from '../../../test-utils/render';
import { useAuthStore } from '../../auth/auth-store';
import * as client from '../ai-client';
import { AiScreen } from '../ai-screen';
import { IMAGE_ONLY_QUESTION, resetAiStore, useAiStore } from '../ai-store';
import { pickImage, type ImageAttachment } from '../attach-image';

jest.mock('../../../db/client', () => ({ getRepositories: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));
jest.mock('../ai-client');
jest.mock('../attach-image', () => ({
  pickImage: jest.fn(),
  PICK_FAILURE_COPY: {
    denied: 'Camera access is off.',
    failed: 'That picture could not be opened.',
  },
}));

const USER = 'user-1';
const mocked = client as jest.Mocked<typeof client>;

let db: ReturnType<typeof createTestDatabase>;
let repositories: Repositories;

const ai = () => useAiStore.getState();

const proposal: AiProposal = {
  kind: 'addChapters',
  subjectName: 'Mathematics',
  chapters: [
    { name: 'Number Systems', topics: ['Decimal', 'Real Number'] },
    { name: 'Polynomials', topics: ['Degree'] },
  ],
};

beforeEach(() => {
  db = createTestDatabase();
  repositories = createTestRepositories(db, createTestClock());
  (getRepositories as jest.MockedFunction<typeof getRepositories>).mockReturnValue(repositories);

  jest.clearAllMocks();
  mocked.unavailableReason.mockReturnValue(null);
  // Automocking blanks the copy table the screen reads from.
  Object.assign(mocked.UNAVAILABLE_COPY, {
    unconfigured: 'The AI assistant is not set up yet. It needs a server connection to work.',
    demo: 'The assistant is off in the demo. It answers only for a signed-in account, because each reply costs the project owner.',
  });
  mocked.ask.mockResolvedValue({
    ok: true,
    reply: { message: 'A polynomial is an expression.', proposal: null },
  });

  resetAiStore();
  useAuthStore.setState({ user: { id: USER } as never, status: 'signedIn' });
});

afterEach(() => {
  db.$close();
});

const render = () => renderWithTheme(<AiScreen />);

describe('when the assistant is not configured', () => {
  /** Better than accepting a question and failing after the student has typed it. */
  it('says so instead of accepting questions', () => {
    mocked.unavailableReason.mockReturnValue('unconfigured');
    render();

    expect(screen.getByTestId('ai-unavailable')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ask' }).props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('reassures that the rest of the app still works', () => {
    mocked.unavailableReason.mockReturnValue('unconfigured');
    render();

    expect(screen.getByText('Everything else in PrepPilot works without it.')).toBeOnTheScreen();
  });

  /**
   * The proxy answers only a request carrying a real account's token, because
   * every reply spends the project owner's Gemini quota. Demo mode has no such
   * token, so the composer must not look ready.
   */
  it('explains that the demo has no account to bill the reply to', () => {
    mocked.unavailableReason.mockReturnValue('demo');
    render();

    expect(screen.getByTestId('ai-unavailable')).toBeOnTheScreen();
    expect(screen.getByText(/only for a signed-in account/)).toBeOnTheScreen();
  });
});

describe('asking a question', () => {
  it('shows the question and the reply', async () => {
    render();

    fireEvent.changeText(screen.getByLabelText('Ask a question'), 'What is a polynomial?');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Ask' }));
    });

    await waitFor(() => expect(screen.getByText('What is a polynomial?')).toBeOnTheScreen());
    expect(screen.getByText('A polynomial is an expression.')).toBeOnTheScreen();
  });

  it('ignores an empty question', async () => {
    render();

    await act(async () => {
      await ai().ask('   ');
    });

    expect(mocked.ask).not.toHaveBeenCalled();
    expect(ai().messages).toHaveLength(0);
  });

  it('ignores a second question while one is in flight', async () => {
    let release: (value: unknown) => void = () => {};
    mocked.ask.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    render();

    const first = ai().ask('One');
    await act(async () => {
      await ai().ask('Two');
    });

    expect(mocked.ask).toHaveBeenCalledTimes(1);
    release({ ok: true, reply: { message: 'ok', proposal: null } });
    await act(async () => {
      await first;
    });
  });

  it('shows a student-facing failure', async () => {
    mocked.ask.mockResolvedValue({
      ok: false,
      message: 'PrepPilot needs an internet connection to answer this.',
    });
    render();

    await act(async () => {
      await ai().ask('Explain polynomials');
    });

    await waitFor(() => expect(screen.getByTestId('ai-error')).toBeOnTheScreen());
    expect(
      screen.getByText('PrepPilot needs an internet connection to answer this.'),
    ).toBeOnTheScreen();
  });

  it('dismisses an error', async () => {
    mocked.ask.mockResolvedValue({ ok: false, message: 'Something failed.' });
    render();
    await act(async () => {
      await ai().ask('Explain polynomials');
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    });

    expect(ai().error).toBeNull();
  });
});

describe('a proposal', () => {
  beforeEach(() => {
    mocked.ask.mockResolvedValue({
      ok: true,
      reply: { message: 'Here is a plan.', proposal },
    });
  });

  /**
   * The rule PRD §14 exists to enforce: nothing reaches the tracker until the
   * student has seen it and said yes.
   */
  it('changes nothing before it is confirmed', async () => {
    render();

    await act(async () => {
      await ai().ask('Plan my maths');
    });

    expect(await repositories.subjects.listByUser(USER)).toEqual([]);
  });

  it('offers a review rather than applying', async () => {
    render();
    await act(async () => {
      await ai().ask('Plan my maths');
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Review suggestion' })).toBeOnTheScreen(),
    );
  });

  it('lists exactly what would be added', async () => {
    render();
    await act(async () => {
      await ai().ask('Plan my maths');
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Review suggestion' }));
    });

    expect(screen.getByTestId('proposal-review')).toBeOnTheScreen();
    expect(screen.getByText('Number Systems')).toBeOnTheScreen();
    expect(screen.getByText('Decimal')).toBeOnTheScreen();
  });

  it('applies only on confirmation', async () => {
    render();
    await act(async () => {
      await ai().ask('Plan my maths');
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Review suggestion' }));
    });
    await act(async () => {
      fireEvent.press(getInModal('Add to tracker'));
    });

    await waitFor(async () => {
      const subjects = await repositories.subjects.listByUser(USER);
      expect(subjects.map((row) => row.name)).toEqual(['Mathematics']);
    });
  });

  it('creates the proposed chapters and topics', async () => {
    render();
    await act(async () => {
      await ai().ask('Plan my maths');
    });
    act(() => {
      ai().reviewProposal(proposal);
    });
    await act(async () => {
      await ai().applyProposal(USER, repositories);
    });

    const [subject] = await repositories.subjects.listByUser(USER);
    const chapters = await repositories.chapters.listBySubject(subject!.id);
    expect(chapters.map((row) => row.name)).toEqual(['Number Systems', 'Polynomials']);
    expect(await repositories.topics.listBySubject(subject!.id)).toHaveLength(3);
  });

  /** Adding to a subject the student already has, rather than duplicating it. */
  it('adds to an existing subject when the name matches', async () => {
    await repositories.subjects.create({ userId: USER, name: 'mathematics' });
    act(() => {
      ai().reviewProposal(proposal);
    });

    await act(async () => {
      await ai().applyProposal(USER, repositories);
    });

    expect(await repositories.subjects.listByUser(USER)).toHaveLength(1);
  });

  it('changes nothing when the student declines', async () => {
    render();
    await act(async () => {
      await ai().ask('Plan my maths');
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Review suggestion' }));
    });
    await act(async () => {
      fireEvent.press(getInModal('No thanks'));
    });

    expect(screen.queryByTestId('proposal-review')).toBeNull();
    expect(await repositories.subjects.listByUser(USER)).toEqual([]);
  });

  /** Confirming hundreds of topics is a rubber stamp, not a review. */
  it('refuses a proposal too large to review', async () => {
    const huge: AiProposal = {
      kind: 'addChapters',
      subjectName: 'Mathematics',
      chapters: [{ name: 'Everything', topics: Array.from({ length: 500 }, (_, i) => `t${i}`) }],
    };
    act(() => {
      ai().reviewProposal(huge);
    });

    await act(async () => {
      await ai().applyProposal(USER, repositories);
    });

    expect(ai().error).toMatch(/too large to apply at once/);
    expect(await repositories.subjects.listByUser(USER)).toEqual([]);
  });

  it('reports a failure to apply without claiming success', async () => {
    jest.spyOn(repositories.chapters, 'create').mockRejectedValue(new Error('SQLITE_BUSY'));
    act(() => {
      ai().reviewProposal(proposal);
    });

    await act(async () => {
      await ai().applyProposal(USER, repositories);
    });

    expect(ai().error).toBe('We could not add that to your tracker. Try again.');
    expect(ai().pendingProposal).not.toBeNull();
  });

  it('does nothing when there is no pending proposal', async () => {
    await act(async () => {
      await ai().applyProposal(USER, repositories);
    });

    expect(await repositories.subjects.listByUser(USER)).toEqual([]);
  });
});

describe('quick prompts', () => {
  it('offers starting points before the first question', () => {
    render();

    expect(screen.getByRole('button', { name: 'Explain this topic simply' })).toBeOnTheScreen();
  });

  it('sends one when tapped', async () => {
    render();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Give me a quick insight' }));
    });

    expect(mocked.ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'Give me a quick insight' }),
    );
  });
});

describe('replies', () => {
  it('shows formatting instead of markdown symbols', async () => {
    mocked.ask.mockResolvedValue({
      ok: true,
      reply: { message: '**Ohm’s law**\n\n* $V = IR$', proposal: null },
    });
    render();

    await act(async () => {
      await ai().ask('Explain Ohm’s law');
    });

    expect(screen.getByText('Ohm’s law')).toBeOnTheScreen();
    expect(screen.getByText('V = IR')).toBeOnTheScreen();
    expect(screen.queryByText(/\*\*|\$/)).toBeNull();
  });
});

describe('attaching a picture', () => {
  const picked = pickImage as jest.MockedFunction<typeof pickImage>;
  const photo: ImageAttachment = { uri: 'file:///page.jpg', base64: 'abc', mimeType: 'image/jpeg' };

  const choose = async (option: 'Take photo' | 'Choose from gallery') => {
    fireEvent.press(screen.getByRole('button', { name: 'Attach a picture' }));
    await act(async () => {
      fireEvent.press(getInModal(option));
    });
  };

  beforeEach(() => {
    picked.mockResolvedValue({ ok: true, image: photo });
  });

  it('offers the camera and the gallery', async () => {
    render();

    await choose('Take photo');
    expect(picked).toHaveBeenCalledWith('camera');

    await choose('Choose from gallery');
    expect(picked).toHaveBeenLastCalledWith('library');
  });

  it('shows the picture before it is sent, and can remove it', async () => {
    render();
    await choose('Choose from gallery');

    expect(screen.getByLabelText('Picture to send')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Remove picture' }));
    expect(screen.queryByLabelText('Picture to send')).toBeNull();
  });

  it('sends a picture on its own, with a question the model can answer', async () => {
    render();
    await choose('Choose from gallery');

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Ask' }));
    });

    expect(mocked.ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: IMAGE_ONLY_QUESTION, image: photo }),
    );
    // Shown in the conversation, and cleared from the composer.
    expect(screen.getByLabelText('Attached picture')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Picture to send')).toBeNull();
  });

  it('sends the typed question with the picture', async () => {
    render();
    await choose('Take photo');

    fireEvent.changeText(screen.getByLabelText('Ask a question'), 'Solve question 3');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Ask' }));
    });

    expect(mocked.ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'Solve question 3', image: photo }),
    );
    expect(screen.getByText('Solve question 3')).toBeOnTheScreen();
  });

  it('says why when the camera is not allowed', async () => {
    picked.mockResolvedValue({ ok: false, reason: 'denied' });
    render();

    await choose('Take photo');

    expect(screen.getByText('Camera access is off.')).toBeOnTheScreen();
  });

  it('shows nothing when the student backs out', async () => {
    picked.mockResolvedValue({ ok: false, reason: 'cancelled' });
    render();

    await choose('Choose from gallery');

    expect(screen.queryByTestId('ai-attachment')).toBeNull();
  });

  it('can be closed without choosing', async () => {
    render();

    fireEvent.press(screen.getByRole('button', { name: 'Attach a picture' }));
    fireEvent.press(getInModal('Cancel'));

    expect(picked).not.toHaveBeenCalled();
  });
});

describe('saved chats', () => {
  /** Renders and lets the saved-chat connection finish opening. */
  const renderOpened = async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });
  };

  const askAndWait = async (question: string) => {
    await act(async () => {
      await ai().ask(question);
    });
  };

  it('saves a conversation, named after its first question', async () => {
    await renderOpened();
    await askAndWait('What is a polynomial?');

    const [thread] = await repositories.chats.listThreads(USER);
    expect(thread?.title).toBe('What is a polynomial?');
    const messages = await repositories.chats.listMessages(thread!.id);
    expect(messages.map((message) => message.body)).toEqual([
      'What is a polynomial?',
      'A polynomial is an expression.',
    ]);
  });

  it('reopens the last conversation when the assistant is opened again', async () => {
    await renderOpened();
    await askAndWait('What is a polynomial?');
    screen.unmount();

    resetAiStore();
    await renderOpened();

    await waitFor(() =>
      expect(screen.getByText('A polynomial is an expression.')).toBeOnTheScreen(),
    );
  });

  it('starts a new chat, and lists both', async () => {
    await renderOpened();
    await askAndWait('First question');

    await act(async () => {
      fireEvent.press(screen.getByTestId('ai-new-chat'));
    });
    expect(ai().messages).toHaveLength(0);
    await askAndWait('Second question');

    await act(async () => {
      fireEvent.press(screen.getByTestId('ai-open-chats'));
    });
    expect(screen.getByText('First question')).toBeOnTheScreen();
    expect(screen.getAllByText('Second question').length).toBeGreaterThan(0);
  });

  it('opens a past conversation from the list', async () => {
    await renderOpened();
    await askAndWait('First question');
    const [first] = await repositories.chats.listThreads(USER);
    await act(async () => {
      ai().newChat();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('ai-open-chats'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId(`chat-open-${first!.id}`));
    });

    expect(ai().threadId).toBe(first!.id);
    expect(ai().messages.map((message) => message.text)).toEqual([
      'First question',
      'A polynomial is an expression.',
    ]);
  });

  it('deletes a conversation only after asking', async () => {
    await renderOpened();
    await askAndWait('Doomed question');
    const [thread] = await repositories.chats.listThreads(USER);

    await act(async () => {
      fireEvent.press(screen.getByTestId('ai-open-chats'));
    });
    fireEvent.press(screen.getByTestId(`chat-delete-${thread!.id}`));
    expect(await repositories.chats.listThreads(USER)).toHaveLength(1);

    await act(async () => {
      fireEvent.press(screen.getByTestId(`chat-delete-confirm-${thread!.id}`));
    });

    expect(await repositories.chats.listThreads(USER)).toEqual([]);
    expect(ai().messages).toEqual([]);
  });

  it('keeps a suggestion reviewable after the chat is reopened', async () => {
    mocked.ask.mockResolvedValue({ ok: true, reply: { message: 'Here is a plan.', proposal } });
    await renderOpened();
    await askAndWait('Plan Mathematics');
    const [thread] = await repositories.chats.listThreads(USER);

    await act(async () => {
      ai().newChat();
      await ai().openThread(thread!.id);
    });

    expect(ai().messages[1]?.proposal).toEqual(proposal);
  });

  it('says when a picture was sent from another device', async () => {
    const thread = await repositories.chats.createThread(USER, 'From the tablet');
    await repositories.chats.upsertMessageFromSync({
      id: '018f0000-0000-7000-8000-0000000000c1',
      userId: USER,
      threadId: thread.id,
      role: 'student',
      body: 'Solve this',
      proposal: null,
      hasImage: true,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      syncStatus: 'synced',
    });

    await renderOpened();

    await waitFor(() =>
      expect(screen.getByText('Picture sent from another device')).toBeOnTheScreen(),
    );
  });

  it('still answers when the conversation cannot be saved', async () => {
    await renderOpened();
    jest.spyOn(repositories.chats, 'createThread').mockRejectedValueOnce(new Error('disk'));
    await askAndWait('Unsaved question');

    expect(ai().messages.map((message) => message.text)).toEqual([
      'Unsaved question',
      'A polynomial is an expression.',
    ]);
  });
});

describe('keeping a reply as a note', () => {
  const seedTopic = async () => {
    const subject = await repositories.subjects.create({ userId: USER, name: 'Mathematics' });
    const chapter = await repositories.chapters.create({
      userId: USER,
      subjectId: subject.id,
      name: 'Algebra',
    });
    return repositories.topics.create({
      userId: USER,
      chapterId: chapter.id,
      name: 'Polynomials',
    });
  };

  const askOnce = async () => {
    render();
    await act(async () => {
      await ai().ask('What is degree?');
    });
    return ai().messages[1]!;
  };

  it('saves the reply, without its markdown, under the topic chosen', async () => {
    mocked.ask.mockResolvedValue({
      ok: true,
      reply: { message: '**Degree** is the highest power.\n\n* x² has degree 2', proposal: null },
    });
    const topic = await seedTopic();
    const reply = await askOnce();

    await act(async () => {
      fireEvent.press(screen.getByTestId(`ai-keep-${reply.id}`));
    });
    expect(screen.getByText('Which topic is this note for?')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId(`note-target-${topic.id}`)).toBeOnTheScreen());

    await act(async () => {
      fireEvent.press(screen.getByTestId(`note-target-${topic.id}`));
    });

    const [note] = await repositories.notes.listLiveByUser(USER);
    expect(note).toMatchObject({
      topicId: topic.id,
      source: 'assistant',
      body: 'Degree is the highest power.\n• x² has degree 2',
    });
    expect(screen.getByText('Saved to notes')).toBeOnTheScreen();
  });

  it('can be backed out of without saving anything', async () => {
    await seedTopic();
    const reply = await askOnce();

    await act(async () => {
      fireEvent.press(screen.getByTestId(`ai-keep-${reply.id}`));
    });
    fireEvent.press(screen.getByLabelText('Dismiss Choose a topic'));

    expect(await repositories.notes.listLiveByUser(USER)).toEqual([]);
  });

  it('says so when the note cannot be saved', async () => {
    const topic = await seedTopic();
    const reply = await askOnce();
    jest.spyOn(repositories.notes, 'create').mockRejectedValueOnce(new Error('disk'));

    await act(async () => {
      fireEvent.press(screen.getByTestId(`ai-keep-${reply.id}`));
    });
    await waitFor(() => expect(screen.getByTestId(`note-target-${topic.id}`)).toBeOnTheScreen());
    await act(async () => {
      fireEvent.press(screen.getByTestId(`note-target-${topic.id}`));
    });

    expect(screen.getByText('We could not save that as a note. Try again.')).toBeOnTheScreen();
  });
});

describe('describing a suggestion', () => {
  /** "1 chapters" read as a bug; one of anything is singular. */
  it('uses the singular for one chapter and one topic', async () => {
    mocked.ask.mockResolvedValue({
      ok: true,
      reply: {
        message: 'Add this.',
        proposal: {
          kind: 'addChapters',
          subjectName: 'Science',
          chapters: [{ name: 'Electricity', topics: ["Ohm's law"] }],
        },
      },
    });
    render();
    await act(async () => {
      await ai().ask('Suggest a chapter');
    });

    expect(screen.getByText(/This would add 1 chapter and 1 topic to/)).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Review suggestion' }));
    });
    expect(screen.getByText(/1 chapter and 1 topic would be/)).toBeOnTheScreen();
  });
});

describe('following up on a summary', () => {
  const SUMMARY = 'The degree is the highest power of the variable.';

  const startFollowUp = async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      ai().startFollowUp('Degree', SUMMARY);
    });
  };

  it('sends the summary with the question, but never shows it as a message', async () => {
    await startFollowUp();

    await act(async () => {
      await ai().ask('Give me an example.');
    });

    expect(mocked.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Give me an example.',
        followUp: { title: 'Degree', text: SUMMARY },
        history: [],
      }),
    );
    expect(screen.queryByText(SUMMARY)).toBeNull();
  });

  it('remembers the conversation so far for the next follow-up', async () => {
    await startFollowUp();
    await act(async () => {
      await ai().ask('Give me an example.');
    });

    await act(async () => {
      await ai().ask('And a harder one?');
    });

    expect(mocked.ask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        followUp: { title: 'Degree', text: SUMMARY },
        history: [
          { role: 'student', text: 'Give me an example.' },
          { role: 'assistant', text: 'A polynomial is an expression.' },
        ],
      }),
    );
  });

  it('shows a banner that opens the summary', async () => {
    await startFollowUp();

    expect(screen.getByTestId('ai-follow-up-banner')).toHaveTextContent(/Following up on: Degree/);
    fireEvent.press(screen.getByTestId('ai-follow-up-banner'));

    expect(screen.getByText(SUMMARY)).toBeOnTheScreen();
  });

  it('saves the chat under the topic’s name, with its summary', async () => {
    await startFollowUp();
    await act(async () => {
      await ai().ask('Give me an example.');
    });

    const [thread] = await repositories.chats.listThreads(USER);
    expect(thread?.title).toBe('Degree');
    expect(JSON.parse(thread!.followUp!)).toEqual({ title: 'Degree', text: SUMMARY });
  });

  it('keeps the summary when the chat is reopened later', async () => {
    await startFollowUp();
    await act(async () => {
      await ai().ask('Give me an example.');
    });
    const [thread] = await repositories.chats.listThreads(USER);

    await act(async () => {
      ai().newChat();
    });
    expect(ai().followUp).toBeNull();
    expect(screen.queryByTestId('ai-follow-up-banner')).toBeNull();

    await act(async () => {
      await ai().openThread(thread!.id);
    });
    expect(ai().followUp).toEqual({ title: 'Degree', text: SUMMARY });
  });

  it('is not replaced by the last conversation when the assistant opens', async () => {
    const older = await repositories.chats.createThread(USER, 'Older question');
    ai().startFollowUp('Degree', SUMMARY);

    await act(async () => {
      await ai().openChats(USER, repositories);
    });

    expect(ai().threadId).toBeNull();
    expect(ai().followUp?.title).toBe('Degree');
    expect(ai().threads.map((entry) => entry.id)).toEqual([older.id]);
  });

  it('sends no history in an ordinary chat', async () => {
    render();
    await act(async () => {
      await ai().ask('First');
    });
    await act(async () => {
      await ai().ask('Second');
    });

    expect(mocked.ask).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ history: expect.anything() }),
    );
  });
});

describe('closing things', () => {
  it('closes the follow-up summary', async () => {
    render();
    await act(async () => {
      ai().startFollowUp('Degree', 'The highest power.');
    });
    fireEvent.press(screen.getByTestId('ai-follow-up-banner'));
    expect(screen.getByText('The highest power.')).toBeOnTheScreen();

    fireEvent.press(getInModal('Close'));

    expect(screen.queryByText('The highest power.')).toBeNull();
  });

  it('closes the chat list, and starts a new chat from it', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await ai().ask('Something');
    });

    fireEvent.press(screen.getByTestId('ai-open-chats'));
    fireEvent.press(screen.getByLabelText('Dismiss Your chats'));
    expect(screen.queryByTestId('chat-list-new')).toBeNull();

    fireEvent.press(screen.getByTestId('ai-open-chats'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('chat-list-new'));
    });
    expect(ai().messages).toEqual([]);
  });

  it('can back out of deleting a chat', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await ai().ask('Keep me');
    });
    const [thread] = await repositories.chats.listThreads(USER);

    fireEvent.press(screen.getByTestId('ai-open-chats'));
    fireEvent.press(screen.getByTestId(`chat-delete-${thread!.id}`));
    fireEvent.press(getInModal('Keep'));

    expect(screen.getByTestId(`chat-delete-${thread!.id}`)).toBeOnTheScreen();
  });

  it('closes the picture chooser without picking', () => {
    render();

    fireEvent.press(screen.getByRole('button', { name: 'Attach a picture' }));
    fireEvent.press(screen.getByLabelText('Dismiss Attach a picture'));

    expect(screen.queryByText('Take photo')).toBeNull();
  });
});
