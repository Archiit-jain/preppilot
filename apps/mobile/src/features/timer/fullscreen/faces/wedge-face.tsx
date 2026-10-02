import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Text } from '../../../../components/ui';
import { shownFraction, type FacePalette, type FaceProps } from './types';

export const WEDGE_PALETTE: FacePalette = {
  background: '#FFFFFF',
  ink: '#2B2B2B',
  muted: '#6E6E6E',
};

const WEDGE = '#E5484D';
const DIAL = '#F3F3F3';
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The slice of a circle from twelve o'clock, clockwise, covering `fraction`.
 * A whole circle is two half arcs, since one arc cannot start and end at the
 * same point.
 */
export function wedgePath(centre: number, radius: number, fraction: number): string {
  'worklet';
  const top = centre - radius;
  if (fraction <= 0.0005) return `M ${centre} ${centre} Z`;
  if (fraction >= 0.9995) {
    return `M ${centre} ${top} A ${radius} ${radius} 0 1 1 ${centre} ${centre + radius} A ${radius} ${radius} 0 1 1 ${centre} ${top} Z`;
  }
  const angle = fraction * 2 * Math.PI;
  const x = centre + radius * Math.sin(angle);
  const y = centre - radius * Math.cos(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `M ${centre} ${centre} L ${centre} ${top} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y} Z`;
}

/** Whole minutes, for a readout meant to be read from across a room. */
export function minutesLabel(seconds: number, countsDown: boolean): string {
  const minutes = countsDown ? Math.ceil(seconds / 60) : Math.floor(seconds / 60);
  return `${minutes} min ${countsDown ? 'left' : 'in'}`;
}

/**
 * A red wedge that shrinks smoothly as time passes, like a kitchen timer: how
 * much is left is visible at a glance, without reading a single digit.
 */
export function WedgeFace({ readout, progress, width, height }: FaceProps) {
  const size = height * 0.8;
  const centre = size / 2;
  const radius = size * 0.44;
  const countsDown = readout.countsDown;
  const label = size * 0.1;

  const slice = useAnimatedProps(() => ({
    d: wedgePath(centre, radius, shownFraction(progress.value, countsDown)),
  }));

  return (
    <View
      style={[styles.fill, { flexDirection: width > height ? 'row' : 'column' }]}
      testID="face-wedge"
    >
      <Svg width={size} height={size}>
        <Circle
          cx={centre}
          cy={centre}
          r={size * 0.48}
          fill={DIAL}
          stroke="#DDDDDD"
          strokeWidth={1.5}
        />
        <AnimatedPath testID="wedge-slice" animatedProps={slice} fill={WEDGE} />
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index / 12) * 2 * Math.PI;
          const inner = size * (index % 3 === 0 ? 0.42 : 0.45);
          return (
            <Line
              key={index}
              x1={centre + inner * Math.sin(angle)}
              y1={centre - inner * Math.cos(angle)}
              x2={centre + size * 0.48 * Math.sin(angle)}
              y2={centre - size * 0.48 * Math.cos(angle)}
              stroke="#9A9A9A"
              strokeWidth={index % 3 === 0 ? 2.5 : 1.5}
            />
          );
        })}
        <Circle cx={centre} cy={centre} r={size * 0.04} fill="#333333" />
      </Svg>
      <Text
        numeric
        weight="semibold"
        style={{
          fontSize: label,
          lineHeight: label * 1.3,
          color: WEDGE_PALETTE.ink,
          marginLeft: size * 0.1,
        }}
      >
        {minutesLabel(readout.seconds, countsDown)}
      </Text>
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
