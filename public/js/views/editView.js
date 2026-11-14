import { esc, fmtDuration } from '../utils.js';
import { href } from '../router.js';
import { bindRoot, armConfirm } from './ui.js';
import {
  continueList,
  indentLines,
  toggleList,
  toggleBold,
  onListLine,
  applyEditToString,
} from '../notes/editing.js';

const autosize = (t) => {
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 2 + 'px';
};

/**
 * Apply an Edit (see notes/editing.js) to a textarea. Uses insertText when the
 * browser supports it, so Ctrl/⌘+Z can undo the change. Always ends with an
 * `input` event so the change is saved.
 */
function applyEdit(t, edit) {
  const expected = applyEditToString(t.value, edit);
  t.focus();
  t.setSelectionRange(edit.start, edit.end);
  let ok = false;
  try {
    ok = edit.text
      ? document.execCommand('insertText', false, edit.text)
      : edit.start === edit.end || document.execCommand('delete');
  } catch {
    ok = false;
  }
  if (!ok || t.value !== expected) {
    t.value = expected;
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }
  t.setSelectionRange(edit.selStart, edit.selEnd);
}

/** The formatting toolbar's buttons → the edit each one makes. */
const FORMATS = {
  bullet: (v, s, e) => toggleList(v, s, e, 'bullet'),
  number: (v, s, e) => toggleList(v, s, e, 'number'),
  outdent: (v, s, e) => indentLines(v, s, e, -1),
  indent: (v, s, e) => indentLines(v, s, e, 1),
  bold: (v, s, e) => toggleBold(v, s, e),
};

/** Keyboard shortcuts inside a notes box. @returns {object|null|false} an Edit, null (no edit), or false (swallow the key) */
function keyEdit(e, t) {
  const { value: v, selectionStart: s, selectionEnd: en } = t;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Enter' && !e.shiftKey && !mod && !e.altKey) return continueList(v, s, en);
  if (e.key === 'Tab' && !mod && !e.altKey) {
    // Only take over Tab on list lines / multi-line selections, so Tab still moves focus elsewhere.
    const multiLine = v.slice(s, en).includes('\n');
    if (!multiLine && !onListLine(v, s, en)) return null;
    return indentLines(v, s, en, e.shiftKey ? -1 : 1) || false;
  }
  if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') return toggleBold(v, s, en);
  return null;
}

/** 90 → "1:30", 0 → "" */
const formatSlideTime = (seconds) => (seconds ? fmtDuration(seconds * 1000) : '');

const slideIndex = (el) => {
  const li = el.closest('.slide');
  return li ? Number(li.dataset.i) : -1;
};

export class EditView {
  constructor(root) {
    this.root = root;
  }

  /** @param {{ onTitle, onTargetMinutes, onNotes, onSlideTarget, onAddSlide, onMoveSlide, onRemoveSlide, onPaste }} h */
  bind(h) {
    bindRoot(this.root, {
      // Keep focus (and the selection) in the notes box when clicking a toolbar button.
      mousedown: (e) => {
        if (e.target.closest('.notes-toolbar button')) e.preventDefault();
      },
      keydown: (e) => {
        const t = e.target;
        if (t.tagName !== 'TEXTAREA' || slideIndex(t) < 0 || e.isComposing) return;
        const edit = keyEdit(e, t);
        if (edit === null) return;
        e.preventDefault();
        if (edit) applyEdit(t, edit);
      },
      click: (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const i = slideIndex(b);
        switch (b.dataset.act) {
          case 'fmt': {
            const t = b.closest('.slide').querySelector('textarea');
            const edit = FORMATS[b.dataset.fmt](t.value, t.selectionStart, t.selectionEnd);
            if (edit) applyEdit(t, edit);
            else t.focus();
            break;
          }
          case 'add':
            h.onAddSlide();
            break;
          case 'up':
            h.onMoveSlide(i, -1);
            break;
          case 'down':
            h.onMoveSlide(i, 1);
            break;
          case 'remove': {
            const hasNotes = b.closest('.slide').querySelector('textarea').value.trim();
            if (hasNotes && !armConfirm(b, 'Delete?')) return;
            h.onRemoveSlide(i);
            break;
          }
        }
      },
      input: (e) => {
        const t = e.target;
        if (t.dataset.field === 'title') h.onTitle(t.value);
        else if (t.dataset.field === 'targetMinutes') h.onTargetMinutes(t.value);
        else if (t.dataset.field === 'slideTarget') {
          // onSlideTarget returns the parsed seconds, or null if it can't be understood yet.
          const seconds = h.onSlideTarget(slideIndex(t), t.value);
          t.classList.toggle('invalid', seconds === null);
          t.setAttribute('aria-invalid', String(seconds === null));
        } else if (t.tagName === 'TEXTAREA' && slideIndex(t) >= 0) {
          autosize(t);
          h.onNotes(slideIndex(t), t.value);
        }
      },
      // On blur, tidy what was typed ("90s" → "1:30").
      change: (e) => {
        const t = e.target;
        if (t.dataset.field !== 'slideTarget') return;
        const seconds = h.onSlideTarget(slideIndex(t), t.value);
        if (seconds !== null) {
          t.value = formatSlideTime(seconds);
          t.classList.remove('invalid');
          t.setAttribute('aria-invalid', 'false');
        }
      },
      paste: (e) => {
        const t = e.target;
        if (t.tagName !== 'TEXTAREA' || slideIndex(t) < 0) return;
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const handled = h.onPaste(slideIndex(t), {
          text,
          before: t.value.slice(0, t.selectionStart),
          after: t.value.slice(t.selectionEnd),
        });
        if (handled) e.preventDefault();
      },
    });
  }

