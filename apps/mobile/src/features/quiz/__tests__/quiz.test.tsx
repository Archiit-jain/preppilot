import { DEFAULT_QUIZ_SETTINGS, type Quiz, type QuizQuestion } from '@preppilot/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Repositories } from '../../../db/client';
import { getRepositories } from '../../../db/client';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../../../db/test-support/test-database';
import { getInModal, renderWithTheme } from '../../../test-utils/render';
import * as client from '../../ai/ai-client';
import { useAuthStore } from '../../auth/auth-store';
import { QuizDeck, settingsOf } from '../quiz-deck';
import { recordQuizAttempt, resetQuizDeckStore, useQuizDeckStore } from '../quiz-deck-store';
import { QuizSettingsSheet, resetLastQuizSettings } from '../quiz-settings-sheet';
import { TopicQuiz } from '../../tracker/components/topic-quiz';

jest.mock('../../../db/client', () => ({ getRepositories: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));
jest.mock('../../ai/ai-client', () => ({
  quizTopic: jest.fn(),
  UNAVAILABLE_COPY: { guest: 'The assistant needs an account.' },
}));

const USER = 'user-1';
const mockedQuiz = client.quizTopic as jest.MockedFunction<typeof client.quizTopic>;

let db: ReturnType<typeof createTestDatabase>;
let repositories: Repositories;
let clock: ReturnType<typeof createTestClock>;

beforeEach(() => {
  db = createTestDatabase();
  clock = createTestClock();
  repositories = createTestRepositories(db, clock);
  (getRepositories as jest.MockedFunction<typeof getRepositories>).mockReturnValue(repositories);
  jest.clearAllMocks();
  resetQuizDeckStore();
  resetLastQuizSettings();
  useAuthStore.setState({ user: { id: USER } as never, status: 'signedIn', isGuest: false });
});

afterEach(() => {
  db.$close();
});

const question = (n: number, answer = 0): QuizQuestion => ({
  question: `Question ${n}?`,
  options: [`A${n}`, `B${n}`, `C${n}`, `D${n}`],
  answerIndexes: [answer],
  explanation: `Because ${n}.`,
});

const quiz: Quiz = { topicName: "Ohm's law", questions: [question(1), question(2)] };

describe('choosing how to be quizzed', () => {
  const renderSheet = () => {
    const onStart = jest.fn();
    renderWithTheme(
      <QuizSettingsSheet visible topicName="Ohm's law" onStart={onStart} onDismiss={jest.fn()} />,
    );
    return onStart;
  };

  it('starts from five medium questions that may have several answers', () => {
    const onStart = renderSheet();

    fireEvent.press(getInModal('Start quiz'));

    expect(onStart).toHaveBeenCalledWith(DEFAULT_QUIZ_SETTINGS);
  });

  it('asks for as many questions, as hard, as the student chooses', () => {
    const onStart = renderSheet();

    fireEvent.press(getInModal('Increase Questions'));
    fireEvent.press(getInModal('Increase Questions'));
    fireEvent.press(getInModal('Competitive'));
    fireEvent(screen.getByTestId('quiz-multiple'), 'valueChange', false);
    expect(screen.getByText('Every question has exactly one right answer.')).toBeOnTheScreen();

    fireEvent.press(getInModal('Start quiz'));

    expect(onStart).toHaveBeenCalledWith({
      questionCount: 7,
      difficulty: 'competitive',
      allowMultiple: false,
    });
  });

  it('never asks for more than fifteen', () => {
    const onStart = renderSheet();

    for (let i = 0; i < 20; i += 1) fireEvent.press(getInModal('Increase Questions'));
    fireEvent.press(getInModal('Start quiz'));

    expect(onStart.mock.calls[0]![0].questionCount).toBe(15);
  });

  it('remembers the last settings for the next topic', () => {
    const first = renderSheet();
    fireEvent.press(getInModal('Hard'));
    fireEvent.press(getInModal('Start quiz'));
    expect(first).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 'hard' }));
    screen.unmount();

    const second = renderSheet();
    fireEvent.press(getInModal('Start quiz'));

    expect(second).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 'hard' }));
  });
});

