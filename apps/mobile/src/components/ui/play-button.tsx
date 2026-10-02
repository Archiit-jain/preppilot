import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { mostReadable } from '@preppilot/shared';
import { edgeBelow } from '../../theme/look-styles';
import { useTheme } from '../../theme/theme-context';
import { ariaState } from './aria';

export interface PlayButtonProps {
  readonly onPress: () => void;
  readonly label: string;
  readonly color?: string;
  readonly size?: number;
  readonly disabled?: boolean;
  readonly variant?: 'filled' | 'outline';
}

/**
 * Circular timer/play control.
 *
 * The visible size is controlled by `size`, while `hitSlop` makes the actual
 * touch target large enough for comfortable mobile interaction.
 */
export function PlayButton({
  onPress,
  label,
  color,
  size,
  disabled = false,
  variant = 'filled',
}: PlayButtonProps) {
  const theme = useTheme();
  const diameter = size ?? 48;
  const accent = color ?? theme.colors.accent;

  // Preserve the visual size but expand the interactive area to the
  // application's minimum touch target.
  const slop = Math.max(0, (theme.minTouchTarget - diameter) / 2);

  const filled = variant === 'filled';

  const look = theme.look;
  const play = look?.components.playButton;
  const iconColor =
    look === null || !filled
      ? filled
        ? theme.colors.textOnAccent
        : accent
      : mostReadable(accent, [look.ornament.onSubjectAccent, theme.colors.textPrimary, '#FFFFFF']);
  const lookShape =
    play === undefined
      ? null
      : {
          borderRadius: play.shape === 'square' ? theme.radius.md : diameter / 2,
          ...(filled && play.borderWidth > 0
            ? { borderWidth: play.borderWidth, borderColor: theme.colors.textPrimary }
            : {}),
          ...(filled && play.edgeBottom > play.borderWidth
            ? {
                borderBottomWidth: play.edgeBottom,
                borderBottomColor:
                  play.borderWidth > 0 && look !== null ? look.ornament.edge : edgeBelow(accent),
              }
            : {}),
        };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Start timer for ${label}`}
      accessibilityState={{ disabled }}
      {...ariaState({ disabled })}
      hitSlop={slop}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: filled ? accent : 'transparent',
          borderColor: filled ? 'transparent' : accent,
          borderWidth: filled ? 0 : 1.5,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        lookShape,
      ]}
    >
      <Svg width={diameter * 0.4} height={diameter * 0.4} viewBox="0 0 24 24">
        <Path d="M8 5v14l11-7z" fill={iconColor} />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
});
