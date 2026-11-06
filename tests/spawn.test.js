import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSpawner, updateSpawner, resetSpawner, findSurfaceY, spawnFromRequest, isFarBehind,
} from '../src/zozniki.js';
import { parseMap } from '../src/world.js';
import { TILE_SIZE, LOOP, SPAWN, ZOZNIKI } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;

// 100 × 10 тайлов: пол на ряду 9, Яма 50..52, тонкая платформа на ряду 5 (70..75)
function map100() {
  const rows = Array.from({ length: 9 }, () => '.'.repeat(100));
  rows[5] = rows[5].slice(0, 70) + '------' + rows[5].slice(76);
  rows.push('#'.repeat(50) + '...' + '#'.repeat(47));
  return parseMap(rows, TS);
}

const FLOOR = 9 * TS;

function ctxAt(map, viewX, { nikichX = viewX + 100, alive = 0, feet = FLOOR } = {}) {
  return { map, view: { x: viewX, y: 0, w: 480, h: 160 }, nikichX, nikichFeetY: feet, alive };
}

function run(sp, ctx, frames) {
  const out = [];
  for (let i = 0; i < frames; i++) out.push(...updateSpawner(sp, DT, ctx));
  return out;
}

test('волна с края: ждёт, пока Никич дойдёт до отметки', () => {
  const map = map100();
  const sp = createSpawner([{ type: 'edge', atTx: 10, kinds: ['runner', 'smoothie'], interval: 0.5 }], TS);
  assert.equal(run(sp, ctxAt(map, 0, { nikichX: 10 * TS - 1 }), 60).length, 0);
});

test('волна с края: появляются за правым краем экрана на полу, по очереди, один раз', () => {
  const map = map100();
  const sp = createSpawner([{ type: 'edge', atTx: 10, kinds: ['runner', 'smoothie'], interval: 0.5 }], TS);
  const ctx = ctxAt(map, 0, { nikichX: 10 * TS });
  const first = run(sp, ctx, 1);
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'runner');
  assert.ok(first[0].x >= 480 + SPAWN.edgeOffset, 'за краем экрана');
  assert.equal(first[0].y, FLOOR);
  assert.equal(run(sp, ctx, 25).length, 0, 'интервал 0,5 с');
  const second = run(sp, ctx, 10);
  assert.deepEqual(second.map((r) => r.kind), ['smoothie']);
  assert.equal(run(sp, ctx, 300).length, 0, 'волна не повторяется');
});

test('край экрана над Ямой — ищем опору правее', () => {
  const map = map100();
  const sp = createSpawner([{ type: 'edge', atTx: 0, kinds: ['runner'], interval: 0.5 }], TS);
  const viewX = 50 * TS - 480 - SPAWN.edgeOffset + 4; // правый край + отступ — над Ямой
  const [r] = run(sp, ctxAt(map, viewX), 1);
  assert.ok(r.x >= 53 * TS, `x=${r.x}`);
  assert.equal(r.y, FLOOR);
});

test('поверхность для появления — ближайшая по высоте к Никичу', () => {
  const map = map100();
  const x = 72 * TS + 8;
  assert.equal(findSurfaceY(map, x, 5 * TS), 5 * TS, 'Никич наверху — на платформу');
  assert.equal(findSurfaceY(map, x, FLOOR), FLOOR, 'Никич внизу — на пол');
  assert.equal(findSurfaceY(map, 51 * TS, FLOOR), null, 'над Ямой опоры нет');
});

test('дверь: выпускает, только пока видна, раз в every с, не больше count', () => {
  const map = map100();
  const sp = createSpawner([{ type: 'door', tx: 40, ty: 8, kinds: ['runner', 'smoothie'], every: 2, count: 3 }], TS);
  assert.equal(run(sp, ctxAt(map, 0), 120).length, 0, 'далеко — тишина');
  const out = run(sp, ctxAt(map, 40 * TS - 300), 60 * 10);
  assert.deepEqual(out.map((r) => r.kind), ['runner', 'smoothie', 'runner']);
  assert.equal(out[0].x, 40 * TS + TS / 2);
  assert.equal(out[0].y, FLOOR);
});

test('дверь: интервал между Зожниками', () => {
  const map = map100();
  const sp = createSpawner([{ type: 'door', tx: 40, ty: 8, kinds: ['runner'], every: 2, count: 5 }], TS);
  const near = ctxAt(map, 40 * TS - 300);
  assert.equal(run(sp, near, 1).length, 1);
  assert.equal(run(sp, near, 118).length, 0);
  assert.equal(run(sp, near, 3).length, 1); // ровно на 2 с (с точностью до шага)
});

test('точка: один Зожник, когда место показалось', () => {
  const map = map100();
  const sp = createSpawner([{ type: 'point', tx: 72, ty: 4, kind: 'yoga' }], TS);
  assert.equal(run(sp, ctxAt(map, 0), 10).length, 0);
  const out = run(sp, ctxAt(map, 72 * TS - 480), 120);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { kind: 'yoga', x: 72 * TS + 8, y: 5 * TS });
});

test('не больше maxAlive Зожников одновременно', () => {
  const map = map100();
  const sp = createSpawner([{ type: 'edge', atTx: 0, kinds: ['runner', 'runner', 'runner'], interval: 0.1 }], TS);
  assert.equal(run(sp, ctxAt(map, 0, { alive: SPAWN.maxAlive }), 60).length, 0, 'полный экран — ждут');
  assert.equal(run(sp, ctxAt(map, 0, { alive: SPAWN.maxAlive - 1 }), 1).length, 1, 'одно место');
  assert.equal(run(sp, ctxAt(map, 0, { alive: 0 }), 60).length, 2, 'остальные дождались');
});

test('после потери жизни волны впереди снова ждут, позади — нет', () => {
  const map = map100();
  const sp = createSpawner([
    { type: 'edge', atTx: 5, kinds: ['runner'], interval: 0.5 },
    { type: 'edge', atTx: 30, kinds: ['smoothie'], interval: 0.5 },
  ], TS);
  run(sp, ctxAt(map, 0, { nikichX: 31 * TS }), 120);
  resetSpawner(sp, 10 * TS);
  const again = run(sp, ctxAt(map, 0, { nikichX: 31 * TS }), 120);
  assert.deepEqual(again.map((r) => r.kind), ['smoothie']);
});

test('запрос → Зожник стоит ногами на поверхности, по центру точки', () => {
  const z = spawnFromRequest({ kind: 'moto', x: 100, y: FLOOR });
  assert.equal(z.body.x + z.body.w / 2, 100);
  assert.equal(z.body.y + z.body.h, FLOOR);
  assert.equal(z.body.w, ZOZNIKI.moto.w);
});

test('Зожник далеко позади экрана — убирается', () => {
  const z = spawnFromRequest({ kind: 'runner', x: 100, y: FLOOR });
  assert.equal(isFarBehind(z, { x: 200, y: 0, w: 480, h: 270 }), false);
  assert.equal(isFarBehind(z, { x: 100 + SPAWN.despawnBehind + 20, y: 0, w: 480, h: 270 }), true);
});

test('неизвестный тип появления — ошибка', () => {
  assert.throws(() => createSpawner([{ type: 'nope' }], TS), /Неизвестный тип/);
});
