import { MAX_NAME_LENGTH, type TemplateSubject } from '@preppilot/shared';

/**
 * The "Build from scratch" form, held entirely in memory until it is submitted.
 *
 * Nothing here touches the database. The course is written in one go when the
 * student presses Create, so abandoning the form halfway leaves nothing behind —
 * no half-built course sitting in the switcher for them to clean up.
 *
 * Every row carries a `key` so React can track it while rows are added and
 * removed around it, and so a validation message can point at the exact field.
 */
export interface TopicDraft {
  readonly key: string;
  readonly name: string;
}

export interface ChapterDraft {
  readonly key: string;
  readonly name: string;
  readonly topics: readonly TopicDraft[];
}

export interface SubjectDraft {
  readonly key: string;
  readonly name: string;
  readonly chapters: readonly ChapterDraft[];
}

export interface CourseDraft {
  readonly name: string;
  readonly subjects: readonly SubjectDraft[];
}

/** The key a message about the course name is filed under. */
export const COURSE_NAME_KEY = 'course-name';

let lastKey = 0;
const nextKey = (): string => `draft-${++lastKey}`;

const blankTopic = (): TopicDraft => ({ key: nextKey(), name: '' });
const blankChapter = (): ChapterDraft => ({ key: nextKey(), name: '', topics: [blankTopic()] });
const blankSubject = (): SubjectDraft => ({ key: nextKey(), name: '', chapters: [blankChapter()] });

/**
 * A fresh form: one subject holding one chapter holding one topic.
 *
 * Every level has to hold at least one of the level below before the course can
 * be created, so the form starts with the smallest shape that could be valid
 * rather than making the student add each row before they can type in it.
 */
export function emptyCourseDraft(): CourseDraft {
  return { name: '', subjects: [blankSubject()] };
}

