// Human-readable sync status, shared by the home chip and the account page.

/** @param {{ enabled: boolean, ready: boolean, email: string|null, status: string }} account */
export function syncLabel(account) {
  if (!account.enabled) return null;
  if (!account.email) return account.ready ? 'Sign in to sync' : 'Account';
  return (
    {
      syncing: 'Syncing…',
      synced: 'Synced',
      offline: 'Offline · saved here',
      error: 'Sync issue · retrying',
    }[account.status] || 'Signed in'
  );
}

/** CSS modifier for the status dot. */
export const syncTone = (account) =>
  !account.email ? 'idle' : { synced: 'ok', syncing: 'busy', offline: 'warn', error: 'bad' }[account.status] || 'idle';
