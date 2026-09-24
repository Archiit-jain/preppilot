import { summariseProposal } from '@preppilot/shared';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  Sheet,
  Text,
  TextField,
} from '../../components/ui';
import { getRepositories } from '../../db/client';
import { emptyStateCopy } from '../../constants/copy';
import { useAuthStore } from '../auth/auth-store';
import { useNetworkStore } from '../network/network-store';
import { useTrackerStore } from '../tracker/tracker-store';
import { useKeyboardOverlap } from '../../lib/use-keyboard-overlap';
import { useTheme } from '../../theme/theme-context';
import { UNAVAILABLE_COPY, unavailableReason } from './ai-client';
import {
  PICK_FAILURE_COPY,
  pickImage,
  type ImageAttachment,
  type ImageSource,
} from './attach-image';
import { RichReply } from './components/rich-reply';
import { ChatList } from './components/chat-list';
import { setSubjectContext, useAiStore, type AiMessage } from './ai-store';
import { toPlainText } from './markdown';
import { countOf } from '../../lib/plural';
import { NoteTargetPicker } from '../notes/components/note-target-picker';
import { addNote, useNotesStore, type NoteTarget } from '../notes/notes-store';

const QUICK_PROMPTS = [
  'Explain this topic simply',
  'Give me a quick insight',
  'Help me plan this week',
];

