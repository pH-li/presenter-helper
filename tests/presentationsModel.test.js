import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresentationsModel } from '../public/js/models/presentationsModel.js';
import { LocalStore } from '../public/js/models/localStore.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const setup = () => {
  const storage = memoryStorage();
  return { storage, model: new PresentationsModel(new LocalStore(storage)) };
};

test('create persists and survives a reload', () => {
  const { storage, model } = setup();
  const p = model.create();
  model.update(p.id, { title: 'My talk', targetMinutes: '15' });
  model.setSlideNotes(p.id, 0, 'Hello');

  const reloaded = new PresentationsModel(new LocalStore(storage));
  const q = reloaded.get(p.id);
  assert.equal(q.title, 'My talk');
  assert.equal(q.targetMinutes, 15);
  assert.equal(q.slides[0].notes, 'Hello');
});

test('list is sorted by most recently edited', () => {
  const { model } = setup();
  const a = model.create();
  const b = model.create();
  a.updatedAt = 1;
  b.updatedAt = 2;
  assert.deepEqual(model.list().map((p) => p.id), [b.id, a.id]);
});

test('add, move and remove slides', () => {
  const { model } = setup();
  const p = model.create();
  model.setSlideNotes(p.id, 0, 'A');
  assert.equal(model.addSlide(p.id, 'B'), 1);
  assert.equal(model.moveSlide(p.id, 1, -1), true);
  assert.deepEqual(p.slides.map((s) => s.notes), ['B', 'A']);
  assert.equal(model.moveSlide(p.id, 0, -1), false); // already first
  assert.equal(model.removeSlide(p.id, 0), true);
  assert.equal(model.removeSlide(p.id, 0), false); // never remove the last slide
  assert.equal(p.slides.length, 1);
});

test('insertSlidesAfter places slides in order', () => {
  const { model } = setup();
  const p = model.create();
  model.addSlide(p.id, 'Z');
  model.insertSlidesAfter(p.id, 0, ['X', 'Y']);
  assert.deepEqual(p.slides.map((s) => s.notes), ['', 'X', 'Y', 'Z']);
});

test('setFontSize clamps and does not bump updatedAt', () => {
  const { model } = setup();
  const p = model.create();
  p.updatedAt = 123;
  assert.equal(model.setFontSize(p.id, 1), 16);
  assert.equal(p.updatedAt, 123);
});

test('remove deletes a presentation', () => {
  const { model } = setup();
  const p = model.create();
  model.remove(p.id);
  assert.equal(model.get(p.id), undefined);
});

test('import mints new ids and accepts both backup shapes', () => {
  const { model } = setup();
  const p = model.create();
  const backup = JSON.parse(model.toJSON());
  assert.equal(model.importData(backup), 1);
  assert.equal(model.importData(backup.presentations), 1);
  assert.equal(model.items.length, 3);
  assert.equal(new Set(model.items.map((x) => x.id)).size, 3);
  assert.ok(model.items.some((x) => x.id === p.id));
});

test('import rejects non-backups', () => {
  const { model } = setup();
  assert.throws(() => model.importData({ hello: 'world' }));
});

test('save failures are reported', () => {
  const messages = [];
  const failing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const model = new PresentationsModel(new LocalStore(failing), { onSaveError: (m) => messages.push(m) });
  model.create();
  assert.equal(messages.length, 1);
});
