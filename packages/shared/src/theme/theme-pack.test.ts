import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  mixHex,
  mostReadable,
  parseThemeCatalog,
  parseThemePack,
  ThemePackError,
  themePackFontPaths,
  type ThemePack,
} from './theme-pack';

const PACKS_DIR = join(__dirname, '..', '..', '..', '..', 'supabase', 'themes', 'packs');
const PACK_IDS = ['notebook', 'flight-deck', 'bold-bento'] as const;

const readPack = (id: string): unknown =>
  JSON.parse(readFileSync(join(PACKS_DIR, `${id}.json`), 'utf8'));

/** A deep copy with one field changed, for the refusal cases. */
function withChange(change: (pack: Record<string, any>) => void): unknown {
  const pack = structuredClone(readPack('notebook')) as Record<string, any>;
  change(pack);
  return pack;
}

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('the packs in the repository', () => {
  it.each(PACK_IDS)('%s is a valid pack', (id) => {
    const pack = parseThemePack(readPack(id));

    expect(pack.id).toBe(id);
  });

  /**
   * A look that cannot be read is not a look. These are the same thresholds
   * the built-in theme is held to: body text well clear of AA, secondary and
   * muted text at AA, and the accent visible as a control.
   */
  describe.each(PACK_IDS)('%s stays readable', (id) => {
    const pack = parseThemePack(readPack(id));

    it.each(['light', 'dark'] as const)('in %s mode', (mode) => {
      const colors = pack.colors[mode];
      for (const ground of [colors.background, colors.surface]) {
        expect(contrast(colors.textPrimary, ground)).toBeGreaterThanOrEqual(7);
        expect(contrast(colors.textSecondary, ground)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colors.textMuted, ground)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colors.accent, ground)).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(colors.textOnAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it('draws legible icons on every subject colour', () => {
      for (const mode of ['light', 'dark'] as const) {
        for (const accent of pack.subjectAccents) {
          expect(contrast(pack.ornament[mode].onSubjectAccent, accent)).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });

  it('lists each font file once, even when two families share it', () => {
    const pack = parseThemePack(readPack('flight-deck'));

    expect(themePackFontPaths(pack)).toHaveLength(6);
  });
});

describe('refusing a bad pack', () => {
  const refused = (pack: unknown, message: RegExp) =>
    expect(() => parseThemePack(pack)).toThrow(message);

  it('refuses something that is not a pack at all', () => {
    expect(() => parseThemePack(null)).toThrow(ThemePackError);
    expect(() => parseThemePack([])).toThrow(ThemePackError);
    expect(() => parseThemePack('pack')).toThrow(ThemePackError);
  });

  it('refuses a newer format, rather than half-rendering it', () => {
    refused(
      withChange((p) => (p.format = 2)),
      /newer version/,
    );
  });

  it('refuses a colour that is not a plain hex value', () => {
    refused(
      withChange((p) => (p.colors.light.accent = 'red')),
      /colors\.light\.accent/,
    );
    refused(
      withChange((p) => (p.ornament.dark.edge = 'url(evil)')),
      /ornament\.dark\.edge/,
    );
  });

  it('refuses a missing colour', () => {
    refused(
      withChange((p) => delete p.colors.dark.surface),
      /colors\.dark\.surface/,
    );
  });

  it('refuses font files outside the theme folder', () => {
    refused(
      withChange((p) => (p.fonts.files.Nunito_400Regular = 'https://elsewhere.example/x.ttf')),
      /fonts\.files/,
    );
    refused(
      withChange((p) => (p.fonts.files.Nunito_400Regular = 'fonts/../../secrets.ttf')),
      /fonts\.files/,
    );
  });

  it('refuses a family the pack does not ship', () => {
    refused(
      withChange((p) => (p.fonts.body.bold = 'Comic_700Bold')),
      /does not ship/,
    );
    refused(
      withChange((p) => (p.fonts.display.family = 'Comic_700Bold')),
      /does not ship/,
    );
  });

  it('refuses monospaced labels with no monospaced face', () => {
    refused(
      withChange((p) => (p.fonts.overline = 'mono')),
      /fonts\.mono is needed/,
    );
  });

  it('refuses too many or too few fonts', () => {
    refused(
      withChange((p) => (p.fonts.files = {})),
      /1 to 12 fonts/,
    );
    refused(
      withChange((p) => {
        for (let i = 0; i < 13; i += 1) p.fonts.files[`Extra${i}`] = `fonts/Extra${i}.ttf`;
      }),
      /1 to 12 fonts/,
    );
  });

  it('refuses sizes that would break the layout', () => {
    refused(
      withChange((p) => (p.components.progressBar.height = 200)),
      /progressBar\.height/,
    );
    refused(
      withChange((p) => (p.radius.md = -1)),
      /radius\.md/,
    );
    refused(
      withChange((p) => (p.fonts.display.scale = 5)),
      /display\.scale/,
    );
  });

  it('refuses unknown choices', () => {
    refused(
      withChange((p) => (p.components.button.shape = 'star')),
      /button\.shape/,
    );
    refused(
      withChange((p) => (p.components.checkbox.borderWidth = 'thick')),
      /checkbox\.borderWidth/,
    );
    refused(
      withChange((p) => (p.components.button.uppercase = 'yes')),
      /uppercase/,
    );
    refused(
      withChange((p) => (p.fonts.display.variants = ['caption'])),
      /variants\[0\]/,
    );
  });

  it('refuses an empty heading list, a bad id, a long name or a fractional version', () => {
    refused(
      withChange((p) => (p.fonts.display.variants = [])),
      /at least one variant/,
    );
    refused(
      withChange((p) => (p.id = 'Not An Id')),
      /id is not valid/,
    );
    refused(
      withChange((p) => (p.name = 'x'.repeat(41))),
      /name must be text/,
    );
    refused(
      withChange((p) => (p.version = 1.5)),
      /whole number/,
    );
  });

  it('needs enough subject colours, and not too many', () => {
    refused(
      withChange((p) => (p.subjectAccents = ['#111111'])),
      /at least 4/,
    );
    refused(
      withChange((p) => (p.subjectAccents = Array(17).fill('#111111'))),
      /at most 16/,
    );
    refused(
      withChange((p) => (p.subjectAccents = 'blue')),
      /at least 4/,
    );
  });

  it('accepts a pack with no separate heading face or monospaced face', () => {
    const pack = parseThemePack(
      withChange((p) => {
        p.fonts.display = null;
        p.fonts.mono = undefined;
      }),
    ) as ThemePack;

    expect(pack.fonts.display).toBeNull();
    expect(pack.fonts.mono).toBeNull();
  });
});

describe('the theme catalog', () => {
  const entry = (id: string) => ({
    id,
    name: 'Notebook',
    description: 'Ruled paper.',
    version: 1,
    sizeBytes: 640_000,
    preview: { background: '#FBF6EA', surface: '#FFFDF7', accent: '#2450B8', text: '#1F2A3C' },
    pack: `packs/${id}.json`,
  });

  it('reads the themes on offer', () => {
    const catalog = parseThemeCatalog({ format: 1, themes: [entry('notebook')] });

    expect(catalog.themes.map((theme) => theme.id)).toEqual(['notebook']);
  });

  it('drops a malformed entry but keeps the rest', () => {
    const catalog = parseThemeCatalog({
      format: 1,
      themes: [{ ...entry('broken'), sizeBytes: -1 }, 'nonsense', entry('notebook')],
    });

    expect(catalog.themes.map((theme) => theme.id)).toEqual(['notebook']);
  });

  it('keeps the first of two entries with the same id', () => {
    const catalog = parseThemeCatalog({
      format: 1,
      themes: [entry('notebook'), { ...entry('notebook'), name: 'Copy' }],
    });

    expect(catalog.themes).toHaveLength(1);
    expect(catalog.themes[0]!.name).toBe('Notebook');
  });

  it('refuses a pack path that leaves the theme folder', () => {
    const catalog = parseThemeCatalog({
      format: 1,
      themes: [{ ...entry('notebook'), pack: '../secrets.json' }],
    });

    expect(catalog.themes).toEqual([]);
  });

  it('refuses a newer format or a missing list', () => {
    expect(() => parseThemeCatalog({ format: 2, themes: [] })).toThrow(/newer version/);
    expect(() => parseThemeCatalog({ format: 1 })).toThrow(/must be a list/);
  });
});

describe('mixHex', () => {
  it('blends between two colours', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('clamps the amount', () => {
    expect(mixHex('#102030', '#FFFFFF', -1)).toBe('#102030');
    expect(mixHex('#102030', '#FFFFFF', 2)).toBe('#FFFFFF');
  });

  it('refuses anything that is not #RRGGBB', () => {
    expect(() => mixHex('red', '#FFFFFF', 0.5)).toThrow(ThemePackError);
  });
});

describe('contrast', () => {
  it('measures black on white as the maximum', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });

  it('picks the candidate that reads best', () => {
    expect(mostReadable('#111111', ['#222222', '#C6F432'])).toBe('#C6F432');
    expect(mostReadable('#F6F3EC', ['#C6F432', '#131313'])).toBe('#131313');
  });

  it('refuses a colour it cannot read', () => {
    expect(() => contrastRatio('blue', '#FFFFFF')).toThrow(ThemePackError);
  });
});
