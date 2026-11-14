import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notesToHtml, inlineFormat } from '../public/js/notes/format.js';

test('plain text keeps its line breaks and paragraphs', () => {
  assert.equal(notesToHtml('Hello\nworld\n\nNext para'), '<p>Hello<br>world</p><p>Next para</p>');
});

test('bullets with -, * and •', () => {
  assert.equal(notesToHtml('- a\n* b\n• c'), '<ul><li>a</li><li>b</li><li>c</li></ul>');
});

test('nested (tiered) lists from indentation', () => {
  const html = notesToHtml('- Wins\n  - Revenue up\n    - 12% QoQ\n  - New hires\n- Risks');
  assert.equal(
    html,
    '<ul><li>Wins<ul><li>Revenue up<ul><li>12% QoQ</li></ul></li><li>New hires</li></ul></li><li>Risks</li></ul>'
  );
});

test('tabs count as indentation too', () => {
  assert.equal(notesToHtml('- a\n\t- b'), '<ul><li>a<ul><li>b</li></ul></li></ul>');
});

test('numbered lists, start number, and mixing with bullets', () => {
  assert.equal(notesToHtml('3. three\n4. four'), '<ol start="3"><li>three</li><li>four</li></ol>');
  assert.equal(notesToHtml('1) one\n   - detail\n2) two'), '<ol><li>one<ul><li>detail</li></ul></li><li>two</li></ol>');
  assert.equal(notesToHtml('- a\n1. b'), '<ul><li>a</li></ul><ol><li>b</li></ol>');
});

test('indented plain line continues the list item', () => {
  assert.equal(notesToHtml('- Point\n  more about it\n- Next'), '<ul><li>Point<br>more about it</li><li>Next</li></ul>');
});

test('a paragraph after a list closes it', () => {
  assert.equal(notesToHtml('- a\n  - b\nThen talk'), '<ul><li>a<ul><li>b</li></ul></li></ul><p>Then talk</p>');
});

test('headings', () => {
  assert.equal(notesToHtml('# Intro\ntext'), '<p class="note-h note-h1">Intro</p><p>text</p>');
  assert.equal(notesToHtml('#1 priority'), '<p>#1 priority</p>'); // needs a space after #
});

test('bold and italic', () => {
  assert.equal(inlineFormat('a **big** *deal* and *x*'), 'a <strong>big</strong> <em>deal</em> and <em>x</em>');
  assert.equal(inlineFormat('2 * 3 * 4'), '2 * 3 * 4'); // spaced asterisks are left alone
  assert.equal(inlineFormat('snake_case_name'), 'snake_case_name');
});

test('dashes that are not list markers stay as text', () => {
  assert.equal(notesToHtml('-5 degrees\n--- not a list'), '<p>-5 degrees<br>--- not a list</p>');
});

test('HTML in notes is escaped, including inside lists and bold', () => {
  const html = notesToHtml('<img src=x onerror=alert(1)>\n- **<script>x</script>**');
  assert.ok(!/<img|<script/i.test(html));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('<strong>&lt;script&gt;x&lt;/script&gt;</strong>'));
});

test('Windows line endings', () => {
  assert.equal(notesToHtml('- a\r\n  - b'), '<ul><li>a<ul><li>b</li></ul></li></ul>');
});
