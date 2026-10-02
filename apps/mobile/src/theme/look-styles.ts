import { contrastRatio, mixHex } from '@preppilot/shared';
import type { ViewStyle } from 'react-native';
import type { Look, Theme } from './theme-context';

/**
 * Styles a downloaded theme applies on top of a component's own.
 *
 * Each helper takes a theme that has a look; components call them only when
 * `theme.look` is set, so Classic never passes through here.
 */

/**
 * The border of a card or sheet.
 *
 * An edge wider than the border is drawn in the pack's edge colour on the
 * bottom and right only, which reads as a stack of paper or a hard shadow —
 * without a real shadow, which Android cannot draw undiffused.
 */
export function surfaceBorder(theme: Theme, look: Look): ViewStyle {
  const { borderWidth, edgeBottom, edgeRight } = look.components.surface;
  const bottom = Math.max(borderWidth, edgeBottom);
  const right = Math.max(borderWidth, edgeRight);
  return {
    borderWidth,
    borderBottomWidth: bottom,
    borderRightWidth: right,
    borderColor: theme.colors.border,
    borderBottomColor: bottom > borderWidth ? look.ornament.edge : theme.colors.border,
    borderRightColor: right > borderWidth ? look.ornament.edge : theme.colors.border,
    ...theme.elevation.none,
  };
}

/** How a card that belongs to a subject carries its colour. */
export function accentSurface(theme: Theme, look: Look, accent: string): ViewStyle {
  const light = theme.mode === 'light';
  switch (look.components.accentCard) {
    case 'sticky':
      // A sticky note: the subject's colour washed into the page.
      return { backgroundColor: mixHex(accent, theme.colors.surface, light ? 0.78 : 0.8) };
    case 'tint':
      return { backgroundColor: mixHex(accent, theme.colors.surface, light ? 0.35 : 0.78) };
    case 'strip':
      return { borderLeftWidth: 4, borderLeftColor: accent };
    case 'plain':
      return {};
  }
}

/** A darker edge under a filled control, as if it were pressed into the page. */
export function edgeBelow(background: string): string {
  return mixHex(background, '#000000', 0.3);
}

/** The main button's fill and label in this look. */
export function primaryButtonColors(
  theme: Theme,
  look: Look,
): {
  background: string;
  label: string;
} {
  if (look.components.button.primary === 'ink') {
    const background = theme.colors.textPrimary;
    // The highlight is the look's signature, so it wins whenever it is
    // readable; otherwise the page colour, which always contrasts with ink.
    return {
      background,
      label:
        contrastRatio(look.ornament.highlight, background) >= 4.5
          ? look.ornament.highlight
          : theme.colors.background,
    };
  }
  return { background: theme.colors.accent, label: theme.colors.textOnAccent };
}
