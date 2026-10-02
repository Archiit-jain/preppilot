import type { ThemeCatalogEntry } from '@preppilot/shared';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from '../../../components/ui';
import { useThemePackStore } from '../../../theme/packs/theme-pack-store';
import { useTheme } from '../../../theme/theme-context';

/** "770 KB", "1.2 MB": what a download will cost, in the units people know. */
export function formatDownloadSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface Swatches {
  readonly background: string;
  readonly surface: string;
  readonly accent: string;
  readonly text: string;
}

/** Built in; listed first so it is always one tap away. */
const CLASSIC_SWATCHES: Swatches = {
  background: '#0B0F14',
  surface: '#151B23',
  accent: '#3B82F6',
  text: '#E6EDF3',
};

function Preview({ swatches }: { swatches: Swatches }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.preview,
        {
          backgroundColor: swatches.background,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <View style={[styles.previewCard, { backgroundColor: swatches.surface }]}>
        <View style={[styles.previewLine, { backgroundColor: swatches.text }]} />
        <View style={[styles.previewDot, { backgroundColor: swatches.accent }]} />
      </View>
    </View>
  );
}

interface RowProps {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly swatches: Swatches;
  readonly detail: string;
  readonly children: React.ReactNode;
}

function ThemeRow({ id, name, description, swatches, detail, children }: RowProps) {
  const theme = useTheme();
  return (
    <View testID={`theme-row-${id}`} style={[styles.row, { gap: theme.spacing.md }]}>
      <Preview swatches={swatches} />
      <View style={styles.rowText}>
        <Text variant="body" weight="semibold">
          {name}
        </Text>
        <Text variant="small" tone="secondary">
          {description}
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.xxs }}>
          {detail}
        </Text>
        <View style={[styles.actions, { gap: theme.spacing.sm, marginTop: theme.spacing.sm }]}>
          {children}
        </View>
      </View>
    </View>
  );
}

/**
 * Settings → Themes.
 *
 * Classic is built in. Every other theme is listed from the server and fetched
 * only when chosen, then kept on the phone so it works offline (D106). Nothing
 * here downloads on its own: opening Settings fetches the short list, and only
 * a tap fetches a theme.
 */
export function ThemePicker() {
  const theme = useTheme();
  const active = useThemePackStore((state) => state.active);
  const installed = useThemePackStore((state) => state.installed);
  const catalog = useThemePackStore((state) => state.catalog);
  const catalogStatus = useThemePackStore((state) => state.catalogStatus);
  const tasks = useThemePackStore((state) => state.tasks);
  const error = useThemePackStore((state) => state.error);
  const { loadCatalog, install, apply, useClassic, remove } = useThemePackStore.getState();

  useEffect(() => {
    if (useThemePackStore.getState().catalogStatus === 'idle') void loadCatalog();
  }, [loadCatalog]);

  // Themes on this phone stay listed when the list cannot be fetched (offline),
  // so a student can still switch between what they have.
  const offered: ThemeCatalogEntry[] = [...catalog];
  for (const local of Object.values(installed)) {
    if (offered.some((entry) => entry.id === local.pack.id)) continue;
    const colors = local.pack.colors.light;
    offered.push({
      id: local.pack.id,
      name: local.pack.name,
      description: local.pack.description,
      version: local.pack.version,
      sizeBytes: 0,
      preview: {
        background: colors.background,
        surface: colors.surface,
        accent: colors.accent,
        text: colors.textPrimary,
      },
      pack: `packs/${local.pack.id}.json`,
    });
  }

  const inUse = (
    <Text variant="small" tone="success" weight="semibold">
      ✓ In use
    </Text>
  );

  return (
    <Card testID="theme-picker">
      <Text variant="caption" tone="muted" overline>
        Themes
      </Text>
      <Text variant="small" tone="secondary" style={{ marginTop: theme.spacing.xs }}>
        Change how PrepPilot looks. Themes download only when you choose one and then work offline.
      </Text>

      <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.md }}>
        <ThemeRow
          id="classic"
          name="Classic"
          description="The original PrepPilot look."
          swatches={CLASSIC_SWATCHES}
          detail="Built in"
        >
          {active === null ? (
            inUse
          ) : (
            <Button
              label="Use"
              size="small"
              variant="secondary"
              testID="theme-use-classic"
              onPress={() => void useClassic()}
            />
          )}
        </ThemeRow>

        {offered.map((entry) => {
          const here = installed[entry.id];
          const task = tasks[entry.id];
          const isActive = active?.id === entry.id;
          const hasUpdate = here !== undefined && entry.version > here.pack.version;
          const detail =
            here !== undefined
              ? hasUpdate
                ? 'Downloaded · update available'
                : 'Downloaded'
              : `${formatDownloadSize(entry.sizeBytes)} download`;

          return (
            <ThemeRow
              key={entry.id}
              id={entry.id}
              name={entry.name}
              description={entry.description}
              swatches={entry.preview}
              detail={detail}
            >
              {here === undefined || hasUpdate ? (
                <Button
                  label={hasUpdate ? 'Update' : 'Download'}
                  size="small"
                  variant="outline"
                  loading={task === 'downloading'}
                  testID={`theme-download-${entry.id}`}
                  onPress={() => void install(entry)}
                />
              ) : isActive ? (
                inUse
              ) : (
                <Button
                  label="Use"
                  size="small"
                  variant="secondary"
                  loading={task === 'applying'}
                  testID={`theme-use-${entry.id}`}
                  onPress={() => void apply(entry.id)}
                />
              )}
              {here !== undefined && (
                <Button
                  label="Remove"
                  size="small"
                  variant="ghost"
                  testID={`theme-remove-${entry.id}`}
                  onPress={() => void remove(entry.id)}
                />
              )}
            </ThemeRow>
          );
        })}
      </View>

      {catalogStatus === 'loading' && (
        <Text variant="small" tone="muted" style={{ marginTop: theme.spacing.md }}>
          Loading themes…
        </Text>
      )}
      {catalogStatus === 'failed' && (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
          <Text variant="small" tone="secondary" testID="theme-catalog-failed">
            Couldn't load the list of themes. Check your connection.
          </Text>
          <Button
            label="Try again"
            size="small"
            variant="ghost"
            testID="theme-catalog-retry"
            onPress={() => void loadCatalog()}
          />
        </View>
      )}
      {catalogStatus === 'unavailable' && (
        <Text variant="small" tone="muted" style={{ marginTop: theme.spacing.md }}>
          Themes aren't available in this version of PrepPilot.
        </Text>
      )}
      {error !== null && (
        <Text
          variant="small"
          tone="danger"
          accessibilityRole="alert"
          testID="theme-error"
          style={{ marginTop: theme.spacing.md }}
        >
          {error}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowText: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  preview: {
    width: 56,
    height: 56,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    justifyContent: 'center',
  },
  previewCard: { borderRadius: 4, padding: 6, gap: 5 },
  previewLine: { height: 4, width: '80%', borderRadius: 2 },
  previewDot: { height: 10, width: 10, borderRadius: 5 },
});
