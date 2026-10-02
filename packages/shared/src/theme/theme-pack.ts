import type { ColorScheme } from './tokens';

/**
 * Downloadable themes.
 *
 * The built-in look (Classic) ships with the app. Every other look is a theme
 * pack: a JSON file plus the fonts it names, fetched from the server only when a
 * student asks for it, so the app download stays the size it is. Once fetched,
 * a pack lives on the device and works offline.
 *
 * A pack is data from the network, so nothing in it is trusted: every colour,
 * number and path is checked here before the app renders with it, and a pack
 * that fails any check is refused whole rather than applied in part.
 */

/** Bumped only when an older app could not render a newer pack correctly. */
export const THEME_PACK_FORMAT = 1;

export type DisplayVariant = 'display' | 'heading' | 'title';

/** Colours a pack adds beyond the shared scheme, for its decorations. */
export interface ThemeOrnament {
  /** Highlighter behind titles; checked-box wash. */
  readonly highlight: string;
  /** Ruled lines or grid behind the page. */
  readonly ruling: string;
  /** The margin line of a notebook page. */
  readonly margin: string;
  /** The thick bottom/right edge that gives cards and buttons their depth. */
  readonly edge: string;
  /** Icons and ticks drawn on top of a subject's colour. */
  readonly onSubjectAccent: string;
}

export interface ThemeFonts {
  /** Family name to font file, relative to the theme root (`fonts/X.ttf`). */
  readonly files: Readonly<Record<string, string>>;
  /** The family for each weight of body text. */
  readonly body: {
    readonly regular: string;
    readonly medium: string;
    readonly semibold: string;
    readonly bold: string;
  };
  /** A separate face for headings, sized by `scale` to sit with the body face. */
  readonly display: {
    readonly family: string;
    readonly scale: number;
    readonly lineHeight: number;
    readonly letterSpacing: number;
    readonly variants: readonly DisplayVariant[];
  } | null;
  readonly mono: string | null;
  /** Section labels: the body face, or the monospaced one. */
  readonly overline: 'body' | 'mono';
  /** Figures (percentages, times): the body face, or the monospaced one. */
  readonly numeric: 'body' | 'mono';
}

export interface ThemeComponents {
  /** Cards and sheets. Edges wider than the border read as a stack of paper or a hard shadow. */
  readonly surface: {
    readonly borderWidth: number;
    readonly edgeBottom: number;
    readonly edgeRight: number;
  };
  /** How a card that belongs to a subject shows that subject's colour. */
  readonly accentCard: 'plain' | 'sticky' | 'tint' | 'strip';
  readonly button: {
    readonly shape: 'rounded' | 'pill';
    readonly borderWidth: number;
    readonly edgeBottom: number;
    readonly uppercase: boolean;
    /** `ink` fills the main button with the text colour and labels it in the highlight. */
    readonly primary: 'accent' | 'ink';
  };
  readonly progressBar: {
    readonly style: 'solid' | 'outline' | 'ticks';
    readonly height: number;
    readonly borderWidth: number;
  };
  readonly progressRing: {
    readonly track: 'solid' | 'dashed' | 'ticks';
    readonly stroke: number;
    readonly outline: boolean;
  };
  readonly checkbox: {
    readonly shape: 'circle' | 'square';
    readonly checked: 'fill' | 'tick';
    readonly borderWidth: number;
  };
  readonly playButton: {
    readonly shape: 'circle' | 'square';
    readonly borderWidth: number;
    readonly edgeBottom: number;
  };
  readonly textField: {
    readonly style: 'box' | 'underline';
    readonly borderWidth: number;
  };
  readonly background: 'plain' | 'ruled' | 'grid';
  readonly title: 'plain' | 'highlight';
  readonly tabBar: { readonly borderWidth: number };
}

export interface ThemePack {
  readonly format: typeof THEME_PACK_FORMAT;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The pack's own revision; a higher one in the catalog offers an update. */
  readonly version: number;
  readonly colors: { readonly light: ColorScheme; readonly dark: ColorScheme };
  readonly ornament: { readonly light: ThemeOrnament; readonly dark: ThemeOrnament };
  readonly subjectAccents: readonly string[];
  readonly radius: {
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
    readonly xxl: number;
  };
  readonly fonts: ThemeFonts;
  readonly components: ThemeComponents;
}

export interface ThemeCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: number;
  /** Pack plus fonts, so the student knows what a download costs. */
  readonly sizeBytes: number;
  /** Swatches for the picker, so a look can be judged before it is fetched. */
  readonly preview: {
    readonly background: string;
    readonly surface: string;
    readonly accent: string;
    readonly text: string;
  };
  /** Relative to the theme root, e.g. `packs/notebook.json`. */
  readonly pack: string;
}

