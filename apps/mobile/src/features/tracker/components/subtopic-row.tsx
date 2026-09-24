import { StyleSheet, View } from 'react-native';
import { Checkbox, Text } from '../../../components/ui';
import type { NoteRow, SubtopicRow as SubtopicRecord } from '../../../db/schema';
import { useTheme } from '../../../theme/theme-context';
import { NotePreviews } from './note-previews';
import { RowMenu, type RowMenuAction } from './row-menu';

export interface SubtopicRowProps {
  readonly subtopic: SubtopicRecord;
  readonly accent: string;
  readonly onToggle: (subtopicId: string) => void;
  readonly onRename: (subtopicId: string, current: string) => void;
  readonly onDelete: (subtopicId: string) => void;
  readonly onMove: (subtopicId: string, direction: 'up' | 'down') => void;
  /** This sub-topic's notes, newest first. */
  readonly notes: readonly NoteRow[];
  readonly onAddNote: (subtopicId: string) => void;
  readonly onEditNote: (noteId: string, current: string) => void;
  readonly onSummarise: (subtopicId: string) => void;
  readonly onTestMe: (subtopicId: string) => void;
  readonly busy?: boolean;
}

export function SubtopicRow({
  subtopic,
  accent,
  onToggle,
  onRename,
  onDelete,
  onMove,
  notes,
  onAddNote,
  onEditNote,
  onSummarise,
  onTestMe,
  busy = false,
}: SubtopicRowProps) {
  const theme = useTheme();

  const actions: RowMenuAction[] = [
    { label: 'Rename sub-topic', onPress: () => onRename(subtopic.id, subtopic.name) },
    { label: 'Summarise', onPress: () => onSummarise(subtopic.id) },
    { label: 'Test me on this', onPress: () => onTestMe(subtopic.id) },
    { label: 'Add note', onPress: () => onAddNote(subtopic.id) },
    { label: 'Move up', onPress: () => onMove(subtopic.id, 'up') },
    { label: 'Move down', onPress: () => onMove(subtopic.id, 'down') },
    { label: 'Delete sub-topic', destructive: true, onPress: () => onDelete(subtopic.id) },
  ];

  return (
    <View testID={`subtopic-${subtopic.id}`}>
      <View
        style={[
          styles.row,
          {
            paddingVertical: theme.spacing.xs,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Checkbox
          checked={subtopic.completed}
          onToggle={() => onToggle(subtopic.id)}
          label={subtopic.name}
          color={accent}
          size={20}
        />

        <Text variant="small" tone={subtopic.completed ? 'muted' : 'secondary'} style={styles.name}>
          {subtopic.name}
        </Text>

        <RowMenu actions={actions} label={subtopic.name} />
      </View>

      {busy && (
        <Text variant="caption" tone="accent" testID={`subtopic-busy-${subtopic.id}`}>
          Asking the assistant…
        </Text>
      )}

      <View style={styles.notes}>
        <NotePreviews notes={notes} name={subtopic.name} accent={accent} onEdit={onEditNote} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  name: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },

  notes: {
    marginLeft: 28,
  },
});
