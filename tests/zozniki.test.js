import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createZoznik, damageZoznik, stunZoznik, holdZoznik, canAct, updateZoznik } from '../src/zozniki.js';
import { parseMap } from '../src/world.js';
import { PHYSICS, TILE_SIZE, LOOP, ZOZNIKI } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;
const map = parseMap(['..........', '..........', '..........', '##########'], TS);

test('урон не уходит ниже нуля, убитый не получает урона', () => {
  const z = createZoznik('dummy', 32, 0);
  const r = damageZoznik(z, 150);
  assert.equal(r.dealt, ZOZNIKI.dummy.health);
  assert.equal(r.killed, true);
  assert.equal(z.health, 0);
  assert.equal(damageZoznik(z, 10).dealt, 0);
});

test('оглушение и удержание: не действует, пока таймеры не вышли', () => {
  const z = createZoznik('dummy', 32, 0);
  stunZoznik(z, 1.5);
  assert.equal(canAct(z), false);
  for (let i = 0; i < 91; i++) updateZoznik(z, DT, map, PHYSICS);
  assert.equal(canAct(z), true);
  holdZoznik(z, 3);
  assert.equal(canAct(z), false);
  for (let i = 0; i < 181; i++) updateZoznik(z, DT, map, PHYSICS);
  assert.equal(canAct(z), true);
});

test('манекен стоит на полу под гравитацией', () => {
  const z = createZoznik('dummy', 32, 0);
  for (let i = 0; i < 60; i++) updateZoznik(z, DT, map, PHYSICS);
  assert.equal(z.body.y + z.body.h, 3 * TS);
  assert.equal(z.body.onGround, true);
});

test('убитый манекен возрождается через respawnTime с полным здоровьем', () => {
  const z = createZoznik('dummy', 32, 0);
  damageZoznik(z, 1000);
  for (let i = 0; i < ZOZNIKI.dummy.respawnTime * 60 + 1; i++) updateZoznik(z, DT, map, PHYSICS);
  assert.equal(z.alive, true);
  assert.equal(z.health, z.maxHealth);
});

test('неизвестный вид — ошибка', () => {
  assert.throws(() => createZoznik('nope', 0, 0), /Неизвестный вид/);
});
