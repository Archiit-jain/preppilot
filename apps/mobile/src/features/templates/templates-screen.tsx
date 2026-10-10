import {
  countFacet,
  countGroups,
  countSubgroups,
  countTemplate,
  filterLibrary,
  placeTemplate,
  subgroupLabel,
  templateGroup,
  type LibrarySort,
  type SyllabusTemplate,
} from '@preppilot/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  Screen,
  Sheet,
  Text,
  TextField,
} from '../../components/ui';
import { getRepositories } from '../../db/client';
import { useAuthStore } from '../auth/auth-store';
import { useTrackersStore } from '../trackers/trackers-store';
import { useTheme } from '../../theme/theme-context';
import { CategoryGrid, ChipRow, TemplateCard, type ChipOption } from './components/library-parts';
import { importTemplate } from './import-template';
import { useLibraryItems, useRecentTemplateIds, type LibraryTemplateItem } from './library-items';
import { useTemplateLibraryStore } from './template-library-store';

/** Null follows the search: best match while searching, by category otherwise. */
type SortChoice = LibrarySort | null;

interface Filters {
  readonly group: string | null;
  readonly subgroup: string | null;
  readonly classLevel: string | null;
  readonly stream: string | null;
}

const NO_FILTERS: Filters = { group: null, subgroup: null, classLevel: null, stream: null };

const plural = (n: number) => `${n} ${n === 1 ? 'template' : 'templates'}`;

/**
 * Template library.
 *
 * Flow:
 * browse (categories, or search) → preview → confirm → import
 *
 * The library is organised by the shelf plan in `@preppilot/shared`
 * (taxonomy.ts): every template sits in one category and subcategory, and
 * search reads names, aliases, category names and the subjects inside. Only
 * catalog metadata is listed; a syllabus is loaded when its preview opens.
 *
 * Importing a template starts a NEW course holding only that template's
 * subjects. Nothing already on the account is touched: the course the student
 * was on is still there, and the switcher moves between them.
 */
