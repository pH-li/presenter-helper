import { href } from '../router.js';
import { bindRoot } from './ui.js';

export class PresentView {
  constructor(root) {
    this.root = root;
    this.els = {};
  }

  /** @param {{ onPrev, onNext, onSmaller, onBigger, onToggle, onReset, onFullscreen }} h */
  bind(h) {
    const actions = {
      prev: h.onPrev,
      next: h.onNext,
      smaller: h.onSmaller,
      bigger: h.onBigger,
      toggle: h.onToggle,
      reset: h.onReset,
      fullscreen: h.onFullscreen,
    };
    bindRoot(this.root, {
      click: (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        b.blur(); // so Space doesn't re-activate the last clicked button
        const fn = actions[b.dataset.act];
        if (fn) fn();
      },
    });
  }

  render(p) {
    document.title = `Presenting · ${p.title || 'Untitled talk'}`;
    this.root.innerHTML = `
      <div class="present">
        <section class="notes" id="notes" aria-live="polite">
          <div class="notes-text" id="notesText"></div>
        </section>
        <nav class="bar" aria-label="Presenter controls">
          <div class="row tight">
            <button class="btn" data-act="prev" aria-label="Previous slide" title="Previous slide (←)">←</button>
            <span class="slide-count" id="count"></span>
            <button class="btn" data-act="next" aria-label="Next slide" title="Next slide (→)">→</button>
          </div>
          <div class="row tight">
            <button class="btn" data-act="smaller" aria-label="Smaller text" title="Smaller text (−)">A−</button>
            <span class="muted font-label" id="fontLabel"></span>
            <button class="btn" data-act="bigger" aria-label="Bigger text" title="Bigger text (+)">A+</button>
          </div>
          <div class="row tight">
            <button class="btn ghost" data-act="fullscreen" title="Fullscreen (F)">Fullscreen</button>
            <a class="btn ghost" href="${href.edit(p.id)}" title="Exit (Esc)">Exit</a>
          </div>
        </nav>
        <section class="timer" id="timer">
          <div class="time" id="time">0:00</div>
          <div class="timer-sub" id="timerSub"></div>
          <div class="row">
            <button class="btn primary big" data-act="toggle" id="toggle">Start</button>
            <button class="btn big" data-act="reset">Reset</button>
          </div>
          <p class="keys muted">← → slides · ↑ ↓ scroll · + − text size · Space start/pause · R reset · F fullscreen · Esc exit</p>
        </section>
      </div>`;
    for (const id of ['notes', 'notesText', 'count', 'fontLabel', 'timer', 'time', 'timerSub', 'toggle']) {
      this.els[id] = this.root.querySelector('#' + id);
    }
  }

  showSlide(index, total, notes) {
    const empty = !notes.trim();
    this.els.notesText.textContent = empty ? 'No notes for this slide.' : notes;
    this.els.notesText.classList.toggle('empty-note', empty);
    this.els.count.textContent = `Slide ${index + 1} / ${total}`;
    this.els.notes.scrollTop = 0;
  }

  setFontSize(px) {
    this.els.notesText.style.fontSize = px + 'px';
    this.els.fontLabel.textContent = px + 'px';
  }

  /** @param {1|-1} direction */
  scrollNotes(direction) {
    const n = this.els.notes;
    n.scrollBy({ top: direction * n.clientHeight * 0.3, behavior: 'smooth' });
  }

  /** @param {{ time: string, sub: string, state: 'none'|'ok'|'warn'|'over', paused: boolean }} t */
  showTimer({ time, sub, state, paused }) {
    this.els.time.textContent = time;
    this.els.timerSub.textContent = sub;
    const c = this.els.timer.classList;
    c.toggle('warn', state === 'warn');
    c.toggle('over', state === 'over');
    c.toggle('paused', paused);
  }

  setToggleLabel(label) {
    this.els.toggle.textContent = label;
  }
}
