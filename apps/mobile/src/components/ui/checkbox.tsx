import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/theme-context';
import { ariaState } from './aria';

export interface CheckboxProps extends Omit<PressableProps, 'onPress' | 'style'> {
  readonly checked: boolean;
  readonly onToggle: (next: boolean) => void;
  readonly label: string;
  readonly color?: string;
  readonly size?: number;
}

export function Checkbox({
  checked,
  onToggle,
  label,
  color,
  size,
  disabled,
  ...rest
}: CheckboxProps) {
  const theme = useTheme();
  const boxSize = size ?? theme.progressMetrics.checkSize;
  const accent = color ?? theme.colors.accent;

  // The visible checkbox stays compact, but the interactive area is expanded
  // to the application's minimum comfortable touch target.
  const slop = Math.max(0, (theme.minTouchTarget - boxSize) / 2);

  const tickColor = theme.mode === 'light' ? theme.colors.textPrimary : theme.colors.textOnAccent;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: disabled ?? false }}
      {...ariaState({ checked, disabled: disabled ?? false })}
      hitSlop={slop}
      disabled={disabled}
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [
        styles.box,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: boxSize / 2,
          backgroundColor: checked ? accent : 'transparent',
          borderColor: checked ? accent : theme.colors.border,
          opacity: disabled === true ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
      {...rest}
    >
      <View pointerEvents="none" testID={checked ? 'checkbox-tick' : 'checkbox-tick-empty'}>
        <Svg width={boxSize * 0.6} height={boxSize * 0.6} viewBox="0 0 24 24">
          <Path
            d="M20 6L9 17l-5-5"
            stroke={checked ? tickColor : theme.colors.textMuted}
            strokeWidth={checked ? 3 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={checked ? 1 : 0.9}
          />
        </Svg>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
