import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLru, textBox, quantize, poseKey, chunkRange } from '../src/cache.js';

test('createLru: вытесняет давно не использованное', () => {
  const l = createLru(2);
  l.set('a', 1);
  l.set('b', 2);
  assert.equal(l.get('a'), 1); // a стал свежим
  l.set('c', 3);
  assert.equal(l.get('b'), undefined);
  assert.equal(l.get('a'), 1);
  assert.equal(l.get('c'), 3);
  assert.equal(l.size, 2);
});

test('createLru: повторная запись не раздувает кэш', () => {
  const l = createLru(3);
  for (let i = 0; i < 10; i++) l.set('x', i);
  assert.equal(l.size, 1);
  assert.equal(l.get('x'), 9);
});

test('textBox: привязка по выравниванию', () => {
  const left = textBox(20, 10, 2, 'left', 'middle');
  const center = textBox(20, 10, 2, 'center', 'middle');
  const right = textBox(20, 10, 2, 'right', 'middle');
  assert.equal(left.w, 24);
  assert.equal(left.ax, 2);
  assert.equal(center.ax, 12);
  assert.equal(right.ax, 22);
});

test('textBox: глифы любой базовой линии внутри картинки', () => {
  // Глифы занимают примерно такие доли размера от базовой линии
  const spans = { top: [0, 1.4], middle: [-0.75, 0.65], alphabetic: [-1.05, 0.3], bottom: [-1.3, 0] };
  for (const [base, span] of Object.entries(spans)) {
    const b = textBox(10, 10, 1, 'left', base);
    assert.ok(b.ay + span[0] * 10 >= 0, `${base}: верх`);
    assert.ok(b.ay + span[1] * 10 <= b.h, `${base}: низ`);
  }
});

test('quantize: к ближайшему шагу', () => {
  assert.equal(quantize(0.26, 0.25), 0.25);
  assert.equal(quantize(0.4, 0.25), 0.5);
});

test('poseKey: близкие позы — один ключ, разные — разные', () => {
  const a = { legs: [[0.1001, -0.2]], bob: 0.30001, run: true };
  const b = { run: true, bob: 0.3, legs: [[0.1, -0.2]] };
  const c = { legs: [[0.2, -0.2]], bob: 0.3, run: true };
  assert.equal(poseKey(a), poseKey(b));
  assert.notEqual(poseKey(a), poseKey(c));
});

test('chunkRange: куски под камерой и края карты', () => {
  assert.deepEqual(chunkRange(0, 480, 16, 32, 200), [0, 0]);
  assert.deepEqual(chunkRange(500, 480, 16, 32, 200), [0, 1]);
  assert.deepEqual(chunkRange(3000, 480, 16, 32, 200), [5, 6]);
  assert.deepEqual(chunkRange(-50, 480, 16, 32, 200), [0, 0]);
});
