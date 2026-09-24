import {
  normaliseQuizSettings,
  shuffleOptions,
  type Quiz,
  type QuizDifficulty,
  type QuizSettings,
} from '@preppilot/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, PressableScale, Sheet, Text } from '../../components/ui';
import { getRepositories } from '../../db/client';
import type { QuizAttempt } from '../../db/repositories/quiz-attempts';
import { useTheme } from '../../theme/theme-context';
import { quizTopic, UNAVAILABLE_COPY } from '../ai/ai-client';
import { useAuthStore } from '../auth/auth-store';
import { TopicQuiz } from '../tracker/components/topic-quiz';
import { recordQuizAttempt, useQuizDeckStore } from './quiz-deck-store';
import { DIFFICULTY_LABELS } from './quiz-settings-sheet';

/** How many quizzes show before "Show all". */
export const DECK_PREVIEW = 5;

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

function difficultyLabel(value: string): string {
  return DIFFICULTY_LABELS[value as QuizDifficulty] ?? value;
}

/** The settings a past quiz was asked with, for asking again. */
export function settingsOf(attempt: QuizAttempt): QuizSettings {
  return normaliseQuizSettings({
    questionCount: attempt.total,
    difficulty: attempt.difficulty as QuizDifficulty,
    allowMultiple: attempt.allowMultiple,
  });
}

/** What is on screen: a quiz being replayed, and the attempt it came from. */
interface Playing {
  readonly quiz: Quiz;
  readonly from: QuizAttempt;
}

/**
 * The Quiz deck: every quiz the student finished, to look back on and redo.
 *
 * "Redo" replays the saved questions with their options reshuffled — no AI
 * request, so it works offline and costs nothing. "New quiz" asks for fresh
 * questions on the same topic with the same settings. Either way, finishing it
 * adds another attempt, so the deck shows whether the score is improving.
 */
export function QuizDeck() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { attempts, error } = useQuizDeckStore();

  const [showAll, setShowAll] = useState(false);
  const [chosen, setChosen] = useState<QuizAttempt | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const visible = showAll ? attempts : attempts.slice(0, DECK_PREVIEW);

  const redo = (attempt: QuizAttempt) => {
    setChosen(null);
    setPlaying({
      quiz: {
        topicName: attempt.topicName,
        questions: attempt.questions.map((question) => shuffleOptions(question)),
      },
      from: attempt,
    });
  };

  const fresh = async (attempt: QuizAttempt) => {
    setChosen(null);
    if (isGuest) {
      setProblem(UNAVAILABLE_COPY.guest);
      return;
    }
    setAsking(true);
    try {
      const result = await quizTopic(
        {
          topicName: attempt.topicName,
          ...(attempt.chapterName !== null ? { chapterName: attempt.chapterName } : {}),
          ...(attempt.subjectName !== null ? { subjectName: attempt.subjectName } : {}),
        },
        settingsOf(attempt),
      );
      if (result.ok) setPlaying({ quiz: result.quiz, from: attempt });
      else setProblem(result.message);
    } finally {
      setAsking(false);
    }
  };

  const save = (answers: readonly (readonly number[])[]) => {
    if (user === null || playing === null) return;
    const { quiz, from } = playing;
    void recordQuizAttempt(
      user.id,
      getRepositories(),
      quiz,
      answers,
      { difficulty: settingsOf(from).difficulty, allowMultiple: from.allowMultiple },
      { topicId: from.topicId, chapterName: from.chapterName, subjectName: from.subjectName },
    );
  };

  return (
    <Card testID="quiz-deck">
      <Text variant="caption" tone="muted" overline>
        Quiz deck
      </Text>
      <Text variant="small" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
        {attempts.length === 0
          ? 'Quizzes you finish from "Test me on this" in the tracker are kept here, to look back on and redo.'
          : 'Your finished quizzes. Tap one to redo it.'}
      </Text>

      {error !== null && (
        <Text variant="small" tone="danger" style={{ marginTop: theme.spacing.sm }}>
          {error}
        </Text>
      )}
      {asking && (
        <Text variant="caption" tone="accent" style={{ marginTop: theme.spacing.sm }}>
          Writing new questions…
        </Text>
      )}

      <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
        {visible.map((attempt) => (
          <PressableScale
            key={attempt.id}
            accessibilityRole="button"
            accessibilityLabel={`${attempt.topicName}, ${attempt.correct} of ${attempt.total}`}
            accessibilityHint="Redo, ask for new questions, or delete"
            testID={`quiz-attempt-${attempt.id}`}
            onPress={() => setChosen(attempt)}
          >
            <View
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                  gap: theme.spacing.sm,
                },
              ]}
            >
              <View style={styles.rowText}>
                <Text variant="small" weight="semibold" numberOfLines={1}>
                  {attempt.topicName}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {[
                    dateFormat.format(new Date(attempt.createdAt)),
                    difficultyLabel(attempt.difficulty),
                    attempt.subjectName,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text
                variant="small"
                weight="semibold"
                tone={attempt.correct === attempt.total ? 'success' : 'primary'}
              >
                {attempt.correct}/{attempt.total}
              </Text>
            </View>
          </PressableScale>
        ))}
      </View>

      {attempts.length > DECK_PREVIEW && (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button
            label={showAll ? 'Show fewer' : `Show all ${attempts.length}`}
            variant="ghost"
            size="small"
            onPress={() => setShowAll((current) => !current)}
          />
        </View>
      )}

      <Sheet
        visible={chosen !== null}
        onDismiss={() => setChosen(null)}
        label="Quiz"
        testID="quiz-attempt-actions"
      >
        {chosen !== null && (
          <>
            <Text variant="caption" tone="muted" overline>
              {chosen.correct} of {chosen.total} right · {difficultyLabel(chosen.difficulty)}
            </Text>
            <Text variant="title" numberOfLines={2}>
              {chosen.topicName}
            </Text>
            <View style={{ gap: theme.spacing.sm }}>
              <Button label="Redo these questions" fullWidth onPress={() => redo(chosen)} />
              <Button
                label="New quiz, same settings"
                variant="secondary"
                fullWidth
                onPress={() => void fresh(chosen)}
              />
              <Button
                label="Delete from deck"
                variant="ghost"
                fullWidth
                onPress={() => {
                  const id = chosen.id;
                  setChosen(null);
                  void useQuizDeckStore.getState().remove(id);
                }}
              />
            </View>
          </>
        )}
      </Sheet>

      <Sheet visible={problem !== null} onDismiss={() => setProblem(null)} label="Quiz">
        <Text variant="title">No new questions</Text>
        <Text variant="small" tone="secondary" testID="quiz-deck-problem">
          {problem}
        </Text>
        <View style={styles.actions}>
          <Button label="Close" onPress={() => setProblem(null)} />
        </View>
      </Sheet>

      {playing !== null && (
        <TopicQuiz
          visible
          quiz={playing.quiz}
          offerComplete={false}
          onAttempted={save}
          onDismiss={() => setPlaying(null)}
          onFinish={() => setPlaying(null)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
