import { esc } from '../utils.js';
import { href } from '../router.js';
import { bindRoot, armConfirm } from './ui.js';

const autosize = (t) => {
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 2 + 'px';
};

const slideIndex = (el) => {
  const li = el.closest('.slide');
  return li ? Number(li.dataset.i) : -1;
};

export class EditView {
  constructor(root) {
    this.root = root;
  }

  /** @param {{ onTitle, onTargetMinutes, onNotes, onAddSlide, onMoveSlide, onRemoveSlide, onPaste }} h */
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
        else if (t.tagName === 'TEXTAREA' && slideIndex(t) >= 0) {
          autosize(t);
          h.onNotes(slideIndex(t), t.value);
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
        <p class="muted hint">Tip: to fill several slides at once, paste notes separated by a line containing only <code>---</code>.</p>
        <ol class="slides" id="slides"></ol>
        <button class="btn add" data-act="add">+ Add slide</button>
      </main>`;
    this.list = this.root.querySelector('#slides');
    this.renderSlides(p);
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