  render(p) {
    this.setTitle(p.title);
    this.root.innerHTML = `
      <main class="page">
        <header class="page-head">
          <a class="btn ghost" href="${href.home()}">← All presentations</a>
          <a class="btn primary" href="${href.present(p.id)}">Present ▶</a>
        </header>
        <div class="fields">
          <label class="field grow"><span>Title</span>
            <input type="text" data-field="title" value="${esc(p.title)}" placeholder="Untitled talk">
          </label>
          <label class="field"><span>Target length (minutes)</span>
            <input type="number" min="0" max="600" step="1" inputmode="numeric" data-field="targetMinutes"
              value="${p.targetMinutes || ''}" placeholder="None">
          </label>
        </div>
        <details class="hint muted">
          <summary>Tips for writing notes</summary>
          <ul>
            <li><strong>Lists:</strong> start a line with <code>-</code> or <code>1.</code> (or use • / 1. in the toolbar).
              <kbd>Enter</kbd> continues the list; <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> nests or un-nests a point.</li>
            <li><strong>Emphasis:</strong> <code>**bold**</code> (or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>B</kbd>), <code>*italic*</code>, and <code># </code> for a heading line.</li>
            <li><strong>Many slides at once:</strong> paste notes separated by a line containing only <code>---</code>.</li>
            <li><strong>Slide timers:</strong> give a slide a time like <code>1:30</code> or <code>45s</code>.</li>
          </ul>
        </details>
        <p class="timing-summary" id="timingSummary" hidden></p>
        <ol class="slides" id="slides"></ol>
        <button class="btn add" data-act="add">+ Add slide</button>
      </main>`;
    this.list = this.root.querySelector('#slides');
    this.summary = this.root.querySelector('#timingSummary');
    this.renderSlides(p);
  }

  /**
   * "Slide times add up to 7:30 of your 10 min target"
   * @param {number} totalSeconds sum of slide budgets
   * @param {number} targetMinutes whole-talk target (0 = none)
   */
  setTimingSummary(totalSeconds, targetMinutes) {
    if (!this.summary) return;
    this.summary.hidden = !totalSeconds;
    if (!totalSeconds) return;
    const total = fmtDuration(totalSeconds * 1000);
    const over = targetMinutes && totalSeconds > targetMinutes * 60;
    this.summary.classList.toggle('over', Boolean(over));
    this.summary.textContent = targetMinutes
      ? `Slide times add up to ${total} of your ${targetMinutes} min target${
          over ? ` (${fmtDuration((totalSeconds - targetMinutes * 60) * 1000)} over)` : ''
        }.`
      : `Slide times add up to ${total}.`;
  }

  setTitle(title) {
    document.title = `Edit · ${title || 'Untitled talk'}`;
  }

  /** @param {number} [focusIndex] slide to focus and scroll to */
  renderSlides(p, focusIndex) {
    const n = p.slides.length;
    this.list.innerHTML = p.slides
      .map(
        (_, i) => `
        <li class="slide" data-i="${i}">
          <div class="slide-head">
            <span class="slide-num">Slide ${i + 1}</span>
            <label class="slide-time" title="Time for this slide, e.g. 1:30 or 45s">
              <span class="slide-time-icon" aria-hidden="true">⏱</span>
              <span class="sr-only">Time for slide ${i + 1}</span>
              <input type="text" data-field="slideTarget" inputmode="text" autocomplete="off" spellcheck="false"
                placeholder="time" value="${formatSlideTime(p.slides[i].targetSeconds)}">
            </label>
            <div class="row tight">
              <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move slide up" title="Move up">↑</button>
              <button class="icon-btn" data-act="down" ${i === n - 1 ? 'disabled' : ''} aria-label="Move slide down" title="Move down">↓</button>
              <button class="icon-btn" data-act="remove" ${n === 1 ? 'disabled' : ''} aria-label="Delete slide" title="Delete slide">✕</button>
            </div>
          </div>
          <div class="notes-toolbar" role="toolbar" aria-label="Formatting for slide ${i + 1}">
            <button type="button" data-act="fmt" data-fmt="bullet" aria-label="Bulleted list" title="Bulleted list">•&#8202;≡</button>
            <button type="button" data-act="fmt" data-fmt="number" aria-label="Numbered list" title="Numbered list">1.</button>
            <button type="button" data-act="fmt" data-fmt="outdent" aria-label="Outdent" title="Outdent (Shift+Tab)">⇤</button>
            <button type="button" data-act="fmt" data-fmt="indent" aria-label="Indent" title="Indent (Tab)">⇥</button>
            <button type="button" data-act="fmt" data-fmt="bold" aria-label="Bold" title="Bold (Ctrl/⌘+B)"><strong>B</strong></button>
          </div>
          <textarea rows="4" placeholder="What do you want to say on this slide?&#10;- Start a line with - for bullets" aria-label="Notes for slide ${i + 1}"></textarea>
        </li>`
      )
      .join('');

    const areas = this.list.querySelectorAll('textarea');
    areas.forEach((t, i) => {
      t.value = p.slides[i].notes;
      autosize(t);
    });
    const target = focusIndex != null && areas[focusIndex];
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}
