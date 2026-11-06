// Предметы (SPEC §7): Бонусы, ловушка Пиво 0,0, Самокат. Чистая логика, без DOM.

import { createBody, stepPlatformer } from './physics.js';
import { heal, mountScooter, isRiding } from './nikich.js';
import { ITEMS, DROPS } from './config.js';

export const ITEM_TYPES = Object.freeze(['hotdog', 'vodka', 'cigarette', 'chip', 'beerZero', 'scooter']);
// Бонусы — их притягивает «Магнит для халявы»; Пиво 0,0 и Самокат — нет
export const BONUS_TYPES = Object.freeze(['hotdog', 'vodka', 'cigarette', 'chip']);

const IDLE = Object.freeze({ move: 0, jumpPressed: false, jumpHeld: false, dropHeld: false });

// x, y — центр. drop: выпал из Зожника — падает под гравитацией; иначе висит на месте.
export function createItem(type, x, y, { drop = false, popVelocity = DROPS.popVelocity } = {}, I = ITEMS) {
  if (!ITEM_TYPES.includes(type)) throw new Error(`Неизвестный предмет: ${type}`);
  const s = I.size;
  const item = { type, x, y, alive: true, t: 0, body: null };
  if (drop) {
    item.body = createBody(x - s / 2, y - s / 2, s, s);
    item.body.vy = -popVelocity;
  }
  return item;
}

// Записи карты { type, tx, ty } → предметы в центре тайла
export function itemsFromMap(defs, ts) {
  return defs.map((d) => createItem(d.type, d.tx * ts + ts / 2, d.ty * ts + ts / 2));
}

export function updateItems(items, dt, map, P) {
  for (const it of items) {
    it.t += dt;
    if (it.body) {
      stepPlatformer(it.body, IDLE, dt, map, P);
      it.x = it.body.x + it.body.w / 2;
      it.y = it.body.y + it.body.h / 2;
      if (it.body.y > map.pixelHeight) it.alive = false; // упал в Яму
    }
  }
  removeDead(items);
}

// «Магнит для халявы»: Бонусы ближе radius летят к центру Никича со скоростью speed.
// Падающий Бонус перестаёт падать и летит по прямой.
export function attractItems(items, n, dt, radius, speed) {
  if (radius <= 0) return;
  const cx = n.body.x + n.body.w / 2;
  const cy = n.body.y + n.body.h / 2;
  for (const it of items) {
    if (!it.alive || !BONUS_TYPES.includes(it.type)) continue;
    const dx = cx - it.x;
    const dy = cy - it.y;
    const d = Math.hypot(dx, dy);
    if (d > radius || d < 1e-6) continue;
    const k = Math.min(d, speed * dt) / d;
    it.body = null;
    it.x += dx * k;
    it.y += dy * k;
  }
}

export function itemBox(it, I = ITEMS) {
  return { x: it.x - I.size / 2, y: it.y - I.size / 2, w: I.size, h: I.size };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Что Никич подобрал за шаг. Самокат не берётся, пока Никич уже на Самокате.
export function collectItems(items, n, I = ITEMS) {
  const picked = [];
  for (const it of items) {
    if (!it.alive || !overlaps(itemBox(it, I), n.body)) continue;
    if (it.type === 'scooter' && isRiding(n)) continue;
    it.alive = false;
    picked.push(it);
  }
  removeDead(items);
  return picked;
}

// run: { timer, stats } — состояние прохождения Уровня.
// Возвращает: floater — подпись над Никичем, speech — ключ реплики в LINES, lifeLost, gameOver.
export function applyItem(n, type, run, I = ITEMS) {
  const res = { type, floater: null, speech: null, lifeLost: false, gameOver: false };
  switch (type) {
    case 'hotdog': {
      const got = heal(n, I.hotdog.heal);
      res.floater = `+${Math.round(got)}`;
      break;
    }
    case 'vodka':
      n.effects.vodka = I.vodka.duration;
      run.stats.shots += 1;
      res.floater = `+${Math.round((I.vodka.damageMul - 1) * 100)}%`;
      break;
    case 'cigarette':
      n.effects.smoke = I.cigarette.boostTime;
      if (!run.timer) break; // Уровень без таймера — перекур просто так
      run.timer.left += I.cigarette.time;
      res.floater = `+${I.cigarette.time} с`;
      break;
    case 'chip':
      n.effects.luck = I.chip.luckTime;
      res.speech = 'chip';
      break;
    case 'beerZero':
      n.drunk = Math.min(I.beerZero.maxStacks, n.drunk + 1);
      n.effects.beer = I.beerZero.duration * n.mods.beerTimeMul;
      res.speech = 'beerZero';
      break;
    case 'scooter':
      mountScooter(n, I);
      res.speech = 'scooter';
      break;
    default:
      throw new Error(`Неизвестный предмет: ${type}`);
  }
  return res;
}

// Что выпадает из убитого Зожника: Пиво 0,0 (10%), иногда Бонус, чаще ничего
export function rollLoot(rng = Math.random, D = DROPS) {
  const r = rng();
  if (r < D.beerZeroChance) return 'beerZero';
  if (r < D.beerZeroChance + D.bonusChance) return D.bonusKinds[Math.floor(rng() * D.bonusKinds.length)];
  return null;
}

function removeDead(list) {
  let j = 0;
  for (const e of list) if (e.alive) list[j++] = e;
  list.length = j;
}