describe('the Quiz deck', () => {
  const record = async (topicName = "Ohm's law", correct: [number[], number[]] = [[0], [0]]) => {
    await recordQuizAttempt(
      USER,
      repositories,
      { ...quiz, topicName },
      correct,
      { difficulty: 'hard', allowMultiple: false },
      { topicId: null, chapterName: 'Electricity', subjectName: 'Physics' },
    );
    clock.advance(1000);
  };

  const renderDeck = async () => {
    renderWithTheme(<QuizDeck />);
    await act(async () => {
      await useQuizDeckStore.getState().load(USER, repositories);
    });
  };

  it('explains itself when it is empty', async () => {
    await renderDeck();

    expect(screen.getByText(/Quizzes you finish from "Test me on this"/)).toBeOnTheScreen();
  });

  it('lists finished quizzes with their scores, newest first', async () => {
    await record('First', [[0], [1]]);
    await record('Second');
    await renderDeck();

    const scores = screen.getAllByText(/^\d+\/\d+$/).map((node) => node.props.children.join(''));
    expect(scores).toEqual(['2/2', '1/2']);
    expect(screen.getByText('Second')).toBeOnTheScreen();
  });

  it('shows five, then the rest on request', async () => {
    for (let i = 1; i <= 7; i += 1) await record(`Topic ${i}`);
    await renderDeck();

    expect(screen.queryByText('Topic 1')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Show all 7' }));
    expect(screen.getByText('Topic 1')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.queryByText('Topic 1')).toBeNull();
  });

  /** "Redo" replays the saved questions: no AI request, and it works offline. */
  it('redoes the same questions without asking the assistant', async () => {
    await record();
    await renderDeck();
    const [attempt] = useQuizDeckStore.getState().attempts;

    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt!.id}`));
    fireEvent.press(getInModal('Redo these questions'));

    expect(mockedQuiz).not.toHaveBeenCalled();
    expect(screen.getByText('Question 1?')).toBeOnTheScreen();
  });

  it('saves a redo as a new attempt', async () => {
    await record();
    await renderDeck();
    const [attempt] = useQuizDeckStore.getState().attempts;
    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt!.id}`));
    fireEvent.press(getInModal('Redo these questions'));

    for (let index = 0; index < 2; index += 1) {
      // The options are shuffled; pick whichever holds the right answer.
      const right = attempt!.questions[index]!.options[0]!;
      fireEvent.press(screen.getByRole('radio', { name: right }));
      fireEvent.press(screen.getByTestId('quiz-check'));
      fireEvent.press(screen.getByTestId(index === 1 ? 'quiz-results' : 'quiz-next'));
    }

    await waitFor(() => expect(useQuizDeckStore.getState().attempts).toHaveLength(2));
    expect(screen.getByTestId('quiz-finish')).toHaveTextContent('Done');
  });

  it('asks for new questions with the same settings', async () => {
    mockedQuiz.mockResolvedValue({ ok: true, quiz: { ...quiz, questions: [question(9)] } });
    await record();
    await renderDeck();
    const [attempt] = useQuizDeckStore.getState().attempts;

    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt!.id}`));
    await act(async () => {
      fireEvent.press(getInModal('New quiz, same settings'));
    });

    expect(mockedQuiz).toHaveBeenCalledWith(
      { topicName: "Ohm's law", chapterName: 'Electricity', subjectName: 'Physics' },
      { questionCount: 2, difficulty: 'hard', allowMultiple: false },
    );
    expect(screen.getByText('Question 9?')).toBeOnTheScreen();
  });

  it('says why when new questions cannot be had', async () => {
    mockedQuiz.mockResolvedValue({ ok: false, message: 'The assistant is busy right now.' });
    await record();
    await renderDeck();
    const [attempt] = useQuizDeckStore.getState().attempts;

    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt!.id}`));
    await act(async () => {
      fireEvent.press(getInModal('New quiz, same settings'));
    });

    expect(screen.getByTestId('quiz-deck-problem')).toHaveTextContent(
      'The assistant is busy right now.',
    );
  });

  it('tells a guest that new questions need an account', async () => {
    useAuthStore.setState({ isGuest: true });
    await record();
    await renderDeck();
    const [attempt] = useQuizDeckStore.getState().attempts;

    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt!.id}`));
    await act(async () => {
      fireEvent.press(getInModal('New quiz, same settings'));
    });

    expect(mockedQuiz).not.toHaveBeenCalled();
    expect(screen.getByTestId('quiz-deck-problem')).toHaveTextContent(/needs an account/);
  });

  it('deletes a quiz from the deck', async () => {
    await record();
    await renderDeck();
    const [attempt] = useQuizDeckStore.getState().attempts;

    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt!.id}`));
    await act(async () => {
      fireEvent.press(getInModal('Delete from deck'));
    });

    expect(useQuizDeckStore.getState().attempts).toEqual([]);
  });

  it('says so when the deck cannot be read', async () => {
    jest.spyOn(repositories.quizAttempts, 'listByUser').mockRejectedValueOnce(new Error('disk'));
    await renderDeck();

    expect(screen.getByText('We could not open your quiz deck. Try again.')).toBeOnTheScreen();
    act(() => useQuizDeckStore.getState().clearError());
  });

  it('reads the settings a past quiz was asked with', async () => {
    await record();
    const [attempt] = await repositories.quizAttempts.listByUser(USER);

    expect(settingsOf(attempt!)).toEqual({
      questionCount: 2,
      difficulty: 'hard',
      allowMultiple: false,
    });
  });
});

