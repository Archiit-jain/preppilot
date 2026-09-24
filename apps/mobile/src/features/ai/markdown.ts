/**
 * Turns the assistant's markdown into blocks the app can style.
 *
 * Gemini answers in markdown whether asked to or not, and shown raw it is a
 * reply full of asterisks, hashes and LaTeX backslashes that a student has to
 * read around. This understands the handful of constructs a chat answer
 * actually uses and passes everything else through as plain text, so an
 * unusual reply degrades to readable prose rather than to nothing.
 *
 * Written here rather than taken from a markdown package: those bring a full
 * CommonMark parser and a renderer of their own for what is a few dozen lines.
 */

export interface Span {
  readonly text: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly code?: boolean;
  readonly strike?: boolean;
}

export type Block =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3; readonly spans: readonly Span[] }
  | { readonly kind: 'paragraph'; readonly spans: readonly Span[] }
  | { readonly kind: 'bullet'; readonly depth: number; readonly spans: readonly Span[] }
  | {
      readonly kind: 'numbered';
      readonly depth: number;
      readonly marker: string;
      readonly spans: readonly Span[];
    }
  | { readonly kind: 'quote'; readonly spans: readonly Span[] }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'rule' };

type Style = Omit<Span, 'text'>;

/*
 * A backslash-escaped character is swapped for one in the private-use area
 * while the text is parsed, so `\*` can never open or close emphasis, and is
 * swapped back afterwards.
 */
