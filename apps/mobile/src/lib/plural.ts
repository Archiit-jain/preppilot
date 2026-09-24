/** "1 chapter", "2 chapters" — a count with its noun agreeing. */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
