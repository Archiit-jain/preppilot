import type { Repositories } from '../../db/client';
import type { TrackerRow } from '../../db/schema';
import { importSubjects } from '../templates/import-template';
import { useTrackersStore } from '../trackers/trackers-store';
import { toTemplateSubjects, validateCourseDraft, type CourseDraft } from './course-form';

/**
 * Writes a finished "Build from scratch" form as a NEW course.
 *
 * The course is created first and becomes the one showing, then the syllabus is
 * written into it by the same import a bundled template uses. Nothing already on
 * the account is touched: the course the student was on keeps every subject it
 * had, which is the whole difference between this and adding a subject.
 *
 * All-or-nothing from the student's point of view. If the syllabus cannot be
 * written, the course just made is removed again and the one they were on is
 * put back, so a failure never leaves a half-built course in the switcher.
 */
export async function createCourse(
  userId: string,
  draft: CourseDraft,
  repositories: Repositories,
): Promise<TrackerRow> {
  // The screen validates before calling, but a course written with a missing
  // level is not a state to reach by any route.
  const [problem] = validateCourseDraft(draft);
  if (problem !== undefined) throw new Error(problem.message);

  const trackers = useTrackersStore.getState();
  const previous = trackers.activeId;

  const course = await trackers.add(draft.name.trim());
  if (course === null) throw new Error('Could not create the course');

  try {
    await importSubjects(userId, toTemplateSubjects(draft), repositories, course.id);
    return course;
  } catch (error) {
    await useTrackersStore.getState().remove(course.id);
    if (previous !== null) await useTrackersStore.getState().select(previous);
    throw error;
  }
}
