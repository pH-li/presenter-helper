import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timer } from '../public/js/models/timer.js';

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test('starts at zero and not running', () => {
  const timer = new Timer(fakeClock().now);
  assert.equal(timer.running, false);
  assert.equal(timer.elapsedMs, 0);
});

test('accumulates time across pause and resume', () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(5000);
  timer.pause();
  clock.advance(10000); // paused time is not counted
  timer.start();
  clock.advance(2000);
  assert.equal(timer.elapsedMs, 7000);
});

test('toggle returns the new running state', () => {
  const timer = new Timer(fakeClock().now);
  assert.equal(timer.toggle(), true);
  assert.equal(timer.toggle(), false);
});

test('reset clears elapsed time and stops', () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(3000);
  timer.reset();
  assert.equal(timer.running, false);
  assert.equal(timer.elapsedMs, 0);
});

test('status without a target is "none"', () => {
  const timer = new Timer(fakeClock().now);
  assert.deepEqual(timer.status(0), { ms: 0, remainingMs: null, state: 'none' });
});

test('status moves through ok → warn → over', () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  assert.equal(timer.status(10).state, 'ok');
  clock.advance(9 * 60000); // 1 minute left of 10 → warn (max(1 min, 10%))
  assert.equal(timer.status(10).state, 'warn');
  clock.advance(60000 + 1);
  const s = timer.status(10);
  assert.equal(s.state, 'over');
  assert.ok(s.remainingMs < 0);
});

test('warn window is 10% for long talks', () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(53 * 60000); // 7 min left of 60: outside the 6-minute (10%) window
  assert.equal(timer.status(60).state, 'ok');
  clock.advance(60000); // 6 min left → exactly 10%
  assert.equal(timer.status(60).state, 'warn');
});