export interface ThemeCatalog {
  readonly format: typeof THEME_PACK_FORMAT;
  readonly themes: readonly ThemeCatalogEntry[];
}

/** Raised for anything a pack or catalog gets wrong; the message names the field. */
export class ThemePackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThemePackError';
  }
}

const COLOR_KEYS = [
  'background',
  'surface',
  'surfaceElevated',
  'border',
  'progressTrack',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'textOnAccent',
  'accent',
  'success',
  'warning',
  'danger',
  'offline',
] as const satisfies readonly (keyof ColorScheme)[];

const ORNAMENT_KEYS = [
  'highlight',
  'ruling',
  'margin',
  'edge',
  'onSubjectAccent',
] as const satisfies readonly (keyof ThemeOrnament)[];

const ID = /^[a-z][a-z0-9-]{1,31}$/;
const FAMILY = /^[A-Za-z][A-Za-z0-9_]{1,47}$/;
const FONT_PATH = /^fonts\/[A-Za-z0-9_-]{1,64}\.ttf$/;
const PACK_PATH = /^packs\/[a-z][a-z0-9-]{1,31}\.json$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** More than this many fonts is not a theme any more; it is a download. */
const MAX_FONT_FILES = 12;
const MAX_THEMES = 24;

type Json = Record<string, unknown>;

function object(value: unknown, path: string): Json {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ThemePackError(`${path} must be an object`);
  }
  return value as Json;
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new ThemePackError(`${path} must be text of at most ${max} characters`);
  }
  return value;
}

function matching(value: unknown, path: string, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new ThemePackError(`${path} is not valid`);
  }
  return value;
}

function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ThemePackError(`${path} must be a number from ${min} to ${max}`);
  }
  return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  const result = number(value, path, min, max);
  if (!Number.isInteger(result)) throw new ThemePackError(`${path} must be a whole number`);
  return result;
}

function oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== 'string' || !(options as readonly string[]).includes(value)) {
    throw new ThemePackError(`${path} must be one of ${options.join(', ')}`);
  }
  return value as T;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new ThemePackError(`${path} must be true or false`);
  return value;
}

const color = (value: unknown, path: string) => matching(value, path, HEX);

function colorScheme(value: unknown, path: string): ColorScheme {
  const raw = object(value, path);
  const scheme: Record<string, string> = {};
  for (const key of COLOR_KEYS) scheme[key] = color(raw[key], `${path}.${key}`);
  return scheme as unknown as ColorScheme;
}

function ornament(value: unknown, path: string): ThemeOrnament {
  const raw = object(value, path);
  const result: Record<string, string> = {};
  for (const key of ORNAMENT_KEYS) result[key] = color(raw[key], `${path}.${key}`);
  return result as unknown as ThemeOrnament;
}

function fonts(value: unknown): ThemeFonts {
  const raw = object(value, 'fonts');
  const filesRaw = object(raw.files, 'fonts.files');
  const entries = Object.entries(filesRaw);
  if (entries.length === 0 || entries.length > MAX_FONT_FILES) {
    throw new ThemePackError(`fonts.files must name 1 to ${MAX_FONT_FILES} fonts`);
  }
  const files: Record<string, string> = {};
  for (const [family, file] of entries) {
    matching(family, `fonts.files key ${family}`, FAMILY);
    files[family] = matching(file, `fonts.files.${family}`, FONT_PATH);
  }

  // Every family the pack uses must be one it ships: a missing face would fall
  // back to the platform default and quietly break the look.
  const known = (family: unknown, path: string): string => {
    const name = matching(family, path, FAMILY);
    if (!(name in files)) throw new ThemePackError(`${path} names a font the pack does not ship`);
    return name;
  };

  const bodyRaw = object(raw.body, 'fonts.body');
  const body = {
    regular: known(bodyRaw.regular, 'fonts.body.regular'),
    medium: known(bodyRaw.medium, 'fonts.body.medium'),
    semibold: known(bodyRaw.semibold, 'fonts.body.semibold'),
    bold: known(bodyRaw.bold, 'fonts.body.bold'),
  };

  let display: ThemeFonts['display'] = null;
  if (raw.display !== null && raw.display !== undefined) {
    const d = object(raw.display, 'fonts.display');
    if (!Array.isArray(d.variants) || d.variants.length === 0) {
      throw new ThemePackError('fonts.display.variants must list at least one variant');
    }
    display = {
      family: known(d.family, 'fonts.display.family'),
      scale: number(d.scale, 'fonts.display.scale', 0.8, 1.6),
      lineHeight: number(d.lineHeight, 'fonts.display.lineHeight', 1, 1.6),
      letterSpacing: number(d.letterSpacing, 'fonts.display.letterSpacing', -2, 2),
      variants: d.variants.map((variant, index) =>
        oneOf(variant, `fonts.display.variants[${index}]`, [
          'display',
          'heading',
          'title',
        ] as const),
      ),
    };
  }

  const mono = raw.mono === null || raw.mono === undefined ? null : known(raw.mono, 'fonts.mono');
  const overline = oneOf(raw.overline, 'fonts.overline', ['body', 'mono'] as const);
  const numeric = oneOf(raw.numeric, 'fonts.numeric', ['body', 'mono'] as const);
  if (mono === null && (overline === 'mono' || numeric === 'mono')) {
    throw new ThemePackError('fonts.mono is needed when labels or figures use it');
  }

  return { files, body, display, mono, overline, numeric };
}

