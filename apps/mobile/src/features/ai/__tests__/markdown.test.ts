import { inlineSpans, parseMarkdown, plainMath, toPlainText } from '../markdown';

const text = (spans: readonly { text: string }[]) => spans.map((span) => span.text).join('');

describe('inline formatting', () => {
  it('turns **bold** into a bold span with no asterisks left', () => {
    expect(inlineSpans('An **ohm** is a unit')).toEqual([
      { text: 'An ' },
      { text: 'ohm', bold: true },
      { text: ' is a unit' },
    ]);
  });

  it('reads __bold__, *italic*, ~~strike~~ and `code`', () => {
    expect(inlineSpans('__a__ *b* ~~c~~ `d`')).toEqual([
      { text: 'a', bold: true },
      { text: ' ' },
      { text: 'b', italic: true },
      { text: ' ' },
      { text: 'c', strike: true },
      { text: ' ' },
      { text: 'd', code: true },
    ]);
  });

  it('nests italic inside bold', () => {
    expect(inlineSpans('**very *much* so**')).toEqual([
      { text: 'very ', bold: true },
      { text: 'much', bold: true, italic: true },
      { text: ' so', bold: true },
    ]);
  });

  /** "2 * 3 * 4" is multiplication, not emphasis. */
  it('leaves a lone or spaced asterisk alone', () => {
    expect(text(inlineSpans('2 * 3 * 4'))).toBe('2 * 3 * 4');
    expect(inlineSpans('2 * 3 * 4')).toHaveLength(1);
  });

  it('keeps the text of a link and drops its address', () => {
    expect(text(inlineSpans('See [the notes](https://example.com) here'))).toBe(
      'See the notes here',
    );
  });

  it('shows an escaped character as itself, not as formatting', () => {
    expect(inlineSpans('5 \\* 3 and \\_x\\_')).toEqual([{ text: '5 * 3 and _x_' }]);
  });
});

describe('maths', () => {
  it('rewrites LaTeX fractions, roots, powers and symbols', () => {
    expect(plainMath('\\frac{a}{b}')).toBe('a/b');
    expect(plainMath('\\frac{a+1}{2b}')).toBe('(a+1)/2b');
    expect(plainMath('\\sqrt{x}')).toBe('√x');
    expect(plainMath('\\sqrt{x+1}')).toBe('√(x+1)');
    expect(plainMath('x^2 + y^{10}')).toBe('x² + y¹⁰');
    expect(plainMath('e^{i\\pi}')).toBe('e^(iπ)');
    expect(plainMath('H_2O')).toBe('H₂O');
    expect(plainMath('a_{n}')).toBe('a_n');
    expect(plainMath('V = I \\times R')).toBe('V = I × R');
    expect(plainMath('\\alpha \\leq \\beta')).toBe('α ≤ β');
    expect(plainMath('\\text{speed} = \\dfrac{d}{t}')).toBe('speed = d/t');
    expect(plainMath('\\left( x \\right) \\rightarrow y')).toBe('( x ) → y');
    expect(plainMath('a\\,b\\ c')).toBe('ab c');
    expect(plainMath('\\unknown{z}')).toBe('unknownz');
  });

  it('works through a fraction inside a root', () => {
    expect(plainMath('\\sqrt{\\frac{1}{2}}')).toBe('√(1/2)');
  });

  it('unwraps every delimiter the model uses', () => {
    expect(text(inlineSpans('so $x^2$ grows'))).toBe('so x² grows');
    expect(text(inlineSpans('$$\\frac{1}{2}$$'))).toBe('1/2');
    expect(text(inlineSpans('\\(a \\times b\\)'))).toBe('a × b');
    expect(text(inlineSpans('\\[\\pi r^2\\]'))).toBe('π r²');
  });

  it('does not mistake prices for maths', () => {
    expect(text(inlineSpans('It costs $5 and $10'))).toBe('It costs $5 and $10');
  });
});

