import { href } from '../router.js';
import { bindRoot, swipeHandlers, prefersReducedMotion } from './ui.js';
import { notesToHtml } from '../notes/format.js';

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
      // Swipe left/right anywhere outside the control bar to change slides.
      ...swipeHandlers((dir) => (dir > 0 ? h.onNext() : h.onPrev()), '.bar, button, a'),
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
          <div class="bar-group">
            <button class="btn" data-act="prev" aria-label="Previous slide" title="Previous slide (←)">←</button>
            <span class="slide-count" id="count"></span>
            <button class="btn" data-act="next" aria-label="Next slide" title="Next slide (→)">→</button>
          </div>
          <div class="bar-group">
            <button class="btn" data-act="smaller" aria-label="Smaller text" title="Smaller text (−)">A−</button>
            <span class="muted font-label" id="fontLabel"></span>
            <button class="btn" data-act="bigger" aria-label="Bigger text" title="Bigger text (+)">A+</button>
          </div>
          <div class="bar-group">
            <button class="btn ghost" data-act="fullscreen" id="fullscreenBtn" aria-label="Fullscreen" title="Fullscreen (F)">
              <span class="icon-only" aria-hidden="true">⛶</span><span class="label">Fullscreen</span>
            </button>
            <a class="btn ghost" href="${href.edit(p.id)}" aria-label="Exit" title="Exit (Esc)">
              <span class="icon-only" aria-hidden="true">✕</span><span class="label">Exit</span>
            </a>
          </div>
        </nav>
        <section class="timer" id="timer">
          <div class="time" id="time">0:00</div>
          <div class="timer-sub" id="timerSub"></div>
          <div class="slide-timer" id="slideTimer" hidden>
            <div class="slide-timer-text"><span class="muted">This slide</span> <span id="slideTime"></span></div>
            <div class="slide-progress" id="slideProgressTrack" aria-hidden="true"><div class="slide-progress-fill" id="slideProgress"></div></div>
          </div>
          <div class="row timer-actions">
            <button class="btn primary big" data-act="toggle" id="toggle">Start</button>
            <button class="btn big" data-act="reset">Reset</button>
          </div>
          <p class="keys muted">← → slides · ↑ ↓ scroll · + − text size · Space start/pause · R reset · F fullscreen · Esc exit</p>
          <p class="touch-hint muted">Swipe left or right to change slides</p>
        </section>
      </div>`;
    for (const id of [
      'notes', 'notesText', 'count', 'fontLabel', 'timer', 'time', 'timerSub', 'toggle', 'fullscreenBtn',
      'slideTimer', 'slideTime', 'slideProgressTrack', 'slideProgress',
    ]) {
      this.els[id] = this.root.querySelector('#' + id);
    }
  }

  /** @param {number} [direction] 1 / -1 to animate the change, 0 for none */
  showSlide(index, total, notes, direction = 0) {
    const empty = !notes.trim();
    const text = this.els.notesText;
    if (empty) text.textContent = 'No notes for this slide.';
    else text.innerHTML = notesToHtml(notes); // escapes everything; only list/emphasis markup is added
    text.classList.toggle('empty-note', empty);
    this.els.count.innerHTML = `<span class="label">Slide </span>${index + 1} / ${total}`;
    this.els.notes.scrollTop = 0;
    if (direction && text.animate && !prefersReducedMotion()) {
      text.animate(
        [
          { opacity: 0, transform: `translateX(${direction * 24}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 180, easing: 'ease-out' }
      );
    }
  }

  setFullscreenAvailable(available) {
    this.els.fullscreenBtn.hidden = !available;
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

  /**
   * The current slide's own timer.
   * @param {{ visible: boolean, text: string, progress: number|null, state: 'none'|'ok'|'warn'|'over' }} s
   *   progress: 0..1 of the slide's budget, or null when the slide has no budget
   */
  showSlideTimer({ visible, text, progress, state }) {
    const e = this.els;
    e.slideTimer.hidden = !visible;
    if (!visible) return;
    e.slideTime.textContent = text;
    e.slideProgressTrack.hidden = progress === null;
    if (progress !== null) e.slideProgress.style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
    for (const s of ['ok', 'warn', 'over']) e.slideTimer.classList.toggle(s, state === s);
  }

  setToggleLabel(label) {
    this.els.toggle.textContent = label;
  }
}
