import { FONT_STEP } from '../models/presentation.js';
import { Timer, SlideTimer, timerReadout } from '../models/timer.js';
import { nextTimerPosition } from '../models/prefsStore.js';
import { clamp } from '../utils.js';
import { href, navigate } from '../router.js';
import {
  ScreenWakeLock,
  toggleFullscreen,
  exitFullscreen,
  isFullscreen,
  isFullscreenSupported,
} from '../services/screen.js';

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
  l: 'moveTimer',
  L: 'moveTimer',
  m: 'minimizeTimer',
  M: 'minimizeTimer',
  Escape: 'exit',
};

const TICK_MS = 200;

export class PresentController {
  /**
   * @param {import('../models/presentationsModel.js').PresentationsModel} model
   * @param {import('../views/presentView.js').PresentView} view
   * @param {import('../models/prefsStore.js').PrefsStore} prefsStore  per-device timer layout
   */
  constructor(model, view, prefsStore) {
    this.model = model;
    this.view = view;
    this.prefsStore = prefsStore;
  }

  /** @returns {false | (() => void)} cleanup, or false if the presentation doesn't exist */
  mount(id) {
    const p = this.model.get(id);
    if (!p) return false;

    this.p = p;
    this.index = 0;
    this.timer = new Timer();
    this.slideTimer = new SlideTimer(); // runs in step with this.timer
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
      moveTimer: () => this.updateLayout({ timerPosition: nextTimerPosition(this.prefs.timerPosition, this.view.canPlaceTimerBeside()), timerMinimized: false }),
      minimizeTimer: () => this.updateLayout({ timerMinimized: !this.prefs.timerMinimized }),
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
      onMoveTimer: a.moveTimer,
      onMinimizeTimer: a.minimizeTimer,
    });
    this.view.render(p);
    this.prefs = this.prefsStore.load();
    this.view.setLayout(this.prefs);
    this.view.setFullscreenAvailable(isFullscreenSupported());
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
    this.slideTimer.switchTo(next);
    this.showSlide(delta);
    this.tick();
  }

  showSlide(direction = 0) {
    this.view.showSlide(this.index, this.p.slides.length, this.p.slides[this.index].notes, direction);
  }

  changeFont(delta) {
    this.view.setFontSize(this.model.setFontSize(this.p.id, this.p.fontSize + delta));
  }

  toggleTimer() {
    const running = this.timer.toggle();
    if (running) {
      this.slideTimer.start();
      this.wakeLock.acquire();
    } else {
      this.slideTimer.pause();
      this.wakeLock.release();
    }
    this.tick();
  }

  resetTimer() {
    this.timer.reset();
    this.slideTimer.reset();
    this.wakeLock.release();
    this.tick();
  }

  /** Change and remember (per device) where the timer sits / whether it's minimized. */
  updateLayout(patch) {
    this.prefs = this.prefsStore.update(patch);
    this.view.setLayout(this.prefs);
  }

  /** Big number: time on the current slide. Quiet line: the whole talk. */
  tick() {
    const slide = this.p.slides[this.index]; // can vanish if another device deleted slides mid-talk
    const budgetSeconds = (slide && slide.targetSeconds) || 0;
    const total = this.timer.status(this.p.targetMinutes);
    const readout = timerReadout({
      index: this.index,
      slide: this.slideTimer.status(budgetSeconds),
      budgetSeconds,
      total,
      targetMinutes: this.p.targetMinutes,
    });
    this.view.showTimer(readout, { running: this.timer.running, started: total.ms > 0 });
  }
}
