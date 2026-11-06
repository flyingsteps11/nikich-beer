import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createNikich, setAim, updateNikich, handPos,
  tryShoot, updateShots, tryDog, updateDogs, tryStun, trySuper, canSuper,
  takeDamage, createSpeech, say, updateSpeech, applyDamage,
} from '../src/nikich.js';
import { createZoznik } from '../src/zozniki.js';
import { parseMap } from '../src/world.js';
import { PHYSICS, TILE_SIZE, LOOP, ATTACKS, NIKICH, SPEECH } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;
const IDLE = { move: 0, jumpPressed: false, jumpHeld: false, dropHeld: false };
const FLOOR_Y = 7 * TS;

// 40 × 8 тайлов, пол на ряду 7, по желанию стена на x=30
function arena({ wall = false } = {}) {
  const rows = Array.from({ length: 7 }, () => '.'.repeat(40));
  if (wall) for (let y = 0; y < 7; y++) rows[y] = rows[y].slice(0, 30) + '#' + rows[y].slice(31);
  rows.push('#'.repeat(40));
  return parseMap(rows, TS);
}

function nikichAt(map, x) {
  const n = createNikich(x, FLOOR_Y - NIKICH.hitboxH);
  updateNikich(n, IDLE, DT, map, PHYSICS);
  return n;
}

function dummyAt(x) {
  return createZoznik('dummy', x, FLOOR_Y - 22);
}

// ---------- Щелбан ----------

test('Щелбан летит к курсору со скоростью 300 px/с', () => {
  const map = arena();
  const n = nikichAt(map, 100);
  const h = handPos(n);
  setAim(n, h.x + 30, h.y - 40); // вверх-вправо, 3:4
  const s = tryShoot(n);
  assert.ok(Math.abs(Math.hypot(s.vx, s.vy) - ATTACKS.shot.speed) < 1e-9);
  assert.ok(Math.abs(s.vx / ATTACKS.shot.speed - 0.6) < 1e-9);
  assert.ok(Math.abs(s.vy / ATTACKS.shot.speed + 0.8) < 1e-9);
  assert.equal(n.facing, 1);
});

test('Щелбан: прицел влево разворачивает Никича', () => {
  const map = arena();
  const n = nikichAt(map, 200);
  setAim(n, 50, 100);
  assert.equal(n.facing, -1);
});

test('Щелбан: перезарядка 0,25 с — за 1 с зажатия 4 окурка', () => {
  const map = arena();
  const n = nikichAt(map, 100);
  let shots = 0;
  for (let i = 0; i < 60; i++) {
    if (tryShoot(n)) shots++;
    updateNikich(n, IDLE, DT, map, PHYSICS);
  }
  assert.equal(shots, 4);
});

test('Щелбан: урон 10 первому Зожнику на пути, второй цел', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  const a = dummyAt(120);
  const b = dummyAt(150);
  setAim(n, 500, handPos(n).y);
  const shots = [tryShoot(n)];
  let hits = [];
  for (let i = 0; i < 60; i++) hits = hits.concat(updateShots(n, shots, DT, map, [a, b]));
  assert.equal(hits.length, 1);
  assert.equal(a.health, a.maxHealth - ATTACKS.shot.damage);
  assert.equal(b.health, b.maxHealth);
  assert.equal(shots.length, 0);
});

test('Щелбан: дальность 220 px, дальше окурок исчезает', () => {
  const map = arena();
  const n = nikichAt(map, 20);
  setAim(n, 1000, handPos(n).y);
  const shots = [tryShoot(n)];
  const x0 = shots[0].x;
  let lastX = x0;
  for (let i = 0; i < 120 && shots.length; i++) {
    lastX = shots[0].x;
    updateShots(n, shots, DT, map, []);
  }
  assert.equal(shots.length, 0);
  assert.ok(Math.abs(lastX - x0 - ATTACKS.shot.range) <= ATTACKS.shot.speed * DT + 1e-9);
});

test('Щелбан гаснет о стену', () => {
  const map = arena({ wall: true });
  const n = nikichAt(map, 400);
  const z = dummyAt(31 * TS + 10); // за стеной
  setAim(n, 1000, handPos(n).y);
  const shots = [tryShoot(n)];
  for (let i = 0; i < 60; i++) updateShots(n, shots, DT, map, [z]);
  assert.equal(shots.length, 0);
  assert.equal(z.health, z.maxHealth);
});

