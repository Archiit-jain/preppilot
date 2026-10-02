import { makeProgress, mixHex, type ThemeMode, type ThemePack } from '@preppilot/shared';
import { StyleSheet } from 'react-native';
import {
  AppHeader,
  Button,
  Card,
  Checkbox,
  PlayButton,
  ProgressBar,
  ProgressRing,
  Screen,
  Sheet,
  StatChip,
  Text,
  TextField,
} from '../../components/ui';
import { fireEvent, renderWithTheme, screen } from '../../test-utils/render';
import { loadPack, PACK_IDS, type PackId } from '../../test-utils/theme-packs';
import { resetThemePackStore, useThemePackStore } from '../packs/theme-pack-store';
import { useTheme } from '../theme-context';

/**
 * Every component under every downloadable theme, in both modes.
 *
 * Classic is covered by each component's own tests, which still pass unchanged;
 * these check that a theme's choices actually reach the screen.
 */

const half = makeProgress(5, 10);
const none = makeProgress(0, 10);

function using(id: PackId): ThemePack {
  const pack = loadPack(id);
  useThemePackStore.setState({ active: pack });
  return pack;
}

const flat = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;

afterEach(() => resetThemePackStore());

describe.each(PACK_IDS)('%s', (id) => {
  describe.each(['light', 'dark'] as ThemeMode[])('in %s mode', (mode) => {
    it('renders every component without falling back', () => {
      const pack = using(id);
      renderWithTheme(
        <Screen>
          <AppHeader title="Tracker" overline="Your syllabus" />
          <Text variant="heading">Heading</Text>
          <Text>Body</Text>
          <Text numeric>42%</Text>
          <Text overline variant="caption">
            Label
          </Text>
          <Card accent={pack.subjectAccents[0]} tilt={0.6}>
            <Text display>Physics</Text>
          </Card>
          <Card accent={pack.subjectAccents[1]} onPress={() => {}} accessibilityLabel="Open">
            <Text>Chemistry</Text>
          </Card>
          <Card elevated>
            <Text>Nested</Text>
          </Card>
          {(['primary', 'secondary', 'outline', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} label={variant} variant={variant} onPress={() => {}} />
          ))}
          <ProgressBar progress={half} label="Half" />
          <ProgressBar progress={none} label="None" height={4} />
          <ProgressRing progress={half} label="Ring" />
          <Checkbox checked label="Done" onToggle={() => {}} />
          <Checkbox checked={false} label="Todo" onToggle={() => {}} />
          <PlayButton label="Maths" color={pack.subjectAccents[2]} onPress={() => {}} />
          <PlayButton label="Topic" variant="outline" onPress={() => {}} />
          <TextField label="Name" />
          <TextField label="Email" error="Required" />
          <StatChip label="Streak" value="3 days" />
        </Screen>,
        { mode },
      );

      expect(screen.getByText('Heading')).toBeOnTheScreen();
      expect(screen.getAllByRole('button').length).toBeGreaterThan(5);
    });

    it('sets text in the theme’s faces', () => {
      const pack = using(id);
      renderWithTheme(
        <>
          <Text variant="heading">Heading</Text>
          <Text weight="bold">Bold body</Text>
          <Text display>Subject</Text>
          <Text variant="display" numeric>
            25:00
          </Text>
          <Text variant="caption" overline>
            Label
          </Text>
        </>,
        { mode },
      );

      const heading = pack.fonts.display;
      expect(screen.getByText('Heading')).toHaveStyle({
        fontFamily:
          heading !== null && heading.variants.includes('heading')
            ? heading.family
            : pack.fonts.body.semibold,
      });
      expect(screen.getByText('Bold body')).toHaveStyle({ fontFamily: pack.fonts.body.bold });
      expect(screen.getByText('Subject')).toHaveStyle({
        fontFamily: heading?.family ?? pack.fonts.body.regular,
      });
      // Figures never take a handwritten heading face.
      expect(screen.getByText('25:00')).toHaveStyle({
        fontFamily:
          pack.fonts.numeric === 'mono' ? (pack.fonts.mono as string) : pack.fonts.body.semibold,
        fontVariant: ['tabular-nums'],
      });
      expect(screen.getByText('Label')).toHaveStyle({
        fontFamily:
          pack.fonts.overline === 'mono' ? (pack.fonts.mono as string) : pack.fonts.body.semibold,
        textTransform: 'uppercase',
      });
    });

    it('takes colours and corners from the pack', () => {
      const pack = using(id);
      renderWithTheme(
        <Card testID="card">
          <Text>Inside</Text>
        </Card>,
        { mode },
      );

      expect(screen.getByTestId('card')).toHaveStyle({
        backgroundColor: pack.colors[mode].surface,
        borderRadius: pack.radius.lg,
        borderWidth: pack.components.surface.borderWidth,
      });
    });
  });
});

