import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createZoznik, damageZoznik, stunZoznik, holdZoznik, canAct, updateZoznik,
  updateEnemyShots, contactDamage, rollDrop,
} from '../src/zozniki.js';
import { createBody, fellOut } from '../src/physics.js';
import { parseMap } from '../src/world.js';
import { PHYSICS, TILE_SIZE, LOOP, ZOZNIKI } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;
const small = parseMap(['..........', '..........', '..........', '##########'], TS);

// Карта W тайлов × 8, пол на ряду 7; mutate(rows) правит строки
function level(w, mutate) {
  const rows = Array.from({ length: 7 }, () => '.'.repeat(w));
  rows.push('#'.repeat(w));
  if (mutate) mutate(rows);
  return parseMap(rows, TS);
}

function put(rows, tx, ty, ch) {
  rows[ty] = rows[ty].slice(0, tx) + ch + rows[ty].slice(tx + 1);
}

function spawnAt(kind, tx) {
  const k = ZOZNIKI[kind];
  return createZoznik(kind, tx * TS + (TS - k.w) / 2, 7 * TS - k.h);
}

function target(tx) {
  return createBody(tx * TS, 7 * TS - 22, 10, 22);
}

function sim(z, map, t, frames, onStep) {
  const events = [];
  for (let i = 0; i < frames; i++) {
    events.push(...updateZoznik(z, DT, map, PHYSICS, t, ZOZNIKI, () => 0));
    if (onStep) onStep(i);
  }
  return events;
}

// ---------- Основа ----------

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
  for (let i = 0; i < 91; i++) updateZoznik(z, DT, small, PHYSICS);
  assert.equal(canAct(z), true);
  holdZoznik(z, 3);
  assert.equal(canAct(z), false);
  for (let i = 0; i < 181; i++) updateZoznik(z, DT, small, PHYSICS);
  assert.equal(canAct(z), true);
});

test('манекен стоит на полу под гравитацией и возрождается', () => {
  const z = createZoznik('dummy', 32, 0);
  for (let i = 0; i < 60; i++) updateZoznik(z, DT, small, PHYSICS);
  assert.equal(z.body.y + z.body.h, 3 * TS);
  damageZoznik(z, 1000);
  for (let i = 0; i < ZOZNIKI.dummy.respawnTime * 60 + 1; i++) updateZoznik(z, DT, small, PHYSICS);
  assert.equal(z.alive, true);
  assert.equal(z.health, z.maxHealth);
});

test('неизвестный вид — ошибка', () => {
  assert.throws(() => createZoznik('nope', 0, 0), /Неизвестный вид/);
});

test('характеристики видов — по таблице SPEC §6', () => {
  const spec = {
    runner: [20, 70, 10],
    cyclist: [30, 140, 20],
    moto: [60, 170, 30],
    yoga: [40, 30, 5],
    smoothie: [25, 45, 0],
  };
  for (const [kind, [hp, speed, touch]] of Object.entries(spec)) {
    assert.deepEqual([ZOZNIKI[kind].health, ZOZNIKI[kind].speed, ZOZNIKI[kind].touchDamage], [hp, speed, touch], kind);
  }
  assert.equal(ZOZNIKI.smoothie.projectileDamage, 10);
});

// ---------- Бегун ----------

test('Бегун бежит к Никичу не быстрее 100 px/с', () => {
  const map = level(60);
  const z = spawnAt('runner', 40);
  const t = target(10);
  let maxV = 0;
  sim(z, map, t, 120, () => { maxV = Math.max(maxV, Math.abs(z.body.vx)); });
  assert.ok(z.body.x < 40 * TS - 100);
  assert.ok(maxV <= ZOZNIKI.runner.speed + 1e-9);
  assert.equal(z.dir, -1);
});

