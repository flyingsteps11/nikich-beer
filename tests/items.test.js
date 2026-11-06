import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createItem, itemsFromMap, updateItems, collectItems, applyItem, rollLoot,
} from '../src/items.js';
import {
  createNikich, updateNikich, tryShoot, damageMul, movementMods, isRiding, ramZozniki, takeDamage,
} from '../src/nikich.js';
import { createZoznik } from '../src/zozniki.js';
import { parseMap, createTimer } from '../src/world.js';
import { PHYSICS, TILE_SIZE, LOOP, ITEMS, NIKICH, ATTACKS, DROPS } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;
const IDLE = { move: 0, jumpPressed: false, jumpHeld: false, dropHeld: false };
const RUN = { move: 1, jumpPressed: false, jumpHeld: false, dropHeld: false };
const FLOOR_Y = 7 * TS;

function arena(mutate) {
  const rows = Array.from({ length: 7 }, () => '.'.repeat(60));
  rows.push('#'.repeat(60));
  if (mutate) mutate(rows);
  return parseMap(rows, TS);
}

function put(rows, tx, ty, ch) {
  rows[ty] = rows[ty].slice(0, tx) + ch + rows[ty].slice(tx + 1);
}

function nikichAt(map, tx) {
  const n = createNikich(tx * TS, FLOOR_Y - NIKICH.hitboxH);
  updateNikich(n, IDLE, DT, map, PHYSICS);
  return n;
}

function newRun() {
  return { timer: createTimer(180), stats: { kills: 0, shots: 0, deaths: 0 } };
}

function run(n, map, intent, frames) {
  const events = [];
  for (let i = 0; i < frames; i++) events.push(updateNikich(n, intent, DT, map, PHYSICS));
  return events;
}

// Максимальная высота прыжка в тайлах при текущих эффектах
function jumpHeight(n, map) {
  const y0 = n.body.y;
  let minY = y0;
  updateNikich(n, { ...IDLE, jumpPressed: true, jumpHeld: true }, DT, map, PHYSICS);
  for (let i = 0; i < 120; i++) {
    updateNikich(n, { ...IDLE, jumpHeld: true }, DT, map, PHYSICS);
    minY = Math.min(minY, n.body.y);
  }
  return (y0 - minY) / TS;
}

// ---------- Бонусы ----------

test('Хот-дог: +30 здоровья, но не выше максимума', () => {
  const n = createNikich(0, 0);
  n.health = 50;
  applyItem(n, 'hotdog', newRun());
  assert.equal(n.health, 80);
  applyItem(n, 'hotdog', newRun());
  assert.equal(n.health, 100);
});

test('Стопарик: +25% урона ровно 8 с и счёт в статистику', () => {
  const map = arena();
  const n = nikichAt(map, 5);
  const r = newRun();
  applyItem(n, 'vodka', r);
  assert.equal(r.stats.shots, 1);
  assert.equal(tryShoot(n).damage, ATTACKS.shot.damage * 1.25);
  run(n, map, IDLE, 8 * 60 - 2);
  assert.equal(damageMul(n), 1.25, 'ещё действует');
  run(n, map, IDLE, 3);
  assert.equal(damageMul(n), 1, 'кончился');
});

test('Сигарета: +15 с к таймеру', () => {
  const r = newRun();
  r.timer.left = 10;
  applyItem(createNikich(0, 0), 'cigarette', r);
  assert.equal(r.timer.left, 25);
});

test('Сигарета: Затяжка — быстрее бег, выше прыжок, чаще Щелбан, потом проходит', () => {
  const map = arena();
  const C = ITEMS.cigarette;
  const plain = nikichAt(map, 20);
  const normalJump = jumpHeight(nikichAt(map, 30), map);
  const n = nikichAt(map, 5);
  applyItem(n, 'cigarette', newRun());
  assert.equal(n.effects.smoke, C.boostTime);
  assert.ok(Math.abs(movementMods(n).speedMul - C.speedMul) < 1e-9);
  assert.ok(jumpHeight(nikichAt(map, 5), map) > 0);
  const fast = nikichAt(map, 10);
  applyItem(fast, 'cigarette', newRun());
  assert.ok(jumpHeight(fast, map) > normalJump * 1.15, 'прыжок выше');
  tryShoot(plain);
  tryShoot(n);
  assert.ok(Math.abs(n.cooldowns.shot - plain.cooldowns.shot / C.shotRateMul) < 1e-9, 'Щелбан чаще');
  run(n, map, IDLE, Math.ceil(C.boostTime * 60) + 1);
  assert.equal(n.effects.smoke, 0);
  assert.equal(movementMods(n).speedMul, 1);
});

