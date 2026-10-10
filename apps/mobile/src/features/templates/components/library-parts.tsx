import { TEMPLATE_GROUPS, type Tally } from '@preppilot/shared';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Text } from '../../../components/ui';
import { useTheme } from '../../../theme/theme-context';
import type { LibraryTemplateItem } from '../library-items';

const plural = (n: number) => `${n} ${n === 1 ? 'template' : 'templates'}`;

/**
 * The categories as a grid of tiles, each with its real count.
 *
 * Two columns on a phone, more on a tablet or the web, so twelve categories fit
 * in a screen or two instead of one long wall of buttons.
 */
export function CategoryGrid({
  groups,
  onSelect,
}: {
  readonly groups: readonly Tally[];
  readonly onSelect: (group: string) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 4 : width >= 640 ? 3 : 2;
  const basis = `${100 / columns - 2}%` as const;

  return (
    <View style={styles.grid} accessibilityRole="list">
      {groups.map((tally) => {
        const index = TEMPLATE_GROUPS.findIndex((group) => group.id === tally.id);
        const description = TEMPLATE_GROUPS[index]?.description ?? '';
        return (
          <Pressable
            key={tally.id}
            style={{ flexBasis: basis, flexGrow: 1 }}
            accessibilityRole="button"
            accessibilityLabel={`${tally.label}, ${plural(tally.count)}`}
            accessibilityHint="Shows the templates in this category"
            onPress={() => onSelect(tally.id)}
            testID={`category-${tally.id}`}
          >
            <Card accent={theme.accentFor(index)} style={styles.tile}>
              <Text variant="body" weight="semibold" numberOfLines={3}>
                {tally.label}
              </Text>
              <Text
                variant="caption"
                tone="secondary"
                numberOfLines={2}
                style={{ marginTop: theme.spacing.xxs }}
              >
                {description}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.sm }}>
                {plural(tally.count)}
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface ChipOption {
  readonly id: string | null;
  readonly label: string;
  readonly count?: number;
}

/**
 * One row of filter choices, scrolling sideways rather than wrapping, so a
 * long list of subcategories never pushes the results off the screen.
 */
export function ChipRow({
  label,
  options,
  selected,
  onSelect,
  testID,
}: {
  /** What the row filters by, read out to screen readers. */
  readonly label: string;
  readonly options: readonly ChipOption[];
  readonly selected: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={label} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.base }}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((option) => (
          <Button
            key={option.id ?? 'all'}
            label={option.count === undefined ? option.label : `${option.label} (${option.count})`}
            size="small"
            variant={option.id === selected ? 'primary' : 'secondary'}
            selected={option.id === selected}
            onPress={() => onSelect(option.id)}
            testID={testID === undefined ? undefined : `${testID}-${option.id ?? 'all'}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * A template in the results: what it is, where it sits in the library, and
 * how much it holds. The syllabus itself waits for the preview.
 */
export const TemplateCard = memo(function TemplateCard({
  item,
  opening,
  disabled,
  onOpen,
}: {
  readonly item: LibraryTemplateItem;
  /** This template's syllabus is downloading. */
  readonly opening: boolean;
  readonly disabled: boolean;
  readonly onOpen: (item: LibraryTemplateItem) => void;
}) {
  const theme = useTheme();
  const { counts } = item.source;
  const online = item.source.kind === 'online';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.groupLabel}, ${item.subgroupLabel}`}
      accessibilityHint={
        online ? 'Downloads the syllabus and opens a preview' : 'Opens a preview before importing'
      }
      accessibilityState={{ busy: opening }}
      disabled={disabled}
      onPress={() => onOpen(item)}
      testID={`template-${item.id}`}
    >
      <Card>
        <Text variant="caption" tone="muted" overline numberOfLines={1}>
          {item.groupLabel} · {item.subgroupLabel}
        </Text>
        <Text variant="bodyLarge" weight="semibold" style={{ marginTop: theme.spacing.xxs }}>
          {item.name}
        </Text>
        <Text
          variant="small"
          tone="secondary"
          numberOfLines={2}
          style={{ marginTop: theme.spacing.xxs }}
        >
          {item.source.description}
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {opening
            ? 'Downloading…'
            : `${counts.subjects} subjects · ${counts.chapters} chapters · ${counts.topics} topics${online ? ' · online' : ''}`}
        </Text>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { minHeight: 112, flex: 1 },
});
