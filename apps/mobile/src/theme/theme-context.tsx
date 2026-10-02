import {
  DEFAULT_THEME_MODE,
  accentForIndex,
  colorsFor,
  elevation,
  fontSize,
  fontWeight,
  lineHeight,
  layout,
  letterSpacing,
  minTouchTarget,
  motion,
  progressMetrics,
  radius,
  spacing,
  subjectAccents,
  type ColorScheme,
  type ThemeComponents,
  type ThemeFonts,
  type ThemeMode,
  type ThemeOrnament,
  type ThemePack,
} from '@preppilot/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useThemePackStore } from './packs/theme-pack-store';

/**
 * What a downloaded theme adds on top of colours and shapes.
 *
 * Null for Classic, the built-in look: every component checks for it and, when
 * it is absent, renders exactly as it always has. That is the guarantee that
 * downloadable themes cannot change the app for anyone who never uses them.
 */
export interface Look {
  readonly id: string;
  readonly name: string;
  readonly ornament: ThemeOrnament;
  readonly fonts: ThemeFonts;
  readonly components: ThemeComponents;
}

export interface Theme {
  readonly mode: ThemeMode;
  readonly colors: ColorScheme;
  readonly spacing: typeof spacing;
  readonly radius: { readonly [K in keyof typeof radius]: number };
  readonly fontSize: typeof fontSize;
  readonly fontWeight: typeof fontWeight;
  readonly lineHeight: typeof lineHeight;
  readonly letterSpacing: typeof letterSpacing;
  readonly elevation: typeof elevation;
  readonly motion: typeof motion;
  readonly layout: typeof layout;
  readonly minTouchTarget: typeof minTouchTarget;
  readonly progressMetrics: typeof progressMetrics;
  readonly subjectAccents: readonly string[];
  /** The downloaded theme's extras, or null for Classic. */
  readonly look: Look | null;
  /** A subject's colour by its position, from the active look's palette. */
  readonly accentFor: (index: number) => string;
}

interface ThemeContextValue {
  readonly theme: Theme;
  /** Overrides the device setting. Passing `null` returns to following the device. */
  readonly setMode: (mode: ThemeMode | null) => void;
  /** True when the theme follows the device setting rather than an explicit choice. */
  readonly followsDevice: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(mode: ThemeMode, pack: ThemePack | null = null): Theme {
  if (pack === null) {
    return {
      mode,
      colors: colorsFor(mode),
      spacing,
      radius,
      fontSize,
      fontWeight,
      lineHeight,
      letterSpacing,
      elevation,
      motion,
      layout,
      minTouchTarget,
      progressMetrics,
      subjectAccents,
      look: null,
      accentFor: accentForIndex,
    };
  }

  const accents = pack.subjectAccents;
  return {
    mode,
    colors: pack.colors[mode],
    spacing,
    radius: { ...radius, ...pack.radius },
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    elevation,
    motion,
    layout,
    minTouchTarget,
    progressMetrics,
    subjectAccents: accents,
    look: {
      id: pack.id,
      name: pack.name,
      ornament: pack.ornament[mode],
      fonts: pack.fonts,
      components: pack.components,
    },
    accentFor: (index) => {
      // Same contract as the built-in palette: a stable colour per position.
      accentForIndex(index);
      return accents[index % accents.length] as string;
    },
  };
}

export interface ThemeProviderProps {
  readonly children: ReactNode;
  /**
   * Forces a mode regardless of the device setting. Used by tests and by the
   * settings screen's theme preview.
   */
  readonly initialMode?: ThemeMode | null;
}

export function ThemeProvider({ children, initialMode = null }: ThemeProviderProps) {
  const deviceScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(initialMode);
  const pack = useThemePackStore((state) => state.active);

  const value = useMemo<ThemeContextValue>(() => {
    // Precedence: explicit user choice, then the device setting, then our default.
    // `useColorScheme` reports 'unspecified' when the device has no preference,
    // which is why DEFAULT_THEME_MODE (dark) backstops it rather than light —
    // falling back to light would flash white on a dark-themed device.
    const resolved: ThemeMode =
      override ?? (deviceScheme === 'light' ? 'light' : DEFAULT_THEME_MODE);

    return {
      theme: buildTheme(resolved, pack),
      setMode: setOverride,
      followsDevice: override === null,
    };
  }, [override, deviceScheme, pack]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** @throws if used outside a `ThemeProvider`. */
export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}
