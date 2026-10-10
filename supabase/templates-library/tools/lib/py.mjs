/**
 * Python-compatible helpers for the template converters.
 *
 * The converters were first written in Python, and their output is reviewed text, so the Node versions
 * must produce exactly the same drafts. Python's regular expressions are Unicode-aware (\w, \b, \d, \s)
 * where JavaScript's are ASCII-only, and Python's string methods (title, isupper, splitlines, strip with
 * characters) have no exact JavaScript twin. `re()` translates a Python pattern into an equivalent
 * JavaScript one; the rest copy Python's behaviour.
 */

import { readFileSync } from 'node:fs';

const W = '\\p{L}\\p{N}\\p{M}_'; // Python's \w in str patterns
const S =
  ' \\t\\n\\r\\f\\v\\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'; // Python's \s
const D = '\\p{Nd}'; // Python's \d
const SYNTAX = new Set([...'^$\\.*+?()[]{}|/']);
const cache = new Map();

/** Translates a Python regular expression to a JavaScript one with the same meaning (adds the `u` flag). */
export function translate(src) {
  let out = '';
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      const n = src[i + 1];
      i++;
      if (n === 'w') out += inClass ? W : `[${W}]`;
      else if (n === 'W')
        out += inClass ? `\\P{L}` /* rare: approximate inside classes */ : `[^${W}]`;
      else if (n === 's') out += inClass ? S : `[${S}]`;
      else if (n === 'S') out += inClass ? '\\S' : `[^${S}]`;
      else if (n === 'd') out += inClass ? D : D;
      else if (n === 'D') out += inClass ? '\\P{Nd}' : '\\P{Nd}';
      else if (n === 'b')
        out += inClass ? '\\x08' : `(?:(?<=[${W}])(?![${W}])|(?<![${W}])(?=[${W}]))`;
      else if (n === 'B') out += `(?:(?<=[${W}])(?=[${W}])|(?<![${W}])(?![${W}]))`;
      else if (n === 'Z') out += '$(?![\\s\\S])';
      else if (n === 'A') out += '^';
      else if (/[0-9]/.test(n)) {
        // Back-reference \1..\99, or an octal escape (not used by the converters).
        let num = n;
        while (/[0-9]/.test(src[i + 1] ?? '')) num += src[++i];
        out += `\\${num}`;
      } else if (/[a-zA-Z]/.test(n))
        out += `\\${n}`; // \t \n \x.. \u.... \f \v etc.
      else if (inClass) out += ['-', ']', '\\', '^'].includes(n) ? `\\${n}` : n === '[' ? '\\[' : n;
      else out += SYNTAX.has(n) || n === '-' ? (n === '-' ? '-' : `\\${n}`) : n;
      continue;
    }
    if (inClass) {
      if (ch === ']' && out[out.length - 1] !== '[' && !out.endsWith('[^')) inClass = false;
      if (ch === '[') out += '\\[';
      else if (ch === '/') out += '\\/';
      else out += ch;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      out += '[';
      if (src[i + 1] === '^') {
        out += '^';
        i++;
      }
      if (src[i + 1] === ']') {
        out += '\\]';
        i++;
      } // a leading ] is literal in Python
      continue;
    }
    if (ch === '{') {
      const q = /^\{\d*(,\d*)?\}/.exec(src.slice(i));
      if (q && q[0] !== '{}' && q[0] !== '{,}') {
        out += q[0];
        i += q[0].length - 1;
      } else out += '\\{';
      continue;
    }
    if (ch === '}') {
      out += '\\}';
      continue;
    }
    if (ch === '(' && src.startsWith('(?P<', i)) {
      out += '(?<';
      i += 3;
      continue;
    }
    if (ch === '(' && src.startsWith('(?P=', i)) {
      const end = src.indexOf(')', i);
      out += `\\k<${src.slice(i + 4, end)}>`;
      i = end;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Inline flags at the start of a Python pattern, (?m) (?i) (?s) (?x is not supported). */
function splitFlags(src, flags) {
  const m = /^\(\?([aimsux]+)\)/.exec(src);
  if (!m) return [src, flags];
  let f = flags;
  for (const c of m[1]) if ('ims'.includes(c) && !f.includes(c)) f += c;
  return [src.slice(m[0].length), f];
}

/** A compiled JavaScript RegExp for a Python pattern. flags: any of 'i', 'm', 's'. */
export function re(pattern, flags = '') {
  const key = `${flags}\u0000${pattern}`;
  if (!cache.has(key)) {
    const [src, f] = splitFlags(pattern, flags);
    cache.set(key, new RegExp(translate(src), `${f}u`));
  }
  return cache.get(key);
}

const withFlags = (rx, extra) => new RegExp(rx.source, [...new Set(rx.flags + extra)].join(''));
const rx = (p, flags) => (p instanceof RegExp ? p : re(p, flags));

/** A match object with Python's group()/groups()/start()/end(). */
function wrap(m) {
  if (!m) return null;
  return {
    m,
    group: (k = 0) => (m[k] === undefined ? null : m[k]),
    groups: () => m.slice(1).map((g) => (g === undefined ? null : g)),
    start: () => m.index,
    end: () => m.index + m[0].length,
    get index() {
      return m.index;
    },
  };
}

/** re.match: anchored at the start. */
export function match(p, s, flags = '') {
  const r = withFlags(rx(p, flags), 'y');
  r.lastIndex = 0;
  return wrap(r.exec(s));
}

/** re.fullmatch. */
export function fullmatch(p, s, flags = '') {
  const base = rx(p, flags);
  return wrap(new RegExp(`^(?:${base.source})$`, base.flags.replace('m', '')).exec(s));
}

/** re.search. */
export function search(p, s, flags = '') {
  return wrap(rx(p, flags).exec(s));
}

/** re.finditer. */
export function* finditer(p, s, flags = '') {
  const r = withFlags(rx(p, flags), 'g');
  for (const m of s.matchAll(r)) yield wrap(m);
}

/** re.findall: whole matches, the group, or tuples of groups. */
export function findall(p, s, flags = '') {
  const out = [];
  for (const m of finditer(p, s, flags)) {
    const g = m.groups();
    out.push(g.length === 0 ? m.group(0) : g.length === 1 ? (g[0] ?? '') : g.map((x) => x ?? ''));
  }
  return out;
}

/** re.sub. repl is a string using \1 / \g<1> references, or a function of the match. */
export function sub(p, repl, s, count = 0, flags = '') {
  const r = withFlags(rx(p, flags), 'g');
  let n = 0;
  return s.replace(r, (...args) => {
    if (count && n >= count) return args[0];
    n++;
    const hasGroups = typeof args[args.length - 1] === 'object';
    const groups = args.slice(1, hasGroups ? -3 : -2);
    const index = args[hasGroups ? args.length - 3 : args.length - 2];
    const m = [args[0], ...groups];
    m.index = index;
    if (typeof repl === 'function') return repl(wrap(m));
    return repl.replace(/\\g<(\d+)>|\\(\d+)|\\n|\\\\/g, (t, a, b) => {
      if (t === '\\n') return '\n';
      if (t === '\\\\') return '\\';
      const g = m[Number(a ?? b)];
      return g ?? '';
    });
  });
}

/** re.split, including captured groups (None becomes null) and maxsplit. */
export function split(p, s, maxsplit = 0, flags = '') {
  const r = withFlags(rx(p, flags), 'g');
  const out = [];
  let last = 0;
  let n = 0;
  for (const m of s.matchAll(r)) {
    if (maxsplit && n >= maxsplit) break;
    if (m[0] === '' && m.index === last && m.index !== 0 && false) continue;
    out.push(s.slice(last, m.index));
    for (const g of m.slice(1)) out.push(g === undefined ? null : g);
    last = m.index + m[0].length;
    n++;
  }
  out.push(s.slice(last));
  return out;
}

// ---- strings ---------------------------------------------------------------

const PY_SPACE = new RegExp(`[${S}]`, 'u');

/** str.strip / lstrip / rstrip, with Python's default whitespace or a set of characters. */
export function strip(s, chars) {
  return rstrip(lstrip(s, chars), chars);
}
export function lstrip(s, chars) {
  const set = chars == null ? null : new Set([...chars]);
  const cs = [...s];
  let i = 0;
  while (i < cs.length && (set ? set.has(cs[i]) : PY_SPACE.test(cs[i]))) i++;
  return cs.slice(i).join('');
}
export function rstrip(s, chars) {
  const set = chars == null ? null : new Set([...chars]);
  const cs = [...s];
  let j = cs.length;
  while (j > 0 && (set ? set.has(cs[j - 1]) : PY_SPACE.test(cs[j - 1]))) j--;
  return cs.slice(0, j).join('');
}

/** str.split() with no argument: on runs of whitespace, no empty strings. */
export function splitWs(s) {
  return s.split(new RegExp(`[${S}]+`, 'u')).filter((x) => x !== '');
}

const LINE_BREAK = new RegExp('\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]', 'u');

/** str.splitlines(). */
export function splitlines(s) {
  const lines = s.split(LINE_BREAK);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const cased = (c) => c.toLowerCase() !== c.toUpperCase();
const isLowerChar = (c) => cased(c) && c === c.toLowerCase() && c !== c.toUpperCase();
const isUpperChar = (c) => cased(c) && c === c.toUpperCase() && c !== c.toLowerCase();

/** str.title(): first cased letter after an uncased character is upper-cased, the rest lower-cased. */
export function title(s) {
  let out = '';
  let prev = false;
  for (const c of s) {
    if (cased(c)) {
      out += prev ? c.toLowerCase() : c.toUpperCase();
      prev = true;
    } else {
      out += c;
      prev = false;
    }
  }
  return out;
}

/** str.isupper() */
export function isupper(s) {
  let any = false;
  for (const c of s) {
    if (isLowerChar(c)) return false;
    if (isUpperChar(c)) any = true;
  }
  return any;
}

/** str.islower() */
export function islower(s) {
  let any = false;
  for (const c of s) {
    if (isUpperChar(c)) return false;
    if (isLowerChar(c)) any = true;
  }
  return any;
}

/** str.isdigit() for the characters the converters meet. */
export const isdigit = (s) => s.length > 0 && /^\p{Nd}+$/u.test(s);

/** str.capitalize() */
export function capitalize(s) {
  const cs = [...s];
  return cs.length ? cs[0].toUpperCase() + cs.slice(1).join('').toLowerCase() : s;
}

/** len() in code points, as Python counts. */
export const len = (s) => [...s].length;

/** s[a:b] in code points. */
export function slice(s, a = 0, b) {
  const cs = [...s];
  return cs.slice(a, b).join('');
}

/** str.rsplit(sep, 1) */
export function rsplit1(s, sep) {
  const i = s.lastIndexOf(sep);
  return i < 0 ? [s] : [s.slice(0, i), s.slice(i + sep.length)];
}

/** str.partition(sep) */
export function partition(s, sep) {
  const i = s.indexOf(sep);
  return i < 0 ? [s, '', ''] : [s.slice(0, i), sep, s.slice(i + sep.length)];
}

/** list(dict.fromkeys(xs)): de-duplicate, keeping the first occurrence. */
export const unique = (xs) => [...new Set(xs)];

/** str.endswith(tuple) */
export const endsWithAny = (s, xs) => xs.some((x) => s.endsWith(x));
export const startsWithAny = (s, xs) => xs.some((x) => s.startsWith(x));

/** re.escape (Python 3.7+): escapes the characters that are special in a pattern. */
export function escape(s) {
  return s.replace(/[()[\]{}?*+\-|^$\\.&~# \t\n\r\v\f]/g, (c) => `\\${c}`);
}

/** str.index: like indexOf, but raises when not found, as Python does. */
export function index(s, x, start = 0) {
  const i = s.indexOf(x, start);
  if (i < 0) throw new Error(`substring not found: ${x}`);
  return i;
}

/** Path.read_text(): reads UTF-8 and, like Python's text mode, turns \r\n and lone \r into \n. */
export function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
}
