// Small, DOM-free helpers shared by models, views and controllers.

export const uid = () =>
  globalThis.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const MAX_DURATION_S = 6 * 3600;

/**
 * Parse a typed duration into seconds.
 *   "1:30" → 90 · "2" → 120 (bare numbers are minutes) · "0.5" → 30
 *   "45s" → 45 · "2m" → 120 · "1m 30s" → 90 · "" → 0
 * @returns {number | null} seconds, or null if it can't be understood
 */
export function parseDuration(text) {
  const s = String(text).trim().toLowerCase();
  if (!s) return 0;
  let seconds = null;
  let m;
  if ((m = s.match(/^(\d+):([0-5]\d)$/))) seconds = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = s.match(/^\d+(?:\.\d+)?$/))) seconds = parseFloat(s) * 60;
  else if ((m = s.match(/^(?:(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?)?\s*(?:(\d+)\s*s(?:ec(?:onds?)?)?)?$/)) && (m[1] || m[2])) {
    seconds = (parseFloat(m[1]) || 0) * 60 + (Number(m[2]) || 0);
  }
  if (seconds === null || seconds > MAX_DURATION_S) return null;
  return Math.round(seconds);
}

/** Format milliseconds as m:ss or h:mm:ss. */
export function fmtDuration(ms, roundUp = false) {
  const total = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
