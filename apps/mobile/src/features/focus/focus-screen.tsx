import {
  addFocusPreset,
  DEFAULT_FOCUS_SETTINGS,
  FOCUS_LIMITS,
  formatClock,
  formatHoursMinutes,
  MAX_FOCUS_PRESETS,
  parseFocusSettings,
  remainingSeconds,
  removeFocusPreset,
  serialiseFocusSettings,
  toFocusMinutes,
  type FocusAlert,
  type FocusSettings,
} from '@preppilot/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Checkbox,
  Icon,
  KeepScreenAwake,
  Screen,
  StatChip,
  Text,
  TextField,
} from '../../components/ui';
import { getRepositories } from '../../db/client';
import { useTheme } from '../../theme/theme-context';
import { useAuthStore } from '../auth/auth-store';
import { Stepper } from '../timer/components/stepper';
import { FullScreenTimer } from '../timer/fullscreen/fullscreen-timer';
import { useTimerFaceStore } from '../timer/fullscreen/timer-face-store';
import { focusCapabilities } from './capabilities';
import { focusNow, useFocusStore, watchForDistractions } from './focus-store';

/** Where a student's Focus Mode choices are kept, per device. */
export const FOCUS_PREFERENCE = 'focus.settings';

const ALERT_CHOICES: readonly { readonly value: FocusAlert; readonly label: string }[] = [
  { value: 'both', label: 'Sound and vibration' },
  { value: 'sound', label: 'Sound' },
  { value: 'vibrate', label: 'Vibration' },
  { value: 'silent', label: 'Silent' },
];

/**
 * Focus Mode (PRD §17).
 *
 * Deliberately modest about what it does. Android does not let one app block
 * another, so this does not pretend to: it gives a distraction-free screen,
 * keeps PrepPilot quiet, and counts the times the student leaves. The
 * capabilities panel states plainly what is not possible, which §17 requires.
 *
 * The length, the presets, how the end is announced and whether the screen
 * stays on are the student's to choose, and are remembered on this device.
 */
export function FocusScreen() {
  const theme = useTheme();
  const state = useFocusStore();
  const userId = useAuthStore((auth) => auth.user?.id ?? null);
  const [settings, setSettings] = useState<FocusSettings>(DEFAULT_FOCUS_SETTINGS);
  const [now, setNow] = useState(() => focusNow());
  const [fullScreen, setFullScreen] = useState(false);
  const loadFace = useTimerFaceStore((faces) => faces.load);

  const status = state.timer?.status;
  const running = status === 'running';
  const active = running || status === 'paused';

  useEffect(() => {
    void loadFace(userId);
    if (userId === null) return;
    void (async () => {
      try {
        const stored = await getRepositories().preferences.get(userId, FOCUS_PREFERENCE);
        setSettings(parseFocusSettings(stored));
      } catch {
        // Unreadable settings are not worth an error; the defaults are sound.
      }
    })();
  }, [userId, loadFace]);

  const save = (next: FocusSettings) => {
    setSettings(next);
    if (userId === null) return;
    try {
      void getRepositories()
        .preferences.set(userId, FOCUS_PREFERENCE, serialiseFocusSettings(next))
        .catch(() => undefined);
    } catch {
      // The choice applies now; only remembering it failed.
    }
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(focusNow()), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    return watchForDistractions();
  }, [running]);

  // A finished countdown must stop recording, or the session keeps banking time
  // the student is no longer spending.
  const end = state.end;
  useEffect(() => {
    if (state.timer === null || !running) return;
    if (remainingSeconds(state.timer, now) === 0) void end();
  }, [state.timer, now, running, end]);

  const toggle = () => {
    setNow(focusNow());
    if (running) void state.pause();
    else void state.resume();
  };

  if (active && state.timer !== null) {
    return (
      <>
        {/* Only while a session is on, and only if the student wants it. */}
        {settings.keepAwake && <KeepScreenAwake tag="preppilot-focus" />}
        <RunningSession now={now} onFullScreen={() => setFullScreen(true)} onToggle={toggle} />
        <FullScreenTimer
          visible={fullScreen}
          timer={state.timer}
          now={now}
          title={state.subjectName ?? 'Focus session'}
          detail={
            state.timesLeft > 0
              ? `Left PrepPilot ${state.timesLeft} ${state.timesLeft === 1 ? 'time' : 'times'}`
              : null
          }
          accent={theme.colors.accent}
          onToggle={toggle}
          onClose={() => setFullScreen(false)}
        />
      </>
    );
  }

  if (status === 'finished') {
    return <SessionSummary />;
  }

  return (
    <FocusSetup
      settings={settings}
      onChange={save}
      onStart={() => {
        setNow(focusNow());
        void state.begin({ minutes: settings.minutes, alert: settings.alert });
      }}
    />
  );
}

