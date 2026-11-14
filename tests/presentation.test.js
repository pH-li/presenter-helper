import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, splitNotes, DEFAULT_FONT, DEFAULT_TITLE, FONT_MAX } from '../public/js/models/presentation.js';
import { fmtDuration, esc } from '../public/js/utils.js';

test('normalize fills defaults for an empty object', () => {
  const p = normalize({});
  assert.equal(p.title, DEFAULT_TITLE);
  assert.equal(p.targetMinutes, 0);
  assert.equal(p.fontSize, DEFAULT_FONT);
  assert.equal(p.slides.length, 1);
  assert.equal(p.slides[0].notes, '');
  assert.ok(p.id);
});

test('normalize tolerates garbage input', () => {
  for (const bad of [null, undefined, 42, 'x', { slides: 'nope', fontSize: 'big' }]) {
    const p = normalize(bad);
    assert.equal(p.slides.length, 1);
    assert.equal(p.fontSize, DEFAULT_FONT);
  }
});

test('normalize clamps font size and target', () => {
  const p = normalize({ fontSize: 9999, targetMinutes: -5 });
  assert.equal(p.fontSize, FONT_MAX);
  assert.equal(p.targetMinutes, 0);
});

test('normalize keeps ids only when asked', () => {
  const input = { id: 'abc', slides: [{ id: 's1', notes: 'hi' }] };
  assert.equal(normalize(input, true).id, 'abc');
  assert.equal(normalize(input, true).slides[0].id, 's1');
  assert.notEqual(normalize(input, false).id, 'abc');
  assert.notEqual(normalize(input, false).slides[0].id, 's1');
});

test('splitNotes returns null without a separator', () => {
  assert.equal(splitNotes('just some notes\nno split'), null);
  assert.equal(splitNotes('a --- b'), null); // must be on its own line
});

test('splitNotes splits on --- lines and trims blank edges', () => {
  assert.deepEqual(splitNotes('Intro\n---\nMiddle\n\n  ---  \nEnd'), ['Intro', 'Middle', 'End']);
});

test('splitNotes handles Windows line endings', () => {
  assert.deepEqual(splitNotes('One\r\n---\r\nTwo'), ['One', 'Two']);
});

test('fmtDuration formats minutes and hours', () => {
  assert.equal(fmtDuration(0), '0:00');
  assert.equal(fmtDuration(65_000), '1:05');
  assert.equal(fmtDuration(3_725_000), '1:02:05');
  assert.equal(fmtDuration(1_200, true), '0:02');
});

test('esc escapes HTML', () => {
  assert.equal(esc(`<img src=x onerror="a">&'`), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});