test('Сигарета на Уровне без таймера ничего не ломает', () => {
  const r = { ...newRun(), timer: null };
  const res = applyItem(createNikich(0, 0), 'cigarette', r);
  assert.equal(res.floater, null);
});

test('Покерная фишка: Удача на время и «Легендарная игра»', () => {
  const n = createNikich(0, 0);
  const res = applyItem(n, 'chip', newRun());
  assert.equal(n.effects.luck, ITEMS.chip.luckTime);
  assert.equal(res.speech, 'chip');
  assert.equal(res.floater, null);
});

// ---------- Пиво 0,0 ----------

test('Пиво 0,0: здоровье не трогает, Никич медленнее и прыгает ниже, потом трезвеет', () => {
  const map = arena();
  const B = ITEMS.beerZero;
  const n = nikichAt(map, 5);
  const normalJump = jumpHeight(nikichAt(map, 20), map);
  const res = applyItem(n, 'beerZero', newRun());
  assert.equal(n.health, n.maxHealth);
  assert.equal(res.lifeLost, false);
  assert.equal(res.speech, 'beerZero');
  assert.equal(n.drunk, 1);
  assert.ok(Math.abs(movementMods(n).speedMul - (1 - B.speedPerStack)) < 1e-9);
  run(n, map, RUN, 90);
  assert.ok(Math.abs(n.body.vx - PHYSICS.runSpeed * (1 - B.speedPerStack)) < 1e-6, `vx ${n.body.vx}`);
  assert.ok(jumpHeight(n, map) < normalJump, 'прыжок ниже');
  run(n, map, IDLE, Math.ceil(B.duration * 60) + 2);
  assert.equal(n.drunk, 0);
  assert.equal(movementMods(n).speedMul, 1, 'протрезвел');
});

test('Пиво 0,0 подряд: опьянение копится до предела и уходит по уровню', () => {
  const map = arena();
  const B = ITEMS.beerZero;
  const one = nikichAt(map, 5);
  applyItem(one, 'beerZero', newRun());
  const n = nikichAt(map, 5);
  for (let i = 0; i < B.maxStacks + 2; i++) applyItem(n, 'beerZero', newRun());
  assert.equal(n.drunk, B.maxStacks);
  assert.ok(movementMods(n).speedMul < movementMods(one).speedMul, 'пьянее — медленнее');
  assert.ok(movementMods(n).accelMul < movementMods(one).accelMul, 'и разгон вязче');
  run(n, map, IDLE, Math.ceil(B.duration * 60) + 1);
  assert.equal(n.drunk, B.maxStacks - 1);
  run(n, map, IDLE, Math.ceil(B.stackTime * 60) + 1);
  assert.equal(n.drunk, B.maxStacks - 2);
});

test('Пиво 0,0: вялый разгон — до полной скорости дольше', () => {
  const map = arena();
  const sober = nikichAt(map, 5);
  const drunk = nikichAt(map, 5);
  applyItem(drunk, 'beerZero', newRun());
  run(sober, map, RUN, 4);
  run(drunk, map, RUN, 4);
  assert.ok(drunk.body.vx < sober.body.vx * 0.7, `${drunk.body.vx} против ${sober.body.vx}`);
});

test('Пиво 0,0: Щелбан сильнее, удары Зожников слабее', () => {
  const B = ITEMS.beerZero;
  const n = createNikich(100, 100);
  applyItem(n, 'beerZero', newRun());
  applyItem(n, 'beerZero', newRun());
  const shot = tryShoot(n);
  assert.ok(Math.abs(shot.damage - ATTACKS.shot.damage * (1 + 2 * B.shotDamagePerStack)) < 1e-9);
  takeDamage(n, 20, 0);
  assert.ok(Math.abs(n.health - (n.maxHealth - 20 * (1 - 2 * B.armorPerStack))) < 1e-9, `здоровье ${n.health}`);
});

