import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TILE, createBody, moveX, moveY, stepPlatformer, fellOut } from '../src/physics.js';
import { parseMap } from '../src/world.js';
import { PHYSICS, TILE_SIZE, LOOP } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;
const IDLE = { move: 0, jumpPressed: false, jumpHeld: false, dropHeld: false };

// 10 × 8 тайлов, пол на ряду 7
function flatMap(extra = []) {
  const rows = [
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '##########',
  ];
  for (const [tx, ty, ch] of extra) rows[ty] = rows[ty].slice(0, tx) + ch + rows[ty].slice(tx + 1);
  return parseMap(rows, TS);
}

function standingBody(map, tx = 2, floorTy = 7) {
  const b = createBody(tx * TS, floorTy * TS - 22, 10, 22);
  stepPlatformer(b, IDLE, DT, map, PHYSICS);
  return b;
}

function run(body, map, frames, intent = IDLE, P = PHYSICS, mods) {
  const events = [];
  for (let i = 0; i < frames; i++) events.push(stepPlatformer(body, typeof intent === 'function' ? intent(i) : intent, DT, map, P, mods));
  return events;
}

test('падает под гравитацией и встаёт ровно на пол', () => {
  const map = flatMap();
  const b = createBody(2 * TS, 0, 10, 22);
  run(b, map, 120);
  assert.equal(b.onGround, true);
  assert.equal(b.vy, 0);
  assert.equal(b.y + b.h, 7 * TS);
});

test('гравитация 900 px/с²: скорость растёт линейно до предела', () => {
  const map = flatMap();
  const b = createBody(2 * TS, -2000, 10, 22);
  stepPlatformer(b, IDLE, DT, map, PHYSICS);
  assert.ok(Math.abs(b.vy - PHYSICS.gravity * DT) < 1e-9);
  run(b, map, 60);
  assert.equal(b.vy, PHYSICS.maxFallSpeed);
});

test('стоя на полу, не проваливается и не дрожит', () => {
  const map = flatMap();
  const b = standingBody(map);
  const y = b.y;
  const events = run(b, map, 300);
  assert.equal(b.y, y);
  assert.ok(events.every((e) => !e.landed));
});

test('скорость бега выходит на 110 px/с и не выше', () => {
  const map = flatMap();
  const b = standingBody(map, 0);
  run(b, map, 30, { ...IDLE, move: 1 });
  assert.equal(b.vx, PHYSICS.runSpeed);
});

test('отпустил кнопку — тормозит до нуля на земле', () => {
  const map = flatMap();
  const b = standingBody(map, 0);
  run(b, map, 30, { ...IDLE, move: 1 });
  run(b, map, 30);
  assert.equal(b.vx, 0);
});

test('упирается в стену и останавливается вплотную', () => {
  const map = flatMap([[6, 6, '#'], [6, 5, '#']]);
  const b = standingBody(map, 2);
  const events = run(b, map, 120, { ...IDLE, move: 1 });
  assert.equal(b.x + b.w, 6 * TS);
  assert.ok(events.some((e) => e.hitWall));
});

test('край карты слева — стена', () => {
  const map = flatMap();
  const b = standingBody(map, 1);
  run(b, map, 120, { ...IDLE, move: -1 });
  assert.equal(b.x, 0);
});

test('бьётся головой о потолок и падает обратно', () => {
  // потолок на ряду 4: над головой 2 тайла свободного места
  const map = flatMap([[2, 4, '#'], [3, 4, '#']]);
  const b = standingBody(map, 2);
  const events = run(b, map, 60, (i) => ({ ...IDLE, jumpPressed: i === 0, jumpHeld: true }));
  assert.ok(events.some((e) => e.bumped));
  assert.ok(b.y >= 5 * TS - 1e-9, 'голова не залезла в потолок');
  assert.equal(b.onGround, true);
});

test('тонкая платформа: запрыгивает снизу насквозь и стоит сверху', () => {
  // тонкая на ряду 5 — на 2 тайла выше пола
  const map = flatMap([[2, 5, '-'], [3, 5, '-']]);
  const b = standingBody(map, 2);
  run(b, map, 90, (i) => ({ ...IDLE, jumpPressed: i === 0, jumpHeld: true }));
  assert.equal(b.onGround, true);
  assert.equal(b.groundTile, TILE.THIN);
  assert.equal(b.y + b.h, 5 * TS);
});

test('тонкая платформа: S — спрыгивает вниз на пол', () => {
  const map = flatMap([[2, 5, '-'], [3, 5, '-']]);
  const b = createBody(2 * TS, 5 * TS - 22, 10, 22);
  run(b, map, 2);
  assert.equal(b.groundTile, TILE.THIN);
  const events = run(b, map, 2, { ...IDLE, dropHeld: true });
  assert.ok(events.some((e) => e.dropped));
  run(b, map, 60);
  assert.equal(b.y + b.h, 7 * TS);
});

test('S на сплошном полу ничего не делает', () => {
  const map = flatMap();
  const b = standingBody(map);
  const y = b.y;
  run(b, map, 30, { ...IDLE, dropHeld: true });
  assert.equal(b.y, y);
  assert.equal(b.onGround, true);
});

test('тонкая платформа не мешает идти сквозь неё по горизонтали', () => {
  const map = flatMap([[5, 6, '-']]);
  const b = standingBody(map, 2);
  run(b, map, 60, { ...IDLE, move: 1 });
  assert.ok(b.x > 6 * TS);
});

test('барьер сплошной, но пропускает на Самокате', () => {
  const map = flatMap([[6, 6, 'B'], [6, 5, 'B']]);
  const a = standingBody(map, 2);
  run(a, map, 90, { ...IDLE, move: 1 });
  assert.equal(a.x + a.w, 6 * TS);

  const b = standingBody(map, 2);
  run(b, map, 90, { ...IDLE, move: 1 }, PHYSICS, { passBarriers: true });
  assert.ok(b.x > 6 * TS);
});