test('Бегун не прыгает в Яму сам — стоит у края', () => {
  const map = level(60, (r) => { for (let x = 21; x < 25; x++) put(r, x, 7, '.'); });
  const z = spawnAt('runner', 10);
  sim(z, map, target(40), 300);
  assert.equal(z.body.onGround, true);
  assert.ok(z.body.x + z.body.w <= 21 * TS + 1e-9);
});

test('Бегун перепрыгивает препятствие в 2 тайла', () => {
  const map = level(60, (r) => { put(r, 25, 6, '#'); put(r, 25, 5, '#'); });
  const z = spawnAt('runner', 30);
  sim(z, map, target(10), 240);
  assert.ok(z.body.x < 25 * TS, 'перебрался');
});

test('Бегун не лезет через стену в 4 тайла', () => {
  const map = level(60, (r) => { for (let y = 3; y < 7; y++) put(r, 25, y, '#'); });
  const z = spawnAt('runner', 30);
  sim(z, map, target(10), 240);
  assert.ok(z.body.x >= 26 * TS - 1e-9);
});

// ---------- Велосипедист и Мотоциклист ----------

test('Велосипедист: рывок до 200 px/с, торможение 1 с, новый рывок к Никичу', () => {
  const map = level(80);
  const z = spawnAt('cyclist', 40);
  const t = target(28);
  let maxV = 0;
  const states = [];
  let brakeFrames = 0;
  sim(z, map, t, 400, () => {
    maxV = Math.max(maxV, Math.abs(z.body.vx));
    if (states[states.length - 1] !== z.state) states.push(z.state);
    if (z.state === 'brake') brakeFrames++;
  });
  assert.ok(Math.abs(maxV - ZOZNIKI.cyclist.speed) < 1e-6, `макс ${maxV}`);
  const from = states.indexOf('dash');
  assert.deepEqual(states.slice(from, from + 4), ['dash', 'brake', 'idle', 'dash']);
  assert.ok(brakeFrames >= 59, 'тормозил около секунды');
});

test('Велосипедист разгоняется постепенно, а не сразу', () => {
  const map = level(80);
  const z = spawnAt('cyclist', 40);
  sim(z, map, target(28), 10);
  assert.ok(Math.abs(z.body.vx) < ZOZNIKI.cyclist.speed / 2);
});

test('Велосипедист далеко от Никича стоит', () => {
  const map = level(80);
  const z = spawnAt('cyclist', 70);
  sim(z, map, target(5), 120);
  assert.equal(z.state, 'idle');
  assert.equal(z.body.vx, 0);
});

test('Велосипедист тормозит у Ямы, Мотоциклист перелетает её с трамплина', () => {
  const mk = () => {
    const map = level(40, (r) => { for (let x = 10; x <= 12; x++) put(r, x, 7, '.'); });
    map.ramps = [{ tx: 14, ty: 6 }];
    return map;
  };
  const bike = spawnAt('cyclist', 20);
  const mapA = mk();
  sim(bike, mapA, target(4), 240);
  assert.ok(bike.body.x >= 13 * TS - 1e-9, 'велосипед остался справа от Ямы');
  assert.equal(fellOut(bike.body, mapA), false);

  const moto = spawnAt('moto', 20);
  const mapB = mk();
  let maxV = 0;
  let flew = false;
  sim(moto, mapB, target(4), 240, () => {
    maxV = Math.max(maxV, Math.abs(moto.body.vx));
    if (!moto.body.onGround && moto.body.vy < 0) flew = true;
  });
  assert.ok(flew, 'прыгнул дугой');
  assert.ok(moto.body.x + moto.body.w < 10 * TS, 'перелетел Яму');
  assert.equal(fellOut(moto.body, mapB), false);
  assert.ok(Math.abs(maxV - ZOZNIKI.moto.speed) < 1e-6);
});

test('Мотоциклист: шутка при рывке', () => {
  const map = level(80);
  const z = spawnAt('moto', 40);
  const events = sim(z, map, target(28), 5);
  assert.ok(events.some((e) => e.type === 'joke'));
});

