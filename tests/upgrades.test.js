import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  UPGRADE_IDS, rollChoices, applyUpgrade, applyUpgrades, extraScooterDefs, isUpgrade,
} from '../src/upgrades.js';
import { createNikich, updateNikich, movementMods, tryShoot } from '../src/nikich.js';
import { createItem, attractItems, applyItem } from '../src/items.js';
import { parseMap } from '../src/world.js';
import { isBlocking } from '../src/physics.js';
import { UPGRADE_TEXT } from '../src/lines.js';
import { LEVELS } from '../src/levels/index.js';
import { PHYSICS, TILE_SIZE, LOOP, ATTACKS, ITEMS, NIKICH, UPGRADES } from '../src/config.js';

const TS = TILE_SIZE;
const DT = LOOP.step;

// Детерминированный rng (mulberry32)
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('пул — 11 Улучшений из SPEC §8, у каждого есть название, эффект и подпись', () => {
  assert.equal(UPGRADE_IDS.length, 11);
  assert.equal(new Set(UPGRADE_IDS).size, 11);
  for (const id of UPGRADE_IDS) {
    const t = UPGRADE_TEXT[id];
    assert.ok(t && t.name && t.effect && t.joke, id);
  }
  assert.deepEqual(Object.keys(UPGRADE_TEXT).sort(), [...UPGRADE_IDS].sort());
});

test('тройка: 3 разных Улучшения из пула, на тысяче бросков', () => {
  const rng = seeded(7);
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const c = rollChoices(rng);
    assert.equal(c.length, UPGRADES.choices);
    assert.equal(new Set(c).size, c.length, `повтор в тройке: ${c}`);
    for (const id of c) {
      assert.ok(isUpgrade(id));
      seen.add(id);
    }
  }
  assert.equal(seen.size, UPGRADE_IDS.length, 'каждое Улучшение когда-нибудь выпадает');
});

test('тройка не ломается на краях rng и маленьком пуле', () => {
  assert.equal(new Set(rollChoices(() => 0)).size, 3);
  assert.equal(new Set(rollChoices(() => 0.9999999)).size, 3);
  assert.deepEqual(rollChoices(() => 0, 3, ['a', 'b']).sort(), ['a', 'b']);
});

test('Сало в крови: +10 к макс. здоровью, и здоровье тоже', () => {
  const n = createNikich(0, 0);
  applyUpgrade(n, 'salo');
  assert.equal(n.maxHealth, NIKICH.maxHealth + 10);
  assert.equal(n.health, n.maxHealth);
});

test('Тяжёлая рука: +10% к урону, складывается', () => {
  const n = createNikich(0, 0);
  applyUpgrades(n, ['heavy-hand', 'heavy-hand']);
  assert.ok(Math.abs(n.mods.damageMul - 1.21) < 1e-9);
});

test('Опаздывает в бар: бег на 10% быстрее', () => {
  const map = parseMap(['.'.repeat(80), '.'.repeat(80), '#'.repeat(80)], TS);
  const run = (ids) => {
    const n = createNikich(TS, 0);
    n.body.y = TS * 2 - n.body.h;
    applyUpgrades(n, ids);
    for (let i = 0; i < 120; i++) updateNikich(n, { move: 1, jumpPressed: false, jumpHeld: false, dropHeld: false }, DT, map, PHYSICS);
    return n.body.vx;
  };
  assert.ok(Math.abs(run([]) - PHYSICS.runSpeed) < 1e-6);
  assert.ok(Math.abs(run(['late-for-bar']) - PHYSICS.runSpeed * 1.1) < 1e-6);
  const n = createNikich(0, 0);
  applyUpgrade(n, 'late-for-bar');
  assert.ok(Math.abs(movementMods(n).speedMul - 1.1) < 1e-9);
});

test('Курит как паровоз: перезарядка Щелбана ×0,85', () => {
  const n = createNikich(0, 0);
  applyUpgrade(n, 'chain-smoker');
  assert.ok(tryShoot(n));
  assert.ok(Math.abs(n.cooldowns.shot - ATTACKS.shot.cooldown * 0.85) < 1e-9);
});

test('Папа, Собака, Печень, 5:0 — множители и прибавки', () => {
  const n = createNikich(0, 0);
  applyUpgrades(n, ['dad-coming', 'angry-dog', 'iron-liver', 'five-zero']);
  assert.equal(n.mods.superChargeMul, 1.2);
  assert.equal(n.mods.dogHoldBonus, 1);
  assert.equal(n.mods.beerDamageMul, 0.5);
  assert.equal(n.mods.stunRadiusMul, 1.2);
});

