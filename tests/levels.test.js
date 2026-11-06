import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TILE, createBody, stepPlatformer, fellOut } from '../src/physics.js';
import { PHYSICS, TILE_SIZE, NIKICH, LOOP, MAP_HEIGHT_TILES, ZOZNIKI } from '../src/config.js';
import { LEVELS } from '../src/levels/index.js';
import { createMap } from '../src/world.js';
import { UI } from '../src/lines.js';

const TS = TILE_SIZE;
const DT = LOOP.step;
const W = NIKICH.hitboxW;
const H = NIKICH.hitboxH;

const isStandable = (t) => t === TILE.SOLID || t === TILE.THIN;
const isFree = (t) => t === TILE.EMPTY || t === TILE.DECOR || t === TILE.PIT;

// Крышу Трамвая решатель считает мостом по всему пути: сама езда проверяется в world.test.js
function withMoverBridges(map) {
  for (const d of map.movers) map.fill(d.tx0, d.ty, d.tx1 + d.w - 1, d.ty, TILE.THIN);
  return map;
}

// Действие: разбег runup кадров (или 'edge' — бежать до края опоры), прыжок с удержанием hold кадров
// (0 — без прыжка), управление в воздухе
function* actions() {
  for (const d of [1, -1]) {
    for (const runup of [0, 10, 'edge']) {
      yield { d, runup, hold: 0, air: 'stop' };
      for (const hold of [4, 12, 60]) {
        for (const air of ['keep', 'stop', 'late']) yield { d, runup, hold, air };
      }
    }
  }
  yield { drop: true };
}

// Под передней ногой кончается опора — пора прыгать
function atEdge(b, d, map) {
  const fx = d > 0 ? b.x + b.w + 1 : b.x - 1;
  return b.onGround && !isStandable(map.get(Math.floor(fx / TS), Math.floor((b.y + b.h + 1) / TS)));
}

function simulate(map, x, y, act, exitX) {
  const a = { ...act };
  const b = createBody(x, y, W, H);
  stepPlatformer(b, { move: 0, jumpPressed: false, jumpHeld: false, dropHeld: false }, DT, map, PHYSICS);
  if (!b.onGround) return null;
  if (a.drop && b.groundTile !== TILE.THIN) return null;
  let landedAt = -1; // после приземления управление отпускаем — Никич тормозит
  for (let f = 0; f < 300; f++) {
    let move = 0;
    let jumpPressed = false;
    let jumpHeld = false;
    if (a.drop) {
      move = 0;
    } else if (a.runup === 'edge' && (f >= 90 || atEdge(b, a.d, map) || (f > 0 && b.vx === 0))) {
      a.runup = f; // упёрся в стену или дошёл до края — отсюда прыжок
      f -= 1;
      continue;
    } else if (a.runup === 'edge' || f < a.runup) {
      move = a.d;
    } else if (a.hold === 0) {
      move = f < a.runup + 8 ? a.d : 0;
    } else {
      const t = f - a.runup;
      jumpPressed = t === 0;
      jumpHeld = t < a.hold;
      if (a.air === 'keep') move = a.d;
      else if (a.air === 'late') move = t < 14 ? a.d : 0;
      if (landedAt >= 0) move = 0;
    }
    stepPlatformer(b, { move, jumpPressed, jumpHeld, dropHeld: !!a.drop && f === 0 }, DT, map, PHYSICS);
    if (b.x + b.w / 2 >= exitX) return 'exit';
    if (fellOut(b, map)) return null;
    if (a.hold > 0 && landedAt < 0 && b.onGround && f > a.runup + 1) landedAt = f;
    const settled = b.onGround && Math.abs(b.vx) < 1;
    const started = a.drop ? f > 2 : f > a.runup + (a.hold === 0 ? 8 : 2);
    if (started && settled) return { x: b.x, y: b.y };
  }
  return null;
}

// Поиск в ширину по местам, где Никич может стоять: дойдёт ли он до зоны выхода пешком
function canFinish(map) {
  const exitX = map.exit.tx * TS;
  const start = { x: map.spawn.x + (TS - W) / 2, y: map.spawn.y + TS - H };
  const key = (p) => `${Math.round(p.x / 3)},${Math.round(p.y)}`;
  const seen = new Set([key(start)]);
  const queue = [start];
  let farthest = start.x;
  while (queue.length) {
    const p = queue.shift();
    for (const a of actions()) {
      const r = simulate(map, p.x, p.y, a, exitX);
      if (r === 'exit') return { ok: true };
      if (!r) continue;
      const k = key(r);
      if (seen.has(k)) continue;
      seen.add(k);
      farthest = Math.max(farthest, r.x);
      queue.push(r);
    }
  }
  return { ok: false, farthestTx: Math.floor(farthest / TS) };
}