test('оглушённый на рывке переходит в торможение', () => {
  const map = level(80);
  const z = spawnAt('cyclist', 40);
  sim(z, map, target(28), 20);
  assert.equal(z.state, 'dash');
  stunZoznik(z, 1.5);
  sim(z, map, target(28), 1);
  assert.equal(z.state, 'brake');
});

// ---------- Йога-тётка ----------

test('Йога-тётка стоит в позе, пока Никич далеко', () => {
  const map = level(60);
  const z = spawnAt('yoga', 40);
  sim(z, map, target(10), 120);
  assert.equal(z.state, 'pose');
  assert.equal(z.body.vx, 0);
});

test('Йога-тётка идёт медленно и читает лекцию: Никич оглушён 1 с, повтор не сразу', () => {
  const map = level(60);
  const z = spawnAt('yoga', 40);
  const t = target(33); // 112 px — в зоне
  let maxV = 0;
  const events = sim(z, map, t, 240, () => { maxV = Math.max(maxV, Math.abs(z.body.vx)); });
  const lectures = events.filter((e) => e.type === 'lecture');
  assert.ok(maxV <= ZOZNIKI.yoga.speed + 1e-9);
  assert.ok(lectures.length >= 1);
  assert.equal(lectures[0].stun, ZOZNIKI.yoga.lectureStun);
  // за 4 с — не больше двух лекций (перезарядка 3 с)
  assert.ok(lectures.length <= 2);
});

// ---------- Смузи-хипстер ----------

test('Смузи-хипстер пятится от близкого Никича и подходит к далёкому', () => {
  const map = level(80);
  const near = spawnAt('smoothie', 40);
  sim(near, map, target(37), 60); // 48 px — слишком близко
  assert.ok(near.body.x > 40 * TS + 4, 'отошёл');
  assert.equal(near.dir, -1, 'смотрит на Никича');

  const far = spawnAt('smoothie', 60);
  sim(far, map, target(30), 60); // 480 px — далеко
  assert.ok(far.body.x < 60 * TS - 4, 'подошёл');
});

test('Смузи по дуге попадает в стоящего Никича на 10', () => {
  const map = level(80);
  const z = spawnAt('smoothie', 40);
  const t = target(31); // ~140 px
  const shots = [];
  let hits = [];
  for (let i = 0; i < 200; i++) {
    for (const e of updateZoznik(z, DT, map, PHYSICS, t)) if (e.type === 'throw') shots.push(e.shot);
    hits = hits.concat(updateEnemyShots(shots, DT, map, t));
  }
  assert.ok(hits.length >= 1, 'попал');
  assert.equal(hits[0].damage, 10);
});

test('смузи разбивается о стену', () => {
  const map = level(20, (r) => { for (let y = 0; y < 7; y++) put(r, 10, y, '#'); });
  const shots = [{ x: 8 * TS, y: 5 * TS, vx: 200, vy: 0, g: 0, damage: 10, life: 3, alive: true }];
  const t = target(15);
  let hits = [];
  for (let i = 0; i < 60; i++) hits = hits.concat(updateEnemyShots(shots, DT, map, t));
  assert.equal(hits.length, 0);
  assert.equal(shots.length, 0);
});

// ---------- Касание и выпадение ----------

test('урон касанием: только при касании и если Зожник не оглушён', () => {
  const z = spawnAt('runner', 10);
  const touching = createBody(z.body.x + 2, z.body.y, 10, 22);
  const away = createBody(z.body.x + 100, z.body.y, 10, 22);
  assert.equal(contactDamage(z, touching), 10);
  assert.equal(contactDamage(z, away), 0);
  stunZoznik(z, 1);
  assert.equal(contactDamage(z, touching), 0);
  const s = spawnAt('smoothie', 10);
  assert.equal(contactDamage(s, createBody(s.body.x, s.body.y, 10, 22)), 0, 'хипстер бьёт только смузи');
});

