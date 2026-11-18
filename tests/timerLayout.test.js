import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timerReadout } from '../public/js/models/timer.js';
import { PrefsStore, normalizePrefs, nextTimerPosition, PREFS_KEY } from '../public/js/models/prefsStore.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('readout: slide time is primary, with its budget and progress', () => {
  const r = timerReadout({
    index: 2,
    slide: { ms: 42_000, state: 'ok' },
    budgetSeconds: 90,
    total: { ms: 192_000, state: 'ok' },
    targetMinutes: 10,
  });
  assert.deepEqual(r, {
    label: 'Slide 3',
    time: '0:42',
    of: '/ 1:30',
    progress: 42 / 90,
    state: 'ok',
    total: 'Total 3:12 / 10:00',
    totalState: 'ok',
  });
});

test('readout: no budgets or target means no extras', () => {
  const r = timerReadout({ index: 0, slide: { ms: 5_000, state: 'none' }, budgetSeconds: 0, total: { ms: 5_000, state: 'none' }, targetMinutes: 0 });
  assert.equal(r.of, '');
  assert.equal(r.progress, null);
  assert.equal(r.total, 'Total 0:05');
});

test('readout: passes through over/warn states for colouring', () => {
  const r = timerReadout({ index: 0, slide: { ms: 100_000, state: 'over' }, budgetSeconds: 60, total: { ms: 700_000, state: 'over' }, targetMinutes: 10 });
  assert.equal(r.state, 'over');
  assert.equal(r.totalState, 'over');
  assert.ok(r.progress > 1);
});

test('prefs default to timer at the bottom, not minimized', () => {
  assert.deepEqual(new PrefsStore(memory()).load(), { timerPosition: 'bottom', timerMinimized: false });
});

test('prefs persist and ignore junk', () => {
  const storage = memory();
  const prefs = new PrefsStore(storage);
  prefs.update({ timerPosition: 'side' });
  prefs.update({ timerMinimized: true });
  assert.deepEqual(new PrefsStore(storage).load(), { timerPosition: 'side', timerMinimized: true });
  storage.setItem(PREFS_KEY, '{not json');
  assert.deepEqual(new PrefsStore(storage).load(), { timerPosition: 'bottom', timerMinimized: false });
  assert.deepEqual(normalizePrefs({ timerPosition: 'left', timerMinimized: 'yes' }), { timerPosition: 'bottom', timerMinimized: false });
});

test('timer position cycles, skipping side on narrow screens', () => {
  assert.equal(nextTimerPosition('bottom'), 'top');
  assert.equal(nextTimerPosition('top'), 'side');
  assert.equal(nextTimerPosition('side'), 'bottom');
  assert.equal(nextTimerPosition('top', false), 'bottom');
  assert.equal(nextTimerPosition('side', false), 'bottom'); // was side on a wide screen
});
