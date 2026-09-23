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
import { setSubjectContext, useAiStore } from './ai-store';

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
          <Text variant="heading">Assistant</Text>

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

              {message.role === 'assistant' ? (
                <RichReply source={message.text} />
              ) : (
                message.text.length > 0 && (
                  <Text variant="body" color={theme.colors.textOnAccent}>
                    {message.text}
                  </Text>
                )
              )}

              {message.proposal !== null && (
                <View style={{ marginTop: theme.spacing.md }}>
                  <Text variant="caption" tone="muted">
                    This would add {summariseProposal(message.proposal).chapters} chapters and{' '}
                    {summariseProposal(message.proposal).topics} topics to{' '}
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
        {summary.chapters} chapters and {summary.topics} topics would be added to{' '}
        {proposal.subjectName}. Nothing is changed until you confirm, and you can edit or delete any
        of it afterwards.
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
