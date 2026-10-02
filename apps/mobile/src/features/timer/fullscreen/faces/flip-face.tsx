import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '../../../../components/ui';
import type { FacePalette, FaceProps } from './types';

export const FLIP_PALETTE: FacePalette = {
  background: '#0E0E10',
  ink: '#F2F2F2',
  muted: '#8A8A94',
};

const CARD = '#1D1D22';
const FLAP_TOP = '#23232A';
const FLAP_BOTTOM = '#19191E';

/** How long one flip takes. Well inside a second, so seconds never queue up. */
export const FLIP_MS = 520;

interface HalfProps {
  readonly digit: string;
  readonly half: 'top' | 'bottom';
  readonly width: number;
  readonly height: number;
  readonly colour: string;
}

/** One half of a card: the full digit drawn and clipped to the top or bottom. */
function Half({ digit, half, width, height, colour }: HalfProps) {
  const radius = width * 0.14;
  return (
    <View
      style={[
        styles.half,
        {
          height: height / 2,
          backgroundColor: colour,
          ...(half === 'top'
            ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
            : { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }),
        },
      ]}
    >
      <Text
        numeric
        weight="bold"
        style={[
          styles.glyph,
          {
            top: half === 'top' ? 0 : -height / 2,
            height,
            fontSize: height * 0.72,
            lineHeight: height,
            color: FLIP_PALETTE.ink,
          },
        ]}
      >
        {digit}
      </Text>
    </View>
  );
}

/**
 * One split-flap card, as the real thing works: the new digit's top half is
 * revealed at once; the old top half falls forward over the old bottom half;
 * at the halfway point it becomes the flap carrying the new bottom half, which
 * swings down and lands. Only then does the bottom show the new digit.
 */
function FlipCard({ digit, width, height }: { digit: string; width: number; height: number }) {
  const [old, setOld] = useState<string | null>(null);
  const [bottom, setBottom] = useState(digit);
  const previous = useRef(digit);
  const turn = useSharedValue(1);

  useEffect(() => {
    if (previous.current === digit) return;
    setOld(previous.current);
    previous.current = digit;
    turn.value = 0;
    turn.value = withTiming(1, { duration: FLIP_MS, easing: Easing.inOut(Easing.quad) });
    const landed = setTimeout(() => {
      setBottom(digit);
      setOld(null);
    }, FLIP_MS);
    return () => clearTimeout(landed);
  }, [digit, turn]);

  const perspective = height * 3;
  const falling = useAnimatedStyle(() => ({
    opacity: turn.value < 0.5 ? 1 : 0,
    transform: [{ perspective }, { rotateX: `${-180 * Math.min(turn.value, 0.5)}deg` }],
  }));
  const landing = useAnimatedStyle(() => ({
    opacity: turn.value >= 0.5 ? 1 : 0,
    transform: [{ perspective }, { rotateX: `${180 * (1 - Math.max(turn.value, 0.5))}deg` }],
  }));

  return (
    <View style={{ width, height }}>
      <View style={styles.stack}>
        <Half digit={digit} half="top" width={width} height={height} colour={CARD} />
        <Half digit={bottom} half="bottom" width={width} height={height} colour={CARD} />
      </View>
      {old !== null && (
        <>
          <Animated.View
            testID="flip-flap"
            style={[styles.flapTop, { height: height / 2 }, falling]}
          >
            <Half digit={old} half="top" width={width} height={height} colour={FLAP_TOP} />
          </Animated.View>
          <Animated.View
            testID="flip-flap"
            style={[styles.flapBottom, { top: height / 2, height: height / 2 }, landing]}
          >
            <Half digit={digit} half="bottom" width={width} height={height} colour={FLAP_BOTTOM} />
          </Animated.View>
        </>
      )}
      {/* The hinge across the middle. */}
      <View
        pointerEvents="none"
        style={[styles.hinge, { top: height / 2 - 1, backgroundColor: FLIP_PALETTE.background }]}
      />
      <Text testID="flip-digit" style={styles.hidden}>
        {digit}
      </Text>
    </View>
  );
}

export function FlipFace({ readout, width, height }: FaceProps) {
  const digits = readout.groups.join('').length;
  const colons = readout.groups.length - 1;
  const cardWidth = Math.min(height * 0.4, (width * 0.86) / (digits * 1.1 + colons * 0.45));
  const cardHeight = cardWidth * 1.42;

  return (
    <View style={styles.row} testID="face-flip">
      {readout.groups.map((group, index) => (
        <View key={index} style={styles.row}>
          {index > 0 && (
            <Text
              weight="bold"
              style={{
                fontSize: cardHeight * 0.5,
                lineHeight: cardHeight,
                width: cardWidth * 0.45,
                textAlign: 'center',
                color: FLIP_PALETTE.muted,
              }}
            >
              :
            </Text>
          )}
          {[...group].map((digit, place) => (
            <View key={place} style={{ marginHorizontal: cardWidth * 0.05 }}>
              <FlipCard digit={digit} width={cardWidth} height={cardHeight} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stack: { flex: 1 },
  half: { overflow: 'hidden', alignSelf: 'stretch' },
  glyph: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  flapTop: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: 'bottom' },
  flapBottom: { position: 'absolute', left: 0, right: 0, transformOrigin: 'top' },
  hinge: { position: 'absolute', left: 0, right: 0, height: 2 },
  // The digit as text for tests and screen readers; the halves draw it.
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