const width = (value: unknown, path: string) => number(value, path, 0, 6);

function components(value: unknown): ThemeComponents {
  const raw = object(value, 'components');
  const surface = object(raw.surface, 'components.surface');
  const button = object(raw.button, 'components.button');
  const bar = object(raw.progressBar, 'components.progressBar');
  const ring = object(raw.progressRing, 'components.progressRing');
  const checkbox = object(raw.checkbox, 'components.checkbox');
  const play = object(raw.playButton, 'components.playButton');
  const field = object(raw.textField, 'components.textField');
  const tabBar = object(raw.tabBar, 'components.tabBar');

  return {
    surface: {
      borderWidth: width(surface.borderWidth, 'components.surface.borderWidth'),
      edgeBottom: width(surface.edgeBottom, 'components.surface.edgeBottom'),
      edgeRight: width(surface.edgeRight, 'components.surface.edgeRight'),
    },
    accentCard: oneOf(raw.accentCard, 'components.accentCard', [
      'plain',
      'sticky',
      'tint',
      'strip',
    ] as const),
    button: {
      shape: oneOf(button.shape, 'components.button.shape', ['rounded', 'pill'] as const),
      borderWidth: width(button.borderWidth, 'components.button.borderWidth'),
      edgeBottom: width(button.edgeBottom, 'components.button.edgeBottom'),
      uppercase: bool(button.uppercase, 'components.button.uppercase'),
      primary: oneOf(button.primary, 'components.button.primary', ['accent', 'ink'] as const),
    },
    progressBar: {
      style: oneOf(bar.style, 'components.progressBar.style', [
        'solid',
        'outline',
        'ticks',
      ] as const),
      height: number(bar.height, 'components.progressBar.height', 3, 16),
      borderWidth: width(bar.borderWidth, 'components.progressBar.borderWidth'),
    },
    progressRing: {
      track: oneOf(ring.track, 'components.progressRing.track', [
        'solid',
        'dashed',
        'ticks',
      ] as const),
      stroke: number(ring.stroke, 'components.progressRing.stroke', 2, 8),
      outline: bool(ring.outline, 'components.progressRing.outline'),
    },
    checkbox: {
      shape: oneOf(checkbox.shape, 'components.checkbox.shape', ['circle', 'square'] as const),
      checked: oneOf(checkbox.checked, 'components.checkbox.checked', ['fill', 'tick'] as const),
      borderWidth: width(checkbox.borderWidth, 'components.checkbox.borderWidth'),
    },
    playButton: {
      shape: oneOf(play.shape, 'components.playButton.shape', ['circle', 'square'] as const),
      borderWidth: width(play.borderWidth, 'components.playButton.borderWidth'),
      edgeBottom: width(play.edgeBottom, 'components.playButton.edgeBottom'),
    },
    textField: {
      style: oneOf(field.style, 'components.textField.style', ['box', 'underline'] as const),
      borderWidth: width(field.borderWidth, 'components.textField.borderWidth'),
    },
    background: oneOf(raw.background, 'components.background', ['plain', 'ruled', 'grid'] as const),
    title: oneOf(raw.title, 'components.title', ['plain', 'highlight'] as const),
    tabBar: { borderWidth: width(tabBar.borderWidth, 'components.tabBar.borderWidth') },
  };
}