export function TemplatesScreen() {
  const theme = useTheme();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sortChoice, setSortChoice] = useState<SortChoice>(null);
  const [previewing, setPreviewing] = useState<SyllabusTemplate | null>(null);
  /**
   * What the student already has, so the preview can say it will be left alone.
   * Null until it has been counted.
   */
  const [existing, setExisting] = useState<{ subjects: number; notes: number } | null>(null);
  const [query, setQuery] = useState('');
  // "Search from templates" arrives here wanting the keyboard up; "Import a
  // template" arrives wanting the list. Same screen, two intents.
  const { search } = useLocalSearchParams<{ search?: string }>();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const library = useTemplateLibraryStore();
  const loadLibrary = library.load;
  useEffect(() => {
    if (useTemplateLibraryStore.getState().status === 'idle') void loadLibrary();
  }, [loadLibrary]);

  const items = useLibraryItems();
  const recent = useRecentTemplateIds();
  const searching = query.trim().length > 0;
  const filtering = filters.group !== null;
  const sort: LibrarySort = sortChoice ?? (searching ? 'relevance' : 'category');

  // Search first, then each filter: the counts beside every choice say how many
  // results picking it would leave, so no chip leads to an empty page.
  const matching = useMemo(() => filterLibrary(items, { query }), [items, query]);
  const inGroup = useMemo(
    () =>
      filters.group === null ? matching : matching.filter((item) => item.group === filters.group),
    [matching, filters.group],
  );
  const results = useMemo(
    () => filterLibrary(inGroup, { ...filters, query, sort, recent }),
    [inGroup, filters, query, sort, recent],
  );

  const groups = useMemo(() => countGroups(matching), [matching]);
  const allGroups = useMemo(() => countGroups(items), [items]);
  const subgroups = useMemo(
    () => (filters.group === null ? [] : countSubgroups(inGroup, filters.group)),
    [inGroup, filters.group],
  );
  const inSubgroup = useMemo(
    () =>
      filters.subgroup === null
        ? inGroup
        : inGroup.filter((item) => item.subgroup === filters.subgroup),
    [inGroup, filters.subgroup],
  );
  const classes = useMemo(() => countFacet(inSubgroup, 'classLevel'), [inSubgroup]);
  const streams = useMemo(
    () =>
      countFacet(
        filters.classLevel === null
          ? inSubgroup
          : inSubgroup.filter((item) => item.facets.classLevel === filters.classLevel),
        'stream',
      ),
    [inSubgroup, filters.classLevel],
  );

  const chooseGroup = (group: string | null) => {
    setFilters({ ...NO_FILTERS, group });
  };
  const reset = () => {
    setQuery('');
    setFilters(NO_FILTERS);
    setSortChoice(null);
  };

  const openItem = useCallback(async (item: LibraryTemplateItem) => {
    setError(null);
    if (item.source.kind === 'bundled') {
      setPreviewing(item.source.template);
    } else {
      const template = await useTemplateLibraryStore.getState().open(item.source.entry);
      if (template === null) return;
      setPreviewing(template);
    }
    const counted = await countWhatIsAlreadyThere();
    if (counted !== undefined) setExisting(counted);
  }, []);

  const confirmImport = async () => {
    if (previewing === null || userId === null) return;

    setImporting(true);
    setError(null);

    try {
      // A course becomes its own tracker, so the student's other courses are
      // untouched and switching between them switches everything.
      const tracker = await useTrackersStore.getState().add(previewing.name, previewing.id);
      if (tracker === null) throw new Error('Could not create the course');

      await importTemplate(userId, previewing, getRepositories(), tracker.id);

      setPreviewing(null);

      // The tracker reloads its data when it receives focus, and the new course
      // is already the active one, so it opens on the imported syllabus.
      router.push('/');
    } catch {
      setError('We could not import that template. Try again.');
    } finally {
      setImporting(false);
    }
  };

  const sortOptions: ChipOption[] = [
    ...(searching
      ? [{ id: 'relevance', label: 'Best match' }]
      : [{ id: 'category', label: 'By category' }]),
    { id: 'name', label: 'A–Z' },
    { id: 'size', label: 'Most topics' },
    ...(recent.length > 0 ? [{ id: 'recent', label: 'Recently used' }] : []),
  ];

  const groupLabel = filters.group === null ? null : templateGroup(filters.group).label;
  const browsing = !searching && !filtering;

  const header = (
    <View style={{ gap: theme.spacing.base, marginBottom: theme.spacing.base }}>
      <AppHeader overline="Choose a course" title="Templates">
        <Text variant="body" tone="secondary">
          Pick the exam or course you are preparing for and PrepPilot fills in its syllabus. You can
          edit any of it afterwards.
        </Text>
      </AppHeader>

      <TextField
        label="Search"
        placeholder="Exam, board, class or course"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        testID="template-search"
        autoFocus={search === '1'}
        returnKeyType="search"
        accessibilityHint="Searches template names, exam names, boards, classes and subjects"
        hint={searching ? `${plural(results.length)}` : undefined}
      />

      {browsing ? (
        <>
          <Text variant="caption" tone="muted" overline accessibilityRole="header">
            Browse by category
          </Text>
          <CategoryGrid groups={allGroups} onSelect={chooseGroup} />
        </>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {groupLabel !== null && (
            <View style={styles.breadcrumb}>
              <Button
                label="‹ All categories"
                size="small"
                variant="ghost"
                onPress={() => chooseGroup(null)}
                testID="library-all-categories"
              />
              <Text
                variant="body"
                weight="semibold"
                accessibilityRole="header"
                style={styles.crumb}
              >
                {groupLabel}
              </Text>
            </View>
          )}

          {filters.group === null ? (
            <ChipRow
              label="Category"
              options={[{ id: null, label: 'All', count: matching.length }, ...groups]}
              selected={null}
              onSelect={chooseGroup}
              testID="filter-category"
            />
          ) : (
            subgroups.length > 1 && (
              <ChipRow
                label="Subcategory"
                options={[{ id: null, label: 'All', count: inGroup.length }, ...subgroups]}
                selected={filters.subgroup}
                onSelect={(subgroup) =>
                  setFilters({ ...filters, subgroup, classLevel: null, stream: null })
                }
                testID="filter-subcategory"
              />
            )
          )}

          {classes.length > 1 && (
            <ChipRow
              label="Class"
              options={[{ id: null, label: 'Any class' }, ...classes]}
              selected={filters.classLevel}
              onSelect={(classLevel) => setFilters({ ...filters, classLevel, stream: null })}
              testID="filter-class"
            />
          )}
          {streams.length > 1 && (
            <ChipRow
              label="Stream"
              options={[{ id: null, label: 'Any stream' }, ...streams]}
              selected={filters.stream}
              onSelect={(stream) => setFilters({ ...filters, stream })}
              testID="filter-stream"
            />
          )}
        </View>
      )}

      <View style={{ gap: theme.spacing.sm }}>
        <Text
          variant="body"
          weight="semibold"
          accessibilityRole="header"
          testID="library-count"
          accessibilityLiveRegion="polite"
        >
          {browsing ? `All templates · ${results.length}` : `${plural(results.length)} found`}
        </Text>
        {results.length > 1 && (
          <ChipRow
            label="Sort by"
            options={sortOptions}
            selected={sort}
            onSelect={(choice) => setSortChoice(choice as LibrarySort)}
            testID="sort"
          />
        )}
      </View>
    </View>
  );

  const footer = (
    <View style={{ gap: theme.spacing.base, marginTop: theme.spacing.base }}>
      {library.error !== null && (
        <Text variant="small" tone="danger" accessibilityRole="alert" testID="library-error">
          {library.error}
        </Text>
      )}
      {library.status === 'loading' && (
        <Text variant="small" tone="muted" testID="library-loading">
          Loading more templates…
        </Text>
      )}
      {library.status === 'failed' && (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="small" tone="secondary" testID="library-failed">
            {"Couldn't load the online templates. Check your connection."}
          </Text>
          <Button
            label="Try again"
            size="small"
            variant="ghost"
            testID="library-retry"
            onPress={() => void library.load()}
          />
        </View>
      )}

      <Card>
        <Text variant="caption" tone="muted" overline>
          Custom
        </Text>

        <Text variant="bodyLarge" weight="semibold" style={{ marginTop: theme.spacing.xxs }}>
          Build your own
        </Text>

        <Text variant="small" tone="secondary" style={{ marginTop: theme.spacing.xxs }}>
          Start a new course of your own: name it, then add its subjects, chapters and topics.
          Nothing here has to come from a template, and the course you are on is left as it is.
        </Text>

        <View style={{ marginTop: theme.spacing.base }}>
          {/*
            A new course, not a subject in the one showing. It used to write a
            subject straight into the active course, which made it a second
            "Add subject" rather than a way to start something new.
          */}
          <Button
            label="Build from scratch"
            variant="secondary"
            testID="build-from-scratch"
            onPress={() => router.push('/build-course')}
          />
        </View>
      </Card>

      <Card>
        <Text variant="caption" tone="muted" overline>
          About These Templates
        </Text>

        <Text variant="small" tone="secondary" style={{ marginTop: theme.spacing.sm }}>
          Importing a template starts a separate course with that syllabus in it, leaving anything
          you are already studying untouched. You can rename, reorder, add to or delete any part of
          it afterwards, and switch between courses from the button at the top left.
        </Text>
      </Card>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: LibraryTemplateItem }) => (
      <TemplateCard
        item={item}
        opening={library.opening === item.id}
        disabled={library.opening !== null}
        onOpen={(chosen) => void openItem(chosen)}
      />
    ),
    [library.opening, openItem],
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <EmptyState
            title="No templates found"
            description="Try a different name or browse all categories."
            actionLabel="Clear search and filters"
            onAction={reset}
            testID={searching ? 'templates-no-results' : 'templates-empty'}
          />
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ padding: theme.spacing.base }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        showsVerticalScrollIndicator={false}
        testID="template-results"
      />

      <Sheet
        visible={previewing !== null}
        onDismiss={() => {
          if (!importing) {
            setPreviewing(null);
            setError(null);
          }
        }}
        label="Template preview"
      >
        {previewing !== null && <TemplatePreview template={previewing} existing={existing} />}

        {error !== null && (
          <Text variant="small" tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        )}

        <View style={styles.actions}>
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => {
              setPreviewing(null);
              setError(null);
            }}
          />

          <Button label="Import" loading={importing} onPress={() => void confirmImport()} />
        </View>
      </Sheet>
    </Screen>
  );
}

