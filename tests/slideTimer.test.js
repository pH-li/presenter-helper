import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlideTimer, targetStatus } from '../public/js/models/timer.js';
import { parseDuration } from '../public/js/utils.js';
import { normalize, slidesTotalSeconds, MAX_SLIDE_SECONDS } from '../public/js/models/presentation.js';
import { PresentationsModel } from '../public/js/models/presentationsModel.js';

function fakeClock() {
  let t = 0;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test('SlideTimer credits time to the slide that was showing', () => {
  const c = fakeClock();
  const st = new SlideTimer(c.now);
  st.start();
  c.advance(5000);
  st.switchTo(1);
  c.advance(3000);
  assert.equal(st.elapsedMs(0), 5000);
  assert.equal(st.elapsedMs(1), 3000);
  assert.equal(st.elapsedMs(), 3000);
});

test('SlideTimer continues a slide’s total when you go back to it', () => {
  const c = fakeClock();
  const st = new SlideTimer(c.now);
  st.start();
  c.advance(4000);
  st.switchTo(1);
  c.advance(1000);
  st.switchTo(0);
  c.advance(2000);
  assert.equal(st.elapsedMs(0), 6000);
});

test('SlideTimer does not count while paused, including slide changes while paused', () => {
  const c = fakeClock();
  const st = new SlideTimer(c.now);
  st.start();
  c.advance(1000);
  st.pause();
  c.advance(10000);
  st.switchTo(2);
  c.advance(10000);
  assert.equal(st.elapsedMs(0), 1000);
  assert.equal(st.elapsedMs(2), 0);
  st.start();
  c.advance(500);
  assert.equal(st.elapsedMs(2), 500);
});

test('SlideTimer reset clears every slide', () => {
  const c = fakeClock();
  const st = new SlideTimer(c.now);
  st.start();
  c.advance(1000);
  st.switchTo(1);
  st.reset();
  assert.equal(st.running, false);
  assert.equal(st.elapsedMs(0), 0);
  assert.equal(st.elapsedMs(1), 0);
});

test('slide status warns in the last 20% (min 10s) and goes over', () => {
  const c = fakeClock();
  const st = new SlideTimer(c.now);
  st.start();
  c.advance(40_000);
  assert.equal(st.status(60).state, 'ok'); // 20s left > 12s window
  c.advance(9_000);
  assert.equal(st.status(60).state, 'warn'); // 11s left
  c.advance(12_000);
  assert.equal(st.status(60).state, 'over');
  assert.equal(st.status(0).state, 'none');
});

test('targetStatus uses the longer of the two warning windows', () => {
  assert.equal(targetStatus(50_000, 60_000, { minWarnMs: 10_000, warnFraction: 0.1 }).state, 'warn');
  assert.equal(targetStatus(45_000, 60_000, { minWarnMs: 10_000, warnFraction: 0.1 }).state, 'ok');
});

test('parseDuration understands the common ways people type times', () => {
  const cases = { '': 0, '1:30': 90, '0:45': 45, '2': 120, '0.5': 30, '45s': 45, '2m': 120, '1m 30s': 90, '1 min': 60, '90 sec': 90, ' 3:05 ': 185 };
  for (const [input, seconds] of Object.entries(cases)) assert.equal(parseDuration(input), seconds, input);
});

test('parseDuration rejects nonsense and absurd values', () => {
  for (const bad of ['abc', '1:75', '1:3', '-2', '10:00:00x', '999']) assert.equal(parseDuration(bad), null, bad);
});

test('normalize adds targetSeconds to old saved slides and clamps it', () => {
  const p = normalize({ slides: [{ notes: 'old' }, { notes: 'x', targetSeconds: 1e9 }, { targetSeconds: 12.6 }] });
  assert.deepEqual(p.slides.map((s) => s.targetSeconds), [0, MAX_SLIDE_SECONDS, 13]);
  assert.equal(slidesTotalSeconds(p), MAX_SLIDE_SECONDS + 13);
});

test('model setSlideTarget saves, and new slides start with no budget', () => {
  const store = { data: null, load: () => ({ presentations: [] }), save(d) { this.data = d; return true; } };
  const model = new PresentationsModel(store);
  const p = model.create();
  model.setSlideTarget(p.id, 0, 90);
  const i = model.addSlide(p.id);
  assert.equal(p.slides[0].targetSeconds, 90);
  assert.equal(p.slides[i].targetSeconds, 0);
  assert.equal(store.data.presentations[0].slides[0].targetSeconds, 90);
});