test('Пиво 0,0: прицел догоняет курсор с запаздыванием, трезвый — сразу', async () => {
  const { steerAim } = await import('../src/nikich.js');
  const sober = createNikich(100, 100);
  steerAim(sober, 100, 300, DT);
  assert.ok(sober.aim.y > 0.99, 'трезвый смотрит вниз сразу');
  const drunk = createNikich(100, 100);
  applyItem(drunk, 'beerZero', newRun());
  steerAim(drunk, 100, 300, DT);
  assert.ok(drunk.aim.y < 0.3, 'один кадр — почти не повернулся');
  for (let i = 0; i < 90; i++) steerAim(drunk, 100, 300, DT);
  assert.ok(drunk.aim.y > 0.95, 'за 1,5 с довернулся');
});

test('«Железная печень» вдвое укорачивает Пиво 0,0', () => {
  const n = createNikich(0, 0);
  n.mods.beerTimeMul = 0.5;
  applyItem(n, 'beerZero', newRun());
  assert.equal(n.effects.beer, ITEMS.beerZero.duration / 2);
  assert.equal(n.health, n.maxHealth);
});

// ---------- Самокат ----------

test('Самокат: скорость ×2 и прыжок выше на 50%', () => {
  const map = arena();
  const normalJump = jumpHeight(nikichAt(map, 20), map);
  const n = nikichAt(map, 2);
  applyItem(n, 'scooter', newRun());
  assert.equal(isRiding(n), true);
  run(n, map, RUN, 60);
  assert.ok(Math.abs(n.body.vx - PHYSICS.runSpeed * 2) < 1e-6);
  const n2 = nikichAt(map, 10);
  applyItem(n2, 'scooter', newRun());
  const high = jumpHeight(n2, map);
  assert.ok(Math.abs(high / normalJump - 1.5) < 0.06, `${high} / ${normalJump}`);
});

test('Самокат пролетает Барьер', () => {
  const map = arena((r) => { for (let y = 3; y < 7; y++) put(r, 15, y, 'B'); });
  const walker = nikichAt(map, 10);
  run(walker, map, RUN, 120);
  assert.ok(walker.body.x + walker.body.w <= 15 * TS + 1e-9, 'пешком не пройти');
  const n = nikichAt(map, 10);
  applyItem(n, 'scooter', newRun());
  run(n, map, RUN, 60);
  assert.ok(n.body.x > 16 * TS, 'на Самокате проехал');
});

test('Самокат кончается через 10 с — Никич падает и оглушён 1 с', () => {
  const map = arena();
  const n = nikichAt(map, 2);
  applyItem(n, 'scooter', newRun());
  const ev = run(n, map, IDLE, 10 * 60 + 1);
  assert.equal(isRiding(n), false);
  assert.ok(ev.some((e) => e.scooterEnded));
  assert.ok(n.stun > 0.9);
  const x = n.body.x;
  run(n, map, RUN, 30);
  assert.equal(n.body.x, x, 'лежит');
  assert.equal(tryShoot(n), null);
});

test('Самокат слетает при ударе о стену на скорости', () => {
  const map = arena((r) => { for (let y = 0; y < 7; y++) put(r, 20, y, '#'); });
  const n = nikichAt(map, 5);
  applyItem(n, 'scooter', newRun());
  const ev = run(n, map, RUN, 120);
  assert.equal(isRiding(n), false);
  assert.ok(ev.some((e) => e.scooterEnded));
  assert.ok(n.stun > 0);
});

test('медленно упереться в стену на Самокате — не падение', () => {
  const map = arena((r) => { for (let y = 0; y < 7; y++) put(r, 6, y, '#'); });
  const n = nikichAt(map, 5);
  n.body.x = 6 * TS - n.body.w - 0.5;
  applyItem(n, 'scooter', newRun());
  run(n, map, RUN, 10);
  assert.equal(isRiding(n), true);
});

