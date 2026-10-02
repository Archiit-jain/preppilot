import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useWindowDimensions, type ColorValue } from 'react-native';
import { Icon, type IconName } from '../../components/ui';
import { getRepositories } from '../../db/client';
import { useAuthStore } from '../../features/auth/auth-store';
import { configureFocusContext } from '../../features/focus/focus-store';
import { startSyncSession } from '../../features/sync/sync-session';
import { configureTimerContext } from '../../features/timer/timer-store';
import { useTheme } from '../../theme/theme-context';

/**
 * Routes that require a session.
 *
 * PrepPilot requires sign-in before the tracker is available (DECISIONS.md, D1),
 * so this guard is the single place that decision is enforced.
 *
 * The Tracker is the first tab because PRD §19 makes it the primary screen; the
 * Dashboard summarises it rather than replacing it.
 */
/**
 * Builds a tab icon renderer.
 *
 * Defined outside the component so the function identity is stable — an inline
 * arrow would be a new prop on every render and remount each icon.
 */
function tabIcon(name: IconName) {
  return function TabIcon({ color }: { readonly color: ColorValue }) {
    return <Icon name={name} color={String(color)} size={22} />;
  };
}

/**
 * Below this, the labels stop fitting and the bar shows icons alone.
 *
 * With four tabs there is room on any phone, so this now only bites in a very
 * narrow window. The full name is what a screen reader announces either way.
 */
export const LABELLED_TABS_MIN_WIDTH = 320;

/**
 * The four destinations.
 *
 * Everything else — the template library, the assistant, settings, reminders,
 * Focus Mode — is reached from the header or from the screen it belongs to.
 * Eight tabs was more than a phone can label, and most of them were not places a
 * student returns to between every action.
 *
 * The name is given explicitly rather than left to the visible label: hiding
 * labels on a narrow screen removes them from the accessibility tree too, which
 * had left the tabs announcing nothing but "tab". The icon is decorative; this is
 * the only thing naming the destination.
 */
export const TABS = [
  { name: 'index', title: 'Tracker', icon: 'tracker' },
  { name: 'flashcards', title: 'Cards', icon: 'cards' },
  { name: 'notes', title: 'Notes', icon: 'notes' },
  { name: 'sessions', title: 'Sessions', icon: 'sessions' },
] as const satisfies readonly { name: string; title: string; icon: IconName }[];

/** Reachable, but not from the tab bar. */
const OFF_BAR = [
  'templates',
  'build-course',
  'assistant',
  'settings',
  'reminders',
  'focus',
  'timer',
  'dashboard',
  'history',
  'design-system',
] as const;

export default function AppLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const showLabels = width >= LABELLED_TABS_MIN_WIDTH;
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const recoveringPassword = useAuthStore((state) => state.recoveringPassword);

  useEffect(() => {
    if (userId === null) return;

    const repositories = getRepositories();
    configureTimerContext({ userId, sessions: repositories.sessions, now: () => Date.now() });
    configureFocusContext({ userId, sessions: repositories.sessions, now: () => Date.now() });

    // Close out any session left running when the app was last killed. Its last
    // heartbeat is kept, so the study time is not lost, but it is marked
    // abandoned rather than completed because no accurate end time exists.
    void repositories.sessions.abandonInterrupted(userId);

    // Syncs on sign-in, then loads the courses — creating the first and
    // claiming any rows written before trackers existed — and keeps syncing
    // while the student stays signed in. See startSyncSession for the order.
    return startSyncSession({ userId, repositories });
  }, [userId]);

  if (status === 'signedOut') return <Redirect href="/login" />;
  // A password-reset link signs the student in; the new password comes first.
  if (recoveringPassword) return <Redirect href="/auth/new-password" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor:
            (theme.look?.components.tabBar.borderWidth ?? 1) >= 2
              ? theme.colors.textPrimary
              : theme.colors.border,
          borderTopWidth: theme.look?.components.tabBar.borderWidth ?? 1,
          // The height has to hold everything stacked inside it: 6 + 8 of our
          // padding, the 1px border, React Navigation's 5px above and below each
          // tab, the 28px icon row and the 14px label line — 67 in all. At 62 the
          // label was left 9px and its lower half was cut off.
          //
          // Without labels the bar does not need the room for them, but it still
          // needs a comfortable touch target.
          height: showLabels ? 67 : 56,
          paddingTop: showLabels ? 6 : 10,
          paddingBottom: 8,
        },
        tabBarShowLabel: showLabels,
        // The line height is pinned rather than left to the font's "normal",
        // which differs between Inter builds and platforms and is what the bar's
        // height above is measured against.
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontFamily: theme.look?.fonts.body.semibold ?? 'Inter_500Medium',
        },
        tabBarItemStyle: { paddingHorizontal: 2 },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: tabIcon(tab.icon),
            tabBarAccessibilityLabel: tab.title,
          }}
        />
      ))}
      {OFF_BAR.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