/** Whether anything has been typed, which is what makes leaving worth confirming. */
export function isDraftDirty(draft: CourseDraft): boolean {
  const typed = (name: string) => name.trim().length > 0;

  return (
    typed(draft.name) ||
    draft.subjects.some(
      (subject) =>
        typed(subject.name) ||
        subject.chapters.some(
          (chapter) => typed(chapter.name) || chapter.topics.some((topic) => typed(topic.name)),
        ),
    )
  );
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

const mapSubject = (
  draft: CourseDraft,
  subjectKey: string,
  change: (subject: SubjectDraft) => SubjectDraft,
): CourseDraft => ({
  ...draft,
  subjects: draft.subjects.map((subject) =>
    subject.key === subjectKey ? change(subject) : subject,
  ),
});

const mapChapter = (
  draft: CourseDraft,
  subjectKey: string,
  chapterKey: string,
  change: (chapter: ChapterDraft) => ChapterDraft,
): CourseDraft =>
  mapSubject(draft, subjectKey, (subject) => ({
    ...subject,
    chapters: subject.chapters.map((chapter) =>
      chapter.key === chapterKey ? change(chapter) : chapter,
    ),
  }));

export function setCourseName(draft: CourseDraft, name: string): CourseDraft {
  return { ...draft, name };
}

export function addSubject(draft: CourseDraft): CourseDraft {
  return { ...draft, subjects: [...draft.subjects, blankSubject()] };
}

export function renameSubject(draft: CourseDraft, subjectKey: string, name: string): CourseDraft {
  return mapSubject(draft, subjectKey, (subject) => ({ ...subject, name }));
}

/** Refuses to remove the last subject: a course needs at least one. */
export function removeSubject(draft: CourseDraft, subjectKey: string): CourseDraft {
  if (draft.subjects.length <= 1) return draft;
  return { ...draft, subjects: draft.subjects.filter((subject) => subject.key !== subjectKey) };
}

export function addChapter(draft: CourseDraft, subjectKey: string): CourseDraft {
  return mapSubject(draft, subjectKey, (subject) => ({
    ...subject,
    chapters: [...subject.chapters, blankChapter()],
  }));
}

export function renameChapter(
  draft: CourseDraft,
  subjectKey: string,
  chapterKey: string,
  name: string,
): CourseDraft {
  return mapChapter(draft, subjectKey, chapterKey, (chapter) => ({ ...chapter, name }));
}

/** Refuses to remove a subject's last chapter. */
export function removeChapter(
  draft: CourseDraft,
  subjectKey: string,
  chapterKey: string,
): CourseDraft {
  return mapSubject(draft, subjectKey, (subject) =>
    subject.chapters.length <= 1
      ? subject
      : { ...subject, chapters: subject.chapters.filter((chapter) => chapter.key !== chapterKey) },
  );
}

export function addTopic(draft: CourseDraft, subjectKey: string, chapterKey: string): CourseDraft {
  return mapChapter(draft, subjectKey, chapterKey, (chapter) => ({
    ...chapter,
    topics: [...chapter.topics, blankTopic()],
  }));
}

export function renameTopic(
  draft: CourseDraft,
  subjectKey: string,
  chapterKey: string,
  topicKey: string,
  name: string,
): CourseDraft {
  return mapChapter(draft, subjectKey, chapterKey, (chapter) => ({
    ...chapter,
    topics: chapter.topics.map((topic) => (topic.key === topicKey ? { ...topic, name } : topic)),
  }));
}

/** Refuses to remove a chapter's last topic. */
export function removeTopic(
  draft: CourseDraft,
  subjectKey: string,
  chapterKey: string,
  topicKey: string,
): CourseDraft {
  return mapChapter(draft, subjectKey, chapterKey, (chapter) =>
    chapter.topics.length <= 1
      ? chapter
      : { ...chapter, topics: chapter.topics.filter((topic) => topic.key !== topicKey) },
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** One problem, filed under the key of the field it belongs to. */
export interface FormIssue {
  readonly key: string;
  readonly message: string;
}

/** Why a name is not acceptable, or null when it is. */
function nameProblem(name: string, what: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return `${what} needs a name.`;
  if (trimmed.length > MAX_NAME_LENGTH) return `${what} has a name that is too long.`;
  return null;
}

/**
 * Every reason the course cannot be created yet, in the order they appear.
 *
 * Deliberately strict: the course name, at least one subject, and at least one
 * chapter in every subject and one topic in every chapter. A blank row is an
 * error rather than something to skip silently — the student typed nothing
 * there, and quietly dropping it would hide a row they meant to fill in.
 *
 * Messages name rows by what the student typed where they can, and by position
 * where they have typed nothing yet.
 */
export function validateCourseDraft(draft: CourseDraft): readonly FormIssue[] {
  const issues: FormIssue[] = [];
  const report = (key: string, message: string | null) => {
    if (message !== null) issues.push({ key, message });
  };

  report(COURSE_NAME_KEY, nameProblem(draft.name, 'The course'));

  if (draft.subjects.length === 0) {
    report(COURSE_NAME_KEY, 'Add at least one subject.');
  }

  draft.subjects.forEach((subject, s) => {
    const subjectLabel = subject.name.trim() || `Subject ${s + 1}`;
    report(subject.key, nameProblem(subject.name, `Subject ${s + 1}`));
    if (subject.chapters.length === 0) {
      report(subject.key, `${subjectLabel} needs at least one chapter.`);
    }

    subject.chapters.forEach((chapter, c) => {
      const chapterLabel = chapter.name.trim() || `Chapter ${c + 1} in ${subjectLabel}`;
      report(chapter.key, nameProblem(chapter.name, `Chapter ${c + 1} in ${subjectLabel}`));
      if (chapter.topics.length === 0) {
        report(chapter.key, `${chapterLabel} needs at least one topic.`);
      }

      chapter.topics.forEach((topic, t) => {
        report(topic.key, nameProblem(topic.name, `Topic ${t + 1} in ${chapterLabel}`));
      });
    });
  });

  return issues;
}

/**
 * The finished form in the shape a template's syllabus takes.
 *
 * That is the shape the existing import already writes into a course, so the
 * course built here goes to the database through the same tested path as a
 * bundled template does. Names are trimmed on the way.
 */
export function toTemplateSubjects(draft: CourseDraft): TemplateSubject[] {
  return draft.subjects.map((subject) => ({
    name: subject.name.trim(),
    chapters: subject.chapters.map((chapter) => ({
      name: chapter.name.trim(),
      topics: chapter.topics.map((topic) => ({ name: topic.name.trim() })),
    })),
  }));
}