test('Самокат сбивает Зожников: урон 30, не чаще раза в полсекунды', () => {
  const map = arena();
  const n = nikichAt(map, 5);
  applyItem(n, 'scooter', newRun());
  const z = createZoznik('moto', n.body.x, n.body.y - 2);
  const hits = ramZozniki(n, [z]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].dealt, ITEMS.scooter.ramDamage);
  assert.notEqual(z.body.vx, 0, 'отброшен');
  assert.equal(ramZozniki(n, [z]).length, 0, 'перезарядка');
  const walker = nikichAt(map, 30);
  const z2 = createZoznik('moto', walker.body.x, walker.body.y);
  assert.equal(ramZozniki(walker, [z2]).length, 0, 'пешком не сбивает');
});

test('пока Никич на Самокате, второй Самокат не подбирается', () => {
  const map = arena();
  const n = nikichAt(map, 5);
  applyItem(n, 'scooter', newRun());
  const items = [createItem('scooter', n.body.x + 5, n.body.y + 11)];
  assert.equal(collectItems(items, n).length, 0);
  assert.equal(items.length, 1);
});

test('потеря жизни сбрасывает эффекты Предметов', () => {
  const n = createNikich(0, 0);
  n.effects = { vodka: 5, beer: 3, scooter: 7, luck: 0 };
  n.health = 5;
  const r = takeDamage(n, 10, 0);
  assert.equal(r.lifeLost, true);
  assert.deepEqual(n.effects, { vodka: 0, beer: 0, scooter: 0, smoke: 0, luck: 0 });
});

// ---------- Предметы на карте и выпадение ----------

test('предметы из карты — в центре тайла и висят', () => {
  const map = arena();
  const [it] = itemsFromMap([{ type: 'chip', tx: 3, ty: 2 }], TS);
  assert.deepEqual([it.x, it.y], [3 * TS + 8, 2 * TS + 8]);
  updateItems([it], 1, map, PHYSICS);
  assert.deepEqual([it.x, it.y], [3 * TS + 8, 2 * TS + 8]);
});

test('выпавший из Зожника предмет подскакивает и ложится на пол', () => {
  const map = arena();
  const items = [createItem('beerZero', 10 * TS, FLOOR_Y - 20, { drop: true })];
  let minY = items[0].y;
  for (let i = 0; i < 120; i++) {
    updateItems(items, DT, map, PHYSICS);
    minY = Math.min(minY, items[0].y);
  }
  assert.ok(minY < FLOOR_Y - 26, 'подскочил');
  assert.equal(items[0].y + ITEMS.size / 2, FLOOR_Y);
});

test('предмет, упавший в Яму, исчезает', () => {
  const map = arena((r) => { put(r, 10, 7, '.'); });
  const items = [createItem('hotdog', 10 * TS + 8, FLOOR_Y - 8, { drop: true, popVelocity: 0 })];
  for (let i = 0; i < 120; i++) updateItems(items, DT, map, PHYSICS);
  assert.equal(items.length, 0);
});

test('подбор: только при касании', () => {
  const map = arena();
  const n = nikichAt(map, 5);
  const items = [createItem('hotdog', n.body.x + 5, n.body.y + 11), createItem('chip', n.body.x + 100, n.body.y)];
  const picked = collectItems(items, n);
  assert.deepEqual(picked.map((p) => p.type), ['hotdog']);
  assert.deepEqual(items.map((p) => p.type), ['chip']);
});

test('выпадение: Пиво 0,0 10%, Бонус 5%, иначе ничего', () => {
  assert.equal(rollLoot(() => 0.05), 'beerZero');
  let call = 0;
  assert.equal(rollLoot(() => (call++ === 0 ? 0.12 : 0)), DROPS.bonusKinds[0]);
  assert.equal(rollLoot(() => 0.5), null);
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const counts = { beer: 0, bonus: 0 };
  for (let i = 0; i < 20000; i++) {
    const r = rollLoot(rng);
    if (r === 'beerZero') counts.beer++;
    else if (r) counts.bonus++;
  }
  assert.ok(counts.beer > 1700 && counts.beer < 2300, `пиво ${counts.beer}`);
  assert.ok(counts.bonus > 800 && counts.bonus < 1200, `бонусы ${counts.bonus}`);
});

test('неизвестный предмет — ошибка', () => {
  assert.throws(() => createItem('nope', 0, 0), /Неизвестный предмет/);
});
