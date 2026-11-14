import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// CloudSync listens for browser events; give it minimal stand-ins.
before(() => {
  globalThis.window = { addEventListener() {} };
  globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
});
after(() => {
  delete globalThis.window;
  delete globalThis.document;
});

const { CloudSync } = await import('../public/js/services/cloudSync.js');
const { PresentationsModel } = await import('../public/js/models/presentationsModel.js');
const { LocalStore, userStorageKey } = await import('../public/js/models/localStore.js');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    keys: () => [...map.keys()],
  };
}

/** In-memory stand-in for the Supabase `presentations` table, shared by "devices". */
function fakeCloud() {
  const rows = new Map(); // `${user}/${id}` → data
  let offline = false;
  const check = () => {
    if (offline) throw new Error('Failed to fetch');
  };
  const client = {
    from() {
      let userId;
      let op;
      let payload;
      const q = {
        select() {
          op = 'select';
          return q;
        },
        upsert(r) {
          op = 'upsert';
          payload = r;
          return q;
        },
        delete() {
          op = 'delete';
          return q;
        },
        eq(_col, v) {
          userId = v;
          return q;
        },
        in(_col, ids) {
          payload = ids;
          return q;
        },
        then(resolve, reject) {
          try {
            check();
            if (op === 'select') {
              const data = [...rows].map(([k, data]) => ({ id: k.split('/')[1], data }));
              resolve({ data, error: null });
            } else if (op === 'upsert') {
              for (const r of payload) rows.set(`${r.user_id}/${r.id}`, structuredClone(r.data));
              resolve({ error: null });
            } else {
              for (const id of payload) rows.delete(`${userId}/${id}`);
              resolve({ error: null });
            }
          } catch (e) {
            reject(e);
          }
        },
      };
      return q;
    },
  };
  return {
    client,
    rows,
    setOffline: (v) => (offline = v),
  };
}

function device(cloud, storage = memoryStorage()) {
  const model = new PresentationsModel(new LocalStore(storage));
  const sync = new CloudSync(model, async () => cloud.client, storage);
  return { model, sync, storage };
}

const user = { id: 'u1', email: 'a@b.c' };
const titles = (model) => model.list().map((p) => p.title).sort();

test('signed-out presentations move into the account on first sign-in', async () => {
  const cloud = fakeCloud();
  const d = device(cloud);
  const p = d.model.create();
  d.model.update(p.id, { title: 'Before login' });

  const adopted = await d.sync.start(user);
  assert.equal(adopted, 1);
  assert.equal(d.sync.status, 'synced');
  assert.equal(cloud.rows.size, 1);
  assert.equal(d.storage.getItem('presenter-helper:v1'), null); // signed-out cache cleared
  assert.ok(d.storage.getItem(userStorageKey('u1')));
});

test('edits on one device show up on another', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  const b = device(cloud);
  await a.sync.start(user);
  await b.sync.start(user);

  const p = a.model.create();
  a.model.update(p.id, { title: 'From A' });
  assert.equal(await a.sync.flush(), true);

  await b.sync.pull({ force: true });
  assert.deepEqual(titles(b.model), ['From A']);
});

test('deletes propagate between devices', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  const b = device(cloud);
  await a.sync.start(user);
  const p = a.model.create();
  await a.sync.flush();
  await b.sync.start(user);
  assert.equal(b.model.items.length, 1);

  b.model.remove(p.id);
  await b.sync.flush();
  assert.equal(cloud.rows.size, 0);

  await a.sync.pull({ force: true });
  assert.equal(a.model.items.length, 0);
});

test('offline edits are kept locally and pushed when back online', async () => {
  const cloud = fakeCloud();
  const d = device(cloud);
  await d.sync.start(user);

  cloud.setOffline(true);
  const p = d.model.create();
  d.model.update(p.id, { title: 'Written offline' });
  assert.equal(await d.sync.flush(), false);
  assert.ok(['error', 'offline'].includes(d.sync.status));
  assert.equal(cloud.rows.size, 0);

  cloud.setOffline(false);
  await d.sync.pull({ force: true });
  assert.equal(d.sync.status, 'synced');
  assert.equal(cloud.rows.get(`u1/${p.id}`).title, 'Written offline');
});

test('sign-out hides the account data; forgetUser removes the cached copy', async () => {
  const cloud = fakeCloud();
  const d = device(cloud);
  await d.sync.start(user);
  d.model.create();
  await d.sync.flush();

  d.sync.stop();
  assert.equal(d.model.items.length, 0);
  assert.equal(d.sync.status, 'off');
  assert.ok(d.storage.getItem(userStorageKey('u1'))); // still cached until forgotten

  d.sync.forgetUser('u1');
  assert.equal(d.storage.getItem(userStorageKey('u1')), null);
  assert.equal(CloudSync.lastUserId(d.storage), null);
});
