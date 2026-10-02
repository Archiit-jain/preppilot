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
const FLAP = '#26262D';

/** How long a falling card takes. Short enough to finish well inside a second. */
export const FLIP_MS = 380;

/**
 * One digit card. When the digit changes, the old digit's top half falls
 * forward over the new one — the "falling cards" of a split-flap clock.
 */
function FlipCard({ digit, width, height }: { digit: string; width: number; height: number }) {
  const [falling, setFalling] = useState<string | null>(null);
  const previous = useRef(digit);
  const turn = useSharedValue(1);

  useEffect(() => {
    if (previous.current === digit) return;
    setFalling(previous.current);
    previous.current = digit;
    turn.value = 0;
    turn.value = withTiming(1, { duration: FLIP_MS, easing: Easing.in(Easing.quad) });
    const done = setTimeout(() => setFalling(null), FLIP_MS + 20);
    return () => clearTimeout(done);
  }, [digit, turn]);

  const flap = useAnimatedStyle(() => ({
    transform: [{ perspective: height * 4 }, { rotateX: `${-90 * turn.value}deg` }],
  }));

  const glyph = (value: string, testID?: string) => (
    <Text
      numeric
      weight="bold"
      testID={testID}
      style={[
        styles.glyph,
        { fontSize: height * 0.72, lineHeight: height, height, color: FLIP_PALETTE.ink },
      ]}
    >
      {value}
    </Text>
  );

  return (
    <View
      style={[styles.card, { width, height, borderRadius: width * 0.14, backgroundColor: CARD }]}
    >
      {glyph(digit, 'flip-digit')}
      {/* The hinge across the middle. */}
      <View
        style={[styles.hinge, { top: height / 2 - 1, backgroundColor: FLIP_PALETTE.background }]}
      />
      {falling !== null && (
        <Animated.View
          testID="flip-falling"
          style={[
            styles.flap,
            flap,
            {
              height: height / 2,
              borderTopLeftRadius: width * 0.14,
              borderTopRightRadius: width * 0.14,
              backgroundColor: FLAP,
            },
          ]}
        >
          {glyph(falling)}
        </Animated.View>
      )}
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
  card: { overflow: 'hidden', alignItems: 'center' },
  glyph: { textAlign: 'center', alignSelf: 'stretch' },
  hinge: { position: 'absolute', left: 0, right: 0, height: 2 },
  flap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    transformOrigin: 'bottom',
  },
});
