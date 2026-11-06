import { test } from 'node:test';
import assert from 'node:assert/strict';

import { advanceClock, createInterp, capture, blend, unblend } from '../src/loop.js';
import { inView } from '../src/world.js';
import { LOOP } from '../src/config.js';

const STEP = 1 / 60;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('advanceClock: 60 Гц — один шаг за кадр', () => {
  const r = advanceClock(0, STEP, STEP, LOOP.maxFrame);
  assert.equal(r.steps, 1);
  close(r.acc, 0);
});

test('advanceClock: 30 Гц — два шага, 144 Гц — шаг не каждый кадр', () => {
  assert.equal(advanceClock(0, 1 / 30, STEP, LOOP.maxFrame).steps, 2);
  let acc = 0;
  let steps = 0;
  for (let i = 0; i < 144; i++) {
    const r = advanceClock(acc, 1 / 144, STEP, LOOP.maxFrame);
    acc = r.acc;
    steps += r.steps;
    assert.ok(r.alpha >= 0 && r.alpha < 1);
  }
  assert.ok(steps >= 59 && steps <= 60, `за секунду ${steps} шагов`);
});

test('advanceClock: долгий кадр догоняется не больше maxFrame — 6 шагов', () => {
  const r = advanceClock(0, 0.5, STEP, 0.1);
  assert.equal(r.steps, 6);
  assert.ok(r.acc < STEP);
});

test('advanceClock: отрицательный dt не ломает часы', () => {
  assert.equal(advanceClock(0, -1, STEP, LOOP.maxFrame).steps, 0);
});

test('blend: позиция между прошлым и текущим шагом, unblend возвращает настоящую', () => {
  const st = createInterp(32);
  const o = { x: 10, y: 20 };
  capture(st, [o]);
  o.x = 14;
  o.y = 18;
  blend(st, [o], 0.25);
  close(o.x, 11);
  close(o.y, 19.5);
  unblend(st);
  assert.deepEqual(o, { x: 14, y: 18 });
});

test('blend: alpha 0 — прошлый шаг, alpha 1 — текущий', () => {
  const st = createInterp(32);
  const o = { x: 0, y: 0 };
  capture(st, [o]);
  o.x = 4;
  blend(st, [o], 0);
  assert.equal(o.x, 0);
  unblend(st);
  blend(st, [o], 1);
  assert.equal(o.x, 4);
  unblend(st);
});

test('blend: скачок дальше snapDistance и новый объект не сглаживаются', () => {
  const st = createInterp(32);
  const tele = { x: 0, y: 0 };
  capture(st, [tele]);
  tele.x = 200;
  const fresh = { x: 50, y: 50 };
  blend(st, [tele, fresh], 0.5);
  assert.equal(tele.x, 200);
  assert.equal(fresh.x, 50);
  unblend(st);
});

test('inView: в кадре, за краем и в запасе', () => {
  assert.equal(inView(100, 8, 0, 480), true);
  assert.equal(inView(500, 8, 0, 480), false);
  assert.equal(inView(500, 8, 0, 480, 48), true);
  assert.equal(inView(-20, 8, 0, 480), false);
  assert.equal(inView(-5, 8, 0, 480), true);
});
