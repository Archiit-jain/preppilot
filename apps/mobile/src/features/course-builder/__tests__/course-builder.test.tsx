import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Repositories } from '../../../db/client';
import { getRepositories } from '../../../db/client';
import {
  createTestClock,
  createTestDatabase,
  createTestRepositories,
} from '../../../db/test-support/test-database';
import { getInModal, renderWithTheme } from '../../../test-utils/render';
import { useAuthStore } from '../../auth/auth-store';
import { resetTrackersStore, useTrackersStore } from '../../trackers/trackers-store';
import { emptyCourseDraft } from '../course-form';
import { CourseBuilderScreen } from '../course-builder-screen';
import { createCourse } from '../create-course';

jest.mock('../../../db/client', () => ({ getRepositories: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));

const USER = 'user-1';

let db: ReturnType<typeof createTestDatabase>;
let repositories: Repositories;
/** The course the student is on before they build a new one. */
let existingCourseId: string;

beforeEach(async () => {
  db = createTestDatabase();
  repositories = createTestRepositories(db, createTestClock());
  jest.mocked(getRepositories).mockReturnValue(repositories);
  jest.mocked(router.push).mockClear();
  useAuthStore.setState({ user: { id: USER } as never, status: 'signedIn' });

  // As the app layout does: load the courses before any screen renders. A
  // first-time student is given one, and it already has a subject in it.
  resetTrackersStore();
  await useTrackersStore.getState().load(USER, repositories);
  existingCourseId = useTrackersStore.getState().activeId!;
  await repositories.subjects.create({
    userId: USER,
    name: 'History',
    trackerId: existingCourseId,
  });
});

afterEach(() => {
  db.$close();
});

const type = (testID: string, text: string) => {
  fireEvent.changeText(screen.getByTestId(testID), text);
};

const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};

/** Fills the one subject, chapter and topic a fresh form starts with. */
const fillSmallestCourse = () => {
  type('course-name', 'UPSC Prelims');
  type('subject-0-name', 'Polity');
  type('subject-0-chapter-0-name', 'Constitution');
  type('subject-0-chapter-0-topic-0', 'Preamble');
};

const subjectNames = async (trackerId: string) =>
  (await repositories.subjects.listByUser(USER, trackerId)).map((row) => row.name);

/**
 * The bug this screen exists to fix: "Build from scratch" used to write a
 * subject into whichever course was showing, which made it a second "Add
 * subject". It has to start a NEW course and leave the current one alone.
 */
describe('building a course from scratch', () => {
  it('creates a new course rather than adding a subject to the one showing', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('create-course');

    const courses = await repositories.trackers.listByUser(USER);
    expect(courses).toHaveLength(2);

    const created = courses.find((course) => course.id !== existingCourseId)!;
    expect(created.name).toBe('UPSC Prelims');
    // Built by the student, not imported: the switcher does not call it a template.
    expect(created.templateId).toBeNull();

    // The course the student was on keeps exactly what it had.
    expect(await subjectNames(existingCourseId)).toEqual(['History']);
    expect(await subjectNames(created.id)).toEqual(['Polity']);
  });

  it('switches to the new course and opens the tracker on it', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('create-course');

    const active = useTrackersStore.getState().activeId;
    expect(active).not.toBe(existingCourseId);
    expect(useTrackersStore.getState().trackers.find((course) => course.id === active)?.name).toBe(
      'UPSC Prelims',
    );
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('writes every subject, chapter and topic in the order they were typed', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();

    await press('subject-0-chapter-0-add-topic');
    type('subject-0-chapter-0-topic-1', 'Fundamental rights');
    await press('subject-0-add-chapter');
    type('subject-0-chapter-1-name', 'Parliament');
    type('subject-0-chapter-1-topic-0', 'Lok Sabha');

    await press('add-subject-row');
    type('subject-1-name', 'Economy');
    type('subject-1-chapter-0-name', 'Budget');
    type('subject-1-chapter-0-topic-0', 'Fiscal deficit');

    await press('create-course');

    const created = useTrackersStore.getState().activeId!;
    const subjects = await repositories.subjects.listByUser(USER, created);
    expect(subjects.map((row) => row.name)).toEqual(['Polity', 'Economy']);

    const polity = await repositories.chapters.listBySubject(subjects[0]!.id);
    expect(polity.map((row) => row.name)).toEqual(['Constitution', 'Parliament']);
    const constitution = await repositories.topics.listByChapter(polity[0]!.id);
    expect(constitution.map((row) => row.name)).toEqual(['Preamble', 'Fundamental rights']);
    const parliament = await repositories.topics.listByChapter(polity[1]!.id);
    expect(parliament.map((row) => row.name)).toEqual(['Lok Sabha']);

    const economy = await repositories.chapters.listBySubject(subjects[1]!.id);
    expect(economy.map((row) => row.name)).toEqual(['Budget']);
    const budget = await repositories.topics.listByChapter(economy[0]!.id);
    expect(budget.map((row) => row.name)).toEqual(['Fiscal deficit']);
  });

  it('opens on an empty form again once a course is created', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('create-course');

    expect(screen.getByTestId('course-name').props.value).toBe('');
    expect(screen.queryByTestId('subject-1')).toBeNull();
  });
});

