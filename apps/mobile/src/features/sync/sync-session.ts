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
 * **Pull before the courses are loaded.** Loading courses on a device with none
 * creates a first one to put work in. On a fresh install that meant an empty
 * "My studies" was created before the student's real courses arrived — and was
 * then pushed, leaving a spare empty course on the account after every
 * reinstall. Pulling first means the real ones are already there to load.
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

    // Sign-in sync. A failure is not fatal: everything is already on the
    // device, the courses still load below, and the next trigger retries.
    await sync();
    if (stopped) return;

    await loadCourses();
    if (stopped) return;

    // Only after the first load: that load already reflects the first sync, and
    // reloading again straight away would redraw every screen for nothing.
    cleanups.push(
      useSyncStore.subscribe((state, previous) => {
        if (state.generation !== previous.generation) void loadCourses();
      }),
    );

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
