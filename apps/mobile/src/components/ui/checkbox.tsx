import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { mixHex, mostReadable } from '@preppilot/shared';
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

  // A downloaded theme's box: square or round, filled or ticked in pen.
  const box = theme.look?.components.checkbox;
  const heavy = (box?.borderWidth ?? 0) >= 2;
  const penTick = box?.checked === 'tick';
  const lookTickColor =
    box === undefined
      ? tickColor
      : penTick
        ? accent
        : mostReadable(accent, [
            theme.look?.ornament.onSubjectAccent ?? tickColor,
            theme.colors.background,
            theme.colors.textPrimary,
          ]);
  const lookBox =
    box === undefined
      ? null
      : {
          borderRadius: box.shape === 'square' ? theme.radius.sm / 1.5 : boxSize / 2,
          borderWidth: box.borderWidth,
          borderColor: checked
            ? heavy
              ? theme.colors.textPrimary
              : accent
            : heavy
              ? theme.colors.textPrimary
              : theme.colors.textMuted,
          backgroundColor: checked
            ? penTick
              ? mixHex(accent, theme.colors.surface, 0.85)
              : accent
            : 'transparent',
        };

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
        lookBox,
      ]}
      {...rest}
    >
      <View pointerEvents="none" testID={checked ? 'checkbox-tick' : 'checkbox-tick-empty'}>
        <Svg
          width={boxSize * (penTick && checked ? 0.85 : 0.6)}
          height={boxSize * (penTick && checked ? 0.85 : 0.6)}
          viewBox="0 0 24 24"
        >
          <Path
            // A pen tick is drawn freehand, overshooting the box like a real one.
            d={
              penTick && checked
                ? 'M4 13.5c2.2 1.6 3.6 3.4 5 5.5C11.8 13 15.6 8.6 20.5 5'
                : 'M20 6L9 17l-5-5'
            }
            stroke={checked ? lookTickColor : theme.colors.textMuted}
            strokeWidth={checked ? (penTick ? 3.2 : 3) : 2}
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