// Решатель не должен быть слишком добрым: непроходимое он видит
function strip(widthTiles) {
  const m = createMap(widthTiles, MAP_HEIGHT_TILES, TS);
  m.fill(0, 15, widthTiles - 1, MAP_HEIGHT_TILES - 1, TILE.SOLID);
  m.spawn = { x: 2 * TS, y: 14 * TS };
  m.exit = { tx: widthTiles - 3 };
  return m;
}

test('решатель: Яма в 4 тайла перепрыгивается, в 7 — нет; стену в 5 тайлов не взять', () => {
  const ok = strip(40);
  ok.fill(15, 15, 18, 16, TILE.EMPTY);
  assert.ok(canFinish(ok).ok);
  const wide = strip(40);
  wide.fill(15, 15, 21, 16, TILE.EMPTY);
  assert.equal(canFinish(wide).ok, false);
  const wall = strip(40);
  wall.fill(15, 10, 15, 14, TILE.SOLID);
  assert.equal(canFinish(wall).ok, false);
  const barrier = strip(40);
  barrier.fill(15, 10, 15, 14, TILE.BARRIER);
  assert.equal(canFinish(barrier).ok, false, 'пешком Барьер не пройти');
});

test('Уровень 3 без Трамвая не пройти — крыша Трамвая и правда нужна', () => {
  assert.equal(canFinish(LEVELS[2].build(TS)).ok, false);
});

LEVELS.forEach((level, i) => {
  const n = i + 1;
  test(`Уровень ${n}: проходится пешком от старта до выхода`, () => {
    const map = withMoverBridges(level.build(TS));
    const r = canFinish(map);
    assert.ok(r.ok, `застрял около тайла ${r.farthestTx}`);
  });

  test(`Уровень ${n}: размеры, точка появления и выход`, () => {
    const map = level.build(TS);
    assert.equal(map.height, MAP_HEIGHT_TILES);
    if (level.arena) assert.equal(map.width * TS, 480, 'арена — ровно экран');
    else assert.ok(map.width >= 150 && map.width <= 220, `длина ${map.width}`);
    assert.ok(map.exit && map.exit.tx < map.width);
    const sx = Math.floor(map.spawn.x / TS);
    const sy = Math.floor(map.spawn.y / TS);
    assert.ok(isFree(map.get(sx, sy)) && isStandable(map.get(sx, sy + 1)), 'старт стоит на опоре');
  });

  test(`Уровень ${n}: Контрольные точки, Предметы, трамплины и Подсказки на своих местах`, () => {
    const map = level.build(TS);
    if (!level.arena) assert.ok(map.checkpoints.length >= 2 && map.checkpoints.length <= 3, 'SPEC §9: 2–3 точки');
    for (const c of map.checkpoints) {
      assert.ok(isFree(map.get(c.tx, c.ty)) && isStandable(map.get(c.tx, c.ty + 1)), `точка ${c.tx} на опоре`);
    }
    for (const it of map.items) assert.ok(isFree(map.get(it.tx, it.ty)), `${it.type} в ${it.tx},${it.ty} не в стене`);
    for (const r of map.ramps) assert.ok(isStandable(map.get(r.tx, r.ty + 1)), `трамплин ${r.tx} на земле`);
    for (const h of map.hints) assert.equal(typeof UI[h.text], 'string', `подсказка ${h.text} есть в lines.js`);
    for (const s of map.spawns) {
      if (s.type === 'point' || s.type === 'door') assert.ok(isFree(map.get(s.tx, s.ty)), `появление в ${s.tx},${s.ty} не в стене`);
      for (const k of s.kinds ?? [s.kind]) assert.ok(k in ZOZNIKI, k);
    }
    assert.equal(typeof UI.levelNames[i], 'string', 'название Уровня');
  });
});

function kindsOf(map) {
  return new Set(map.spawns.flatMap((s) => s.kinds ?? [s.kind]));
}

function hasPit(map) {
  for (let tx = 0; tx < map.width; tx++) if (!isStandable(map.get(tx, map.height - 1))) return true;
  return false;
}

