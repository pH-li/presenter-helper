// The collection of presentations plus every operation that changes them.
// Each mutation persists through the injected store.
import { uid, clamp } from '../utils.js';
import { normalize, FONT_MIN, FONT_MAX } from './presentation.js';

export class PresentationsModel {
  /**
   * @param {{ load(): {presentations: object[]}, save(data: object): boolean }} store
   * @param {{ onSaveError?: (message: string) => void }} [options]
   */
  constructor(store, { onSaveError } = {}) {
    this.store = store;
    this.onSaveError = onSaveError || (() => {});
    this.items = store.load().presentations.map((p) => normalize(p, true));
  }

  #save(p, touch = true) {
    if (p && touch) p.updatedAt = Date.now();
    const ok = this.store.save({ presentations: this.items });
    if (!ok) this.onSaveError('Could not save — browser storage is full or blocked.');
    return ok;
  }

  /** Most recently edited first. */
  list() {
    return [...this.items].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) {
    return this.items.find((p) => p.id === id);
  }

  create() {
    const p = normalize({});
    this.items.push(p);
    this.#save(p);
    return p;
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((p) => p.id !== id);
    if (this.items.length !== before) this.#save();
  }

  /** @param {{ title?: string, targetMinutes?: number|string }} changes */
  update(id, changes) {
    const p = this.get(id);
    if (!p) return;
    if ('title' in changes) p.title = String(changes.title);
    if ('targetMinutes' in changes) p.targetMinutes = Math.max(0, parseFloat(changes.targetMinutes) || 0);
    this.#save(p);
  }

  setSlideNotes(id, index, notes) {
    const p = this.get(id);
    if (!p || !p.slides[index]) return;
    p.slides[index].notes = String(notes);
    this.#save(p);
  }

  /** @returns {number} index of the new slide */
  addSlide(id, notes = '') {
    const p = this.get(id);
    if (!p) return -1;
    p.slides.push({ id: uid(), notes });
    this.#save(p);
    return p.slides.length - 1;
  }

  insertSlidesAfter(id, index, notesList) {
    const p = this.get(id);
    if (!p || !notesList.length) return;
    p.slides.splice(index + 1, 0, ...notesList.map((notes) => ({ id: uid(), notes: String(notes) })));
    this.#save(p);
  }

  /** @returns {boolean} whether anything moved */
  moveSlide(id, index, delta) {
    const p = this.get(id);
    const to = index + delta;
    if (!p || !p.slides[index] || to < 0 || to >= p.slides.length) return false;
    [p.slides[index], p.slides[to]] = [p.slides[to], p.slides[index]];
    this.#save(p);
    return true;
  }

  /** Refuses to remove the last remaining slide. @returns {boolean} */
  removeSlide(id, index) {
    const p = this.get(id);
    if (!p || p.slides.length <= 1 || !p.slides[index]) return false;
    p.slides.splice(index, 1);
    this.#save(p);
    return true;
  }

  /** A display preference — saved without bumping the "edited" date. @returns {number} applied size */
  setFontSize(id, size) {
    const p = this.get(id);
    if (!p) return size;
    const next = clamp(size, FONT_MIN, FONT_MAX);
    if (next !== p.fontSize) {
      p.fontSize = next;
      this.#save(p, false);
    }
    return next;
  }

  /**
   * Add presentations from a backup (array or { presentations }). New ids are minted.
   * @returns {number} how many were imported
   */
  importData(json) {
    const arr = Array.isArray(json) ? json : json && json.presentations;
    if (!Array.isArray(arr)) throw new Error('No presentations found');
    const imported = arr.map((p) => normalize(p, false));
    this.items.push(...imported);
    this.#save();
    return imported.length;
  }

  toJSON() {
    return JSON.stringify({ presentations: this.items }, null, 2);
  }
}
