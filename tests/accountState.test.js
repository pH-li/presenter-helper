import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccount } from '../public/js/services/accountState.js';

function fakes({ flushOk = true, signOutError = null } = {}) {
  const calls = [];
  const auth = {
    user: { id: 'u1', email: 'a@b.c' },
    ready: true,
    async signOut() {
      calls.push('signOut');
      if (signOutError) throw new Error(signOutError);
      this.user = null;
    },
  };
  const sync = {
    status: 'synced',
    async flush() {
      calls.push('flush');
      return flushOk;
    },
    forgetUser(id) {
      calls.push(`forget:${id}`);
    },
  };
  return { auth, sync, calls };
}

test('signOut uploads pending changes, signs out, then forgets the local copy', async () => {
  const { auth, sync, calls } = fakes();
  const result = await createAccount(auth, sync).signOut();
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, ['flush', 'signOut', 'forget:u1']);
});

test('signOut refuses when changes could not be uploaded', async () => {
  const { auth, sync, calls } = fakes({ flushOk: false });
  const result = await createAccount(auth, sync).signOut();
  assert.equal(result.ok, false);
  assert.match(result.error, /haven’t synced/);
  assert.deepEqual(calls, ['flush']); // still signed in, nothing deleted
});

test('signOut keeps the local copy if Supabase sign-out fails', async () => {
  const { auth, sync, calls } = fakes({ signOutError: 'network down' });
  const result = await createAccount(auth, sync).signOut();
  assert.deepEqual(result, { ok: false, error: 'network down' });
  assert.ok(!calls.some((c) => c.startsWith('forget')));
});

test('state reflects signed-in user and sync status', () => {
  const { auth, sync } = fakes();
  assert.deepEqual(createAccount(auth, sync).state(), { enabled: true, ready: true, email: 'a@b.c', status: 'synced' });
  assert.deepEqual(createAccount(null, null).state(), { enabled: false, ready: false, email: null, status: 'off' });
});

function deleteFakes({ rpcError = null } = {}) {
  const calls = [];
  const auth = {
    user: { id: 'u1', email: 'a@b.c' },
    async deleteAccount() {
      calls.push('rpc');
      if (rpcError) throw new Error(rpcError);
      this.user = null;
    },
  };
  const sync = {
    stop: () => calls.push('stop'),
    start: async (u) => calls.push(`start:${u.id}`),
    forgetUser: (id) => calls.push(`forget:${id}`),
  };
  return { auth, sync, calls };
}

test('deleteAccount stops syncing before deleting, then forgets the local copy', async () => {
  const { auth, sync, calls } = deleteFakes();
  const result = await createAccount(auth, sync).deleteAccount();
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, ['stop', 'rpc', 'forget:u1']);
});

test('deleteAccount resumes syncing and keeps data if the server call fails', async () => {
  const { auth, sync, calls } = deleteFakes({ rpcError: 'Failed to fetch' });
  const result = await createAccount(auth, sync).deleteAccount();
  assert.equal(result.ok, false);
  assert.match(result.error, /connection/);
  assert.deepEqual(calls, ['stop', 'rpc', 'start:u1']);
});

test('deleteAccount explains when the database function is missing', async () => {
  const { auth, sync } = deleteFakes({ rpcError: 'Could not find the function public.delete_my_account without parameters in the schema cache' });
  const result = await createAccount(auth, sync).deleteAccount();
  assert.match(result.error, /isn’t set up on the server/);
});