describe('notebook', () => {
  it('turns a subject card into a taped, tilted sticky note', () => {
    const pack = using('notebook');
    renderWithTheme(
      <Card testID="note" accent="#3B6FD8" tilt={0.6}>
        <Text>Physics</Text>
      </Card>,
      { mode: 'light' },
    );

    expect(screen.getByTestId('card-tape')).toBeOnTheScreen();
    expect(screen.getByTestId('note')).toHaveStyle({
      backgroundColor: mixHex('#3B6FD8', pack.colors.light.surface, 0.78),
      transform: [{ rotate: '0.6deg' }],
    });
  });

  it('rules the page and highlights the title', () => {
    using('notebook');
    renderWithTheme(
      <Screen>
        <AppHeader title="Tracker" />
      </Screen>,
    );

    expect(screen.getByTestId('page-background')).toBeOnTheScreen();
    expect(screen.getByTestId('title-highlight')).toBeOnTheScreen();
  });

  it('draws the ring track in pencil and ticks the box in pen', () => {
    using('notebook');
    renderWithTheme(
      <>
        <ProgressRing progress={half} label="Ring" />
        <Checkbox checked label="Done" onToggle={() => {}} />
      </>,
    );

    expect(screen.getByLabelText('Done')).toHaveStyle({ borderRadius: 4 / 1.5 });
    expect(screen.queryAllByTestId('progress-ring-tick')).toHaveLength(0);
  });

  it('writes on a ruled line rather than in a box', () => {
    using('notebook');
    renderWithTheme(<TextField label="Name" />, { mode: 'light' });

    expect(screen.getByLabelText('Name')).toHaveStyle({ borderWidth: 0, borderBottomWidth: 1.5 });
  });

  it('tapes the top of a sheet', () => {
    using('notebook');
    renderWithTheme(
      <Sheet visible label="Add" onDismiss={() => {}}>
        <Text>Inside</Text>
      </Sheet>,
    );

    expect(screen.getAllByTestId('sheet-tape').length).toBeGreaterThan(0);
  });

  it('gives the main button a pen edge', () => {
    using('notebook');
    renderWithTheme(<Button label="Save" onPress={() => {}} />, { mode: 'light' });

    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      borderRadius: 999,
      borderBottomWidth: 3,
    });
  });
});

describe('flight deck', () => {
  it('marks subjects with a strip and never tilts', () => {
    using('flight-deck');
    renderWithTheme(
      <Card testID="leg" accent="#6EA8FF" tilt={0.6}>
        <Text>Physics</Text>
      </Card>,
    );

    expect(screen.queryByTestId('card-tape')).toBeNull();
    const style = flat(screen.getByTestId('leg'));
    expect(style.borderLeftColor).toBe('#6EA8FF');
    expect(style.transform).toBeUndefined();
  });

  it('draws instrument ticks on rings and bars, on a grid', () => {
    using('flight-deck');
    renderWithTheme(
      <Screen>
        <ProgressRing progress={half} label="Ring" />
        <ProgressBar progress={half} label="Bar" />
      </Screen>,
    );

    expect(screen.getAllByTestId('progress-ring-tick')).toHaveLength(4);
    expect(screen.getByTestId('progress-ticks')).toBeOnTheScreen();
    expect(screen.getByTestId('page-background')).toBeOnTheScreen();
  });

  it('sets button labels in capitals', () => {
    using('flight-deck');
    renderWithTheme(<Button label="Take off" onPress={() => {}} />);

    expect(screen.getByText('Take off')).toHaveStyle({ textTransform: 'uppercase' });
  });

  it('squares the play button', () => {
    using('flight-deck');
    renderWithTheme(<PlayButton label="Maths" onPress={() => {}} />);

    expect(screen.getByRole('button', { name: 'Start timer for Maths' })).toHaveStyle({
      borderRadius: 10,
    });
  });
});