function count(map, tile) {
  return map.tiles.filter((t) => t === tile).length;
}

test('Зожники по Уровням — как в таблице SPEC §9', () => {
  const k = LEVELS.map((l) => kindsOf(l.build(TS)));
  assert.deepEqual([...k[0]], ['runner']);
  assert.deepEqual([...k[1]].sort(), ['runner', 'smoothie']);
  assert.deepEqual([...k[2]].sort(), ['runner', 'smoothie', 'yoga']);
  assert.ok(k[3].has('cyclist') && k[3].has('moto'));
});

test('Уровень 1 без Ям, Ямы — со второго', () => {
  const maps = LEVELS.map((l) => l.build(TS));
  assert.equal(hasPit(maps[0]), false);
  assert.ok(hasPit(maps[1]));
});

test('Самокаты — с Уровня 3; Барьеры только там, где есть Самокат', () => {
  const maps = LEVELS.map((l) => l.build(TS));
  maps.forEach((m, i) => {
    const scooters = m.items.filter((it) => it.type === 'scooter').length;
    if (i < 2) assert.equal(scooters, 0, `Уровень ${i + 1}`);
    if (count(m, TILE.BARRIER) > 0) assert.ok(scooters > 0, `Уровень ${i + 1}: Барьер без Самоката`);
  });
  assert.ok(maps[2].items.some((it) => it.type === 'scooter'));
});

test('Трамвай — на Уровне 3; трамплины — на Уровне 4', () => {
  const maps = LEVELS.map((l) => l.build(TS));
  assert.equal(maps[2].movers.length, 1);
  assert.ok(maps[3].ramps.length > 0);
});

function standingSpots(map) {
  const start = { x: map.spawn.x + (TS - W) / 2, y: map.spawn.y + TS - H };
  const key = (p) => `${Math.round(p.x / 3)},${Math.round(p.y)}`;
  const seen = new Map([[key(start), start]]);
  const queue = [start];
  while (queue.length) {
    const p = queue.shift();
    for (const a of actions()) {
      const r = simulate(map, p.x, p.y, a, Infinity);
      if (!r || r === 'exit' || seen.has(key(r))) continue;
      seen.set(key(r), r);
      queue.push(r);
    }
  }
  return [...seen.values()];
}

test('Запертые волны: 2–3 на Уровнях 1–4, без Ям и Контрольных точек внутри, Зожники — те же, что на Уровне', () => {
  LEVELS.forEach((level, i) => {
    const map = level.build(TS);
    if (level.arena) { assert.equal(map.locks.length, 0); return; }
    assert.ok(map.locks.length >= 2 && map.locks.length <= 3, `Уровень ${i + 1}: ${map.locks.length}`);
    const kinds = kindsOf(map);
    for (const l of map.locks) {
      const w = l.tx1 - l.tx0 + 1;
      assert.ok(w >= 15 && w <= 26, `ширина ${w}`);
      for (let tx = l.tx0; tx <= l.tx1; tx++) assert.equal(map.get(tx, map.height - 1), TILE.SOLID, `Яма в ${tx}`);
      for (const c of map.checkpoints) assert.ok(c.tx < l.tx0 || c.tx > l.tx1, `точка ${c.tx} внутри`);
      assert.ok(l.tx0 * TS > map.spawn.x && l.tx1 < map.exit.tx, 'между стартом и выходом');
      assert.equal(l.waves.length, 2, 'две короткие волны');
      for (const wave of l.waves) {
        assert.ok(wave.length >= 2 && wave.length <= 3, `волна из ${wave.length}`);
        for (const k of wave) assert.ok(kinds.has(k), `${k} не водится на Уровне ${i + 1}`);
      }
    }
  });
});

test('Арена: на каждую платформу G-man Никич запрыгивает', () => {
  const map = LEVELS[4].build(TS);
  const spots = standingSpots(map);
  for (const p of map.arena.perches) {
    const feet = (p.ty + 1) * TS;
    const ok = spots.some((s) => Math.abs(s.y + H - feet) < 0.5 && Math.abs(s.x + W / 2 - (p.tx * TS + TS / 2)) < 3 * TS);
    assert.ok(ok, `платформа у тайла ${p.tx}`);
  }
});

test('Таймер Уровня — на 1–4, на Уровне 5 только жизни', () => {
  assert.deepEqual(LEVELS.map((l) => l.timed), [true, true, true, true, false]);
});
