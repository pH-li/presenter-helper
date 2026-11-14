// Turns speaking-note text into safe HTML for present mode. DOM-free, so it's unit-tested in Node.
//
// Supported (a small, forgiving Markdown subset):
//   - item / * item / • item      bullet list
//   1. item / 1) item             numbered list (the first number sets the start)
//   indent with spaces or tabs    nested ("tiered") lists, any depth
//   indented line under an item   continues that item on a new line
//   # / ## / ### heading          heading line
//   **bold**  *italic*            inline emphasis
//   anything else                 paragraphs; single line breaks are kept; blank lines separate paragraphs
//
// Everything is HTML-escaped before formatting is applied, so notes can never inject markup.
import { esc } from '../utils.js';

const LIST_ITEM = /^([ \t]*)([-*•+]|\d{1,4}[.)])[ \t]+(.*)$/;
const HEADING = /^(#{1,3})[ \t]+(.+)$/;

/** Indent width in columns (tab = 2), so tabs and spaces mix sensibly. */
const indentWidth = (ws) => ws.replace(/\t/g, '  ').length;

/** **bold** and *italic*, applied to already-escaped text. */
export function inlineFormat(text) {
  return esc(text)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)(?<!\s)\*(?!\*)/g, '$1<em>$2</em>');
}

/**
 * @param {string} text the raw notes
 * @returns {string} HTML (safe to assign to innerHTML)
 */
export function notesToHtml(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  /** @type {{ indent: number, tag: 'ul'|'ol' }[]} */
  const lists = [];
  let para = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
    para = [];
  };
  const closeListsDeeperThan = (indent) => {
    while (lists.length && lists[lists.length - 1].indent > indent) out.push(`</li></${lists.pop().tag}>`);
  };
  const openList = (tag, start) => `<${tag}${tag === 'ol' && start !== 1 ? ` start="${start}"` : ''}>`;

  for (const line of lines) {
    const item = line.match(LIST_ITEM);
    if (item) {
      flushPara();
      const indent = indentWidth(item[1]);
      const ordered = /\d/.test(item[2]);
      const tag = ordered ? 'ol' : 'ul';
      const start = ordered ? parseInt(item[2], 10) : 1;
      closeListsDeeperThan(indent);
      const top = lists[lists.length - 1];
      if (!top || indent > top.indent) {
        out.push(openList(tag, start)); // first list, or a deeper (nested) one inside the open item
        lists.push({ indent, tag });
      } else if (top.tag !== tag) {
        out.push(`</li></${top.tag}>${openList(tag, start)}`); // switched bullets ↔ numbers at this level
        top.tag = tag;
      } else {
        out.push('</li>');
      }
      out.push(`<li>${inlineFormat(item[3])}`);
      continue;
    }

    if (lists.length && /^[ \t]+\S/.test(line)) {
      out.push(`<br>${inlineFormat(line.trim())}`); // continuation of the current item
      continue;
    }

    closeListsDeeperThan(-1);
    const heading = line.match(HEADING);
    if (heading) {
      flushPara();
      out.push(`<p class="note-h note-h${heading[1].length}">${inlineFormat(heading[2].trim())}</p>`);
    } else if (!line.trim()) {
      flushPara();
    } else {
      para.push(inlineFormat(line));
    }
  }
  closeListsDeeperThan(-1);
  flushPara();
  return out.join('');
}
