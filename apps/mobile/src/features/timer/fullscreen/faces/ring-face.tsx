import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '../../../../components/ui';
import { remainingFraction, type FacePalette, type FaceProps } from './types';

export const RING_PALETTE: FacePalette = {
  background: '#0B0F14',
  ink: '#E6EDF3',
  muted: '#8B97A5',
};

const TRACK = '#1C2430';

/** A ring that drains as a countdown runs (or fills over each hour of a stopwatch). */
export function RingFace({ readout, accent, height }: FaceProps) {
  const size = height * 0.78;
  const stroke = Math.max(8, size * 0.06);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = remainingFraction(readout);
  const text = readout.groups.join(':');

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
        {shown > 0 && (
          <Circle
            testID="ring-arc"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={accent}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * shown} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.centre} pointerEvents="none">
        <Text
          numeric
          weight="semibold"
          style={{ fontSize: size * 0.2, lineHeight: size * 0.24, color: RING_PALETTE.ink }}
        >
          {text}
        </Text>
        <Text style={{ fontSize: size * 0.06, color: RING_PALETTE.muted }}>
          {readout.countsDown ? 'left' : 'so far'}
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
