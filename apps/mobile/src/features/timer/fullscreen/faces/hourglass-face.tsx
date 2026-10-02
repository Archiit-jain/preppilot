import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Line, Path, Rect } from 'react-native-svg';
import { Text } from '../../../../components/ui';
import { remainingFraction, type FacePalette, type FaceProps } from './types';

export const HOURGLASS_PALETTE: FacePalette = {
  background: '#1B1A2E',
  ink: '#EDE6D6',
  muted: '#A79F8C',
};

const GLASS = '#C9B37E';
const SAND = '#E8C872';
const AnimatedLine = Animated.createAnimatedComponent(Line);

/** Drawn in a 100 × 160 box: two bulbs meeting at a neck at y = 80. */
const OUTLINE =
  'M20 10 C20 50 46 66 48 80 C46 94 20 110 20 150 L80 150 C80 110 54 94 52 80 C54 66 80 50 80 10 Z';
const TOP_BULB = 'M20 10 C20 50 46 66 48 80 L52 80 C54 66 80 50 80 10 Z';
const BOTTOM_BULB = 'M48 80 C46 94 20 110 20 150 L80 150 C80 110 54 94 52 80 Z';
const BULB = 70;

/** Sand runs from the top bulb to the bottom over the session. */
export function HourglassFace({ readout, width, height, running }: FaceProps) {
  const glassHeight = height * 0.82;
  const glassWidth = (glassHeight * 100) / 160;
  const left = remainingFraction(readout);
  const fallen = 1 - left;
  const ids = useId().replace(/[^A-Za-z0-9]/g, '');

  // The trickle moves only while time does.
  const flow = useSharedValue(0);
  useEffect(() => {
    if (running && left > 0) {
      flow.value = 0;
      flow.value = withRepeat(withTiming(-12, { duration: 500, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(flow);
    }
    return () => cancelAnimation(flow);
  }, [running, left, flow]);
  const trickle = useAnimatedProps(() => ({ strokeDashoffset: flow.value }));

  return (
    <View
      style={[styles.fill, { flexDirection: width > height ? 'row' : 'column' }]}
      testID="face-hourglass"
    >
      <Svg width={glassWidth} height={glassHeight} viewBox="0 0 100 160">
        <Defs>
          <ClipPath id={`top${ids}`}>
            <Path d={TOP_BULB} />
          </ClipPath>
          <ClipPath id={`bottom${ids}`}>
            <Path d={BOTTOM_BULB} />
          </ClipPath>
        </Defs>
        <Rect
          testID="hourglass-top"
          x={0}
          y={80 - left * BULB}
          width={100}
          height={left * BULB}
          fill={SAND}
          clipPath={`url(#top${ids})`}
        />
        <Rect
          testID="hourglass-bottom"
          x={0}
          y={150 - fallen * BULB}
          width={100}
          height={fallen * BULB}
          fill={SAND}
          clipPath={`url(#bottom${ids})`}
        />
        {left > 0 && (
          <AnimatedLine
            testID="hourglass-trickle"
            animatedProps={trickle}
            x1={50}
            y1={80}
            x2={50}
            y2={150 - fallen * BULB}
            stroke={SAND}
            strokeWidth={1.6}
            strokeDasharray="3 3"
          />
        )}
        <Path d={OUTLINE} fill="none" stroke={GLASS} strokeWidth={2} />
        <Path d="M14 8 H86 M14 152 H86" stroke={GLASS} strokeWidth={4} strokeLinecap="round" />
      </Svg>
      <Text
        numeric
        weight="semibold"
        style={{
          fontSize: glassHeight * 0.16,
          color: HOURGLASS_PALETTE.ink,
          marginLeft: glassWidth * 0.3,
        }}
      >
        {readout.groups.join(':')}
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