test('moveX и moveY напрямую: снап к границе тайла', () => {
  const map = flatMap([[4, 6, '#']]);
  const b = createBody(2 * TS, 6 * TS, 10, 10);
  assert.equal(moveX(b, 40, map), true);
  assert.equal(b.x + b.w, 4 * TS);
  const c = createBody(1 * TS, 5 * TS, 10, 10);
  assert.equal(moveY(c, 30, map), 'land');
  assert.equal(c.y + c.h, 7 * TS);
});

function jumpApex(holdFrames) {
  const rows = Array.from({ length: 12 }, () => '......');
  rows.push('######');
  const map = parseMap(rows, TS);
  const b = createBody(2 * TS, 12 * TS - 22, 10, 22);
  stepPlatformer(b, IDLE, DT, map, PHYSICS);
  const floorY = b.y;
  let minY = b.y;
  for (let i = 0; i < 120; i++) {
    stepPlatformer(b, { ...IDLE, jumpPressed: i === 0, jumpHeld: i < holdFrames }, DT, map, PHYSICS);
    minY = Math.min(minY, b.y);
  }
  return (floorY - minY) / TS;
}

test('прыжок с полным зажатием ≈ 3,5 тайла', () => {
  const h = jumpApex(1000);
  assert.ok(Math.abs(h - PHYSICS.jumpHeightTiles) < 0.1, `высота ${h.toFixed(2)} тайла`);
});

test('короткое нажатие ≈ 1,5 тайла', () => {
  const h = jumpApex(1);
  assert.ok(Math.abs(h - PHYSICS.shortJumpHeightTiles) < 0.1, `высота ${h.toFixed(2)} тайла`);
});

test('чем дольше держишь прыжок, тем выше', () => {
  const heights = [1, 6, 12, 1000].map(jumpApex);
  for (let i = 1; i < heights.length; i++) assert.ok(heights[i] >= heights[i - 1]);
});

// Пол только до тайла 4, дальше Яма
function ledgeMap() {
  return parseMap([
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '#####.....',
  ], TS);
}

function walkOffLedge(map) {
  const b = standingBody(map, 2);
  let guard = 0;
  while (b.onGround && guard++ < 200) stepPlatformer(b, { ...IDLE, move: 1 }, DT, map, PHYSICS);
  assert.equal(b.onGround, false);
  return b;
}

test('койот-тайм: прыжок через 4 кадра после схода с края срабатывает', () => {
  const map = ledgeMap();
  const b = walkOffLedge(map);
  run(b, map, 3, { ...IDLE, move: 1 });
  const [e] = run(b, map, 1, { ...IDLE, move: 1, jumpPressed: true, jumpHeld: true });
  assert.equal(e.jumped, true);
  assert.ok(b.vy < 0);
});

test('койот-тайм: через 0,15 с прыжка уже нет', () => {
  const map = ledgeMap();
  const b = walkOffLedge(map);
  run(b, map, 8, { ...IDLE, move: 1 });
  const [e] = run(b, map, 1, { ...IDLE, move: 1, jumpPressed: true, jumpHeld: true });
  assert.equal(e.jumped, false);
});

function fallingBody(map) {
  const b = createBody(2 * TS, 0, 10, 22);
  let guard = 0;
  // падаем, пока до пола не останется несколько кадров
  while (guard++ < 500) {
    const left = 7 * TS - (b.y + b.h);
    if (left < 20) break;
    stepPlatformer(b, IDLE, DT, map, PHYSICS);
  }
  return b;
}

test('буфер прыжка: нажал чуть раньше приземления — прыжок засчитан', () => {
  const map = flatMap();
  const b = fallingBody(map);
  assert.equal(b.onGround, false);
  stepPlatformer(b, { ...IDLE, jumpPressed: true, jumpHeld: true }, DT, map, PHYSICS);
  const events = run(b, map, 5, { ...IDLE, jumpHeld: true });
  assert.ok(events.some((e) => e.jumped), 'прыжок после приземления');
});

test('буфер прыжка: нажал слишком рано — прыжка нет', () => {
  const map = flatMap();
  const b = createBody(2 * TS, 0, 10, 22);
  stepPlatformer(b, { ...IDLE, jumpPressed: true, jumpHeld: true }, DT, map, PHYSICS);
  const events = run(b, map, 120, { ...IDLE, jumpHeld: true });
  assert.ok(events.every((e) => !e.jumped));
});

test('двойной прыжок только при airJumps > 0', () => {
  const map = flatMap();
  const jumps = (P) => {
    const b = standingBody(map);
    return run(b, map, 30, (i) => ({ ...IDLE, jumpPressed: i === 0 || i === 15, jumpHeld: true }), P)
      .filter((e) => e.jumped).length;
  };
  assert.equal(jumps(PHYSICS), 1);
  assert.equal(jumps({ ...PHYSICS, airJumps: 1 }), 2);
});

test('модификатор скорости (Самокат ×2)', () => {
  const map = parseMap(['.'.repeat(40), '#'.repeat(40)], TS);
  const b = createBody(0, TS - 22, 10, 22);
  stepPlatformer(b, IDLE, DT, map, PHYSICS);
  run(b, map, 30, { ...IDLE, move: 1 }, PHYSICS, { speedMul: 2 });
  assert.equal(b.vx, PHYSICS.runSpeed * 2);
});

test('провалился ниже карты — fellOut', () => {
  const map = ledgeMap();
  const b = createBody(7 * TS, 0, 10, 22);
  run(b, map, 120);
  assert.equal(fellOut(b, map), true);
});
