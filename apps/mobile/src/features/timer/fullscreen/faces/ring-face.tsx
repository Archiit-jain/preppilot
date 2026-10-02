import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '../../../../components/ui';
import { shownFraction, type FacePalette, type FaceProps } from './types';

export const RING_PALETTE: FacePalette = {
  background: '#0B0F14',
  ink: '#E6EDF3',
  muted: '#8B97A5',
};

const TRACK = '#1C2430';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that drains smoothly as a countdown runs (or fills over each hour of a stopwatch). */
export function RingFace({ readout, progress, accent, height }: FaceProps) {
  const size = height * 0.78;
  const stroke = Math.max(8, size * 0.06);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const countsDown = readout.countsDown;
  const digits = size * 0.2;
  const caption = size * 0.06;

  const arc = useAnimatedProps(() => {
    const shown = shownFraction(progress.value, countsDown);
    return {
      strokeDashoffset: circumference * (1 - shown),
      // A round cap on a zero-length arc still draws a dot; hide it instead.
      strokeOpacity: shown > 0.001 ? 1 : 0,
    };
  });

  return (
    <View style={styles.fill} testID="face-ring">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TRACK}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          testID="ring-arc"
          animatedProps={arc}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.fill} pointerEvents="none">
        <Text
          numeric
          weight="semibold"
          style={{ fontSize: digits, lineHeight: digits * 1.2, color: RING_PALETTE.ink }}
        >
          {readout.groups.join(':')}
        </Text>
        <Text style={{ fontSize: caption, lineHeight: caption * 1.4, color: RING_PALETTE.muted }}>
          {countsDown ? 'left' : 'so far'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