describe('an incomplete form', () => {
  it('creates nothing and says what is missing', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    await press('create-course');

    expect(screen.getByText('The course needs a name.')).toBeOnTheScreen();
    expect(screen.getByTestId('builder-issues')).toHaveTextContent(/4 things need fixing/);
    expect(await repositories.trackers.listByUser(USER)).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('refuses a blank topic row rather than quietly dropping it', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('subject-0-chapter-0-add-topic');
    await press('create-course');

    expect(screen.getByText('Topic 2 in Constitution needs a name.')).toBeOnTheScreen();
    expect(await repositories.trackers.listByUser(USER)).toHaveLength(1);
  });

  it('stops flagging a field once it is fixed', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    type('course-name', '');
    await press('create-course');
    expect(screen.getByText('The course needs a name.')).toBeOnTheScreen();

    type('course-name', 'UPSC Prelims');

    expect(screen.queryByText('The course needs a name.')).toBeNull();
    expect(screen.queryByTestId('builder-issues')).toBeNull();
  });

  it('opens a folded subject that has a problem inside it', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    type('course-name', 'UPSC Prelims');
    type('subject-0-name', 'Polity');
    await press('subject-0-toggle');
    expect(screen.getByTestId('subject-0-summary')).toHaveTextContent('1 chapter · 1 topic');
    expect(screen.queryByTestId('subject-0-chapter-0-name')).toBeNull();

    await press('create-course');

    expect(screen.getByTestId('subject-0-chapter-0-name')).toBeOnTheScreen();
    expect(screen.getByText('Chapter 1 in Polity needs a name.')).toBeOnTheScreen();
  });
});

describe('removing rows', () => {
  it('only offers to remove a row when there is another beside it', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    expect(screen.queryByTestId('subject-0-remove')).toBeNull();
    expect(screen.queryByTestId('subject-0-chapter-0-remove')).toBeNull();
    expect(screen.queryByTestId('subject-0-chapter-0-topic-0-remove')).toBeNull();

    await press('add-subject-row');
    expect(screen.getByTestId('subject-0-remove')).toBeOnTheScreen();
  });

  it('leaves a removed row out of the course', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('subject-0-chapter-0-add-topic');
    type('subject-0-chapter-0-topic-1', 'Discarded');
    await press('subject-0-chapter-0-topic-1-remove');
    await press('create-course');

    const created = useTrackersStore.getState().activeId!;
    const [subject] = await repositories.subjects.listByUser(USER, created);
    const [chapter] = await repositories.chapters.listBySubject(subject!.id);
    const topics = await repositories.topics.listByChapter(chapter!.id);
    expect(topics.map((row) => row.name)).toEqual(['Preamble']);
  });
});

describe('leaving without creating', () => {
  it('goes straight back when nothing has been typed', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    await press('builder-cancel');

    expect(screen.queryByText('Discard this course?')).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/templates');
  });

  it('asks first once something has been typed', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    type('course-name', 'UPSC Prelims');
    await press('builder-cancel');

    expect(screen.getByText('Discard this course?')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps everything when the student chooses to keep editing', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    type('course-name', 'UPSC Prelims');
    await press('builder-cancel');
    await act(async () => {
      fireEvent.press(getInModal('Keep editing'));
    });

    expect(screen.getByTestId('course-name').props.value).toBe('UPSC Prelims');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('creates nothing when discarded', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('builder-cancel');
    await act(async () => {
      fireEvent.press(getInModal('Discard'));
    });

    expect(router.push).toHaveBeenCalledWith('/templates');
    expect(await repositories.trackers.listByUser(USER)).toHaveLength(1);
    expect(await subjectNames(existingCourseId)).toEqual(['History']);
  });
});

/**
 * Saving once at the end promises that nothing half-built is left behind. A
 * failure part-way through would otherwise leave a course with some of its
 * syllabus in the switcher.
 */
describe('when the syllabus cannot be written', () => {
  beforeEach(() => {
    jest.spyOn(repositories.topics, 'createMany').mockRejectedValue(new Error('SQLITE_BUSY'));
  });

  it('removes the half-made course and returns to the one the student was on', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('create-course');

    const courses = await repositories.trackers.listByUser(USER);
    expect(courses.map((course) => course.id)).toEqual([existingCourseId]);
    expect(useTrackersStore.getState().activeId).toBe(existingCourseId);
    expect(await subjectNames(existingCourseId)).toEqual(['History']);
  });

  it('keeps what was typed so it can be tried again', async () => {
    renderWithTheme(<CourseBuilderScreen />);
    fillSmallestCourse();
    await press('create-course');

    expect(screen.getByTestId('builder-error')).toHaveTextContent(/Nothing was saved/);
    expect(screen.getByTestId('course-name').props.value).toBe('UPSC Prelims');
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('createCourse', () => {
  it('refuses an incomplete form without creating a course', async () => {
    await expect(createCourse(USER, emptyCourseDraft(), repositories)).rejects.toThrow(
      'The course needs a name.',
    );
    expect(await repositories.trackers.listByUser(USER)).toHaveLength(1);
  });
});
