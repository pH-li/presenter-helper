// Stopwatch with an optional target. No DOM, and the clock is injectable for tests.

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
    if (!targetMinutes) return { ms, remainingMs: null, state: 'none' };
    const target = targetMinutes * 60000;
    const remainingMs = target - ms;
    let state = 'ok';
    if (remainingMs < 0) state = 'over';
    else if (remainingMs <= Math.max(60000, target * 0.1)) state = 'warn';
    return { ms, remainingMs, state };
  }
}