test('множитель урона действует на Щелбан', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  n.mods.damageMul = 1.1;
  const z = dummyAt(120);
  setAim(n, 500, handPos(n).y);
  const shots = [tryShoot(n)];
  for (let i = 0; i < 60; i++) updateShots(n, shots, DT, map, [z]);
  assert.ok(Math.abs(z.maxHealth - z.health - 11) < 1e-9);
});

// ---------- Собака ----------

function runDogs(n, dogs, map, zs, frames) {
  let events = [];
  for (let i = 0; i < frames; i++) {
    events = events.concat(updateDogs(n, dogs, DT, map, zs, PHYSICS));
    for (const z of zs) z.held = Math.max(0, z.held - DT);
  }
  return events;
}

test('Собака бежит к курсору, вцепляется в первого Зожника и держит 3 с: урон 15/с', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  const a = dummyAt(150);
  const b = dummyAt(200);
  const dogs = [tryDog(n, 500)];
  const events = runDogs(n, dogs, map, [a, b], 60);
  assert.ok(events.some((e) => e.type === 'bite' && e.z === a));
  assert.ok(a.held > 0, 'Зожник обездвижен');
  runDogs(n, dogs, map, [a, b], 60 * 4);
  assert.equal(dogs.length, 0, 'отпустила и ушла');
  const dealt = a.maxHealth - a.health;
  assert.ok(Math.abs(dealt - ATTACKS.dog.dps * ATTACKS.dog.holdTime) < 1e-6, `урон ${dealt}`);
  assert.equal(b.health, b.maxHealth);
});

test('Собака бежит в сторону курсора — влево тоже', () => {
  const map = arena();
  const n = nikichAt(map, 300);
  const left = dummyAt(150);
  const dogs = [tryDog(n, 0)];
  const events = runDogs(n, dogs, map, [left], 90);
  assert.ok(events.some((e) => e.type === 'bite' && e.z === left));
});

test('Собака: перезарядка 6 с', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  assert.ok(tryDog(n, 500));
  assert.equal(tryDog(n, 500), null);
  for (let i = 0; i < 6 * 60 + 1; i++) updateNikich(n, IDLE, DT, map, PHYSICS);
  assert.ok(tryDog(n, 500));
});

test('Собака без цели убегает через maxRunTime', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  const dogs = [tryDog(n, 500)];
  runDogs(n, dogs, map, [], Math.ceil(ATTACKS.dog.maxRunTime * 60) + 2);
  assert.equal(dogs.length, 0);
});

test('Злая собака: держит на 1 с дольше', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  n.mods.dogHoldBonus = 1;
  const z = dummyAt(150);
  const dogs = [tryDog(n, 500)];
  runDogs(n, dogs, map, [z], 60 * 6);
  assert.ok(Math.abs(z.maxHealth - z.health - ATTACKS.dog.dps * (ATTACKS.dog.holdTime + 1)) < 1e-6);
});

// ---------- 5:0 ----------

test('5:0: оглушает на 1,5 с и бьёт на 5 в радиусе 70, дальше — нет', () => {
  const map = arena();
  const n = nikichAt(map, 200);
  const near = dummyAt(200 + 55);
  const far = dummyAt(200 + 120);
  const res = tryStun(n, [near, far]);
  assert.equal(res.hits.length, 1);
  assert.equal(near.stun, ATTACKS.stun.duration);
  assert.equal(near.health, near.maxHealth - ATTACKS.stun.damage);
  assert.equal(far.stun, 0);
  assert.equal(far.health, far.maxHealth);
});

test('5:0: перезарядка 5 с', () => {
  const map = arena();
  const n = nikichAt(map, 200);
  assert.ok(tryStun(n, []));
  assert.equal(tryStun(n, []), null);
  for (let i = 0; i < 5 * 60 + 1; i++) updateNikich(n, IDLE, DT, map, PHYSICS);
  assert.ok(tryStun(n, []));
});

test('5:0 в нашу пользу: радиус +20%', () => {
  const map = arena();
  const n = nikichAt(map, 200);
  n.mods.stunRadiusMul = 1.2;
  const z = dummyAt(200 + 76); // ближний край ~71 px от центра: без Улучшения не достаёт
  assert.equal(tryStun(createNikichCopy(n), [dummyAt(200 + 76)]).hits.length, 0);
  const res = tryStun(n, [z]);
  assert.equal(res.radius, ATTACKS.stun.radius * 1.2);
  assert.equal(res.hits.length, 1);
});

