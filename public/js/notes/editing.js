// Text-editing helpers for the notes box: list continuation, indenting, list toggles, bold.
// DOM-free and unit-tested. Each helper takes the textarea's value + selection and returns an
// Edit describing one replacement, or null when it doesn't apply (let the browser do its default).
//
// @typedef {{ start: number, end: number, text: string, selStart: number, selEnd: number }} Edit
//   Replace value[start..end) with `text`, then select [selStart, selEnd) in the new value.

export const INDENT = '  ';
const ITEM = /^([ \t]*)([-*•+]|\d{1,4}[.)])([ \t]+)/;

const lineStartAt = (value, pos) => value.lastIndexOf('\n', pos - 1) + 1;
const lineEndAt = (value, pos) => {
  const i = value.indexOf('\n', pos);
  return i === -1 ? value.length : i;
};

/** The full lines touched by the selection: [blockStart, blockEnd). */
function lineBlock(value, selStart, selEnd) {
  // A selection ending right at the start of a line doesn't include that line.
  const endPos = selEnd > selStart && value[selEnd - 1] === '\n' ? selEnd - 1 : selEnd;
  return [lineStartAt(value, selStart), lineEndAt(value, endPos)];
}

/** Is the caret / selection on at least one list line? */
export function onListLine(value, selStart, selEnd = selStart) {
  const [a, b] = lineBlock(value, selStart, selEnd);
  return value.slice(a, b).split('\n').some((l) => ITEM.test(l));
}

/**
 * Enter on a list line: start the next item with the same marker (numbers count up).
 * Enter on an empty item: outdent it, or end the list if it's already at the left edge.
 * @returns {Edit | null}
 */
export function continueList(value, selStart, selEnd) {
  if (selStart !== selEnd) return null;
  const ls = lineStartAt(value, selStart);
  const le = lineEndAt(value, selStart);
  const m = value.slice(ls, le).match(ITEM);
  if (!m || selStart < ls + m[0].length) return null; // not a list line, or caret inside the marker

  const isEmptyItem = !value.slice(ls + m[0].length, le).trim();
  if (isEmptyItem) {
    if (m[1].length) {
      const remove = m[1].startsWith('\t') ? 1 : Math.min(INDENT.length, m[1].length);
      return { start: ls, end: ls + remove, text: '', selStart: selStart - remove, selEnd: selStart - remove };
    }
    return { start: ls, end: le, text: '', selStart: ls, selEnd: ls }; // end the list
  }

  const num = m[2].match(/^(\d+)([.)])$/);
  const marker = num ? `${Number(num[1]) + 1}${num[2]}` : m[2];
  const text = `\n${m[1]}${marker}${m[3]}`;
  return { start: selStart, end: selStart, text, selStart: selStart + text.length, selEnd: selStart + text.length };
}

/**
 * Indent (dir = 1) or outdent (dir = -1) every line in the selection by one level.
 * @returns {Edit | null} null if nothing would change
 */
export function indentLines(value, selStart, selEnd, dir) {
  const [a, b] = lineBlock(value, selStart, selEnd);
  const lines = value.slice(a, b).split('\n');
  const deltas = lines.map((l) => {
    if (dir > 0) return l.trim() ? INDENT.length : 0;
    if (l.startsWith('\t')) return -1;
    return -Math.min(INDENT.length, l.match(/^ */)[0].length);
  });
  if (deltas.every((d) => d === 0)) return null;
  const text = lines.map((l, i) => (deltas[i] > 0 ? INDENT + l : l.slice(-deltas[i]))).join('\n');
  const first = deltas[0];
  const total = deltas.reduce((s, d) => s + d, 0);
  return {
    start: a,
    end: b,
    text,
    selStart: Math.max(a, selStart + first),
    selEnd: Math.max(a, selEnd + total),
  };
}

/**
 * Toggle bullets ('bullet') or numbers ('number') on the selected lines.
 * If every non-empty line already has that kind of marker, the markers are removed.
 * @returns {Edit}
 */
export function toggleList(value, selStart, selEnd, kind) {
  const [a, b] = lineBlock(value, selStart, selEnd);
  const lines = value.slice(a, b).split('\n');
  const isKind = (l) => {
    const m = l.match(ITEM);
    return m && (kind === 'number') === /\d/.test(m[2]);
  };
  const targets = lines.filter((l) => l.trim() || lines.length === 1);
  const removing = targets.length > 0 && targets.every(isKind);

  let n = 0;
  const text = lines
    .map((l) => {
      if (!l.trim() && lines.length > 1) return l;
      const m = l.match(ITEM);
      const indent = m ? m[1] : l.match(/^[ \t]*/)[0];
      const rest = m ? l.slice(m[0].length) : l.slice(indent.length);
      if (removing) return indent + rest;
      n += 1;
      return `${indent}${kind === 'number' ? `${n}.` : '-'} ${rest}`;
    })
    .join('\n');

  // Keep the caret at the end of the text it was on (a single line) or select the whole block.
  if (lines.length === 1) {
    const caret = a + text.length - (b - selEnd);
    return { start: a, end: b, text, selStart: Math.max(a, caret), selEnd: Math.max(a, caret) };
  }
  return { start: a, end: b, text, selStart: a, selEnd: a + text.length };
}

/**
 * Wrap the selection in **bold**, or unwrap it if it's already bold.
 * With no selection, inserts **** and puts the caret in the middle.
 * @returns {Edit}
 */
export function toggleBold(value, selStart, selEnd) {
  const sel = value.slice(selStart, selEnd);
  if (sel.length > 4 && sel.startsWith('**') && sel.endsWith('**')) {
    const inner = sel.slice(2, -2);
    return { start: selStart, end: selEnd, text: inner, selStart, selEnd: selStart + inner.length };
  }
  if (value.slice(selStart - 2, selStart) === '**' && value.slice(selEnd, selEnd + 2) === '**') {
    return { start: selStart - 2, end: selEnd + 2, text: sel, selStart: selStart - 2, selEnd: selEnd - 2 };
  }
  return { start: selStart, end: selEnd, text: `**${sel}**`, selStart: selStart + 2, selEnd: selEnd + 2 };
}

/** Apply an Edit to a string (used by tests and as a fallback). */
export const applyEditToString = (value, e) => value.slice(0, e.start) + e.text + value.slice(e.end);
