import type { Repositories } from '../../db/client';
import { useNetworkStore } from '../network/network-store';
import { useTrackersStore } from '../trackers/trackers-store';
import { startAutoSync, type AppStateSource } from './auto-sync';
import type { Remote } from './remote';
import { useSyncStore } from './sync-store';

export interface SyncSessionOptions {
  readonly userId: string;
  readonly repositories: Repositories;
  /** Test seams. The app passes neither. */
  readonly remote?: Remote;
  readonly appState?: AppStateSource;
  readonly watchNetwork?: boolean;
}

/**
 * Everything sync does for as long as a student is signed in.
 *
 * **Local first, then the server.** A phone that already holds courses shows
 * them straight away and syncs behind them. A phone holding none pulls first:
 * loading courses there creates an empty one to put work in, which on a fresh
 * install was then pushed — a spare empty course after every reinstall.
 *
 * After that: sync again whenever the connection returns, every five minutes
 * while the app is open, and when the student leaves it (see `startAutoSync`).
 * A sync that brings in new rows also reloads the course list, because a course
 * created on another device should appear in the switcher, not only after a
 * restart.
 *
 * Returns a function that stops all of it, for when the student signs out.
 */
export function startSyncSession({
  userId,
  repositories,
  remote,
  appState,
  watchNetwork = true,
}: SyncSessionOptions): () => void {
  let stopped = false;
  const cleanups: (() => void)[] = [];

  const sync = () => useSyncStore.getState().syncNow(userId, { repositories, remote });
  const loadCourses = () => useTrackersStore.getState().load(userId, repositories);

  void (async () => {
    await useSyncStore.getState().hydrate(userId, repositories);
    if (stopped) return;

    const reloadOnPull = () =>
      cleanups.push(
        useSyncStore.subscribe((state, previous) => {
          if (state.generation !== previous.generation) void loadCourses();
        }),
      );

    // What is already on the phone is shown first, and the server is asked
    // after. The server can take seconds; the local database takes none, and a
    // student reopening the app should see their syllabus, not wait on a
    // network round-trip for work that never left the device.
    //
    // A phone with nothing on it yet is the exception. Loading courses there
    // creates a first one to put work in, so doing it before the pull would
    // invent an empty course and push it — pulling first means the real ones
    // are there to load.
    const hasLocalCourses = (await repositories.trackers.listByUser(userId)).length > 0;
    if (stopped) return;

    if (hasLocalCourses) {
      await loadCourses();
      if (stopped) return;
      // Subscribed before the sync, so courses it brings in appear too.
      reloadOnPull();
    }

    // Sign-in sync. A failure is not fatal: whatever is on the device is
    // already showing, and the next trigger retries.
    await sync();
    if (stopped) return;

    if (!hasLocalCourses) {
      await loadCourses();
      if (stopped) return;
      // Only after this first load: it already reflects the first sync.
      reloadOnPull();
    }

    // PRD §22 asks for a retry after a network failure, and waiting for the
    // student to notice and press something is not that.
    if (watchNetwork) {
      const stopWatching = await useNetworkStore.getState().start(() => void sync());
      if (stopped) {
        stopWatching();
        return;
      }
      cleanups.push(stopWatching);
    }

    cleanups.push(startAutoSync(sync, appState));
  })();

  return () => {
    stopped = true;
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
}
