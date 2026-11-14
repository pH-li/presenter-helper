// Stopwatches with optional targets. No DOM, and the clock is injectable for tests.

/**
 * Where elapsed time stands against a target.
 * 'warn' starts at whichever is longer: `minWarnMs` before the end, or the last `warnFraction` of the target.
 * @returns {{ remainingMs: number|null, state: 'none'|'ok'|'warn'|'over' }}
 */
export function targetStatus(ms, targetMs, { minWarnMs = 60000, warnFraction = 0.1 } = {}) {
  if (!targetMs) return { remainingMs: null, state: 'none' };
  const remainingMs = targetMs - ms;
  let state = 'ok';
  if (remainingMs < 0) state = 'over';
  else if (remainingMs <= Math.max(minWarnMs, targetMs * warnFraction)) state = 'warn';
  return { remainingMs, state };
}

/** Warning window for individual slides: last 10 seconds or last 20%, whichever is longer. */
export const SLIDE_WARN = { minWarnMs: 10000, warnFraction: 0.2 };

export class Timer {
  /** @param {() => number} [now] */
  constructor(now = () => Date.now()) {
    this.now = now;
    this.accumulated = 0;
    this.startedAt = null;
  }

  get running() {
    return this.startedAt !== null;
  }

  get elapsedMs() {
    return this.accumulated + (this.running ? this.now() - this.startedAt : 0);
  }

  start() {
    if (!this.running) this.startedAt = this.now();
  }

  pause() {
    if (!this.running) return;
    this.accumulated += this.now() - this.startedAt;
    this.startedAt = null;
  }

  /** @returns {boolean} running after the toggle */
  toggle() {
    if (this.running) this.pause();
    else this.start();
    return this.running;
  }

  reset() {
    this.accumulated = 0;
    this.startedAt = null;
  }

  /**
   * @param {number} [targetMinutes] 0 / undefined for no target
   * @returns {{ ms: number, remainingMs: number|null, state: 'none'|'ok'|'warn'|'over' }}
   *   'warn' kicks in for the last minute or last 10% of the target, whichever is longer.
   */
  status(targetMinutes) {
    const ms = this.elapsedMs;
    return { ms, ...targetStatus(ms, (targetMinutes || 0) * 60000) };
  }
}

/**
 * Time spent on each slide. Only the current slide accumulates time, and only
 * while running. Revisiting a slide continues its total.
 */
export class SlideTimer {
  /** @param {() => number} [now] */
  constructor(now = () => Date.now()) {
    this.now = now;
    this.totals = new Map();
    this.index = 0;
    this.since = null;
  }

  get running() {
    return this.since !== null;
  }

  #bank() {
    if (!this.running) return;
    const t = this.now();
    this.totals.set(this.index, (this.totals.get(this.index) || 0) + (t - this.since));
    this.since = t;
  }

  start() {
    if (!this.running) this.since = this.now();
  }

  pause() {
    this.#bank();
    this.since = null;
  }

  reset() {
    this.totals.clear();
    this.since = null;
  }

  /** Move to another slide; time so far is credited to the previous one. */
  switchTo(index) {
    this.#bank();
    this.index = index;
  }

  /** @param {number} [index] defaults to the current slide */
  elapsedMs(index = this.index) {
    const live = index === this.index && this.running ? this.now() - this.since : 0;
    return (this.totals.get(index) || 0) + live;
  }

  /** @param {number} targetSeconds 0 for no target */
  status(targetSeconds, index = this.index) {
    const ms = this.elapsedMs(index);
    return { ms, ...targetStatus(ms, (targetSeconds || 0) * 1000, SLIDE_WARN) };
  }
}
