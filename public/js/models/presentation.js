// Pure functions describing a single presentation's shape.
import { uid, clamp } from '../utils.js';

export const FONT_MIN = 16;
export const FONT_MAX = 120;
export const FONT_STEP = 4;
export const DEFAULT_FONT = 36;
export const DEFAULT_TITLE = 'Untitled talk';

/**
 * Coerce anything (saved data, imported JSON, {}) into a valid presentation.
 * Add a default here for every new field so older saved data still loads.
 * @param {object} [p]
 * @param {boolean} [keepId] keep existing ids (loading) vs. mint new ones (importing)
 */
export function normalize(p, keepId = false) {
  p = p && typeof p === 'object' ? p : {};
  const slides = Array.isArray(p.slides) && p.slides.length ? p.slides : [{ notes: '' }];
  return {
    id: keepId && p.id ? String(p.id) : uid(),
    title: String(p.title || DEFAULT_TITLE),
    targetMinutes: Math.max(0, Number(p.targetMinutes) || 0),
    fontSize: clamp(Number(p.fontSize) || DEFAULT_FONT, FONT_MIN, FONT_MAX),
    slides: slides.map((s) => ({
      id: keepId && s && s.id ? String(s.id) : uid(),
      notes: String((s && s.notes) || ''),
      targetSeconds: normalizeSeconds(s && s.targetSeconds),
    })),
    updatedAt: Number(p.updatedAt) || Date.now(),
  };
}

export const MAX_SLIDE_SECONDS = 6 * 3600;

/** Clamp a slide's time budget to a whole number of seconds (0 = no budget). */
export const normalizeSeconds = (v) => clamp(Math.round(Number(v) || 0), 0, MAX_SLIDE_SECONDS);

/** Sum of all slide time budgets, in seconds. */
export const slidesTotalSeconds = (p) => p.slides.reduce((sum, s) => sum + (s.targetSeconds || 0), 0);

/** A blank slide. */
export const newSlide = (notes = '') => ({ id: uid(), notes: String(notes), targetSeconds: 0 });

const SEPARATOR = /^[ \t]*---[ \t]*$/m;

/**
 * Split pasted text on lines containing only `---`.
 * @returns {string[] | null} the parts, or null if there is no separator
 */
export function splitNotes(text) {
  const normalized = String(text).replace(/\r\n?/g, '\n');
  if (!SEPARATOR.test(normalized)) return null;
  return normalized.split(SEPARATOR).map((s) => s.replace(/^\n+|\n+$/g, ''));
}
