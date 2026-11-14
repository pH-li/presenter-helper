import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  continueList,
  indentLines,
  toggleList,
  toggleBold,
  onListLine,
  applyEditToString,
} from '../public/js/notes/editing.js';

/** Run an edit on text with a caret marked by | (or a selection marked by [ ]). */
function run(fn, marked, ...args) {
  let value = marked;
  let s;
  let e;
  if (marked.includes('[')) {
    s = value.indexOf('[');
    value = value.replace('[', '');
    e = value.indexOf(']');
    value = value.replace(']', '');
  } else {
    s = e = value.indexOf('|');
    value = value.replace('|', '');
  }
  const edit = fn(value, s, e, ...args);
  if (!edit) return null;
  const next = applyEditToString(value, edit);
  if (edit.selStart === edit.selEnd) return next.slice(0, edit.selStart) + '|' + next.slice(edit.selStart);
  return next.slice(0, edit.selStart) + '[' + next.slice(edit.selStart, edit.selEnd) + ']' + next.slice(edit.selEnd);
}

test('Enter continues bullets at the same depth', () => {
  assert.equal(run(continueList, '- one|'), '- one\n- |');
  assert.equal(run(continueList, '  * deep|'), '  * deep\n  * |');
});

test('Enter counts numbered lists up', () => {
  assert.equal(run(continueList, '1. one|'), '1. one\n2. |');
  assert.equal(run(continueList, '  9) nine|'), '  9) nine\n  10) |');
});

test('Enter in the middle of an item splits it onto a new item', () => {
  assert.equal(run(continueList, '- hello| world'), '- hello\n-  world'.replace('-  world', '- | world'));
});

test('Enter on an empty item outdents, then ends the list', () => {
  assert.equal(run(continueList, '- a\n  - |'), '- a\n- |');
  assert.equal(run(continueList, '- a\n- |'), '- a\n|');
});

test('Enter on a plain line does nothing special', () => {
  assert.equal(run(continueList, 'plain|'), null);
  assert.equal(run(continueList, '-|'), null); // marker without a space yet
});

test('indent and outdent a single line keep the caret in place', () => {
  assert.equal(run(indentLines, '- a|', 1), '  - a|');
  assert.equal(run(indentLines, '  - a|', -1), '- a|');
  assert.equal(run(indentLines, '- a|', -1), null); // already at the edge
});

test('indent a multi-line selection', () => {
  assert.equal(run(indentLines, '[- a\n- b]', 1), '  [- a\n  - b]');
  assert.equal(run(indentLines, '  [- a\n\n  - b]', -1), '[- a\n\n- b]');
});

test('toggle bullets on, switch to numbers, and off again', () => {
  assert.equal(run(toggleList, '[one\ntwo]', 'bullet'), '[- one\n- two]');
  assert.equal(run(toggleList, '[- one\n- two]', 'number'), '[1. one\n2. two]');
  assert.equal(run(toggleList, '[1. one\n2. two]', 'number'), '[one\ntwo]');
  assert.equal(run(toggleList, '  hello|', 'bullet'), '  - hello|');
});

test('bold wraps, unwraps, and inserts markers with no selection', () => {
  assert.equal(run(toggleBold, 'say [this] now'), 'say **[this]** now');
  assert.equal(run(toggleBold, 'say **[this]** now'), 'say [this] now');
  assert.equal(run(toggleBold, 'x|'), 'x**|**');
});

test('onListLine detects list lines in the selection', () => {
  assert.equal(onListLine('- a', 1), true);
  assert.equal(onListLine('plain', 2), false);
  assert.equal(onListLine('plain\n- b', 0, 8), true);
});