describe('blocks', () => {
  it('reads headings, capped at three levels', () => {
    expect(parseMarkdown('# One\n## Two\n#### Four ##')).toEqual([
      { kind: 'heading', level: 1, spans: [{ text: 'One' }] },
      { kind: 'heading', level: 2, spans: [{ text: 'Two' }] },
      { kind: 'heading', level: 3, spans: [{ text: 'Four' }] },
    ]);
  });

  it('reads bullets with any marker, and their nesting', () => {
    const blocks = parseMarkdown('* one\n- two\n  + three\n• four');
    expect(blocks.map((block) => block.kind === 'bullet' && block.depth)).toEqual([0, 0, 1, 0]);
    expect(blocks[0]).toEqual({ kind: 'bullet', depth: 0, spans: [{ text: 'one' }] });
  });

  it('does not take a bold line for a bullet', () => {
    expect(parseMarkdown('**Key idea:** current')[0]?.kind).toBe('paragraph');
  });

  it('keeps the number of a numbered step', () => {
    expect(parseMarkdown('1. First\n2) Second\na. Third')).toEqual([
      { kind: 'numbered', depth: 0, marker: '1.', spans: [{ text: 'First' }] },
      { kind: 'numbered', depth: 0, marker: '2)', spans: [{ text: 'Second' }] },
      { kind: 'numbered', depth: 0, marker: 'a.', spans: [{ text: 'Third' }] },
    ]);
  });

  it('joins a paragraph’s lines and splits paragraphs at blank lines', () => {
    expect(parseMarkdown('one\ntwo\n\nthree')).toEqual([
      { kind: 'paragraph', spans: [{ text: 'one\ntwo' }] },
      { kind: 'paragraph', spans: [{ text: 'three' }] },
    ]);
  });

  it('keeps a code block verbatim', () => {
    expect(parseMarkdown('```python\nx = 2 * 3\n**y**\n```\nafter')).toEqual([
      { kind: 'code', text: 'x = 2 * 3\n**y**' },
      { kind: 'paragraph', spans: [{ text: 'after' }] },
    ]);
  });

  it('reads quotes and rules', () => {
    expect(parseMarkdown('> remember\n\n---\n***')).toEqual([
      { kind: 'quote', spans: [{ text: 'remember' }] },
      { kind: 'rule' },
      { kind: 'rule' },
    ]);
  });

  it('lays a table out as rows, with the header in bold', () => {
    expect(parseMarkdown('| Unit | Symbol |\n|---|:---:|\n| Ohm | Ω |')).toEqual([
      { kind: 'paragraph', spans: [{ text: 'Unit  ·  Symbol', bold: true }] },
      { kind: 'paragraph', spans: [{ text: 'Ohm  ·  Ω' }] },
    ]);
  });

  it('nests numbered steps and reads tab indentation', () => {
    expect(parseMarkdown('1. a\n\t2. b\n\t\t\t- c')).toEqual([
      { kind: 'numbered', depth: 0, marker: '1.', spans: [{ text: 'a' }] },
      { kind: 'numbered', depth: 1, marker: '2.', spans: [{ text: 'b' }] },
      { kind: 'bullet', depth: 2, spans: [{ text: 'c' }] },
    ]);
  });

  it('keeps a code block open to the end when it is never closed', () => {
    expect(parseMarkdown('```' + '\n' + 'x = 1')).toEqual([{ kind: 'code', text: 'x = 1' }]);
  });

  it('starts a new table after a blank line, with its own header', () => {
    const blocks = parseMarkdown('| a |' + '\n\n' + '| b |');
    expect(blocks).toEqual([
      { kind: 'paragraph', spans: [{ text: 'a', bold: true }] },
      { kind: 'paragraph', spans: [{ text: 'b', bold: true }] },
    ]);
  });

  it('ends a paragraph at a list, and a list at a paragraph', () => {
    expect(
      parseMarkdown('intro' + '\n' + '- item' + '\n' + 'outro').map((block) => block.kind),
    ).toEqual(['paragraph', 'bullet', 'paragraph']);
  });

  it('handles Windows line endings', () => {
    expect(parseMarkdown('* a\r\n* b')).toHaveLength(2);
  });

  it('gives nothing for an empty reply', () => {
    expect(parseMarkdown('')).toEqual([]);
  });

  it('leaves no markdown symbols in a typical answer', () => {
    const reply = [
      '### Ohm’s law',
      '**Ohm’s law** says that $V = IR$.',
      '',
      '* **V** is voltage',
      '* *I* is current',
      '',
      '1. Measure $I$',
      '2. Multiply by $R$',
    ].join('\n');

    const all = parseMarkdown(reply)
      .map((block) => ('spans' in block ? text(block.spans) : ''))
      .join('\n');

    expect(all).not.toMatch(/[*#$\\]/);
    expect(all).toContain('Ohm’s law says that V = IR.');
  });
});

describe('as plain text, for a note', () => {
  it('keeps the shape of the reply and drops every symbol', () => {
    const reply = [
      '## Ohm’s law',
      '**V = IR**, where $R$ is resistance.',
      '',
      '* current',
      '  - in amperes',
      '1. Measure',
      '> Check units',
      '```',
      'V = 12',
      '```',
      '---',
    ].join('\n');

    expect(toPlainText(reply)).toBe(
      [
        'Ohm’s law',
        'V = IR, where R is resistance.',
        '• current',
        '  • in amperes',
        '1. Measure',
        'Check units',
        'V = 12',
        '—',
      ].join('\n'),
    );
  });

  it('gives nothing for nothing', () => {
    expect(toPlainText('')).toBe('');
  });
});
