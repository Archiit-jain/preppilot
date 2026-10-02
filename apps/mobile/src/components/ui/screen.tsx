import { StyleSheet, View, useWindowDimensions, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { useTheme, type Look } from '../../theme/theme-context';
import { OfflineBanner } from '../../features/network/components/offline-banner';

export interface ScreenProps extends ViewProps {
  /** Applies horizontal screen padding. Disable for edge-to-edge lists. */
  readonly padded?: boolean;
}

/**
 * Root container: paints the app background, respects safe areas, and stops
 * content widening past a readable measure.
 *
 * The app is phone-first but runs in a browser and on tablets, where a full-width
 * layout would stretch text lines far past the ~70 characters beyond which
 * reading measurably slows. Content centres and caps instead.
 */
export function Screen({ padded = true, style, children, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isWide = width >= theme.layout.wideBreakpoint;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        style,
      ]}
      {...rest}
    >
      {theme.look !== null && theme.look.components.background !== 'plain' && (
        <PageBackground look={theme.look} margin={isWide ? null : insets.left + 10} />
      )}
      <View
        testID="screen-content"
        style={[
          styles.content,
          {
            maxWidth: theme.layout.contentMaxWidth,
            paddingLeft: insets.left + (padded ? theme.spacing.base : 0),
            paddingRight: insets.right + (padded ? theme.spacing.base : 0),
            // A little more breathing room once there is room to give.
            paddingTop: isWide ? theme.spacing.md : 0,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * The page under everything: ruled notebook paper, or an instrument grid.
 *
 * One SVG pattern rather than a view per line, so a long screen costs the same
 * as a short one.
 */
function PageBackground({ look, margin }: { look: Look; margin: number | null }) {
  const ruled = look.components.background === 'ruled';
  const step = ruled ? 28 : 24;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="page-background">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={`page-${look.id}`} width={step} height={step} patternUnits="userSpaceOnUse">
            <Line
              x1={0}
              y1={step - 0.5}
              x2={step}
              y2={step - 0.5}
              stroke={look.ornament.ruling}
              strokeWidth={1}
            />
            {!ruled && (
              <Line
                x1={step - 0.5}
                y1={0}
                x2={step - 0.5}
                y2={step}
                stroke={look.ornament.ruling}
                strokeWidth={1}
              />
            )}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#page-${look.id})`} />
        {ruled && margin !== null && (
          <Line
            x1={margin}
            y1={0}
            x2={margin}
            y2="100%"
            stroke={look.ornament.margin}
            strokeWidth={1.5}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, width: '100%', alignSelf: 'center' },
});
