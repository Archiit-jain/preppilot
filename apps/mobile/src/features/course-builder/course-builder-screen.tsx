import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader, Button, Card, Screen, Sheet, Text, TextField } from '../../components/ui';
import { getRepositories } from '../../db/client';
import { useTheme } from '../../theme/theme-context';
import { useAuthStore } from '../auth/auth-store';
import {
  COURSE_NAME_KEY,
  addChapter,
  addSubject,
  addTopic,
  emptyCourseDraft,
  isDraftDirty,
  removeChapter,
  removeSubject,
  removeTopic,
  renameChapter,
  renameSubject,
  renameTopic,
  setCourseName,
  validateCourseDraft,
  type CourseDraft,
  type FormIssue,
  type SubjectDraft,
} from './course-form';
import { createCourse } from './create-course';

/**
 * "Build from scratch": a new course, typed out as one form.
 *
 * Course name, then its subjects, each with its chapters and each chapter with
 * its topics, all on one page so the whole syllabus is in view while it is
 * built. Nothing is saved until Create — see `createCourse` for why that is
 * all-or-nothing. Sub-topics are left to the tracker screen, where they are
 * added under a topic exactly as they are for any other course.
 */
export function CourseBuilderScreen() {
  const theme = useTheme();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [draft, setDraft] = useState<CourseDraft>(emptyCourseDraft);
  /** Only shown once Create has been pressed; flagging empty rows as they appear would nag. */
  const [issues, setIssues] = useState<readonly FormIssue[] | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  /** Edits re-check an already-submitted form, so a fixed field stops showing red. */
  const edit = (change: (current: CourseDraft) => CourseDraft) => {
    const next = change(draft);
    setDraft(next);
    if (issues !== null) setIssues(validateCourseDraft(next));
  };

  const errorFor = (key: string) => issues?.find((issue) => issue.key === key)?.message;

  /**
   * Starts again from an empty form.
   *
   * The screen stays mounted behind the tab bar, so without this the next
   * "Build from scratch" would open on the course just created.
   */
  const reset = () => {
    setDraft(emptyCourseDraft());
    setIssues(null);
    setCollapsed(new Set());
    setSaveError(null);
  };

  const leave = () => {
    reset();
    setConfirmingDiscard(false);
    router.push('/templates');
  };

  const cancel = () => {
    if (isDraftDirty(draft)) setConfirmingDiscard(true);
    else leave();
  };

  const submit = async () => {
    if (userId === null || saving) return;

    const found = validateCourseDraft(draft);
    setIssues(found);
    setSaveError(null);

    if (found.length > 0) {
      // A problem inside a folded subject would otherwise be invisible.
      const keysWithIssues = new Set(found.map((issue) => issue.key));
      setCollapsed(
        (current) =>
          new Set(
            [...current].filter((subjectKey) => {
              const subject = draft.subjects.find((entry) => entry.key === subjectKey);
              return subject === undefined || !subjectContains(subject, keysWithIssues);
            }),
          ),
      );
      return;
    }

    setSaving(true);
    try {
      await createCourse(userId, draft, getRepositories());
      reset();
      // The new course is already the active one, and the tracker re-reads when
      // it comes into view, so it opens on the syllabus just built.
      router.push('/');
    } catch {
      // What was typed is kept: it is still all on the form, ready to try again.
      setSaveError('We could not create that course. Nothing was saved — try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCollapsed = (subjectKey: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  };

  const issueCount = issues?.length ?? 0;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.base, gap: theme.spacing.base }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader overline="Build from scratch" title="New course">
          <Text variant="body" tone="secondary">
            Name your course, then add its subjects, their chapters and each chapter&apos;s topics.
            Nothing is saved until you create it.
          </Text>
        </AppHeader>

        <TextField
          label="Course name"
          required
          placeholder="e.g. UPSC Prelims 2027"
          value={draft.name}
          onChangeText={(name) => edit((current) => setCourseName(current, name))}
          error={errorFor(COURSE_NAME_KEY)}
          testID="course-name"
        />

        {draft.subjects.map((subject, s) => (
          <SubjectSection
            key={subject.key}
            subject={subject}
            index={s}
            removable={draft.subjects.length > 1}
            collapsed={collapsed.has(subject.key)}
            onToggleCollapsed={() => toggleCollapsed(subject.key)}
            errorFor={errorFor}
            edit={edit}
          />
        ))}

        <Button
          label="+ Add another subject"
          variant="secondary"
          fullWidth
          testID="add-subject-row"
          onPress={() => edit(addSubject)}
        />

        {issueCount > 0 && (
          <Text variant="small" tone="danger" accessibilityRole="alert" testID="builder-issues">
            {issueCount === 1
              ? 'One thing needs fixing before the course can be created.'
              : `${issueCount} things need fixing before the course can be created.`}
          </Text>
        )}

        {saveError !== null && (
          <Text variant="small" tone="danger" accessibilityRole="alert" testID="builder-error">
            {saveError}
          </Text>
        )}

        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" testID="builder-cancel" onPress={cancel} />
          <Button
            label="Create course"
            loading={saving}
            testID="create-course"
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>

      <Sheet
        visible={confirmingDiscard}
        onDismiss={() => setConfirmingDiscard(false)}
        label="Discard this course"
      >
        <Text variant="title">Discard this course?</Text>
        <Text variant="small" tone="secondary">
          Nothing has been saved yet, so everything typed here will be lost.
        </Text>
        <View style={styles.actions}>
          <Button
            label="Keep editing"
            variant="secondary"
            testID="discard-cancel"
            onPress={() => setConfirmingDiscard(false)}
          />
          <Button label="Discard" variant="danger" testID="discard-confirm" onPress={leave} />
        </View>
      </Sheet>
    </Screen>
  );
}

interface SubjectSectionProps {
  readonly subject: SubjectDraft;
  readonly index: number;
  readonly removable: boolean;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly errorFor: (key: string) => string | undefined;
  readonly edit: (change: (current: CourseDraft) => CourseDraft) => void;
}

/**
 * One subject with its chapters and their topics.
 *
 * Foldable, because a course with several subjects is otherwise a very long
 * page; folded, it still says how much is inside so nothing looks lost.
 */
function SubjectSection({
  subject,
  index,
  removable,
  collapsed,
  onToggleCollapsed,
  errorFor,
  edit,
}: SubjectSectionProps) {
  const theme = useTheme();
  const label = `Subject ${index + 1}`;
  const shownName = subject.name.trim() || label;
  const topicCount = subject.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0);

  return (
    <Card testID={`subject-${index}`}>
      <View style={styles.rowHead}>
        <Text variant="caption" tone="muted" overline style={styles.grow}>
          {label}
        </Text>
        <RowAction
          label={collapsed ? 'Show' : 'Hide'}
          accessibilityLabel={`${collapsed ? 'Show' : 'Hide'} the chapters of ${shownName}`}
          testID={`subject-${index}-toggle`}
          onPress={onToggleCollapsed}
        />
        {removable && (
          <RowAction
            label="Remove"
            accessibilityLabel={`Remove ${shownName}`}
            testID={`subject-${index}-remove`}
            onPress={() => edit((current) => removeSubject(current, subject.key))}
          />
        )}
      </View>

      <TextField
        label="Subject name"
        accessibilityLabel={`${label} name`}
        placeholder="e.g. Physics"
        value={subject.name}
        onChangeText={(name) => edit((current) => renameSubject(current, subject.key, name))}
        error={errorFor(subject.key)}
        testID={`subject-${index}-name`}
      />

      {collapsed ? (
        <Text
          variant="caption"
          tone="muted"
          style={{ marginTop: theme.spacing.sm }}
          testID={`subject-${index}-summary`}
        >
          {subject.chapters.length} {subject.chapters.length === 1 ? 'chapter' : 'chapters'} ·{' '}
          {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
        </Text>
      ) : (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
          {subject.chapters.map((chapter, c) => {
            const chapterLabel = `Chapter ${c + 1}`;
            const chapterId = `subject-${index}-chapter-${c}`;
            const chapterShown = chapter.name.trim() || chapterLabel;

            return (
              <View
                key={chapter.key}
                testID={chapterId}
                style={[
                  styles.nested,
                  { borderLeftColor: theme.colors.border, paddingLeft: theme.spacing.md },
                ]}
              >
                <View style={styles.rowHead}>
                  <Text variant="caption" tone="muted" overline style={styles.grow}>
                    {chapterLabel}
                  </Text>
                  {subject.chapters.length > 1 && (
                    <RowAction
                      label="Remove"
                      accessibilityLabel={`Remove ${chapterShown} from ${shownName}`}
                      testID={`${chapterId}-remove`}
                      onPress={() =>
                        edit((current) => removeChapter(current, subject.key, chapter.key))
                      }
                    />
                  )}
                </View>

                <TextField
                  label="Chapter name"
                  accessibilityLabel={`${chapterLabel} name in ${shownName}`}
                  placeholder="e.g. Mechanics"
                  value={chapter.name}
                  onChangeText={(name) =>
                    edit((current) => renameChapter(current, subject.key, chapter.key, name))
                  }
                  error={errorFor(chapter.key)}
                  testID={`${chapterId}-name`}
                />

                <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
                  {chapter.topics.map((topic, t) => (
                    <View key={topic.key} style={styles.topicRow}>
                      <View style={styles.grow}>
                        <TextField
                          label={`Topic ${t + 1}`}
                          accessibilityLabel={`Topic ${t + 1} in ${chapterShown}`}
                          placeholder="e.g. Newton's laws"
                          value={topic.name}
                          onChangeText={(name) =>
                            edit((current) =>
                              renameTopic(current, subject.key, chapter.key, topic.key, name),
                            )
                          }
                          error={errorFor(topic.key)}
                          testID={`${chapterId}-topic-${t}`}
                        />
                      </View>
                      {chapter.topics.length > 1 && (
                        <RowAction
                          label="Remove"
                          accessibilityLabel={`Remove topic ${t + 1} from ${chapterShown}`}
                          testID={`${chapterId}-topic-${t}-remove`}
                          onPress={() =>
                            edit((current) =>
                              removeTopic(current, subject.key, chapter.key, topic.key),
                            )
                          }
                        />
                      )}
                    </View>
                  ))}

                  <Button
                    label="+ Add topic"
                    size="small"
                    variant="ghost"
                    testID={`${chapterId}-add-topic`}
                    onPress={() => edit((current) => addTopic(current, subject.key, chapter.key))}
                  />
                </View>
              </View>
            );
          })}

          <Button
            label="+ Add chapter"
            size="small"
            variant="secondary"
            testID={`subject-${index}-add-chapter`}
            onPress={() => edit((current) => addChapter(current, subject.key))}
          />
        </View>
      )}
    </Card>
  );
}

/**
 * A small text action on a row.
 *
 * Every row has a "Remove", so the visible word alone would leave a screen
 * reader announcing a column of identical buttons; the spoken label says which.
 */
function RowAction({
  label,
  accessibilityLabel,
  testID,
  onPress,
}: {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly testID: string;
  readonly onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: theme.minTouchTarget, justifyContent: 'center' }}
    >
      <Text variant="small" tone="accent" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

/** Whether a subject, or anything inside it, has a problem filed against it. */
function subjectContains(subject: SubjectDraft, keys: ReadonlySet<string>): boolean {
  return (
    keys.has(subject.key) ||
    subject.chapters.some(
      (chapter) => keys.has(chapter.key) || chapter.topics.some((topic) => keys.has(topic.key)),
    )
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  grow: { flex: 1 },
  nested: { borderLeftWidth: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topicRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
