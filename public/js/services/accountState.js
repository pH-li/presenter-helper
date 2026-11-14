// Bundles auth + sync for the views/controllers that show account status.

/**
 * @typedef {object} Account
 * @property {boolean} enabled
 * @property {import('./auth.js').AuthService | null} auth
 * @property {import('./cloudSync.js').CloudSync | null} sync
 * @property {() => { enabled: boolean, ready: boolean, email: string|null, status: string }} state
 */

const UNSYNCED = 'Some changes haven’t synced yet. Connect to the internet and try again so nothing is lost.';

/** @returns {Account} */
export function createAccount(auth, sync) {
  return {
    enabled: Boolean(auth),
    auth,
    sync,
    /**
     * Upload pending changes, sign out, then remove this user's copy from the device.
     * Refuses (ok: false) if changes couldn't be uploaded, so nothing is lost.
     * @returns {Promise<{ ok: boolean, error?: string }>}
     */
    async signOut() {
      if (!auth || !auth.user) return { ok: true };
      if (!(await sync.flush())) return { ok: false, error: UNSYNCED };
      const userId = auth.user.id;
      try {
        await auth.signOut();
        sync.forgetUser(userId);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e && e.message) || 'Sign-out failed. Please try again.' };
      }
    },
    /**
     * Permanently delete the account and every presentation in it (all devices),
     * then remove this device's copy. Sync is stopped first so nothing re-uploads.
     * @returns {Promise<{ ok: boolean, error?: string }>}
     */
    async deleteAccount() {
      if (!auth || !auth.user) return { ok: false, error: 'You’re not signed in.' };
      const user = auth.user;
      sync.stop();
      try {
        await auth.deleteAccount();
      } catch (e) {
        await sync.start(user).catch(() => {}); // still signed in: resume syncing
        const msg = (e && e.message) || '';
        return {
          ok: false,
          error: /function|schema cache|not find/i.test(msg)
            ? 'Account deletion isn’t set up on the server yet. Please email lyrwrites@gmail.com and we’ll delete it for you.'
            : /fetch|network/i.test(msg)
              ? 'Couldn’t reach the server. Check your connection and try again.'
              : msg || 'Couldn’t delete your account. Please try again.',
        };
      }
      sync.forgetUser(user.id);
      return { ok: true };
    },
    state: () => ({
      enabled: Boolean(auth),
      ready: Boolean(auth && auth.ready),
      email: (auth && auth.user && auth.user.email) || null,
      status: sync ? sync.status : 'off',
    }),
  };
}
