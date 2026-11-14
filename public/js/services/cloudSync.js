// Keeps the local model and the user's cloud copy in step.
//
// Offline-first: the app always reads and writes the local cache. This service
//   - pulls and three-way-merges on sign-in, on coming back online and when the tab regains focus,
//   - pushes local changes shortly after they happen (debounced),
//   - keeps retrying while offline or after errors.
import { LocalStore, STORAGE_KEY, userStorageKey } from '../models/localStore.js';
import { SupabaseRemote } from '../models/supabaseRemote.js';
import { mergeRemote, diffForPush, snapshotOf, lastSyncedOf } from '../models/syncMerge.js';

const PUSH_DELAY_MS = 800;
const RETRY_MS = 30_000;
const PULL_THROTTLE_MS = 20_000;
const LAST_USER_KEY = `${STORAGE_KEY}:lastUser`;
const syncedKey = (userId) => `${STORAGE_KEY}:synced:${userId}`;

/** @typedef {'off' | 'syncing' | 'synced' | 'offline' | 'error'} SyncStatus */

export class CloudSync {
  /**
   * @param {import('../models/presentationsModel.js').PresentationsModel} model
   * @param {() => Promise<object>} getClient  resolves to a Supabase client
   */
  constructor(model, getClient, storage = globalThis.localStorage) {
    this.model = model;
    this.getClient = getClient;
    this.storage = storage;
    this.user = null;
    this.remote = null;
    this.snapshot = null; // Map id → JSON of what the cloud has; null until the first pull
    /** @type {SyncStatus} */
    this.status = 'off';
    this.listeners = new Set();
    this.remoteListeners = new Set();
    this.pushTimer = null;
    this.retryTimer = null;
    this.lastPull = 0;
    this.busy = Promise.resolve();

    model.subscribe(() => this.#schedulePush());
    window.addEventListener('online', () => this.pull({ force: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.pull();
    });
  }

  /** The user whose cache to show at startup, before auth has confirmed the session. */
  static lastUserId(storage = globalThis.localStorage) {
    try {
      return storage.getItem(LAST_USER_KEY);
    } catch {
      return null;
    }
  }

  onStatus(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Called when a pull brought in changes from another device. */
  onRemoteChange(fn) {
    this.remoteListeners.add(fn);
    return () => this.remoteListeners.delete(fn);
  }

  #setStatus(status) {
    if (status === 'synced') clearTimeout(this.retryTimer);
    if (status === this.status) return;
    this.status = status;
    for (const fn of this.listeners) fn(status);
  }

  /**
   * Switch to the signed-in user's data. Anything created while signed out is
   * moved into the account.
   * @returns {number} how many signed-out presentations were added to the account
   */
  async start(user) {
    this.user = user;
    this.remote = new SupabaseRemote(await this.getClient(), user.id);
    this.snapshot = null;
    this.#write(LAST_USER_KEY, user.id);

    let adopted = 0;
    const userStore = new LocalStore(this.storage, userStorageKey(user.id));
    if (this.model.store.key !== userStore.key) {
      const anonStore = new LocalStore(this.storage);
      const anonItems = anonStore.load().presentations;
      this.model.setStore(userStore);
      adopted = this.model.adopt(anonItems);
      anonStore.clear();
    }
    await this.pull({ force: true });
    return adopted;
  }

  /**
   * No signed-in user: switch to the signed-out cache. The user's local cache is
   * kept (it may hold unsynced offline edits) until forgetUser() is called.
   */
  stop() {
    this.user = null;
    this.remote = null;
    this.snapshot = null;
    clearTimeout(this.pushTimer);
    clearTimeout(this.retryTimer);
    this.#remove(LAST_USER_KEY);
    if (this.model.store.key !== STORAGE_KEY) this.model.setStore(new LocalStore(this.storage));
    this.#setStatus('off');
  }

  /** After an explicit sign-out: delete that user's cached copy from this device. */
  forgetUser(userId) {
    new LocalStore(this.storage, userStorageKey(userId)).clear();
    this.#remove(syncedKey(userId));
  }

  /** Push anything pending right now. Resolves true if everything is in the cloud. */
  async flush() {
    clearTimeout(this.pushTimer);
    await this.#queue(() => this.#push());
    return this.status === 'synced';
  }

  /** Fetch the cloud copy and merge it with local changes. */
  pull({ force = false } = {}) {
    if (!this.remote) return Promise.resolve();
    if (!force && Date.now() - this.lastPull < PULL_THROTTLE_MS) return Promise.resolve();
    this.lastPull = Date.now();
    return this.#queue(() => this.#pull());
  }

  // Serialize pulls and pushes so they never interleave.
  #queue(task) {
    this.busy = this.busy.then(task, task);
    return this.busy;
  }

  async #pull() {
    if (!this.remote) return;
    const remote = this.remote;
    this.#setStatus('syncing');
    try {
      const remoteItems = await remote.fetchAll();
      if (remote !== this.remote) return; // signed out meanwhile
      const before = JSON.stringify(this.model.items);
      const { items, toUpsert, toDelete } = mergeRemote(this.model.items, remoteItems, this.#lastSynced());
      await remote.upsert(toUpsert);
      await remote.remove(toDelete);
      if (remote !== this.remote) return;
      this.model.replaceAll(items); // also schedules a push, which will find nothing to do
      this.snapshot = snapshotOf(this.model.items);
      this.#saveLastSynced();
      this.#setStatus('synced');
      if (JSON.stringify(this.model.items) !== before) for (const fn of this.remoteListeners) fn();
    } catch (e) {
      this.#fail(e);
    }
  }

  async #push() {
    if (!this.remote || !this.snapshot) return; // never push before the first successful pull
    const remote = this.remote;
    const { upserts, deletes } = diffForPush(this.model.items, this.snapshot);
    if (!upserts.length && !deletes.length) {
      this.#setStatus('synced');
      return;
    }
    this.#setStatus('syncing');
    try {
      await remote.upsert(upserts);
      await remote.remove(deletes);
      if (remote !== this.remote) return;
      for (const p of upserts) this.snapshot.set(p.id, JSON.stringify(p));
      for (const id of deletes) this.snapshot.delete(id);
      this.#saveLastSynced();
      // Edits made while this push was in flight are picked up by the next diff.
      if (diffForPush(this.model.items, this.snapshot).upserts.length) this.#schedulePush();
      else this.#setStatus('synced');
    } catch (e) {
      this.#fail(e);
    }
  }

  #schedulePush() {
    if (!this.remote) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.#queue(() => (this.snapshot ? this.#push() : this.#pull())), PUSH_DELAY_MS);
  }

  #fail(error) {
    console.warn('Sync failed', error);
    this.#setStatus(navigator.onLine === false ? 'offline' : 'error');
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.pull({ force: true }), RETRY_MS);
  }

  #lastSynced() {
    try {
      return JSON.parse(this.storage.getItem(syncedKey(this.user.id))) || {};
    } catch {
      return {};
    }
  }

  /** Record what the cloud has (from the snapshot, not from local edits in flight). */
  #saveLastSynced() {
    const cloudItems = [...this.snapshot.values()].map((json) => JSON.parse(json));
    this.#write(syncedKey(this.user.id), JSON.stringify(lastSyncedOf(cloudItems)));
  }

  #write(key, value) {
    try {
      this.storage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  }

  #remove(key) {
    try {
      this.storage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}
