import { countOf } from '../plural';

it('agrees the noun with the count', () => {
  expect(countOf(1, 'chapter')).toBe('1 chapter');
  expect(countOf(0, 'chapter')).toBe('0 chapters');
  expect(countOf(6, 'topic')).toBe('6 topics');
  expect(countOf(2, 'quiz', 'quizzes')).toBe('2 quizzes');
});
