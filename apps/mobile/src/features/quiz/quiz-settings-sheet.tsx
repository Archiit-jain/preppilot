import {
  DEFAULT_QUIZ_SETTINGS,
  MAX_QUIZ_QUESTIONS,
  QUIZ_DIFFICULTIES,
  normaliseQuizSettings,
  type QuizDifficulty,
  type QuizSettings,
} from '@preppilot/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Button, Sheet, Text } from '../../components/ui';
import { useTheme } from '../../theme/theme-context';
import { Stepper } from '../timer/components/stepper';

export const DIFFICULTY_LABELS: Record<QuizDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  competitive: 'Competitive',
};

const DIFFICULTY_HINTS: Record<QuizDifficulty, string> = {
  easy: 'Definitions and basic facts.',
  medium: 'Apply the idea to a straightforward case.',
  hard: 'Several steps, with common mistakes as the wrong options.',
  competitive: 'JEE, NEET or GATE standard.',
};

/**
 * The last settings used, so a student who always wants ten hard questions
 * does not set them again for every topic. Held for the session, not stored.
 */
let lastUsed: QuizSettings = DEFAULT_QUIZ_SETTINGS;

export function resetLastQuizSettings(): void {
  lastUsed = DEFAULT_QUIZ_SETTINGS;
}

export interface QuizSettingsSheetProps {
  readonly visible: boolean;
  readonly topicName: string;
  /** Settings to start from — a redo's own. Defaults to the last ones used. */
  readonly initial?: QuizSettings;
  readonly onStart: (settings: QuizSettings) => void;
  readonly onDismiss: () => void;
}

/**
 * What kind of quiz, before it is written.
 *
 * Asked up front because each answer changes what the model writes: fifteen
 * competitive questions are a different request from three easy ones, and a
 * setting changed after the questions exist would change nothing.
 */
export function QuizSettingsSheet({
  visible,
  topicName,
  initial,
  onStart,
  onDismiss,
}: QuizSettingsSheetProps) {
  const theme = useTheme();
  const [settings, setSettings] = useState<QuizSettings>(initial ?? lastUsed);

  // Each opening starts from the settings it was given, not from the last sheet's edits.
  useEffect(() => {
    if (visible) setSettings(initial ?? lastUsed);
  }, [visible, initial]);

  const update = (patch: Partial<QuizSettings>) =>
    setSettings((current) => normaliseQuizSettings({ ...current, ...patch }));

  return (
    <Sheet visible={visible} onDismiss={onDismiss} label="Quiz settings" testID="quiz-settings">
      <Text variant="caption" tone="muted" overline>
        Test me on
      </Text>
      <Text variant="title" numberOfLines={2}>
        {topicName}
      </Text>

      <Stepper
        label="Questions"
        value={settings.questionCount}
        min={1}
        max={MAX_QUIZ_QUESTIONS}
        onChange={(questionCount) => update({ questionCount })}
        testID="quiz-count"
      />

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="small" tone="secondary">
          Difficulty
        </Text>
        <View style={[styles.chips, { gap: theme.spacing.xs }]}>
          {QUIZ_DIFFICULTIES.map((difficulty) => (
            <Button
              key={difficulty}
              label={DIFFICULTY_LABELS[difficulty]}
              size="small"
              variant={settings.difficulty === difficulty ? 'primary' : 'secondary'}
              selected={settings.difficulty === difficulty}
              testID={`quiz-difficulty-${difficulty}`}
              onPress={() => update({ difficulty })}
            />
          ))}
        </View>
        <Text variant="caption" tone="muted">
          {DIFFICULTY_HINTS[settings.difficulty]}
        </Text>
      </View>

      <View style={[styles.toggle, { gap: theme.spacing.md }]}>
        <View style={styles.toggleText}>
          <Text variant="small">More than one correct answer</Text>
          <Text variant="caption" tone="muted">
            {settings.allowMultiple
              ? 'Some questions may need every correct option picked.'
              : 'Every question has exactly one right answer.'}
          </Text>
        </View>
        <Switch
          value={settings.allowMultiple}
          onValueChange={(allowMultiple) => update({ allowMultiple })}
          accessibilityLabel="More than one correct answer"
          trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
          testID="quiz-multiple"
        />
      </View>

      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <Button label="Cancel" variant="ghost" onPress={onDismiss} />
        <Button
          label="Start quiz"
          testID="quiz-start"
          onPress={() => {
            lastUsed = settings;
            onStart(settings);
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center' },
  toggleText: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
