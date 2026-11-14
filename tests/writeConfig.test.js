import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, resolveConfig, assertPublicKey } from '../scripts/write-config.js';

const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

test('parseEnv handles comments, quotes and export', () => {
  const env = parseEnv(`# comment\nA=1\nexport B="two words"\nC='x' \nD=val # trailing\n\nbad line`);
  assert.deepEqual(env, { A: '1', B: 'two words', C: 'x', D: 'val' });
});

test('resolveConfig reads standard and Netlify-extension names', () => {
  assert.deepEqual(resolveConfig({ SUPABASE_URL: 'https://abc.supabase.co/', SUPABASE_ANON_KEY: 'k' }), {
    supabaseUrl: 'https://abc.supabase.co',
    supabaseAnonKey: 'k',
  });
  assert.deepEqual(resolveConfig({ SUPABASE_DATABASE_URL: 'https://abc.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' }), {
    supabaseUrl: 'https://abc.supabase.co',
    supabaseAnonKey: 'sb_publishable_1',
  });
});

test('resolveConfig ignores a Postgres connection string as the URL', () => {
  assert.equal(resolveConfig({ SUPABASE_DATABASE_URL: 'postgresql://user:pw@db/postgres' }).supabaseUrl, '');
});

test('missing values disable sync instead of failing', () => {
  assert.deepEqual(resolveConfig({}), { supabaseUrl: '', supabaseAnonKey: '' });
});

test('secret keys are rejected', () => {
  assert.throws(() => assertPublicKey('sb_secret_abc'), /secret/);
  assert.throws(() => assertPublicKey(jwt({ role: 'service_role' })), /service_role/);
  assert.doesNotThrow(() => assertPublicKey(jwt({ role: 'anon' })));
  assert.doesNotThrow(() => assertPublicKey('sb_publishable_abc'));
});