test('оглушённый Бегун стоит на месте', () => {
  const map = level(60);
  const z = spawnAt('runner', 40);
  stunZoznik(z, 1.5);
  const x = z.body.x;
  sim(z, map, target(10), 60);
  assert.equal(z.body.x, x);
});

test('Пиво 0,0 выпадает с шансом 10%', () => {
  assert.equal(rollDrop(() => 0.05), true);
  assert.equal(rollDrop(() => 0.1), false);
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let n = 0;
  for (let i = 0; i < 10000; i++) if (rollDrop(rng)) n++;
  assert.ok(n > 850 && n < 1150, `выпало ${n} из 10000`);
});

test('Зожник не проходит сквозь Никича: упирается и бьёт касанием', async () => {
  const { separateFromBody, touching, recoil } = await import('../src/zozniki.js');
  const { CONTACT } = await import('../src/config.js');
  const map = level(30);
  const t = target(10);
  const z = spawnAt('runner', 20);
  for (let i = 0; i < 240; i++) {
    updateZoznik(z, DT, map, PHYSICS, t, ZOZNIKI, () => 0);
    separateFromBody(z, t, map);
    assert.ok(!(z.body.x < t.x + t.w - 0.01 && z.body.x + z.body.w > t.x + 0.01), `кадр ${i}: насквозь`);
  }
  assert.ok(touching(z.body, t), 'стоит вплотную');
  assert.equal(contactDamage(z, t), ZOZNIKI.runner.touchDamage);
  recoil(z, t);
  assert.ok(z.body.vx > 0, 'отскок от Никича');
  assert.equal(contactDamage(z, t), 0, 'сразу снова не бьёт');
  sim(z, map, t, Math.ceil(CONTACT.hitCooldown / DT) + 1);
  separateFromBody(z, t, map);
  assert.equal(contactDamage(z, t), ZOZNIKI.runner.touchDamage, 'после паузы снова опасен');
});

test('Зожник у стены не продавливается — отодвигается Никич', async () => {
  const { separateFromBody } = await import('../src/zozniki.js');
  const map = level(30, (r) => { for (let y = 0; y < 7; y++) put(r, 12, y, '#'); });
  const z = spawnAt('runner', 11);
  const t = target(11);
  t.x = z.body.x + 2;
  separateFromBody(z, t, map);
  assert.ok(t.x >= z.body.x + z.body.w - 0.01 || t.x + t.w <= z.body.x + 0.01);
  assert.ok(z.body.x + z.body.w <= 12 * TS + 0.01, 'Зожник не в стене');
});

test('Никич над головой Зожника не расталкивается — его можно перепрыгнуть', async () => {
  const { separateFromBody } = await import('../src/zozniki.js');
  const map = level(30);
  const z = spawnAt('runner', 10);
  const t = createBody(z.body.x, z.body.y - 20, 10, 22);
  assert.equal(separateFromBody(z, t, map), false);
});

test('Бегун спрыгивает с уступа к Никичу, но не в Яму', async () => {
  const ledge = level(30, (r) => { for (let x = 15; x < 30; x++) { put(r, x, 4, '#'); put(r, x, 5, '#'); put(r, x, 6, '#'); } });
  const z = createZoznik('runner', 20 * TS, 4 * TS - ZOZNIKI.runner.h);
  const t = target(5);
  sim(z, ledge, t, 300);
  assert.ok(z.body.y + z.body.h >= 7 * TS - 0.5, 'спустился на землю');
  assert.ok(z.body.x < 15 * TS, 'дошёл до Никича');
  const pit = level(30, (r) => { put(r, 10, 7, '.'); put(r, 11, 7, '.'); put(r, 12, 7, '.'); });
  const r2 = spawnAt('runner', 16);
  sim(r2, pit, target(5), 300);
  assert.equal(fellOut(r2.body, pit), false);
  assert.ok(r2.body.x > 12 * TS, 'стоит у Ямы');
});
