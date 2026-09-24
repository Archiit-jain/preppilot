import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../components/ui';
import type { NoteRow } from '../../../db/schema';
import { useTheme } from '../../../theme/theme-context';

/** How many notes show under a topic before the rest are left to the Notes tab. */
export const NOTES_SHOWN = 2;

export interface NotePreviewsProps {
  /** Newest first. */
  readonly notes: readonly NoteRow[];
  /** The topic or sub-topic, for the accessibility labels. */
  readonly name: string;
  readonly accent: string;
  readonly onEdit: (noteId: string, current: string) => void;
}

/**
 * The newest notes on a topic, under its row.
 *
 * Two, and a link to the rest: a topic can carry any number of notes, and a
 * syllabus row that grows by a paragraph per note stops being a syllabus. Each
 * preview opens its note for editing.
 */
export function NotePreviews({ notes, name, accent, onEdit }: NotePreviewsProps) {
  const theme = useTheme();
  if (notes.length === 0) return null;

  const hidden = notes.length - NOTES_SHOWN;
  return (
    <>
      {notes.slice(0, NOTES_SHOWN).map((note) => (
        <Pressable
          key={note.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit note on ${name}`}
          testID={`note-preview-${note.id}`}
          onPress={() => onEdit(note.id, note.body)}
          hitSlop={4}
          style={[
            styles.note,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
              marginBottom: theme.spacing.xs,
              borderLeftColor: accent,
            },
          ]}
        >
          <Text variant="caption" tone="secondary" numberOfLines={3}>
            {note.body}
          </Text>
        </Pressable>
      ))}
      {hidden > 0 && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`See all ${notes.length} notes on ${name}`}
          onPress={() => router.push('/notes')}
          hitSlop={6}
          style={{ marginBottom: theme.spacing.xs }}
        >
          <Text variant="caption" tone="accent">
            +{hidden} more {hidden === 1 ? 'note' : 'notes'} in Notes
          </Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  note: {
    borderLeftWidth: 3,
  },
});
