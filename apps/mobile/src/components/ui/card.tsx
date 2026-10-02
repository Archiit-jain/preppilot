import { StyleSheet, View, type ViewProps } from 'react-native';
import { accentSurface, surfaceBorder } from '../../theme/look-styles';
import { useTheme } from '../../theme/theme-context';
import { PressableScale } from './pressable-scale';

export interface CardProps extends ViewProps {
  /** Uses the raised surface colour, for a card nested inside another card. */
  readonly elevated?: boolean;
  readonly padded?: boolean;
  /** Makes the whole card a single target, with the same press motion as a button. */
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  /**
   * The subject this card belongs to. A downloaded theme may show it — as a
   * sticky note, a tint or a strip; Classic ignores it.
   */
  readonly accent?: string;
  /** Degrees to turn a sticky note, so a stack of them looks hand-placed. */
  readonly tilt?: number;
}

export function Card({
  elevated = false,
  padded = true,
  onPress,
  accessibilityLabel,
  accent,
  tilt,
  style,
  children,
  ...rest
}: CardProps) {
  const theme = useTheme();
  const look = theme.look;

  const surface = [
    styles.base,
    {
      backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: padded ? theme.spacing.base : 0,
    },
    // Depth is restrained: on a dark surface a heavy shadow reads as grime, so
    // separation comes mostly from colour and only nested cards lift at all.
    elevated ? theme.elevation.none : theme.elevation.card,
    ...(look === null
      ? []
      : [
          surfaceBorder(theme, look),
          accent === undefined ? null : accentSurface(theme, look, accent),
          tilt === undefined || look.components.accentCard !== 'sticky'
            ? null
            : { transform: [{ rotate: `${tilt}deg` }] },
        ]),
    style,
  ];

  // A strip of tape across the top of a sticky note.
  const tape =
    look !== null && accent !== undefined && look.components.accentCard === 'sticky' ? (
      <View
        pointerEvents="none"
        testID="card-tape"
        style={[styles.tape, { backgroundColor: look.ornament.highlight }]}
      />
    ) : null;

  if (onPress !== undefined) {
    return (
      <PressableScale
        accessibilityRole="button"
        {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
        onPress={onPress}
        style={surface as never}
      >
        {tape}
        {children}
      </PressableScale>
    );
  }

  return (
    <View style={surface} {...rest}>
      {tape}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  tape: {
    position: 'absolute',
    top: -7,
    left: '50%',
    marginLeft: -32,
    width: 64,
    height: 16,
    opacity: 0.75,
    transform: [{ rotate: '-2deg' }],
  },
});