describe('the quiz sheet with any number of questions', () => {
  const answerAll = (picks: readonly number[]) => {
    picks.forEach((pick, index) => {
      fireEvent.press(screen.getByTestId(`q${index}-option${pick}`));
      fireEvent.press(screen.getByTestId('quiz-check'));
      fireEvent.press(
        screen.getByTestId(index === picks.length - 1 ? 'quiz-results' : 'quiz-next'),
      );
    });
  };

  it('says just "Right." for a single question answered correctly', () => {
    const onAttempted = jest.fn();
    renderWithTheme(
      <TopicQuiz
        visible
        quiz={{ topicName: 'T', questions: [question(1)] }}
        onDismiss={jest.fn()}
        onFinish={jest.fn()}
        onAttempted={onAttempted}
      />,
    );

    answerAll([0]);

    expect(screen.getByText('Right.')).toBeOnTheScreen();
    expect(onAttempted).toHaveBeenCalledWith([[0]]);
  });

  it('counts the score out of however many there were, and reports the attempt once', () => {
    const onAttempted = jest.fn();
    renderWithTheme(
      <TopicQuiz
        visible
        quiz={quiz}
        offerComplete={false}
        onDismiss={jest.fn()}
        onFinish={jest.fn()}
        onAttempted={onAttempted}
      />,
    );

    answerAll([0, 1]);
    expect(screen.getByText('1 of 2 right.')).toBeOnTheScreen();
    expect(screen.getByTestId('quiz-finish')).toHaveTextContent('Done');

    fireEvent.press(screen.getByTestId('quiz-back-to-questions'));
    fireEvent.press(screen.getByTestId('quiz-results'));
    expect(onAttempted).toHaveBeenCalledTimes(1);
  });

  it('says all of them were right when they were', () => {
    renderWithTheme(<TopicQuiz visible quiz={quiz} onDismiss={jest.fn()} onFinish={jest.fn()} />);

    answerAll([0, 0]);

    expect(screen.getByText('All 2 right.')).toBeOnTheScreen();
    expect(screen.getByTestId('quiz-finish')).toHaveTextContent('Mark complete');
  });
});

describe('closing things in the deck', () => {
  const recordOne = () =>
    recordQuizAttempt(
      USER,
      repositories,
      quiz,
      [[0], [0]],
      { difficulty: 'easy', allowMultiple: true },
      { topicId: null, chapterName: null, subjectName: null },
    );

  const openDeck = async () => {
    renderWithTheme(<QuizDeck />);
    await act(async () => {
      await useQuizDeckStore.getState().load(USER, repositories);
    });
    return useQuizDeckStore.getState().attempts[0]!;
  };

  it('closes the actions, a redo, and a problem', async () => {
    await recordOne();
    const attempt = await openDeck();

    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt.id}`));
    fireEvent.press(screen.getByLabelText('Dismiss Quiz'));
    expect(screen.queryByText('Redo these questions')).toBeNull();

    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt.id}`));
    fireEvent.press(getInModal('Redo these questions'));
    fireEvent.press(screen.getByLabelText("Dismiss Questions on Ohm's law"));
    expect(screen.queryByText('Question 1?')).toBeNull();

    mockedQuiz.mockResolvedValue({ ok: false, message: 'Busy.' });
    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt.id}`));
    await act(async () => {
      fireEvent.press(getInModal('New quiz, same settings'));
    });
    fireEvent.press(getInModal('Close'));
    expect(screen.queryByTestId('quiz-deck-problem')).toBeNull();
  });

  it('finishes a redo', async () => {
    await recordOne();
    const attempt = await openDeck();
    fireEvent.press(screen.getByTestId(`quiz-attempt-${attempt.id}`));
    fireEvent.press(getInModal('Redo these questions'));

    for (let index = 0; index < 2; index += 1) {
      fireEvent.press(screen.getByRole('radio', { name: attempt.questions[index]!.options[0]! }));
      fireEvent.press(screen.getByTestId('quiz-check'));
      fireEvent.press(screen.getByTestId(index === 1 ? 'quiz-results' : 'quiz-next'));
    }
    await act(async () => {
      fireEvent.press(screen.getByTestId('quiz-finish'));
    });

    expect(screen.queryByTestId('quiz-finish')).toBeNull();
  });
});

describe('the settings sheet', () => {
  it('can be cancelled', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <QuizSettingsSheet visible topicName="T" onStart={jest.fn()} onDismiss={onDismiss} />,
    );

    fireEvent.press(getInModal('Cancel'));

    expect(onDismiss).toHaveBeenCalled();
  });
});
