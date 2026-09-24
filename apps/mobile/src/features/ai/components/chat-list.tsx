import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, PressableScale, Sheet, Text } from '../../../components/ui';
import type { ChatThreadRow } from '../../../db/schema';
import { useTheme } from '../../../theme/theme-context';

const when = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export interface ChatListProps {
  readonly visible: boolean;
  /** Most recently used first. */
  readonly threads: readonly ChatThreadRow[];
  readonly currentId: string | null;
  readonly onOpen: (threadId: string) => void;
  readonly onDelete: (threadId: string) => void;
  readonly onNew: () => void;
  readonly onDismiss: () => void;
}

/**
 * Past conversations with the assistant.
 *
 * Deleting asks first, in place: a conversation can hold an answer the student
 * meant to come back to, and it is gone from every device once deleted.
 */
export function ChatList({
  visible,
  threads,
  currentId,
  onOpen,
  onDelete,
  onNew,
  onDismiss,
}: ChatListProps) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <Sheet visible={visible} onDismiss={onDismiss} label="Your chats" testID="chat-list">
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        <Text variant="title" style={styles.title}>
          Your chats
        </Text>
        <Button label="New chat" size="small" testID="chat-list-new" onPress={onNew} />
      </View>

      {threads.length === 0 ? (
        <Text variant="small" tone="secondary" testID="chat-list-empty">
          Conversations you have with the assistant are saved here.
        </Text>
      ) : (
        <ScrollView style={styles.list}>
          <View style={{ gap: theme.spacing.xs }}>
            {threads.map((thread) =>
              confirming === thread.id ? (
                <View
                  key={thread.id}
                  style={[
                    styles.confirm,
                    {
                      backgroundColor: theme.colors.surfaceElevated,
                      borderRadius: theme.radius.md,
                      padding: theme.spacing.sm,
                      gap: theme.spacing.sm,
                    },
                  ]}
                >
                  <Text variant="small" style={styles.title}>
                    Delete “{thread.title}”?
                  </Text>
                  <Button
                    label="Keep"
                    size="small"
                    variant="ghost"
                    onPress={() => setConfirming(null)}
                  />
                  <Button
                    label="Delete"
                    size="small"
                    variant="danger"
                    testID={`chat-delete-confirm-${thread.id}`}
                    onPress={() => {
                      setConfirming(null);
                      onDelete(thread.id);
                    }}
                  />
                </View>
              ) : (
                <View key={thread.id} style={[styles.row, { gap: theme.spacing.xs }]}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat: ${thread.title}`}
                    accessibilityState={{ selected: thread.id === currentId }}
                    testID={`chat-open-${thread.id}`}
                    onPress={() => onOpen(thread.id)}
                    style={[
                      styles.open,
                      {
                        backgroundColor:
                          thread.id === currentId
                            ? theme.colors.surfaceElevated
                            : theme.colors.surface,
                        borderColor:
                          thread.id === currentId ? theme.colors.accent : theme.colors.border,
                        borderRadius: theme.radius.md,
                        padding: theme.spacing.sm,
                      },
                    ]}
                  >
                    <Text variant="small" weight="semibold" numberOfLines={1}>
                      {thread.title}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {when.format(new Date(thread.updatedAt))}
                    </Text>
                  </PressableScale>
                  <Button
                    label="Delete"
                    size="small"
                    variant="ghost"
                    testID={`chat-delete-${thread.id}`}
                    onPress={() => setConfirming(thread.id)}
                  />
                </View>
              ),
            )}
          </View>
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  list: { maxHeight: 380 },
  row: { flexDirection: 'row', alignItems: 'center' },
  open: { flex: 1, borderWidth: 1 },
  confirm: { flexDirection: 'row', alignItems: 'center' },
});
