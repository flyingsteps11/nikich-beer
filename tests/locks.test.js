import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLocks, updateLocks, activeLock, confine, resetLocks } from '../src/locks.js';
import { createBody } from '../src/physics.js';
import { parseMap } from '../src/world.js';
import { LOCKS, TILE_SIZE, LOOP } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;

function strip() {
  const rows = Array.from({ length: 7 }, () => '.'.repeat(60));
  rows.push('#'.repeat(60));
  const map = parseMap(rows, TS);
  map.locks = [{ tx0: 20, tx1: 39, waves: [['runner', 'runner'], ['smoothie']] }];
  return map;
}

function ctx(map, x, alive = 0, room = 12) {
  return { map, nikichX: x, nikichFeetY: 7 * TS, room, aliveIn: () => alive };
}

function run(locks, map, x, seconds, alive = 0, room = 12) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) events.push(...updateLocks(locks, DT, ctx(map, x, alive, room)));
  return events;
}

test('Запертая волна закрывается, когда Никич зашёл за ворота', () => {
  const map = strip();
  const locks = createLocks(map);
  assert.equal(run(locks, map, 21 * TS, DT).length, 0, 'у самых ворот ещё не закрыто');
  const ev = run(locks, map, (20 + LOCKS.triggerTiles) * TS + 1, DT);
  assert.equal(ev[0].type, 'start');
  assert.equal(activeLock(locks), locks[0]);
});

test('Зожники выходят из ворот по очереди с обеих сторон, на земле', () => {
  const map = strip();
  const locks = createLocks(map);
  const x = 30 * TS;
  const ev = run(locks, map, x, LOCKS.firstDelay + LOCKS.spawnEvery * 2, 2);
  const spawns = ev.filter((e) => e.type === 'spawn');
  assert.equal(spawns.length, 2);
  assert.equal(spawns[0].x, 20 * TS + LOCKS.gateInset);
  assert.equal(spawns[1].x, 40 * TS - LOCKS.gateInset);
  assert.ok(spawns.every((s) => s.y === 7 * TS));
});

test('следующая волна — только когда прошлая уложена; потом ворота открыты', () => {
  const map = strip();
  const locks = createLocks(map);
  const x = 30 * TS;
  run(locks, map, x, 3, 2);
  assert.equal(run(locks, map, x, 3, 2).filter((e) => e.type === 'spawn').length, 0, 'пока живы — не идут');
  const next = run(locks, map, x, LOCKS.waveGap + DT * 2, 0);
  assert.ok(next.some((e) => e.type === 'wave' && e.wave === 1));
  const last = run(locks, map, x, LOCKS.spawnEvery + DT, 1);
  assert.equal(last.filter((e) => e.type === 'spawn').length, 1);
  assert.equal(activeLock(locks), locks[0], 'последний Зожник жив — закрыто');
  const end = run(locks, map, x, DT, 0);
  assert.ok(end.some((e) => e.type === 'clear'));
  assert.equal(activeLock(locks), null);
  assert.equal(run(locks, map, x, 2, 0).length, 0, 'пройденная не закрывается снова');
});

test('у ворот Зожники выходят на землю, а не на крышу прилавка', () => {
  const map = strip();
  map.fill(20, 4, 22, 4, 1);
  const locks = createLocks(map);
  const ev = run(locks, map, 30 * TS, LOCKS.firstDelay + DT, 2);
  const s = ev.find((e) => e.type === 'spawn');
  assert.equal(s.y, 7 * TS);
});

test('лимит Зожников: нет места — ждёт', () => {
  const map = strip();
  const locks = createLocks(map);
  const ev = run(locks, map, 30 * TS, 3, 0, 0);
  assert.equal(ev.filter((e) => e.type === 'spawn').length, 0);
});

test('ворота держат Никича внутри', () => {
  const map = strip();
  const [lock] = createLocks(map);
  const b = createBody(lock.left - 4, 0, 10, 22);
  b.vx = -100;
  assert.equal(confine(b, lock), true);
  assert.equal(b.x, lock.left);
  assert.equal(b.vx, 0);
  b.x = lock.right - 5;
  b.vx = 100;
  confine(b, lock);
  assert.equal(b.x + b.w, lock.right);
  b.x = lock.left + 50;
  assert.equal(confine(b, lock), false);
});

test('потеря жизни: непройденная Запертая волна начнётся заново', () => {
  const map = strip();
  const locks = createLocks(map);
  run(locks, map, 30 * TS, 2, 1);
  resetLocks(locks);
  assert.equal(activeLock(locks), null);
  const ev = run(locks, map, 30 * TS, DT);
  assert.equal(ev[0].type, 'start');
});

test('застряли Зожники — волна не держит дольше предела', () => {
  const map = strip();
  const locks = createLocks(map);
  const ev = run(locks, map, 30 * TS, LOCKS.waveTimeout + 1, 2);
  assert.ok(ev.some((e) => e.type === 'release'));
});