interface SetupProps {
  readonly settings: FocusSettings;
  readonly onChange: (next: FocusSettings) => void;
  readonly onStart: () => void;
}

function FocusSetup({ settings, onChange, onStart }: SetupProps) {
  const theme = useTheme();
  const error = useFocusStore((focus) => focus.error);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | null>(null);
  const minutes = settings.minutes;
  const isPreset = settings.presets.includes(minutes);
  const presetsFull = settings.presets.length >= MAX_FOCUS_PRESETS;

  const choose = (next: number) => onChange({ ...settings, minutes: next });

  const applyTyped = () => {
    if (typed.trim().length === 0) return;
    const value = toFocusMinutes(typed);
    if (value === null) {
      setTypedError(`Enter a whole number from ${FOCUS_LIMITS.min} to ${FOCUS_LIMITS.max}.`);
      return;
    }
    setTypedError(null);
    setTyped('');
    choose(value);
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.base, gap: theme.spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="heading">Focus Mode</Text>
        <Text variant="body" tone="secondary">
          A single screen, no PrepPilot interruptions, for as long as you choose.
        </Text>

        {error !== null && (
          <Card>
            <Text variant="small" tone="danger" accessibilityRole="alert">
              {error}
            </Text>
          </Card>
        )}

        <Card>
          <Text variant="caption" tone="muted" overline>
            How Long
          </Text>
          {settings.presets.length > 0 && (
            <View style={[styles.options, { marginTop: theme.spacing.md }]}>
              {settings.presets.map((option) => (
                <Button
                  key={option}
                  label={`${option} min`}
                  size="small"
                  variant={option === minutes ? 'primary' : 'secondary'}
                  selected={option === minutes}
                  onPress={() => choose(option)}
                />
              ))}
            </View>
          )}

          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
            <Stepper
              label="Length"
              value={minutes}
              min={FOCUS_LIMITS.min}
              max={FOCUS_LIMITS.max}
              step={5}
              unit=" min"
              testID="focus-length"
              onChange={choose}
            />
            <TextField
              label="Or type an exact length (minutes)"
              value={typed}
              onChangeText={(text) => {
                setTyped(text);
                setTypedError(null);
              }}
              onSubmitEditing={applyTyped}
              onBlur={applyTyped}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder={`${FOCUS_LIMITS.min}–${FOCUS_LIMITS.max}`}
              {...(typedError === null ? {} : { error: typedError })}
            />
            {isPreset ? (
              <Button
                label={`Remove ${minutes} min preset`}
                size="small"
                variant="ghost"
                testID="focus-remove-preset"
                onPress={() => onChange(removeFocusPreset(settings, minutes))}
              />
            ) : presetsFull ? (
              <Text variant="caption" tone="muted" testID="focus-presets-full">
                You have {MAX_FOCUS_PRESETS} presets. Remove one to save {minutes} min.
              </Text>
            ) : (
              <Button
                label={`Save ${minutes} min as a preset`}
                size="small"
                variant="ghost"
                testID="focus-save-preset"
                onPress={() => onChange(addFocusPreset(settings, minutes))}
              />
            )}
          </View>
        </Card>

        <Card>
          <Text variant="caption" tone="muted" overline>
            When Time Is Up
          </Text>
          <View style={[styles.options, { marginTop: theme.spacing.md }]}>
            {ALERT_CHOICES.map((choice) => (
              <Button
                key={choice.value}
                label={choice.label}
                size="small"
                variant={choice.value === settings.alert ? 'primary' : 'secondary'}
                selected={choice.value === settings.alert}
                testID={`focus-alert-${choice.value}`}
                onPress={() => onChange({ ...settings, alert: choice.value })}
              />
            ))}
          </View>
          {settings.alert === 'vibrate' && (
            <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.sm }}>
              Vibration only works while PrepPilot is open. Choose a sound to be told with the phone
              locked.
            </Text>
          )}

          <View style={[styles.capability, { marginTop: theme.spacing.lg, alignItems: 'center' }]}>
            <Checkbox
              checked={settings.keepAwake}
              label="Keep the screen on during a session"
              onToggle={(keepAwake) => onChange({ ...settings, keepAwake })}
            />
            <Text variant="body" style={styles.capabilityText}>
              Keep the screen on during a session
            </Text>
          </View>
        </Card>

        <Button label="Start focus session" fullWidth onPress={onStart} />

        <Card>
          <Text variant="caption" tone="muted" overline>
            What This Does
          </Text>
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
            {focusCapabilities().map((capability) => (
              <View key={capability.id} style={styles.capability}>
                <Text
                  variant="body"
                  // The tick and cross carry the meaning; colour only reinforces
                  // it, so the list stays readable without colour perception.
                  color={capability.supported ? theme.colors.success : theme.colors.textMuted}
                  accessibilityLabel={capability.supported ? 'Supported' : 'Not supported'}
                >
                  {capability.supported ? '✓' : '✗'}
                </Text>
                <View style={styles.capabilityText}>
                  <Text variant="body">{capability.label}</Text>
                  <Text variant="caption" tone="muted">
                    {capability.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

interface RunningProps {
  readonly now: number;
  readonly onToggle: () => void;
  readonly onFullScreen: () => void;
}

function RunningSession({ now, onToggle, onFullScreen }: RunningProps) {
  const theme = useTheme();
  const state = useFocusStore();
  const remaining = remainingSeconds(state.timer!, now) ?? 0;
  const paused = state.timer?.status === 'paused';

  return (
    <Screen>
      <View style={styles.running}>
        <Text variant="small" tone="muted">
          {state.subjectName ?? 'Focus session'}
          {paused ? ' · paused' : ''}
        </Text>

        <Text
          variant="display"
          weight="semibold"
          numeric
          testID="focus-readout"
          style={[styles.clock, { fontSize: 64, marginVertical: theme.spacing.xl }]}
          accessibilityLabel={`${formatClock(remaining)} remaining`}
        >
          {formatClock(remaining)}
        </Text>

        {state.timesLeft > 0 && (
          <Text variant="small" tone="muted" testID="focus-distractions">
            You have left PrepPilot {state.timesLeft} {state.timesLeft === 1 ? 'time' : 'times'}
          </Text>
        )}

        <View style={[styles.options, { marginTop: theme.spacing.xxl, justifyContent: 'center' }]}>
          <Button label={paused ? 'Resume' : 'Pause'} onPress={onToggle} />
          <Button
            label="Full screen"
            variant="secondary"
            icon={<Icon name="expand" size={18} color={theme.colors.textPrimary} />}
            testID="focus-fullscreen"
            onPress={onFullScreen}
          />
          <Button label="End session" variant="secondary" onPress={() => void state.end()} />
        </View>
      </View>
    </Screen>
  );
}

function SessionSummary() {
  const theme = useTheme();
  const state = useFocusStore();

  return (
    <Screen>
      <View style={[styles.running, { gap: theme.spacing.base }]}>
        <Text variant="heading">Session finished</Text>

        <View style={[styles.options, { justifyContent: 'center' }]}>
          <StatChip
            label="Focused for"
            value={formatHoursMinutes(state.lastSessionSeconds ?? 0)}
            testID="focus-summary-time"
          />
          <StatChip
            label="Times you left"
            value={String(state.timesLeft)}
            testID="focus-summary-left"
          />
        </View>

        <View style={[styles.options, { marginTop: theme.spacing.lg }]}>
          <Button label="Start another" onPress={state.reset} />
          <Button label="Back to tracker" variant="ghost" onPress={() => router.push('/')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  capability: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  capabilityText: { flex: 1 },
  running: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clock: { fontVariant: ['tabular-nums'] },
});