describe('bold bento', () => {
  it('fills the main button with ink and a readable label', () => {
    const pack = using('bold-bento');
    renderWithTheme(<Button label="Start" onPress={() => {}} />, { mode: 'light' });

    expect(screen.getByRole('button', { name: 'Start' })).toHaveStyle({
      backgroundColor: pack.colors.light.textPrimary,
    });
    expect(screen.getByText('Start')).toHaveStyle({ color: pack.ornament.light.highlight });
  });

  it('labels the ink button in the background colour when the highlight would not read', () => {
    const pack = using('bold-bento');
    renderWithTheme(<Button label="Start" onPress={() => {}} />, { mode: 'dark' });

    expect(screen.getByText('Start')).toHaveStyle({ color: pack.colors.dark.background });
  });

  it('outlines rings and frames bars, with no page pattern', () => {
    using('bold-bento');
    renderWithTheme(
      <Screen>
        <ProgressRing progress={half} label="Ring" />
        <ProgressBar progress={half} label="Bar" />
      </Screen>,
    );

    expect(screen.getAllByTestId('progress-ring-outline')).toHaveLength(2);
    expect(screen.getByLabelText('Bar')).toHaveStyle({ borderWidth: 2, borderRadius: 999 });
    expect(screen.queryByTestId('page-background')).toBeNull();
  });

  it('tints subject cards instead of taping them', () => {
    const pack = using('bold-bento');
    renderWithTheme(
      <Card testID="tile" accent="#9CC9FF">
        <Text>Physics</Text>
      </Card>,
      { mode: 'light' },
    );

    expect(screen.queryByTestId('card-tape')).toBeNull();
    expect(screen.getByTestId('tile')).toHaveStyle({
      backgroundColor: mixHex('#9CC9FF', pack.colors.light.surface, 0.35),
    });
  });

  it('frames inputs and checkboxes in ink', () => {
    const pack = using('bold-bento');
    renderWithTheme(
      <>
        <TextField label="Name" />
        <Checkbox checked={false} label="Todo" onToggle={() => {}} />
      </>,
      { mode: 'light' },
    );

    expect(screen.getByLabelText('Name')).toHaveStyle({
      borderWidth: 2,
      borderColor: pack.colors.light.textPrimary,
    });
    expect(screen.getByLabelText('Todo')).toHaveStyle({
      borderColor: pack.colors.light.textPrimary,
    });
  });

  it('still responds to presses', () => {
    using('bold-bento');
    const onPress = jest.fn();
    renderWithTheme(<Button label="Go" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Go' }));

    expect(onPress).toHaveBeenCalled();
  });
});

describe('classic', () => {
  it('ignores a card’s subject colour and tilt', () => {
    renderWithTheme(
      <Card testID="plain" accent="#3B6FD8" tilt={0.6}>
        <Text display numeric>
          Physics
        </Text>
      </Card>,
    );

    expect(screen.queryByTestId('card-tape')).toBeNull();
    const style = flat(screen.getByTestId('plain'));
    expect(style.transform).toBeUndefined();
    expect(style.borderLeftWidth).toBeUndefined();
    expect(screen.getByText('Physics')).toHaveStyle({ fontFamily: 'Inter_400Regular' });
  });
});

describe('subject colours', () => {
  function Swatches() {
    const theme = useTheme();
    return <Text>{[0, 1, 8].map((index) => theme.accentFor(index)).join(' ')}</Text>;
  }

  it('come from the theme, in a stable order that wraps', () => {
    const pack = using('flight-deck');
    renderWithTheme(<Swatches />);

    const [first, second] = pack.subjectAccents;
    expect(screen.getByText(`${first} ${second} ${first}`)).toBeOnTheScreen();
  });

  it('refuse a position that is not a whole number, as the built-in palette does', () => {
    using('flight-deck');
    function Bad() {
      return <Text>{useTheme().accentFor(-1)}</Text>;
    }
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderWithTheme(<Bad />)).toThrow(RangeError);
  });
});

describe('a theme that leaves subject cards plain', () => {
  it('adds nothing for the subject', () => {
    const pack = loadPack('bold-bento');
    useThemePackStore.setState({
      active: { ...pack, components: { ...pack.components, accentCard: 'plain' } },
    });
    renderWithTheme(
      <Card testID="plain" accent="#9CC9FF">
        <Text>Physics</Text>
      </Card>,
      { mode: 'light' },
    );

    expect(screen.getByTestId('plain')).toHaveStyle({ backgroundColor: pack.colors.light.surface });
  });
});
