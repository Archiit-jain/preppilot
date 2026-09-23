import { waitFor } from '@testing-library/react-native';
import type { AppStateStatus } from 'react-native';
import type { Repositories } from '../../../db/client';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../../../db/test-support/test-database';
import { resetTrackerStore, useTrackerStore } from '../../tracker/tracker-store';
import { resetTrackersStore, useTrackersStore } from '../../trackers/trackers-store';
import type { AppStateSource } from '../auto-sync';
import { startSyncSession } from '../sync-session';
import { resetSyncStore, useSyncStore } from '../sync-store';
import { createFakeRemote } from '../test-support/fake-remote';

const USER = 'user-1';
const T = 1_700_000_000_000;
const iso = new Date(T).toISOString();

let db: ReturnType<typeof createTestDatabase>;
let repositories: Repositories;
let fake: ReturnType<typeof createFakeRemote>;
let stop: (() => void) | null = null;

/** Parked in the background so the five-minute timer stays out of these tests. */
const backgrounded: AppStateSource = {
  currentState: 'background' as AppStateStatus,
  addEventListener: () => ({ remove: () => {} }),
};

beforeEach(() => {
  db = createTestDatabase();
  repositories = createTestRepositories(db, createTestClock(T));
  fake = createFakeRemote();
  resetSyncStore();
  resetTrackersStore();
  resetTrackerStore();
});

afterEach(() => {
  stop?.();
  stop = null;
  db.$close();
});

const begin = () => {
  stop = startSyncSession({
    userId: USER,
    repositories,
    remote: fake.remote,
    appState: backgrounded,
    watchNetwork: false,
  });
};

/** What the server holds after a student built a course and ticked a topic. */
function seedServerCourse() {
  fake.seed('trackers', {
    id: 'jee',
    user_id: USER,
    name: 'JEE Main 2026',
    template_id: 'jee-main',
    position: 0,
    created_at: iso,
    updated_at: iso,
    deleted_at: null,
  } as never);
  fake.seed('subjects', {
    id: 'maths',
    user_id: USER,
    tracker_id: 'jee',
    name: 'Mathematics',
    description: null,
    position: 0,
    created_at: iso,
    updated_at: iso,
    deleted_at: null,
  } as never);
  fake.seed('chapters', {
    id: 'sets',
    user_id: USER,
    subject_id: 'maths',
    name: 'Sets',
    position: 0,
    created_at: iso,
    updated_at: iso,
    deleted_at: null,
  } as never);
  fake.seed('topics', {
    id: 'union',
    user_id: USER,
    chapter_id: 'sets',
    name: 'Union',
    completed: true,
    completed_changed_at: iso,
    note: null,
    position: 0,
    created_at: iso,
    updated_at: iso,
    deleted_at: null,
  } as never);
}

/**
 * The reinstall the student reported: signed in on an empty phone, and the
 * tracker showed nothing until "Sync now" was pressed by hand.
 */
describe('signing in on a fresh install', () => {
  it('syncs straight away, without being asked', async () => {
    seedServerCourse();
    begin();

    await waitFor(() => expect(useSyncStore.getState().lastResult).not.toBeNull());
    expect(useSyncStore.getState().lastResult!.pulled).toBeGreaterThan(0);
  });

  it('opens on the course from the server, not an empty stand-in', async () => {
    seedServerCourse();
    begin();

    await waitFor(() => expect(useTrackersStore.getState().trackers.length).toBeGreaterThan(0));

    // Loading courses before the pull used to create "My studies" on an empty
    // phone, which was then pushed — a spare empty course after every reinstall.
    expect(useTrackersStore.getState().trackers.map((t) => t.name)).toEqual(['JEE Main 2026']);
    expect(useTrackersStore.getState().activeId).toBe('jee');
    expect(fake.rows('trackers').map((row) => row.id)).toEqual(['jee']);
  });

  it('brings back the ticks made before the reinstall', async () => {
    seedServerCourse();
    begin();
    await waitFor(() => expect(useTrackersStore.getState().activeId).toBe('jee'));

    await useTrackerStore.getState().load(USER, repositories);

    const topic = useTrackerStore.getState().subjects[0]!.chapters[0]!.topics[0]!;
    expect(topic.name).toBe('Union');
    expect(topic.completed).toBe(true);
  });

  it('still gives a brand-new student a course to start in', async () => {
    begin();

    await waitFor(() => expect(useTrackersStore.getState().trackers).toHaveLength(1));
  });
});

