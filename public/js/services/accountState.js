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
    state: () => ({
      enabled: Boolean(auth),
      ready: Boolean(auth && auth.ready),
      email: (auth && auth.user && auth.user.email) || null,
      status: sync ? sync.status : 'off',
    }),
  };
}
