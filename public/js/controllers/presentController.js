import { FONT_STEP } from '../models/presentation.js';
import { Timer } from '../models/timer.js';
import { fmtDuration, clamp } from '../utils.js';
import { href, navigate } from '../router.js';
import { ScreenWakeLock, toggleFullscreen, exitFullscreen, isFullscreen } from '../services/screen.js';

// Keyboard map. Keep in sync with the on-screen hint in presentView.js and the README table.
const KEYMAP = {
  ArrowRight: 'next',
  PageDown: 'next',
  ArrowLeft: 'prev',
  PageUp: 'prev',
  ArrowDown: 'scrollDown',
  ArrowUp: 'scrollUp',
  '+': 'bigger',
  '=': 'bigger',
  '-': 'smaller',
  _: 'smaller',
  ' ': 'toggle',
  r: 'reset',
  R: 'reset',
  f: 'fullscreen',
  F: 'fullscreen',
  Escape: 'exit',
};

const TICK_MS = 200;

export class PresentController {
  /**
   * @param {import('../models/presentationsModel.js').PresentationsModel} model
   * @param {import('../views/presentView.js').PresentView} view
   */
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  /** @returns {false | (() => void)} cleanup, or false if the presentation doesn't exist */
  mount(id) {
    const p = this.model.get(id);
    if (!p) return false;

    this.p = p;
    this.index = 0;
    this.timer = new Timer();
    this.wakeLock = new ScreenWakeLock();

    this.actions = {
      next: () => this.go(1),
      prev: () => this.go(-1),
      scrollDown: () => this.view.scrollNotes(1),
      scrollUp: () => this.view.scrollNotes(-1),
      bigger: () => this.changeFont(FONT_STEP),
      smaller: () => this.changeFont(-FONT_STEP),
      toggle: () => this.toggleTimer(),
      reset: () => this.resetTimer(),
      fullscreen: toggleFullscreen,
      exit: () => navigate(href.edit(p.id)),
    };

    const a = this.actions;
    this.view.bind({
      onPrev: a.prev,
      onNext: a.next,
      onSmaller: a.smaller,
      onBigger: a.bigger,
      onToggle: a.toggle,
      onReset: a.reset,
      onFullscreen: a.fullscreen,
    });
    this.view.render(p);
    this.view.setFontSize(p.fontSize);
    this.showSlide();
    this.tick();

    const onKey = (e) => this.onKey(e);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && this.timer.running) this.wakeLock.acquire();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(() => this.tick(), TICK_MS);

    return () => {
      clearInterval(interval);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      this.wakeLock.release();
      exitFullscreen();
    };
  }

  onKey(e) {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const action = KEYMAP[e.key];
    if (!action) return;
    if (action === 'exit' && isFullscreen()) return; // let the browser leave fullscreen first
    e.preventDefault();
    this.actions[action]();
  }

  go(delta) {
    const next = clamp(this.index + delta, 0, this.p.slides.length - 1);
    if (next === this.index) return;
    this.index = next;
    this.showSlide();
  }

  showSlide() {
    this.view.showSlide(this.index, this.p.slides.length, this.p.slides[this.index].notes);
  }

  changeFont(delta) {
    this.view.setFontSize(this.model.setFontSize(this.p.id, this.p.fontSize + delta));
  }

  toggleTimer() {
    const running = this.timer.toggle();
    if (running) this.wakeLock.acquire();
    else this.wakeLock.release();
    this.updateToggleLabel();
    this.tick();
  }

  resetTimer() {
    this.timer.reset();
    this.wakeLock.release();
    this.updateToggleLabel();
    this.tick();
  }

  updateToggleLabel() {
    const t = this.timer;
    this.view.setToggleLabel(t.running ? 'Pause' : t.elapsedMs ? 'Resume' : 'Start');
  }

  tick() {
    const target = this.p.targetMinutes;
    const { ms, remainingMs, state } = this.timer.status(target);
    let sub;
    if (state === 'none') sub = this.timer.running || ms ? 'Elapsed' : 'Press Start or Space when you begin';
    else if (remainingMs >= 0) sub = `${fmtDuration(remainingMs, true)} left of ${target} min`;
    else sub = `${fmtDuration(-remainingMs)} over ${target} min`;
    this.view.showTimer({ time: fmtDuration(ms), sub, state, paused: !this.timer.running && ms > 0 });
  }
}
