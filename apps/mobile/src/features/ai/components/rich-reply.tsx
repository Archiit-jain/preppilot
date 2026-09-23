import { Platform, StyleSheet, View } from 'react-native';
import { Text, type TextProps } from '../../../components/ui';
import { useTheme } from '../../../theme/theme-context';
import { parseMarkdown, type Span } from '../markdown';

type SpanBase = Required<Pick<TextProps, 'variant' | 'tone' | 'weight'>>;

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/**
 * An assistant reply, formatted.
 *
 * Bold, bullets, numbered steps and headings are what make an explanation easy
 * to scan, so they are kept — only the symbols that marked them are gone.
 */
export function RichReply({
  source,
  testID,
}: {
  readonly source: string;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const blocks = parseMarkdown(source);

  /*
   * Each span is a Text of its own, and the primitive sets size, face and
   * colour on every one — so the block's variant, tone and weight are passed
   * down rather than inherited, or a bold word in a heading would shrink to
   * body size.
   */
  const spans = (
    items: readonly Span[],
    { variant = 'body', tone = 'primary', weight = 'regular' }: Partial<SpanBase> = {},
  ) =>
    items.map((span, index) => (
      <Text
        key={index}
        variant={variant}
        tone={tone}
        weight={span.bold === true ? 'semibold' : weight}
        style={[
          span.italic === true && { fontStyle: 'italic' },
          span.strike === true && { textDecorationLine: 'line-through' },
          span.code === true && {
            fontFamily: MONO,
            backgroundColor: theme.colors.surfaceElevated,
          },
        ]}
      >
        {span.text}
      </Text>
    ));

  return (
    <View testID={testID} style={{ gap: theme.spacing.sm }}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Text
                key={index}
                variant={block.level === 1 ? 'title' : 'bodyLarge'}
                weight="semibold"
              >
                {spans(block.spans, {
                  variant: block.level === 1 ? 'title' : 'bodyLarge',
                  weight: 'semibold',
                })}
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={index} variant="body">
                {spans(block.spans)}
              </Text>
            );
          case 'bullet':
          case 'numbered':
            return (
              <View
                key={index}
                style={[styles.item, { paddingLeft: block.depth * theme.spacing.base }]}
              >
                <Text
                  variant="body"
                  tone="secondary"
                  style={block.kind === 'bullet' ? styles.bullet : styles.number}
                >
                  {block.kind === 'bullet' ? (block.depth === 0 ? '•' : '◦') : block.marker}
                </Text>
                <Text variant="body" style={styles.itemText}>
                  {spans(block.spans)}
                </Text>
              </View>
            );
          case 'quote':
            return (
              <View
                key={index}
                style={[
                  styles.quote,
                  { borderLeftColor: theme.colors.border, paddingLeft: theme.spacing.md },
                ]}
              >
                <Text variant="body" tone="secondary">
                  {spans(block.spans, { tone: 'secondary' })}
                </Text>
              </View>
            );
          case 'code':
            return (
              <View
                key={index}
                style={{
                  backgroundColor: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.md,
                }}
              >
                <Text variant="small" style={{ fontFamily: MONO }}>
                  {block.text}
                </Text>
              </View>
            );
          case 'rule':
            return (
              <View
                key={index}
                style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }}
              />
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 8 },
  bullet: { width: 12 },
  number: { minWidth: 18 },
  itemText: { flex: 1 },
  quote: { borderLeftWidth: 3 },
});
