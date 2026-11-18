import { href } from '../router.js';
import { bindRoot, swipeHandlers, prefersReducedMotion } from './ui.js';
import { notesToHtml } from '../notes/format.js';

const POSITION_LABEL = { bottom: 'bottom', top: 'top', side: 'side' };
const STATES = ['ok', 'warn', 'over'];

export class PresentView {
  constructor(root) {
    this.root = root;
    this.els = {};
  }

  /** @param {{ onPrev, onNext, onSmaller, onBigger, onToggle, onReset, onFullscreen, onMoveTimer, onMinimizeTimer }} h */
  bind(h) {
    const actions = {
      prev: h.onPrev,
      next: h.onNext,
      smaller: h.onSmaller,
      bigger: h.onBigger,
      toggle: h.onToggle,
      reset: h.onReset,
      fullscreen: h.onFullscreen,
      'move-timer': h.onMoveTimer,
      'minimize-timer': h.onMinimizeTimer,
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
      <div class="present" id="present" data-timer="bottom">
        <section class="notes" id="notes" aria-live="polite">
          <div class="notes-text" id="notesText"></div>
        </section>
        <button class="mini-timer" id="miniTimer" data-act="minimize-timer" hidden
          aria-label="Show timer" title="Show timer (M)"><span id="miniTime">0:00</span></button>
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
        <section class="timer" id="timer" aria-label="Timer">
          <div class="timer-tools">
            <button class="icon-btn" data-act="move-timer" id="moveTimerBtn" aria-label="Move timer" title="Move timer (L)">⇅</button>
            <button class="icon-btn" data-act="minimize-timer" aria-label="Minimize timer" title="Minimize timer (M)">–</button>
          </div>
          <div class="slide-label" id="slideLabel">Slide 1</div>
          <div class="time" id="time" role="timer" aria-live="off">0:00</div>
          <div class="time-of" id="timeOf" hidden></div>
          <div class="slide-progress" id="slideProgressTrack" aria-hidden="true" hidden><div class="slide-progress-fill" id="slideProgress"></div></div>
          <div class="row timer-actions">
            <button class="btn primary big round" data-act="toggle" id="toggle" aria-label="Start timer" title="Start / pause (Space)">▶</button>
            <button class="btn big round" data-act="reset" aria-label="Reset timer" title="Reset (R)">↺</button>
          </div>
          <div class="total" id="total"></div>
          <p class="keys muted">← → slide · Space start · R reset · L move timer · M hide timer</p>
        </section>
      </div>`;
    for (const id of [
      'present', 'notes', 'notesText', 'count', 'fontLabel', 'timer', 'time', 'timeOf', 'slideLabel', 'total',
      'toggle', 'fullscreenBtn', 'moveTimerBtn', 'slideProgressTrack', 'slideProgress', 'miniTimer', 'miniTime',
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

  /** True when the screen is wide enough for the timer to sit beside the notes. */
  canPlaceTimerBeside() {
    return window.matchMedia('(min-width: 700px)').matches;
  }

  /** @param {{ timerPosition: 'bottom'|'top'|'side', timerMinimized: boolean }} prefs */
  setLayout({ timerPosition, timerMinimized }) {
    const e = this.els;
    e.present.dataset.timer = timerPosition;
    e.present.toggleAttribute('data-minimized', timerMinimized);
    e.timer.hidden = timerMinimized;
    e.miniTimer.hidden = !timerMinimized;
    e.moveTimerBtn.title = `Move timer (L) · now at the ${POSITION_LABEL[timerPosition]}`;
  }

  /**
   * @param {ReturnType<import('../models/timer.js').timerReadout>} r
   * @param {{ running: boolean, started: boolean }} t
   */
  showTimer(r, { running, started }) {
    const e = this.els;
    e.slideLabel.textContent = r.label;
    e.time.textContent = r.time;
    e.timeOf.hidden = !r.of;
    e.timeOf.textContent = r.of;
    e.slideProgressTrack.hidden = r.progress === null;
    if (r.progress !== null) e.slideProgress.style.width = `${Math.min(1, Math.max(0, r.progress)) * 100}%`;
    e.total.textContent = r.total;

    for (const s of STATES) {
      e.timer.classList.toggle(s, r.state === s);
      e.miniTimer.classList.toggle(s, r.state === s);
      e.total.classList.toggle(s, r.totalState === s);
    }
    e.timer.classList.toggle('paused', !running && started);
    e.miniTime.textContent = r.time;

    e.toggle.textContent = running ? '❚❚' : '▶';
    e.toggle.setAttribute('aria-label', running ? 'Pause timer' : started ? 'Resume timer' : 'Start timer');
  }
}
