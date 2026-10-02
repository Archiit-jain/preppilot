import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../../../components/ui';
import type { FacePalette, FaceProps } from './types';

export const TIDE_PALETTE: FacePalette = {
  background: '#0A2540',
  ink: '#FFFFFF',
  muted: '#A9C3E0',
};

const FRONT = '#1E6FD9';
const BACK = '#174E96';
const WAVE_HEIGHT = 18;

/** One wavelength repeated across twice the screen, so it can slide by one screen. */
function wavePath(width: number): string {
  const length = width / 3;
  let d = `M 0 ${WAVE_HEIGHT / 2}`;
  for (let x = 0; x < width * 2; x += length) {
    d += ` q ${length / 4} ${-WAVE_HEIGHT / 2} ${length / 2} 0 t ${length / 2} 0`;
  }
  return `${d} V ${WAVE_HEIGHT} H 0 Z`;
}

function Wave({
  width,
  colour,
  seconds,
  running,
  testID,
}: {
  width: number;
  colour: string;
  seconds: number;
  running: boolean;
  testID: string;
}) {
  const shift = useSharedValue(0);
  useEffect(() => {
    if (running) {
      shift.value = 0;
      shift.value = withRepeat(
        withTiming(-width, { duration: seconds * 1000, easing: Easing.linear }),
        -1,
      );
    } else {
      cancelAnimation(shift);
    }
    return () => cancelAnimation(shift);
  }, [running, width, seconds, shift]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return (
    <Animated.View testID={testID} style={[{ width: width * 2, height: WAVE_HEIGHT }, slide]}>
      <Svg width={width * 2} height={WAVE_HEIGHT}>
        <Path d={wavePath(width)} fill={colour} />
      </Svg>
    </Animated.View>
  );
}

/** Water rises as you study; the waves go still when the timer is paused. */
export function TideFace({ readout, width, height, running }: FaceProps) {
  const level = Math.max(0, Math.min(1, readout.fraction)) * height;
  const size = Math.min(height * 0.32, (width * 0.8) / (readout.groups.join(':').length * 0.6));

  return (
    <View style={styles.fill} testID="face-tide">
      <View style={[styles.water, { height: level + WAVE_HEIGHT }]}>
        <View style={styles.waves}>
          <View style={styles.layer}>
            <Wave width={width} colour={BACK} seconds={7} running={running} testID="tide-back" />
          </View>
          <Wave width={width} colour={FRONT} seconds={4} running={running} testID="tide-front" />
        </View>
        <View testID="tide-water" style={{ height: level, backgroundColor: FRONT }} />
      </View>
      <View style={styles.centre} pointerEvents="none">
        <Text
          numeric
          weight="semibold"
          style={{ fontSize: size, lineHeight: size * 1.15, color: TIDE_PALETTE.ink }}
        >
          {readout.groups.join(':')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  water: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  waves: { height: WAVE_HEIGHT },
  layer: { position: 'absolute', top: -6, left: 0, opacity: 0.9 },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
