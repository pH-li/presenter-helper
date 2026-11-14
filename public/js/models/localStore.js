// Persistence adapter. Models talk to this interface ({ load, save }) only,
// so it can be swapped for a cloud-backed store (e.g. Supabase) later.

export const STORAGE_KEY = 'presenter-helper:v1';

/** Signed-in users get their own cache so accounts never mix on a shared device. */
export const userStorageKey = (userId) => `${STORAGE_KEY}:user:${userId}`;

export class LocalStore {
  /**
   * @param {Storage} [storage] defaults to window.localStorage; injectable for tests
   * @param {string} [key]
   */
  constructor(storage = globalThis.localStorage, key = STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  load() {
    try {
      const raw = this.storage.getItem(this.key);
      const data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.presentations)) return data;
    } catch (e) {
      console.warn('Could not read saved data', e);
    }
    return { presentations: [] };
  }

  /** @returns {boolean} whether the save succeeded */
  save(data) {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Could not save data', e);
      return false;
    }
  }

  clear() {
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* storage unavailable */
    }
  }
}