test('Железная печень: Пиво 0,0 отнимает вдвое меньше', () => {
  const n = createNikich(0, 0);
  applyUpgrade(n, 'iron-liver');
  applyItem(n, 'beerZero', { timer: null, score: 0, stats: { kills: 0, shots: 0, deaths: 0, time: 0 } });
  assert.equal(n.health, NIKICH.maxHealth - ITEMS.beerZero.damage / 2);
});

test('Прыгучий: второй прыжок в воздухе, без Улучшения — нет', () => {
  const map = parseMap(Array.from({ length: 20 }, (_, i) => (i === 19 ? '#' : '.').repeat(10)), TS);
  const peak = (ids) => {
    const n = createNikich(TS * 4, 0);
    n.body.y = TS * 19 - n.body.h;
    applyUpgrades(n, ids);
    const idle = { move: 0, jumpPressed: false, jumpHeld: true, dropHeld: false };
    updateNikich(n, { ...idle, jumpPressed: true }, DT, map, PHYSICS);
    let top = n.body.y;
    for (let i = 0; i < 200; i++) {
      updateNikich(n, { ...idle, jumpPressed: i === 20 }, DT, map, PHYSICS);
      top = Math.min(top, n.body.y);
    }
    return TS * 19 - n.body.h - top;
  };
  const single = peak([]);
  const double = peak(['bouncy']);
  assert.ok(double > single + TS * 2, `одинарный ${single.toFixed(0)}, двойной ${double.toFixed(0)}`);
});

test('Магнит: Бонус в 80 px летит к Никичу, дальше — нет; Пиво 0,0 и Самокат не тянет', () => {
  const n = createNikich(100, 100);
  applyUpgrade(n, 'magnet');
  const cx = n.body.x + n.body.w / 2;
  const cy = n.body.y + n.body.h / 2;
  const near = createItem('hotdog', cx + 70, cy);
  const far = createItem('chip', cx + 90, cy);
  const trap = createItem('beerZero', cx + 40, cy);
  const ride = createItem('scooter', cx - 40, cy);
  const drop = createItem('vodka', cx, cy - 60, { drop: true });
  const items = [near, far, trap, ride, drop];
  attractItems(items, n, DT, n.mods.magnetRadius, UPGRADES.magnet.speed);
  assert.ok(near.x < cx + 70);
  assert.equal(far.x, cx + 90);
  assert.equal(trap.x, cx + 40);
  assert.equal(ride.x, cx - 40);
  assert.equal(drop.body, null, 'падающий Бонус летит к Никичу, а не падает');
  for (let i = 0; i < 60; i++) attractItems(items, n, DT, n.mods.magnetRadius, UPGRADES.magnet.speed);
  assert.ok(Math.hypot(near.x - cx, near.y - cy) < 1e-6, 'долетает и не перелетает');
});

test('без магнита ничего не тянется', () => {
  const n = createNikich(100, 100);
  const it = createItem('hotdog', 110, 110);
  attractItems([it], n, DT, n.mods.magnetRadius, UPGRADES.magnet.speed);
  assert.equal(it.x, 110);
});

test('Прокатчик: Самокаты справа от старта, на каждом Уровне в свободном тайле', () => {
  const n = createNikich(0, 0);
  applyUpgrades(n, ['renter', 'renter']);
  assert.equal(n.mods.extraScooters, 2);
  for (const [i, L] of LEVELS.entries()) {
    const map = L.build(TS);
    const defs = extraScooterDefs(map, n.mods.extraScooters);
    assert.equal(defs.length, 2);
    for (const d of defs) {
      assert.equal(d.type, 'scooter');
      assert.ok(d.tx > map.spawn.x / TS, `Уровень ${i + 1}: правее старта`);
      assert.ok(!isBlocking(map.get(d.tx, d.ty)), `Уровень ${i + 1}: тайл ${d.tx},${d.ty} свободен`);
    }
  }
  assert.deepEqual(extraScooterDefs(LEVELS[0].build(TS), 0), []);
});

test('неизвестное Улучшение — ошибка', () => {
  assert.throws(() => applyUpgrade(createNikich(0, 0), 'beer-hat'));
});