function createNikichCopy(n) {
  const c = createNikich(n.body.x, n.body.y);
  c.body.onGround = true;
  return c;
}

// ---------- Папа сейчас всё сделает ----------

test('шкала супера: +1 за каждую единицу урона, максимум 100', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  const z = dummyAt(100);
  applyDamage(n, z, 30);
  assert.equal(n.superMeter, 30);
  const big = createZoznik('dummy', 300, 0, { dummy: { health: 1000, w: 12, h: 22 } });
  applyDamage(n, big, 500);
  assert.equal(n.superMeter, ATTACKS.super.meterMax);
});

test('супер недоступен, пока шкала не полная', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  n.superMeter = 99;
  assert.equal(canSuper(n), false);
  assert.equal(trySuper(n, [], { x: 0, y: 0, w: 480, h: 270 }), null);
});

test('супер: 200 урона всем на экране, за экраном цел, шкала обнулилась и не наполнилась', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  n.superMeter = 100;
  const big = { dummy: { health: 300, w: 12, h: 22 } };
  const onA = createZoznik('dummy', 100, FLOOR_Y - 22, big);
  const onB = createZoznik('dummy', 400, FLOOR_Y - 22, big);
  const off = createZoznik('dummy', 520, FLOOR_Y - 22, big);
  const res = trySuper(n, [onA, onB, off], { x: 0, y: 0, w: 480, h: 270 });
  assert.equal(res.hits.length, 2);
  assert.equal(onA.health, 100);
  assert.equal(onB.health, 100);
  assert.equal(off.health, 300);
  assert.equal(n.superMeter, 0);
});

test('Папа на подходе: шкала копится на 20% быстрее', () => {
  const map = arena();
  const n = nikichAt(map, 50);
  n.mods.superChargeMul = 1.2;
  applyDamage(n, dummyAt(100), 50);
  assert.ok(Math.abs(n.superMeter - 60) < 1e-9);
});

// ---------- Урон по Никичу ----------

test('удар: минус здоровье, отбрасывание от врага, неуязвимость 1 с', () => {
  const map = arena();
  const n = nikichAt(map, 200);
  const r = takeDamage(n, 20, 250); // враг справа
  assert.equal(r.hit, true);
  assert.equal(n.health, 80);
  assert.ok(n.body.vx < 0 && n.body.vy < 0, 'отброшен влево и вверх');
  assert.equal(takeDamage(n, 20, 250).hit, false, 'неуязвим');
  for (let i = 0; i < 61; i++) updateNikich(n, IDLE, DT, map, PHYSICS);
  assert.equal(takeDamage(n, 20, 250).hit, true);
});

test('во время отбрасывания ввод игнорируется', () => {
  const map = arena();
  const n = nikichAt(map, 200);
  takeDamage(n, 10, 250);
  updateNikich(n, { ...IDLE, move: 1 }, DT, map, PHYSICS);
  assert.ok(n.body.vx < 0);
});

test('здоровье кончилось — минус жизнь, здоровье полное; три жизни — конец', () => {
  const map = arena();
  const n = nikichAt(map, 200);
  let r;
  for (let life = 0; life < NIKICH.lives; life++) {
    n.invuln = 0;
    r = takeDamage(n, NIKICH.maxHealth, 0);
    assert.equal(r.lifeLost, true);
    assert.equal(n.health, n.maxHealth);
  }
  assert.equal(r.gameOver, true);
  assert.equal(n.lives, 0);
});

// ---------- Реплики ----------

test('реплики: не чаще раза в 3 с, висят 2 с', () => {
  const s = createSpeech();
  assert.equal(say(s, 'Поебать кого ебать'), true);
  assert.equal(say(s, 'Легендарная игра'), false);
  for (let i = 0; i < SPEECH.holdTime * 60 + 1; i++) updateSpeech(s, DT);
  assert.equal(s.text, null);
  assert.equal(say(s, 'Легендарная игра'), false, 'ещё не прошло 3 с');
  for (let i = 0; i < (SPEECH.minInterval - SPEECH.holdTime) * 60; i++) updateSpeech(s, DT);
  assert.equal(say(s, 'Легендарная игра'), true);
});

test('реплики: force перебивает ограничение', () => {
  const s = createSpeech();
  say(s, 'раз');
  assert.equal(say(s, 'ПАМАГИТЕ', { force: true }), true);
  assert.equal(s.text, 'ПАМАГИТЕ');
});
