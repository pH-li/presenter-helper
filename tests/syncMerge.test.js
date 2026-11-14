import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRemote, diffForPush, snapshotOf, lastSyncedOf } from '../public/js/models/syncMerge.js';

const p = (id, updatedAt, title = id) => ({ id, updatedAt, title, slides: [{ id: 's', notes: '' }] });
const ids = (arr) => arr.map((x) => (typeof x === 'string' ? x : x.id)).sort();

test('first sync: local-only items are uploaded, remote-only items are downloaded', () => {
  const { items, toUpsert, toDelete } = mergeRemote([p('a', 1)], [p('b', 1)], {});
  assert.deepEqual(ids(items), ['a', 'b']);
  assert.deepEqual(ids(toUpsert), ['a']);
  assert.deepEqual(toDelete, []);
});

test('newer side wins per presentation', () => {
  const { items, toUpsert } = mergeRemote(
    [p('a', 5, 'local-a'), p('b', 1, 'local-b')],
    [p('a', 3, 'remote-a'), p('b', 9, 'remote-b')],
    { a: 3, b: 1 }
  );
  const byId = Object.fromEntries(items.map((x) => [x.id, x.title]));
  assert.deepEqual(byId, { a: 'local-a', b: 'remote-b' });
  assert.deepEqual(ids(toUpsert), ['a']);
});

test('ties keep the remote copy and upload nothing', () => {
  const { items, toUpsert } = mergeRemote([p('a', 2, 'L')], [p('a', 2, 'R')], { a: 2 });
  assert.equal(items[0].title, 'R');
  assert.deepEqual(toUpsert, []);
});

test('deleted on another device: dropped locally if unchanged here', () => {
  const { items, toUpsert } = mergeRemote([p('a', 4)], [], { a: 4 });
  assert.deepEqual(items, []);
  assert.deepEqual(toUpsert, []);
});

test('deleted on another device but edited here afterwards: kept and re-uploaded', () => {
  const { items, toUpsert } = mergeRemote([p('a', 7)], [], { a: 4 });
  assert.deepEqual(ids(items), ['a']);
  assert.deepEqual(ids(toUpsert), ['a']);
});

test('deleted here while offline: deleted in the cloud if unchanged there', () => {
  const { items, toDelete } = mergeRemote([], [p('a', 4)], { a: 4 });
  assert.deepEqual(items, []);
  assert.deepEqual(toDelete, ['a']);
});

test('deleted here but edited elsewhere afterwards: remote copy comes back', () => {
  const { items, toDelete } = mergeRemote([], [p('a', 9)], { a: 4 });
  assert.deepEqual(ids(items), ['a']);
  assert.deepEqual(toDelete, []);
});

test('diffForPush finds changed, new and deleted presentations', () => {
  const a = p('a', 1);
  const b = p('b', 1);
  const snapshot = snapshotOf([a, b]);
  const a2 = { ...a, fontSize: 48 }; // changed without bumping updatedAt (font size)
  const c = p('c', 2);
  const { upserts, deletes } = diffForPush([a2, c], snapshot);
  assert.deepEqual(ids(upserts), ['a', 'c']);
  assert.deepEqual(deletes, ['b']);
});

test('diffForPush is empty when nothing changed', () => {
  const items = [p('a', 1), p('b', 2)];
  assert.deepEqual(diffForPush(items, snapshotOf(items)), { upserts: [], deletes: [] });
});

test('lastSyncedOf maps ids to updatedAt', () => {
  assert.deepEqual(lastSyncedOf([p('a', 1), p('b', 2)]), { a: 1, b: 2 });
});
