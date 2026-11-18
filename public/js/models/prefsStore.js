// Per-device display preferences (not synced: a phone and a laptop usually want
// different layouts). Stored in localStorage; storage is injectable for tests.

export const PREFS_KEY = 'presenter-helper:prefs';
export const TIMER_POSITIONS = ['bottom', 'top', 'side'];

const DEFAULTS = Object.freeze({ timerPosition: 'bottom', timerMinimized: false });

/** Coerce anything into valid prefs. */
export function normalizePrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    timerPosition: TIMER_POSITIONS.includes(p.timerPosition) ? p.timerPosition : DEFAULTS.timerPosition,
    timerMinimized: p.timerMinimized === true,
  };
}

/**
 * The next timer position when cycling bottom → top → side → bottom.
 * @param {boolean} [allowSide] false on screens too narrow for a side-by-side layout
 */
export function nextTimerPosition(current, allowSide = true) {
  const options = allowSide ? TIMER_POSITIONS : TIMER_POSITIONS.filter((p) => p !== 'side');
  const i = options.indexOf(current);
  return options[(i + 1) % options.length];
}

export class PrefsStore {
  constructor(storage = globalThis.localStorage, key = PREFS_KEY) {
    this.storage = storage;
    this.key = key;
  }

  load() {
    try {
      return normalizePrefs(JSON.parse(this.storage.getItem(this.key)));
    } catch {
      return normalizePrefs(null);
    }
  }

  /** Merge a change into the saved prefs. @returns the full, normalized prefs */
  update(patch) {
    const next = normalizePrefs({ ...this.load(), ...patch });
    try {
      this.storage.setItem(this.key, JSON.stringify(next));
    } catch {
      /* storage unavailable: the choice just won't be remembered */
    }
    return next;
  }
}
