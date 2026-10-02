import {
  faceReadout,
  TIMER_FACE_NAMES,
  TIMER_FACES,
  type TimerFace,
  type TimerState,
} from '@preppilot/shared';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, KeepScreenAwake, Text } from '../../../components/ui';
import { useAuthStore } from '../../auth/auth-store';
import { FLIP_PALETTE, FlipFace } from './faces/flip-face';
import { HOURGLASS_PALETTE, HourglassFace } from './faces/hourglass-face';
import { MINIMAL_PALETTE, MinimalFace } from './faces/minimal-face';
import { RING_PALETTE, RingFace } from './faces/ring-face';
import { TIDE_PALETTE, TideFace } from './faces/tide-face';
import type { FacePalette, FaceProps } from './faces/types';
import { WEDGE_PALETTE, WedgeFace } from './faces/wedge-face';
import { enterLandscape, leaveLandscape } from './orientation';
import { useSmoothProgress } from './smooth-progress';
import { useTimerFaceStore } from './timer-face-store';

export const FACES: Readonly<
  Record<TimerFace, { Component: ComponentType<FaceProps>; palette: FacePalette }>
> = {
  flip: { Component: FlipFace, palette: FLIP_PALETTE },
  minimal: { Component: MinimalFace, palette: MINIMAL_PALETTE },
  ring: { Component: RingFace, palette: RING_PALETTE },
  wedge: { Component: WedgeFace, palette: WEDGE_PALETTE },
  hourglass: { Component: HourglassFace, palette: HOURGLASS_PALETTE },
  tide: { Component: TideFace, palette: TIDE_PALETTE },
};

/** How long the close button and face strip stay up after a tap. */
export const CONTROLS_VISIBLE_MS = 3000;

export interface FullScreenTimerProps {
  readonly visible: boolean;
  readonly timer: TimerState;
  readonly now: number;
  /** What is being studied, shown with the controls. */
  readonly title: string;
  /** A second line: the Pomodoro phase, or how often the student left the app. */
  readonly detail?: string | null;
  readonly accent: string;
  /** Start, pause or resume — whichever the timer's state calls for. */
  readonly onToggle: () => void;
  readonly onClose: () => void;
}

/**
 * The timer, filling a landscape screen.
 *
 * The whole screen is one button: a tap starts, pauses or resumes. The close
 * button and the face strip appear for a few seconds after each tap (and stay
 * while paused), then get out of the way. Back closes it too. Closing never
 * stops the timer; it keeps running on the screen underneath.
 */
export function FullScreenTimer(props: FullScreenTimerProps) {
  if (!props.visible) return null;
  return (
    <Modal
      visible
      animationType="fade"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <FullScreenBody {...props} />
    </Modal>
  );
}

function surfaceLabel(status: TimerState['status']): string {
  switch (status) {
    case 'idle':
      return 'Start timer';
    case 'running':
      return 'Pause timer';
    case 'paused':
      return 'Resume timer';
    case 'finished':
      return 'Close full screen';
  }
}

function statusLine(status: TimerState['status']): string | null {
  switch (status) {
    case 'idle':
      return 'Tap anywhere to start';
    case 'paused':
      return 'Paused · tap anywhere to resume';
    case 'finished':
      return 'Done · tap to close';
    case 'running':
      return null;
  }
}

function FullScreenBody({
  timer,
  now,
  title,
  detail,
  accent,
  onToggle,
  onClose,
}: FullScreenTimerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const face = useTimerFaceStore((state) => state.face);
  const choose = useTimerFaceStore((state) => state.choose);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { Component, palette } = FACES[face];
  const progress = useSmoothProgress(timer, now);

  useEffect(() => {
    void enterLandscape();
    return () => {
      void leaveLandscape();
    };
  }, []);

  const [controls, setControls] = useState(true);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = useCallback(() => {
    setControls(true);
    if (hide.current !== null) clearTimeout(hide.current);
    hide.current = setTimeout(() => setControls(false), CONTROLS_VISIBLE_MS);
  }, []);
  useEffect(() => {
    reveal();
    return () => {
      if (hide.current !== null) clearTimeout(hide.current);
    };
  }, [reveal]);

  const status = timer.status;
  const showControls = controls || status !== 'running';
  const line = statusLine(status);

  const onTap = () => {
    if (status === 'finished') {
      onClose();
      return;
    }
    onToggle();
    reveal();
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]} testID="fullscreen-timer">
      <StatusBar hidden />
      <KeepScreenAwake tag="preppilot-fullscreen-timer" />

      <Pressable
        testID="fullscreen-surface"
        accessibilityRole="button"
        accessibilityLabel={surfaceLabel(status)}
        accessibilityHint="Tap anywhere on the screen"
        onPress={onTap}
        style={styles.fill}
      >
        <View style={styles.fill} pointerEvents="none">
          <View style={styles.centre}>
            <Component
              readout={faceReadout(timer, now)}
              progress={progress}
              accent={accent}
              width={width}
              height={height}
              running={status === 'running'}
            />
          </View>
        </View>
      </Pressable>

      {line !== null && (
        <View
          pointerEvents="none"
          style={[styles.status, { bottom: insets.bottom + (showControls ? 64 : 20) }]}
        >
          <Text variant="small" weight="semibold" color={palette.ink} testID="fullscreen-status">
            {line}
          </Text>
        </View>
      )}

      {showControls && (
        <>
          <View
            pointerEvents="box-none"
            style={[
              styles.top,
              { top: insets.top + 12, left: insets.left + 20, right: insets.right + 12 },
            ]}
          >
            <View style={styles.titles} pointerEvents="none">
              <Text variant="body" weight="semibold" color={palette.ink} numberOfLines={1}>
                {title}
              </Text>
              {detail !== undefined && detail !== null && (
                <Text variant="small" color={palette.muted} numberOfLines={1}>
                  {detail}
                </Text>
              )}
            </View>
            <Pressable
              testID="fullscreen-close"
              accessibilityRole="button"
              accessibilityLabel="Leave full screen"
              hitSlop={12}
              onPress={onClose}
              style={[styles.close, { borderColor: palette.muted }]}
            >
              <Icon name="close" size={20} color={palette.ink} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.strip, { bottom: insets.bottom + 10 }]}
            contentContainerStyle={[
              styles.stripContent,
              { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
            ]}
          >
            {TIMER_FACES.map((option) => {
              const active = option === face;
              return (
                <Pressable
                  key={option}
                  testID={`face-option-${option}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${TIMER_FACE_NAMES[option]} face`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void choose(option, userId);
                    reveal();
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: palette.muted,
                      backgroundColor: active ? palette.ink : 'transparent',
                    },
                  ]}
                >
                  <Text
                    variant="small"
                    weight="semibold"
                    color={active ? palette.background : palette.ink}
                  >
                    {TIMER_FACE_NAMES[option]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  top: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 12 },
  titles: { flex: 1, minWidth: 0 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: { position: 'absolute', left: 0, right: 0, flexGrow: 0 },
  stripContent: { gap: 8, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
});
