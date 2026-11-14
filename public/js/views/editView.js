import { esc, fmtDuration } from '../utils.js';
import { href } from '../router.js';
import { bindRoot, armConfirm } from './ui.js';

const autosize = (t) => {
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 2 + 'px';
};

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
      click: (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const i = slideIndex(b);
        switch (b.dataset.act) {
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
        <p class="muted hint">Tip: to fill several slides at once, paste notes separated by a line containing only <code>---</code>.
          Give a slide a time (like <code>1:30</code> or <code>45s</code>) to get a timer for it while presenting.</p>
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
          <textarea rows="4" placeholder="What do you want to say on this slide?" aria-label="Notes for slide ${i + 1}"></textarea>
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