export function AiScreen() {
  const theme = useTheme();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const subjects = useTrackerStore((state) => state.subjects);
  const state = useAiStore();

  const [question, setQuestion] = useState('');
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [choosingSource, setChoosingSource] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [browsingChats, setBrowsingChats] = useState(false);
  /** The reply being kept as a note, while its topic is chosen. */
  const [keeping, setKeeping] = useState<AiMessage | null>(null);
  /** Replies already kept, so their button can say so. */
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [keepError, setKeepError] = useState<string | null>(null);
  const noteTargets = useNotesStore((store) => store.targets);
  const scrollRef = useRef<ScrollView>(null);
  const bodyRef = useRef<View>(null);
  const keyboardOverlap = useKeyboardOverlap(bodyRef);

  // Keeps the latest message in view above the keyboard as it opens.
  useEffect(() => {
    if (keyboardOverlap > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [keyboardOverlap]);

  const attach = async (source: ImageSource) => {
    setChoosingSource(false);
    setAttachError(null);

    const result = await pickImage(source);
    if (result.ok) setAttachment(result.image);
    else if (result.reason !== 'cancelled') setAttachError(PICK_FAILURE_COPY[result.reason]);
  };

  useEffect(() => {
    setSubjectContext(subjects.map((subject) => subject.name));
  }, [subjects]);

  // Saved conversations: reopens the last one, and lists the rest.
  useEffect(() => {
    if (userId !== null) void useAiStore.getState().openChats(userId, getRepositories());
  }, [userId]);

  /** "Page +" on a reply: first choose which topic the note belongs to. */
  const startKeeping = (message: AiMessage) => {
    setKeepError(null);
    setKeeping(message);
    // Always re-read: the course, or its topics, may have changed since.
    if (userId !== null) void useNotesStore.getState().load(userId, getRepositories());
  };

  const keepAsNote = async (target: NoteTarget) => {
    const message = keeping;
    setKeeping(null);
    if (message === null || userId === null) return;
    try {
      const saved = await addNote(userId, getRepositories(), {
        topicId: target.topicId,
        body: toPlainText(message.text),
        source: 'assistant',
      });
      if (saved) setKept((current) => new Set(current).add(message.id));
    } catch {
      setKeepError('We could not save that as a note. Try again.');
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();

    if ((trimmed.length === 0 && attachment === null) || state.asking) {
      return;
    }

    const image = attachment ?? undefined;
    setQuestion('');
    setAttachment(null);
    setAttachError(null);
    await state.ask(trimmed, image);

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const online = useNetworkStore((state) => state.online);
  const isGuest = useAuthStore((state) => state.isGuest);

  const unavailable = unavailableReason({ isGuest });
  const configured = unavailable === null && online;

  return (
    <Screen padded={false}>
      <View ref={bodyRef} style={[styles.fill, { paddingBottom: keyboardOverlap }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={[
            styles.messagesContent,
            {
              padding: theme.spacing.base,
              gap: theme.spacing.md,
              paddingBottom: theme.spacing.lg,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (state.messages.length > 0) {
              requestAnimationFrame(() => {
                scrollRef.current?.scrollToEnd({ animated: false });
              });
            }
          }}
        >
          <View style={[styles.header, { gap: theme.spacing.sm }]}>
            <Text variant="heading" style={styles.headerTitle}>
              Assistant
            </Text>
            <Button
              label="Chats"
              size="small"
              variant="secondary"
              icon={<Icon name="chats" size={18} color={theme.colors.textPrimary} />}
              testID="ai-open-chats"
              onPress={() => setBrowsingChats(true)}
            />
            <Button
              label="New chat"
              size="small"
              variant="secondary"
              icon={<Icon name="plus" size={18} color={theme.colors.textPrimary} />}
              disabled={state.messages.length === 0 || state.asking}
              testID="ai-new-chat"
              onPress={() => state.newChat()}
            />
          </View>

          {!configured && (
            <Card testID="ai-unavailable">
              <Text variant="small" tone="danger" accessibilityRole="alert">
                {!online
                  ? 'The assistant needs an internet connection. Everything else keeps working offline.'
                  : UNAVAILABLE_COPY[unavailable ?? 'unconfigured']}
              </Text>

              {online && (
                <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.sm }}>
                  Everything else in PrepPilot works without it.
                </Text>
              )}

              {unavailable === 'guest' && (
                <View style={{ marginTop: theme.spacing.base }}>
                  <Button
                    label="Sign in"
                    testID="ai-sign-in"
                    onPress={() => router.push('/login')}
                  />
                </View>
              )}
            </Card>
          )}

          {state.messages.length === 0 && (
            <EmptyState title={emptyStateCopy.ai.title} testID="ai-empty" />
          )}

          {state.messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                {
                  alignSelf: message.role === 'student' ? 'flex-end' : 'flex-start',
                  backgroundColor:
                    message.role === 'student' ? theme.colors.accent : theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.md,
                },
              ]}
            >
              {message.imageUri !== undefined && (
                <Image
                  source={{ uri: message.imageUri }}
                  accessibilityLabel="Attached picture"
                  style={[
                    styles.sentImage,
                    {
                      borderRadius: theme.radius.md,
                      marginBottom: message.text.length > 0 ? theme.spacing.sm : 0,
                    },
                  ]}
                />
              )}

              {message.imageElsewhere === true && (
                <Text
                  variant="caption"
                  color={theme.colors.textOnAccent}
                  style={{ marginBottom: theme.spacing.xs }}
                >
                  Picture sent from another device
                </Text>
              )}

              {message.role === 'assistant' ? (
                <RichReply source={message.text} />
              ) : (
                message.text.length > 0 && (
                  <Text variant="body" color={theme.colors.textOnAccent}>
                    {message.text}
                  </Text>
                )
              )}

              {message.role === 'assistant' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={kept.has(message.id) ? 'Saved as a note' : 'Add as note'}
                  accessibilityState={{ disabled: kept.has(message.id) }}
                  disabled={kept.has(message.id)}
                  hitSlop={8}
                  testID={`ai-keep-${message.id}`}
                  onPress={() => startKeeping(message)}
                  style={[styles.keep, { marginTop: theme.spacing.sm, gap: theme.spacing.xxs }]}
                >
                  <Icon
                    name="notePlus"
                    size={18}
                    color={kept.has(message.id) ? theme.colors.success : theme.colors.accent}
                  />
                  <Text variant="caption" tone={kept.has(message.id) ? 'success' : 'accent'}>
                    {kept.has(message.id) ? 'Saved to notes' : 'Add as note'}
                  </Text>
                </Pressable>
              )}

              {message.proposal !== null && (
                <View style={{ marginTop: theme.spacing.md }}>
                  <Text variant="caption" tone="muted">
                    This would add{' '}
                    {countOf(summariseProposal(message.proposal).chapters, 'chapter')} and{' '}
                    {countOf(summariseProposal(message.proposal).topics, 'topic')} to{' '}
                    {message.proposal.subjectName}.
                  </Text>

                  <View style={{ marginTop: theme.spacing.sm }}>
                    <Button
                      label="Review suggestion"
                      size="small"
                      onPress={() => state.reviewProposal(message.proposal!)}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}

          {state.asking && (
            <Text variant="small" tone="muted" testID="ai-thinking">
              Thinking…
            </Text>
          )}

          {keepError !== null && (
            <Text variant="small" tone="danger" accessibilityRole="alert">
              {keepError}
            </Text>
          )}

          {state.error !== null && (
            <Card testID="ai-error">
              <Text variant="small" tone="danger" accessibilityRole="alert">
                {state.error}
              </Text>

              <View style={{ marginTop: theme.spacing.sm }}>
                <Button label="Dismiss" variant="ghost" size="small" onPress={state.clearError} />
              </View>
            </Card>
          )}
        </ScrollView>

        {configured && state.messages.length === 0 && (
          <View
            style={[
              styles.prompts,
              {
                paddingHorizontal: theme.spacing.base,
                gap: theme.spacing.sm,
              },
            ]}
          >
            {QUICK_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                label={prompt}
                size="small"
                variant="secondary"
                onPress={() => void send(prompt)}
              />
            ))}
          </View>
        )}

        {(attachment !== null || attachError !== null) && (
          <View
            testID="ai-attachment"
            style={[
              styles.attachment,
              {
                paddingHorizontal: theme.spacing.base,
                paddingTop: theme.spacing.sm,
                gap: theme.spacing.md,
              },
            ]}
          >
            {attachment !== null ? (
              <>
                <Image
                  source={{ uri: attachment.uri }}
                  accessibilityLabel="Picture to send"
                  style={[styles.thumbnail, { borderRadius: theme.radius.md }]}
                />
                <Text variant="small" tone="secondary" style={styles.attachmentText}>
                  The assistant will read this picture with your question.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove picture"
                  testID="ai-remove-image"
                  hitSlop={8}
                  onPress={() => setAttachment(null)}
                  style={styles.iconButton}
                >
                  <Icon name="close" size={20} />
                </Pressable>
              </>
            ) : (
              <Text
                variant="small"
                tone="danger"
                accessibilityRole="alert"
                style={styles.attachmentText}
              >
                {attachError}
              </Text>
            )}
          </View>
        )}

        <View
          style={[
            styles.composer,
            {
              padding: theme.spacing.base,
              borderTopColor: theme.colors.border,
              gap: theme.spacing.sm,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach a picture"
            accessibilityState={{ disabled: !configured || state.asking }}
            testID="ai-attach"
            disabled={!configured || state.asking}
            onPress={() => setChoosingSource(true)}
            style={[
              styles.iconButton,
              styles.attachButton,
              {
                width: theme.minTouchTarget,
                height: theme.minTouchTarget,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceElevated,
                opacity: !configured || state.asking ? 0.5 : 1,
              },
            ]}
          >
            <Icon name="image" color={theme.colors.accent} />
          </Pressable>

          <View style={styles.field}>
            <TextField
              label="Ask a question"
              value={question}
              onChangeText={setQuestion}
              placeholder={
                attachment !== null
                  ? 'Ask about the picture (optional)'
                  : 'e.g. Explain polynomials'
              }
              editable={configured && !state.asking}
              onFocus={() => {
                requestAnimationFrame(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                });
              }}
              onSubmitEditing={() => void send(question)}
              returnKeyType="send"
              blurOnSubmit={false}
            />
          </View>

          <Button
            label="Ask"
            loading={state.asking}
            disabled={
              !configured || state.asking || (question.trim().length === 0 && attachment === null)
            }
            onPress={() => void send(question)}
          />
        </View>
      </View>

      <Sheet
        visible={choosingSource}
        onDismiss={() => setChoosingSource(false)}
        label="Attach a picture"
        testID="ai-image-source"
      >
        <Text variant="title">Attach a picture</Text>
        <Text variant="small" tone="secondary">
          A page, a diagram or a question from your notes. The assistant reads the text in it.
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Take photo" fullWidth onPress={() => void attach('camera')} />
          <Button
            label="Choose from gallery"
            variant="secondary"
            fullWidth
            onPress={() => void attach('library')}
          />
          <Button
            label="Cancel"
            variant="ghost"
            fullWidth
            onPress={() => setChoosingSource(false)}
          />
        </View>
      </Sheet>

      <ChatList
        visible={browsingChats}
        threads={state.threads}
        currentId={state.threadId}
        onOpen={(threadId) => {
          setBrowsingChats(false);
          void state.openThread(threadId);
        }}
        onDelete={(threadId) => void state.deleteThread(threadId)}
        onNew={() => {
          setBrowsingChats(false);
          state.newChat();
        }}
        onDismiss={() => setBrowsingChats(false)}
      />

      <NoteTargetPicker
        visible={keeping !== null}
        title="Which topic is this note for?"
        targets={noteTargets}
        onPick={(target) => void keepAsNote(target)}
        onDismiss={() => setKeeping(null)}
      />

      <ProposalReview userId={userId} />
    </Screen>
  );
}

function ProposalReview({ userId }: { readonly userId: string | null }) {
  const theme = useTheme();
  const state = useAiStore();
  const proposal = state.pendingProposal;

  if (proposal === null) return null;

  const summary = summariseProposal(proposal);

  return (
    <Sheet
      visible
      onDismiss={state.dismissProposal}
      label="Add this to your tracker?"
      testID="proposal-review"
    >
      <Text variant="title">Add this to your tracker?</Text>

      <Text variant="small" tone="secondary">
        {countOf(summary.chapters, 'chapter')} and {countOf(summary.topics, 'topic')} would be added
        to {proposal.subjectName}. Nothing is changed until you confirm, and you can edit or delete
        any of it afterwards.
      </Text>

      <ScrollView style={styles.preview} showsVerticalScrollIndicator={false}>
        {proposal.chapters.map((chapter) => (
          <View key={chapter.name} style={{ marginBottom: theme.spacing.sm }}>
            <Text variant="body" weight="medium">
              {chapter.name}
            </Text>

            {chapter.topics.map((topic) => (
              <Text
                key={topic}
                variant="caption"
                tone="muted"
                style={{ marginLeft: theme.spacing.md }}
              >
                {topic}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Button label="No thanks" variant="ghost" onPress={state.dismissProposal} />

        <Button
          label="Add to tracker"
          loading={state.applying}
          onPress={() => {
            if (userId !== null) {
              void state.applyProposal(userId, getRepositories());
            }
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },

  messages: {
    flex: 1,
    minHeight: 0,
  },

  messagesContent: {
    flexGrow: 1,
  },

  bubble: {
    maxWidth: '85%',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    flex: 1,
  },

  keep: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },

  sentImage: {
    width: 200,
    height: 200,
  },

  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  thumbnail: {
    width: 56,
    height: 56,
  },

  attachmentText: {
    flex: 1,
  },

  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  attachButton: {
    borderWidth: 1,
  },

  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  field: {
    flex: 1,
    minWidth: 0,
  },

  preview: {
    maxHeight: 200,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