/** Validates a downloaded pack. Throws `ThemePackError` naming the first bad field. */
export function parseThemePack(value: unknown): ThemePack {
  const raw = object(value, 'pack');
  if (raw.format !== THEME_PACK_FORMAT) {
    throw new ThemePackError('This theme needs a newer version of PrepPilot');
  }

  const colors = object(raw.colors, 'colors');
  const ornaments = object(raw.ornament, 'ornament');
  const radius = object(raw.radius, 'radius');

  if (!Array.isArray(raw.subjectAccents) || raw.subjectAccents.length < 4) {
    throw new ThemePackError('subjectAccents must list at least 4 colours');
  }
  if (raw.subjectAccents.length > 16) {
    throw new ThemePackError('subjectAccents must list at most 16 colours');
  }

  return {
    format: THEME_PACK_FORMAT,
    id: matching(raw.id, 'id', ID),
    name: text(raw.name, 'name', 40),
    description: text(raw.description, 'description', 200),
    version: integer(raw.version, 'version', 1, 10_000),
    colors: {
      light: colorScheme(colors.light, 'colors.light'),
      dark: colorScheme(colors.dark, 'colors.dark'),
    },
    ornament: {
      light: ornament(ornaments.light, 'ornament.light'),
      dark: ornament(ornaments.dark, 'ornament.dark'),
    },
    subjectAccents: raw.subjectAccents.map((accent, index) =>
      color(accent, `subjectAccents[${index}]`),
    ),
    radius: {
      sm: number(radius.sm, 'radius.sm', 0, 40),
      md: number(radius.md, 'radius.md', 0, 40),
      lg: number(radius.lg, 'radius.lg', 0, 40),
      xl: number(radius.xl, 'radius.xl', 0, 40),
      xxl: number(radius.xxl, 'radius.xxl', 0, 40),
    },
    fonts: fonts(raw.fonts),
    components: components(raw.components),
  };
}

/** Validates the list of themes on offer. Entries that fail are dropped, not fatal. */
export function parseThemeCatalog(value: unknown): ThemeCatalog {
  const raw = object(value, 'catalog');
  if (raw.format !== THEME_PACK_FORMAT) {
    throw new ThemePackError('This theme list needs a newer version of PrepPilot');
  }
  if (!Array.isArray(raw.themes)) throw new ThemePackError('catalog.themes must be a list');

  const themes: ThemeCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const [index, item] of raw.themes.slice(0, MAX_THEMES).entries()) {
    try {
      const entry = object(item, `themes[${index}]`);
      const preview = object(entry.preview, `themes[${index}].preview`);
      const parsed: ThemeCatalogEntry = {
        id: matching(entry.id, 'id', ID),
        name: text(entry.name, 'name', 40),
        description: text(entry.description, 'description', 200),
        version: integer(entry.version, 'version', 1, 10_000),
        sizeBytes: integer(entry.sizeBytes, 'sizeBytes', 1, 20_000_000),
        preview: {
          background: color(preview.background, 'preview.background'),
          surface: color(preview.surface, 'preview.surface'),
          accent: color(preview.accent, 'preview.accent'),
          text: color(preview.text, 'preview.text'),
        },
        pack: matching(entry.pack, 'pack', PACK_PATH),
      };
      if (seen.has(parsed.id)) continue;
      seen.add(parsed.id);
      themes.push(parsed);
    } catch (error) {
      // One malformed entry should not hide every other theme.
      if (!(error instanceof ThemePackError)) throw error;
    }
  }

  return { format: THEME_PACK_FORMAT, themes };
}

/** Every font file a pack needs, as paths relative to the theme root. */
export function themePackFontPaths(pack: ThemePack): readonly string[] {
  return [...new Set(Object.values(pack.fonts.files))];
}

/**
 * Blends two `#RRGGBB` colours; `amount` 0 gives `from`, 1 gives `to`.
 *
 * Used for the tints a pack derives from a subject's colour — a sticky note is
 * the subject's colour washed into paper, not a second palette to keep in step.
 */
export function mixHex(from: string, to: string, amount: number): string {
  const parse = (hex: string) => {
    if (!HEX.test(hex)) throw new ThemePackError(`${hex} is not a #RRGGBB colour`);
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  };
  const a = parse(from);
  const b = parse(to);
  const t = Math.min(1, Math.max(0, amount));
  return `#${a
    .map((channel, index) => Math.round(channel + ((b[index] as number) - channel) * t))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** WCAG relative luminance of a `#RRGGBB` colour. */
function relativeLuminance(hex: string): number {
  if (!HEX.test(hex)) throw new ThemePackError(`${hex} is not a #RRGGBB colour`);
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

/** WCAG contrast ratio between two `#RRGGBB` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light as number) + 0.05) / ((dark as number) + 0.05);
}

/** Whichever candidate reads best on `background`. */
export function mostReadable(background: string, candidates: readonly string[]): string {
  let best = candidates[0] ?? '#000000';
  for (const candidate of candidates) {
    if (contrastRatio(candidate, background) > contrastRatio(best, background)) best = candidate;
  }
  return best;
}