const ESCAPE_BASE = 0xe000;
const escape = (text: string) =>
  text.replace(/\\([\\`*_{}[\]()#+\-.!|~>$])/g, (_, char: string) =>
    String.fromCharCode(ESCAPE_BASE + char.charCodeAt(0)),
  );
const unescape = (text: string) =>
  text.replace(/[\ue000-\ue07f]/g, (char) => String.fromCharCode(char.charCodeAt(0) - ESCAPE_BASE));

const SYMBOLS: Record<string, string> = {
  times: '×',
  cdot: '·',
  div: '÷',
  pm: '±',
  mp: '∓',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  infty: '∞',
  propto: '∝',
  degree: '°',
  circ: '°',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  leftrightarrow: '↔',
  Leftrightarrow: '⇔',
  implies: '⇒',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  cup: '∪',
  cap: '∩',
  forall: '∀',
  exists: '∃',
  partial: '∂',
  nabla: '∇',
  sum: 'Σ',
  prod: 'Π',
  int: '∫',
  angle: '∠',
  perp: '⊥',
  parallel: '∥',
  therefore: '∴',
  because: '∵',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  Gamma: 'Γ',
  delta: 'δ',
  Delta: 'Δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  theta: 'θ',
  Theta: 'Θ',
  lambda: 'λ',
  Lambda: 'Λ',
  mu: 'μ',
  nu: 'ν',
  pi: 'π',
  Pi: 'Π',
  rho: 'ρ',
  sigma: 'σ',
  Sigma: 'Σ',
  tau: 'τ',
  phi: 'φ',
  varphi: 'φ',
  Phi: 'Φ',
  omega: 'ω',
  Omega: 'Ω',
  ldots: '…',
  cdots: '⋯',
  dots: '…',
  quad: ' ',
  qquad: '  ',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  n: 'ⁿ',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
};

/** Superscript or subscript, when every character has a Unicode form. */
function script(text: string, table: Record<string, string>, fallback: string): string {
  const chars = [...text];
  return chars.every((char) => char in table)
    ? chars.map((char) => table[char]).join('')
    : `${fallback}${chars.length > 1 ? `(${text})` : text}`;
}

/**
 * Rewrites LaTeX as the plain maths a phone can show: `\frac{a}{b}` as a/b,
 * `x^{2}` as x², `\alpha` as α. Anything it does not know is left without its
 * backslash rather than dropped.
 */
export function plainMath(latex: string): string {
  let text = latex;

  // Innermost first, so a fraction inside a root comes out right.
  for (let pass = 0; pass < 5; pass += 1) {
    const before = text;
    text = text
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, top: string, bottom: string) => {
        const wrap = (part: string) =>
          /^[\w.²³]+$/.test(part.trim()) ? part.trim() : `(${part.trim()})`;
        return `${wrap(top)}/${wrap(bottom)}`;
      })
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, inner: string) =>
        /^\w+$/.test(inner.trim()) ? `√${inner.trim()}` : `√(${inner.trim()})`,
      )
      .replace(
        /\\(?:text|mathrm|mathbf|mathit|operatorname|textbf|vec|bar|hat)\s*\{([^{}]*)\}/g,
        '$1',
      );
    if (text === before) break;
  }

  return (
    text
      // Not \leftarrow or \rightarrow, which are symbols in their own right.
      .replace(/\\(?:left|right)(?![A-Za-z])|\\[,;!]/g, '')
      .replace(/\\ /g, ' ')
      .replace(/\^\s*\{([^{}]*)\}/g, (_, sup: string) => script(sup, SUPERSCRIPT, '^'))
      .replace(/\^(\w)/g, (_, sup: string) => script(sup, SUPERSCRIPT, '^'))
      .replace(/_\s*\{([^{}]*)\}/g, (_, sub: string) => script(sub, SUBSCRIPT, '_'))
      .replace(/_(\d)/g, (_, sub: string) => script(sub, SUBSCRIPT, '_'))
      .replace(/\\([A-Za-z]+)/g, (_, name: string) => SYMBOLS[name] ?? name)
      .replace(/[{}]/g, '')
      .replace(/ {2,}/g, ' ')
      .trim()
  );
}

/**
 * Replaces maths delimiters with the maths itself.
 *
 * A dollar sign is only read as maths when it hugs its content — `$x^2$`, not
 * "$5 and $10" — because prices are far more common in a student's question
 * than they are worth mangling.
 */
function replaceMath(text: string): string {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, math: string) => plainMath(math))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, math: string) => plainMath(math))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, math: string) => plainMath(math))
    .replace(/\$(?=\S)([^$\n]*?\S)\$(?!\d)/g, (_, math: string) => plainMath(math));
}

const INLINE =
  /`([^`\n]+)`|\*\*(?=\S)([\s\S]+?)\*\*|__(?=\S)([\s\S]+?)__|~~(?=\S)([\s\S]+?)~~|\*(?=[^\s*])([^*\n]*?[^\s*])\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

function parseInline(text: string, style: Style = {}): Span[] {
  const spans: Span[] = [];
  let last = 0;

  const push = (value: string, extra: Style = {}) => {
    if (value.length > 0) spans.push({ ...style, ...extra, text: value });
  };

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    push(text.slice(last, index));
    last = index + match[0].length;

    const [, code, bold, underBold, strike, italic, linkText] = match;
    if (code !== undefined) push(code, { code: true });
    else if (bold !== undefined) spans.push(...parseInline(bold, { ...style, bold: true }));
    else if (underBold !== undefined)
      spans.push(...parseInline(underBold, { ...style, bold: true }));
    else if (strike !== undefined) spans.push(...parseInline(strike, { ...style, strike: true }));
    else if (italic !== undefined) spans.push(...parseInline(italic, { ...style, italic: true }));
    else if (linkText !== undefined) spans.push(...parseInline(linkText, style));
  }
  push(text.slice(last));

  return spans;
}

/** Inline markdown, with escapes and maths resolved, as styled spans. */
export function inlineSpans(text: string): Span[] {
  // Maths first: LaTeX's own \( \[ \{ would otherwise be taken for escapes.
  return parseInline(escape(replaceMath(text))).map((span) => ({
    ...span,
    text: unescape(span.text),
  }));
}

const FENCE = /^\s*```/;
const HEADING = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+|[a-zA-Z])([.)])\s+(.*)$/;
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_ROW = /^\s*\|(.*)\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Two spaces, or a tab, per level of nesting; three levels at most. */
const depthOf = (indent: string) => Math.min(2, Math.floor(indent.replace(/\t/g, '  ').length / 2));

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  let tableRow = 0;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', spans: inlineSpans(paragraph.join('\n')) });
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }

    if (line.trim().length === 0) {
      flush();
      tableRow = 0;
      continue;
    }

    // A divider needs a pipe, or a plain --- rule would be taken for one.
    const divider = line.includes('|') && TABLE_DIVIDER.test(line);
    const table = TABLE_ROW.exec(line);
    if (table !== null || divider) {
      flush();
      if (divider) continue;

      // A phone is too narrow for columns, so each row becomes a line with its
      // cells separated, and the header row is set in bold.
      const cells = (table?.[1] ?? '')
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      const spans = inlineSpans(cells.join('  ·  '));
      blocks.push({
        kind: 'paragraph',
        spans: tableRow === 0 ? spans.map((span) => ({ ...span, bold: true })) : spans,
      });
      tableRow += 1;
      continue;
    }
    tableRow = 0;

    if (RULE.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      flush();
      const level = Math.min(3, heading[1]?.length ?? 1) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, spans: inlineSpans(heading[2] ?? '') });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet !== null) {
      flush();
      blocks.push({
        kind: 'bullet',
        depth: depthOf(bullet[1] ?? ''),
        spans: inlineSpans(bullet[2] ?? ''),
      });
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (numbered !== null) {
      flush();
      blocks.push({
        kind: 'numbered',
        depth: depthOf(numbered[1] ?? ''),
        marker: `${numbered[2] ?? ''}${numbered[3] ?? '.'}`,
        spans: inlineSpans(numbered[4] ?? ''),
      });
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote !== null) {
      flush();
      blocks.push({ kind: 'quote', spans: inlineSpans(quote[1] ?? '') });
      continue;
    }

    paragraph.push(line.trim());
  }
  flush();

  return blocks;
}

/**
 * A reply as plain text, for keeping as a note.
 *
 * Notes are plain text, so the formatting becomes what it would be in a
 * hand-written note — bullets as "•", steps keep their numbers — and no markup
 * symbol survives.
 */
export function toPlainText(source: string): string {
  const text = (spans: readonly Span[]) => spans.map((span) => span.text).join('');
  const lines: string[] = [];
  for (const block of parseMarkdown(source)) {
    switch (block.kind) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        lines.push(text(block.spans));
        break;
      case 'bullet':
        lines.push(`${'  '.repeat(block.depth)}• ${text(block.spans)}`);
        break;
      case 'numbered':
        lines.push(`${'  '.repeat(block.depth)}${block.marker} ${text(block.spans)}`);
        break;
      case 'code':
        lines.push(block.text);
        break;
      case 'rule':
        lines.push('—');
        break;
    }
  }
  return lines.join('\n').trim();
}
