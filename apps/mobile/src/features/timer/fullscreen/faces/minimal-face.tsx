import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Text } from '../../../../components/ui';
import type { FacePalette, FaceProps } from './types';

export const MINIMAL_PALETTE: FacePalette = {
  background: '#F5F3EE',
  ink: '#1A1A1A',
  muted: '#6B6862',
};

/** Huge digits and one line along the bottom edge. Nothing else. */
export function MinimalFace({ readout, progress, accent, width, height }: FaceProps) {
  const text = readout.groups.join(':');
  const size = Math.min(height * 0.42, (width * 0.9) / (text.length * 0.6));
  const line = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, progress.value)) * 100}%`,
  }));

  return (
    <View style={styles.fill} testID="face-minimal">
      <Text
        numeric
        style={{
          fontSize: size,
          lineHeight: size * 1.2,
          color: MINIMAL_PALETTE.ink,
          letterSpacing: -1,
        }}
      >
        {text}
      </Text>
      <Animated.View
        testID="minimal-line"
        style={[styles.line, line, { backgroundColor: accent }]}
      />
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
  line: { position: 'absolute', left: 0, bottom: 0, height: 6 },
});