/**
 * Whether the student already has a syllabus.
 *
 * Only decides whether to reassure them that this import leaves it alone —
 * there is nothing to warn about, since nothing is removed. Undefined when
 * nobody is signed in; null when the count could not be read.
 */
async function countWhatIsAlreadyThere(): Promise<
  { subjects: number; notes: number } | null | undefined
> {
  const user = useAuthStore.getState().user?.id ?? null;
  if (user === null) return undefined;

  try {
    const repositories = getRepositories();
    // Scoped to the course showing: what sits in another course is not what
    // the student is being reassured about here.
    const tracker = useTrackersStore.getState().activeId;
    const [subjects, notes] = await Promise.all([
      repositories.subjects.listByUser(user, tracker),
      repositories.notes.listByUser(user, tracker),
    ]);
    return { subjects: subjects.length, notes: notes.length };
  } catch {
    // A missing count must not stop the preview opening; the copy falls back
    // to the general warning below.
    return null;
  }
}

function Separator() {
  return <View style={styles.separator} />;
}

/** How many topics to show under each chapter of the open subject. */
const SAMPLE_TOPICS = 3;

export function TemplatePreview({
  template,
  existing = null,
}: {
  readonly template: SyllabusTemplate;
  /** What is there now, so the note only appears when there is something to keep. */
  readonly existing?: { subjects: number; notes: number } | null;
}) {
  const theme = useTheme();
  const counts = useMemo(() => countTemplate(template), [template]);
  const startsAnother = existing !== null && existing.subjects > 0;
  const placement = placeTemplate(template.id);
  // One subject open at a time: a 60-subject syllabus listed in full would bury
  // the Import button under thousands of lines.
  const [open, setOpen] = useState(0);

  return (
    <>
      {placement.group !== 'other' && (
        <Text variant="caption" tone="muted" overline testID="preview-category">
          {templateGroup(placement.group).label} ·{' '}
          {subgroupLabel(placement.group, placement.subgroup)}
        </Text>
      )}
      <Text variant="title">{template.name}</Text>

      <Text variant="small" tone="secondary">
        Adds {counts.subjects} subjects, {counts.chapters} chapters and {counts.topics} topics.
      </Text>
      <Text variant="caption" tone="muted">
        This is a preview. Nothing is added until you press Import.
      </Text>

      {/*
        A student who already has a syllabus is told plainly that this one does
        not disturb it. Left as a note rather than an alert: nothing here is
        destructive, and dressing it in red would teach them to ignore the
        warnings that are.
      */}
      {startsAnother && (
        <View
          accessible
          testID="new-course-note"
          style={[
            styles.warning,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              borderLeftColor: theme.colors.accent,
            },
          ]}
        >
          <Text variant="small" weight="semibold">
            This starts a separate course
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xxs }}>
            Your current syllabus, notes and cards stay exactly as they are. Switch between courses
            from the button at the top left.
          </Text>
        </View>
      )}

      {/*
        Tell the student where the syllabus came from and whether
        it has been verified before they import it.
      */}
      <Text variant="caption" tone={template.verified ? 'muted' : 'danger'}>
        {template.verified
          ? template.source
          : `Not checked — ${template.source}. Compare it against your own syllabus.`}
      </Text>

      <ScrollView style={styles.preview} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {template.subjects.map((subject, index) => {
          const expanded = index === open;
          const topics = subject.chapters.reduce((n, chapter) => n + chapter.topics.length, 0);
          return (
            <View key={`${index}-${subject.name}`} style={{ marginBottom: theme.spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityHint={expanded ? undefined : 'Shows its chapters'}
                onPress={() => setOpen(expanded ? -1 : index)}
                style={styles.subjectRow}
                testID={`preview-subject-${index}`}
              >
                <Text variant="body" weight="medium" style={styles.subjectName}>
                  {subject.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {subject.chapters.length} ch · {topics} topics {expanded ? '▴' : '▾'}
                </Text>
              </Pressable>

              {expanded &&
                subject.chapters.map((chapter, c) => (
                  <View
                    key={`${c}-${chapter.name}`}
                    style={{ marginLeft: theme.spacing.md, marginTop: theme.spacing.xxs }}
                  >
                    <Text variant="caption" tone="secondary">
                      {chapter.name} · {chapter.topics.length} topics
                    </Text>
                    {chapter.topics.length > 0 && (
                      <Text
                        variant="caption"
                        tone="muted"
                        numberOfLines={1}
                        style={{ marginLeft: theme.spacing.sm }}
                      >
                        {chapter.topics
                          .slice(0, SAMPLE_TOPICS)
                          .map((topic) => topic.name)
                          .join(', ')}
                        {chapter.topics.length > SAMPLE_TOPICS ? ', …' : ''}
                      </Text>
                    )}
                  </View>
                ))}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  warning: { borderLeftWidth: 3 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  crumb: { flexShrink: 1 },
  separator: { height: 12 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  subjectName: { flex: 1 },

  preview: {
    maxHeight: 320,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