/** Screens re-read when this moves; a quiet sync must not redraw everything. */
describe('telling screens to re-read', () => {
  it('moves when a sync brings rows in', async () => {
    seedServerCourse();
    begin();

    await waitFor(() => expect(useSyncStore.getState().generation).toBe(1));
  });

  it('stays put when a sync brings nothing', async () => {
    begin();
    await waitFor(() => expect(useSyncStore.getState().lastResult).not.toBeNull());

    expect(useSyncStore.getState().generation).toBe(0);
  });

  it('reloads the course list when a later sync brings a new course', async () => {
    seedServerCourse();
    begin();
    await waitFor(() => expect(useTrackersStore.getState().trackers).toHaveLength(1));

    // Created on another device since.
    const later = new Date(T + 60_000).toISOString();
    fake.seed('trackers', {
      id: 'neet',
      user_id: USER,
      name: 'NEET 2027',
      template_id: null,
      position: 1,
      created_at: later,
      updated_at: later,
      deleted_at: null,
    } as never);
    await useSyncStore.getState().syncNow(USER, { repositories, remote: fake.remote });

    await waitFor(() =>
      expect(useTrackersStore.getState().trackers.map((t) => t.name)).toEqual([
        'JEE Main 2026',
        'NEET 2027',
      ]),
    );
  });
});

/** PRD §22: retry after a network failure without the student having to notice. */
describe('the connection coming back', () => {
  it('syncs again, and stops listening on sign-out', async () => {
    const { useNetworkStore } = jest.requireActual<typeof import('../../network/network-store')>(
      '../../network/network-store',
    );
    const original = useNetworkStore.getState().start;
    let reconnect: (() => void) | undefined;
    const stopWatching = jest.fn();
    useNetworkStore.setState({
      start: async (onReconnect?: () => void) => {
        reconnect = onReconnect;
        return stopWatching;
      },
    });

    try {
      const stopSession = startSyncSession({
        userId: USER,
        repositories,
        remote: fake.remote,
        appState: backgrounded,
      });
      await waitFor(() => expect(reconnect).toBeDefined());

      const before = useSyncStore.getState().lastResult;
      reconnect!();
      await waitFor(() => expect(useSyncStore.getState().lastResult).not.toBe(before));

      stopSession();
      expect(stopWatching).toHaveBeenCalled();
    } finally {
      useNetworkStore.setState({ start: original });
    }
  });
});

describe('signing out part-way through start-up', () => {
  it('does not start anything once stopped', async () => {
    seedServerCourse();
    const stopSession = startSyncSession({
      userId: USER,
      repositories,
      remote: fake.remote,
      appState: backgrounded,
      watchNetwork: false,
    });

    stopSession();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Nothing pulled and no course loaded. Observed through the results rather
    // than a spy on the store: Zustand copies its methods onto every new state,
    // so a spy leaks into later tests and silently disables their syncs.
    expect(useSyncStore.getState().lastResult).toBeNull();
    expect(useTrackersStore.getState().trackers).toEqual([]);
  });
});

describe('reopening the app', () => {
  it('shows the courses already on the phone before the server answers', async () => {
    await repositories.trackers.create({ userId: USER, name: 'JEE Main 2026' });

    // A server that has not answered yet.
    let answer: () => void = () => {};
    const slow = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const pull = fake.remote.pull.bind(fake.remote);
    const slowRemote = {
      ...fake.remote,
      pull: async (...args: Parameters<typeof fake.remote.pull>) => {
        await slow;
        return pull(...args);
      },
    };

    stop = startSyncSession({
      userId: USER,
      repositories,
      remote: slowRemote,
      appState: backgrounded,
      watchNetwork: false,
    });

    await waitFor(() =>
      expect(useTrackersStore.getState().trackers.map((t) => t.name)).toEqual(['JEE Main 2026']),
    );
    expect(useSyncStore.getState().lastResult).toBeNull();

    answer();
    await waitFor(() => expect(useSyncStore.getState().lastResult).not.toBeNull());
  });

  it('still adds a course that arrives with that sync', async () => {
    await repositories.trackers.create({ userId: USER, name: 'JEE Main 2026' });
    fake.seed('trackers', {
      id: 'neet',
      user_id: USER,
      name: 'NEET 2027',
      template_id: null,
      position: 1,
      created_at: iso,
      updated_at: iso,
      deleted_at: null,
    } as never);

    begin();

    await waitFor(() =>
      expect(
        useTrackersStore
          .getState()
          .trackers.map((t) => t.name)
          .sort(),
      ).toEqual(['JEE Main 2026', 'NEET 2027']),
    );
  });
});
