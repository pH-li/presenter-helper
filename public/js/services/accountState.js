// Bundles auth + sync for the views/controllers that show account status.

/**
 * @typedef {object} Account
 * @property {boolean} enabled
 * @property {import('./auth.js').AuthService | null} auth
 * @property {import('./cloudSync.js').CloudSync | null} sync
 * @property {() => { enabled: boolean, ready: boolean, email: string|null, status: string }} state
 */

/** @returns {Account} */
export function createAccount(auth, sync) {
  return {
    enabled: Boolean(auth),
    auth,
    sync,
    state: () => ({
      enabled: Boolean(auth),
      ready: Boolean(auth && auth.ready),
      email: (auth && auth.user && auth.user.email) || null,
      status: sync ? sync.status : 'off',
    }),
  };
}
