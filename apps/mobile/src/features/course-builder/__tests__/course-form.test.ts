import { MAX_NAME_LENGTH } from '@preppilot/shared';
import {
  COURSE_NAME_KEY,
  addChapter,
  addSubject,
  addTopic,
  emptyCourseDraft,
  isDraftDirty,
  removeChapter,
  removeSubject,
  removeTopic,
  renameChapter,
  renameSubject,
  renameTopic,
  setCourseName,
  toTemplateSubjects,
  validateCourseDraft,
  type CourseDraft,
} from '../course-form';

/** A form filled in all the way down: one subject, one chapter, one topic. */
function filled(): CourseDraft {
  let draft = setCourseName(emptyCourseDraft(), 'UPSC Prelims');
  const subject = draft.subjects[0]!;
  const chapter = subject.chapters[0]!;
  const topic = chapter.topics[0]!;
  draft = renameSubject(draft, subject.key, 'Polity');
  draft = renameChapter(draft, subject.key, chapter.key, 'Constitution');
  return renameTopic(draft, subject.key, chapter.key, topic.key, 'Preamble');
}

const messages = (draft: CourseDraft) => validateCourseDraft(draft).map((issue) => issue.message);

describe('a fresh form', () => {
  it('starts with one subject holding one chapter holding one topic', () => {
    const draft = emptyCourseDraft();

    expect(draft.name).toBe('');
    expect(draft.subjects).toHaveLength(1);
    expect(draft.subjects[0]!.chapters).toHaveLength(1);
    expect(draft.subjects[0]!.chapters[0]!.topics).toHaveLength(1);
  });

  it('gives every row its own key', () => {
    const draft = addSubject(emptyCourseDraft());
    const keys = draft.subjects.flatMap((subject) => [
      subject.key,
      ...subject.chapters.flatMap((chapter) => [
        chapter.key,
        ...chapter.topics.map((topic) => topic.key),
      ]),
    ]);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('what has to be filled in', () => {
  it('accepts a form filled in all the way down', () => {
    expect(validateCourseDraft(filled())).toEqual([]);
  });

  it('asks for every missing name on an untouched form', () => {
    expect(messages(emptyCourseDraft())).toEqual([
      'The course needs a name.',
      'Subject 1 needs a name.',
      'Chapter 1 in Subject 1 needs a name.',
      'Topic 1 in Chapter 1 in Subject 1 needs a name.',
    ]);
  });

  it('files each message under the field it is about', () => {
    const draft = emptyCourseDraft();
    const subject = draft.subjects[0]!;
    const chapter = subject.chapters[0]!;

    expect(validateCourseDraft(draft).map((issue) => issue.key)).toEqual([
      COURSE_NAME_KEY,
      subject.key,
      chapter.key,
      chapter.topics[0]!.key,
    ]);
  });

  it('treats a name of only spaces as missing', () => {
    expect(messages(setCourseName(filled(), '   '))).toEqual(['The course needs a name.']);
  });

  it('refuses a name past the limit', () => {
    expect(messages(setCourseName(filled(), 'a'.repeat(MAX_NAME_LENGTH + 1)))).toEqual([
      'The course has a name that is too long.',
    ]);
  });

  /** A blank row is an error, not something to drop: the student meant to fill it. */
  it('flags a blank topic row by the chapter it sits in', () => {
    const draft = filled();
    const subject = draft.subjects[0]!;
    const chapter = subject.chapters[0]!;

    expect(messages(addTopic(draft, subject.key, chapter.key))).toEqual([
      'Topic 2 in Constitution needs a name.',
    ]);
  });

  it('flags a blank chapter row by the subject it sits in', () => {
    const draft = filled();
    const withChapter = addChapter(draft, draft.subjects[0]!.key);

    expect(messages(withChapter)).toEqual([
      'Chapter 2 in Polity needs a name.',
      'Topic 1 in Chapter 2 in Polity needs a name.',
    ]);
  });

  it('requires at least one subject', () => {
    expect(messages({ name: 'UPSC Prelims', subjects: [] })).toEqual(['Add at least one subject.']);
  });

  it('requires at least one chapter in every subject', () => {
    const draft = filled();
    const emptied = {
      ...draft,
      subjects: [{ ...draft.subjects[0]!, chapters: [] }],
    };

    expect(messages(emptied)).toEqual(['Polity needs at least one chapter.']);
  });

  it('requires at least one topic in every chapter', () => {
    const draft = filled();
    const subject = draft.subjects[0]!;
    const emptied = {
      ...draft,
      subjects: [{ ...subject, chapters: [{ ...subject.chapters[0]!, topics: [] }] }],
    };

    expect(messages(emptied)).toEqual(['Constitution needs at least one topic.']);
  });
});

describe('adding and removing rows', () => {
  it('adds a subject that already holds a chapter and a topic to type into', () => {
    const draft = addSubject(filled());

    expect(draft.subjects).toHaveLength(2);
    expect(draft.subjects[1]!.chapters[0]!.topics).toHaveLength(1);
  });

  it('removes a subject but never the last one', () => {
    const one = filled();
    expect(removeSubject(one, one.subjects[0]!.key).subjects).toHaveLength(1);

    const two = addSubject(one);
    const removed = removeSubject(two, two.subjects[1]!.key);
    expect(removed.subjects.map((subject) => subject.name)).toEqual(['Polity']);
  });

  it('removes a chapter but never a subject’s last one', () => {
    const draft = filled();
    const subject = draft.subjects[0]!;
    expect(
      removeChapter(draft, subject.key, subject.chapters[0]!.key).subjects[0]!.chapters,
    ).toHaveLength(1);

    const two = addChapter(draft, subject.key);
    const second = two.subjects[0]!.chapters[1]!;
    expect(removeChapter(two, subject.key, second.key).subjects[0]!.chapters).toHaveLength(1);
  });

  it('removes a topic but never a chapter’s last one', () => {
    const draft = filled();
    const subject = draft.subjects[0]!;
    const chapter = subject.chapters[0]!;
    const onlyTopic = removeTopic(draft, subject.key, chapter.key, chapter.topics[0]!.key);
    expect(onlyTopic.subjects[0]!.chapters[0]!.topics).toHaveLength(1);

    const two = addTopic(draft, subject.key, chapter.key);
    const added = two.subjects[0]!.chapters[0]!.topics[1]!;
    const removed = removeTopic(two, subject.key, chapter.key, added.key);
    expect(removed.subjects[0]!.chapters[0]!.topics.map((topic) => topic.name)).toEqual([
      'Preamble',
    ]);
  });

  it('only changes the row it was asked to', () => {
    const draft = addSubject(filled());
    const renamed = renameSubject(draft, draft.subjects[1]!.key, 'Economy');

    expect(renamed.subjects.map((subject) => subject.name)).toEqual(['Polity', 'Economy']);
  });
});

describe('whether leaving would lose anything', () => {
  it('is nothing on an untouched form', () => {
    expect(isDraftDirty(emptyCourseDraft())).toBe(false);
  });

  it('is still nothing after adding empty rows', () => {
    const draft = emptyCourseDraft();
    expect(isDraftDirty(addChapter(addSubject(draft), draft.subjects[0]!.key))).toBe(false);
  });

  it('is something once any name is typed', () => {
    const draft = emptyCourseDraft();
    const subject = draft.subjects[0]!;
    const chapter = subject.chapters[0]!;

    expect(isDraftDirty(setCourseName(draft, 'UPSC'))).toBe(true);
    expect(
      isDraftDirty(renameTopic(draft, subject.key, chapter.key, chapter.topics[0]!.key, 'x')),
    ).toBe(true);
  });
});

describe('handing the form to the importer', () => {
  it('keeps the order and trims every name', () => {
    let draft = filled();
    draft = renameSubject(draft, draft.subjects[0]!.key, '  Polity  ');
    draft = addSubject(draft);
    const second = draft.subjects[1]!;
    draft = renameSubject(draft, second.key, 'Economy');
    draft = renameChapter(draft, second.key, second.chapters[0]!.key, 'Budget ');
    draft = renameTopic(
      draft,
      second.key,
      second.chapters[0]!.key,
      second.chapters[0]!.topics[0]!.key,
      ' Fiscal deficit',
    );

    expect(toTemplateSubjects(draft)).toEqual([
      { name: 'Polity', chapters: [{ name: 'Constitution', topics: [{ name: 'Preamble' }] }] },
      { name: 'Economy', chapters: [{ name: 'Budget', topics: [{ name: 'Fiscal deficit' }] }] },
    ]);
  });
});
