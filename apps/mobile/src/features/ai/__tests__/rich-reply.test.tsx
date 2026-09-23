import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../../../test-utils/render';
import { RichReply } from '../components/rich-reply';

const REPLY = [
  '# Circuits',
  '## Ohm’s law',
  'Current is **proportional** to *voltage*, not ~~resistance~~. Use `V = IR`.',
  '',
  '* Series',
  '  - same current',
  '1. Measure',
  '> Check the units.',
  '---',
  '```',
  'V = 12',
  '```',
].join('\n');

it('shows every kind of block without its markdown', () => {
  renderWithTheme(<RichReply source={REPLY} testID="reply" />);

  expect(screen.getByText('Circuits')).toBeOnTheScreen();
  expect(screen.getByText('Ohm’s law')).toBeOnTheScreen();
  expect(screen.getByText('proportional')).toBeOnTheScreen();
  expect(screen.getByText('voltage')).toBeOnTheScreen();
  expect(screen.getByText('resistance')).toBeOnTheScreen();
  expect(screen.getByText('V = IR')).toBeOnTheScreen();
  expect(screen.getByText('Series')).toBeOnTheScreen();
  expect(screen.getByText('same current')).toBeOnTheScreen();
  expect(screen.getByText('1.')).toBeOnTheScreen();
  expect(screen.getByText('Check the units.')).toBeOnTheScreen();
  expect(screen.getByText('V = 12')).toBeOnTheScreen();

  expect(screen.queryByText(/[*#`~>]/)).toBeNull();
});

it('marks a top-level bullet and a nested one differently', () => {
  renderWithTheme(<RichReply source={'* outer\n  * inner'} />);

  expect(screen.getByText('•')).toBeOnTheScreen();
  expect(screen.getByText('◦')).toBeOnTheScreen();
});

it('sets bold in the heavier face and italic in italics', () => {
  renderWithTheme(<RichReply source="**bold** and *slanted*" />);

  const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  expect(flat(screen.getByText('bold').props.style).fontWeight).toBe('600');
  expect(flat(screen.getByText('slanted').props.style).fontStyle).toBe('italic');
});
