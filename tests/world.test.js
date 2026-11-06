import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TILE, createBody } from '../src/physics.js';
import {
  parseMap, createMap, createCamera, updateCamera, snapCamera,
  createTimer, updateTimer, formatTime, createCheckpoints, updateCheckpoints, reachedExit,
} from '../src/world.js';
import { CAMERA, SCREEN, TILE_SIZE, LOOP, MAP_HEIGHT_TILES } from '../src/config.js';
import { buildTestMap } from '../src/levels/test.js';

const TS = TILE_SIZE;

test('parseMap: размеры, тайлы и точка появления', () => {
  const map = parseMap(['..N.', '-B~#'], TS);
  assert.equal(map.width, 4);
  assert.equal(map.height, 2);
  assert.deepEqual(map.spawn, { x: 2 * TS, y: 0 });
  assert.equal(map.get(0, 1), TILE.THIN);
  assert.equal(map.get(1, 1), TILE.BARRIER);
  assert.equal(map.get(2, 1), TILE.DECOR);
  assert.equal(map.get(3, 1), TILE.SOLID);
  assert.equal(map.get(2, 0), TILE.EMPTY);
});

test('parseMap: неизвестный символ — понятная ошибка', () => {
  assert.throws(() => parseMap(['.?.'], TS), /Неизвестный тайл/);
});

test('за краями карты: по бокам стена, сверху и снизу пусто', () => {
  const map = createMap(3, 3, TS);
  assert.equal(map.get(-1, 1), TILE.SOLID);
  assert.equal(map.get(3, 1), TILE.SOLID);
  assert.equal(map.get(1, -1), TILE.EMPTY);
  assert.equal(map.get(1, 3), TILE.EMPTY);
});

test('fill заполняет прямоугольник включительно', () => {
  const map = createMap(5, 5, TS);
  map.fill(1, 1, 3, 2, TILE.SOLID);
  let n = 0;
  for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === TILE.SOLID) n++;
  assert.equal(n, 6);
});

function wideMap() {
  return createMap(200, MAP_HEIGHT_TILES, TS);
}

test('камера не выходит за границы карты', () => {
  const map = wideMap();
  const cam = createCamera(SCREEN.width, SCREEN.height);
  const b = createBody(0, 0, 10, 22);
  snapCamera(cam, b, map, CAMERA);
  assert.equal(cam.x, 0);
  assert.equal(cam.y, 0);
  b.x = map.pixelWidth - 10;
  b.y = map.pixelHeight;
  snapCamera(cam, b, map, CAMERA);
  assert.equal(cam.x, map.pixelWidth - SCREEN.width);
  assert.equal(cam.y, map.pixelHeight - SCREEN.height);
});

test('камера смотрит вперёд по направлению бега', () => {
  const map = wideMap();
  const cam = createCamera(SCREEN.width, SCREEN.height);
  const b = createBody(1000, 100, 10, 22);
  b.vx = 110;
  for (let i = 0; i < 120; i++) updateCamera(cam, b, map, LOOP.step, CAMERA);
  const center = cam.x + SCREEN.width / 2;
  assert.ok(center > b.x + b.w / 2 + CAMERA.lookAhead * 0.9, 'впереди справа');

  b.vx = -110;
  for (let i = 0; i < 180; i++) updateCamera(cam, b, map, LOOP.step, CAMERA);
  const center2 = cam.x + SCREEN.width / 2;
  assert.ok(center2 < b.x + b.w / 2 - CAMERA.lookAhead * 0.9, 'развернулась влево');
});

test('остановился — упреждение не дёргается', () => {
  const map = wideMap();
  const cam = createCamera(SCREEN.width, SCREEN.height);
  const b = createBody(1000, 100, 10, 22);
  b.vx = 110;
  for (let i = 0; i < 120; i++) updateCamera(cam, b, map, LOOP.step, CAMERA);
  const look = cam.lookAhead;
  b.vx = 0;
  for (let i = 0; i < 60; i++) updateCamera(cam, b, map, LOOP.step, CAMERA);
  assert.equal(cam.lookAhead, look);
});

test('вертикаль сглажена: камера догоняет постепенно', () => {
  const map = wideMap();
  const cam = createCamera(SCREEN.width, SCREEN.height);
  const b = createBody(1000, 200, 10, 22);
  snapCamera(cam, b, map, CAMERA);
  const y0 = cam.y;
  b.y = 120;
  updateCamera(cam, b, map, LOOP.step, CAMERA);
  const y1 = cam.y;
  assert.ok(y1 < y0 && y1 > y0 - 80 * 0.5, 'за один кадр сдвинулась частично');
});

test('тестовая карта: высота 17 тайлов, есть пол под точкой появления', () => {
  const map = buildTestMap(TS);
  assert.equal(map.height, MAP_HEIGHT_TILES);
  assert.ok(map.width >= 100);
  const tx = Math.floor(map.spawn.x / TS);
  let floor = -1;
  for (let ty = Math.floor(map.spawn.y / TS); ty < map.height; ty++) {
    if (map.get(tx, ty) === TILE.SOLID) { floor = ty; break; }
  }
  assert.ok(floor > 0, 'под точкой появления есть пол');
});

// ---------- Таймер Уровня ----------

test('таймер: 180 с истекают ровно один раз', () => {
  const t = createTimer(180);
  let fired = 0;
  for (let i = 0; i < 180 * 60 - 1; i++) if (updateTimer(t, LOOP.step)) fired++;
  assert.equal(fired, 0);
  assert.equal(t.expired, false);
  for (let i = 0; i < 5; i++) if (updateTimer(t, LOOP.step)) fired++;
  assert.equal(fired, 1);
  assert.equal(t.left, 0);
  assert.equal(updateTimer(t, 1), false, 'дальше не срабатывает');
});

test('таймер: добавка времени отодвигает конец', () => {
  const t = createTimer(1);
  updateTimer(t, 0.5);
  t.left += 15;
  for (let i = 0; i < 15 * 60; i++) updateTimer(t, LOOP.step);
  assert.equal(t.expired, false);
  for (let i = 0; i < 60; i++) updateTimer(t, LOOP.step);
  assert.equal(t.expired, true);
});

test('таймер: формат мм:сс с округлением вверх', () => {
  assert.equal(formatTime(180), '3:00');
  assert.equal(formatTime(179.2), '3:00');
  assert.equal(formatTime(59.01), '1:00');
  assert.equal(formatTime(9), '0:09');
  assert.equal(formatTime(0.2), '0:01');
  assert.equal(formatTime(0), '0:00');
});

// ---------- Контрольные точки и выход ----------

test('контрольные точки: возврат на последнюю пройденную', () => {
  const map = createMap(100, 10, TS);
  map.spawn = { x: 2 * TS, y: 8 * TS };
  map.checkpoints = [{ tx: 60, ty: 6 }, { tx: 30, ty: 8 }];
  const cp = createCheckpoints(map);
  assert.deepEqual(cp.current, { x: 2 * TS, y: 8 * TS }, 'сначала — старт');
  const b = createBody(20 * TS, 0, 10, 22);
  assert.equal(updateCheckpoints(cp, b), null);
  b.x = 31 * TS;
  assert.equal(updateCheckpoints(cp, b).tx, 30);
  assert.deepEqual(cp.current, { x: 30 * TS, y: 8 * TS });
  b.x = 10 * TS; // вернулся назад — точка не теряется
  updateCheckpoints(cp, b);
  assert.deepEqual(cp.current, { x: 30 * TS, y: 8 * TS });
  b.x = 61 * TS;
  updateCheckpoints(cp, b);
  assert.deepEqual(cp.current, { x: 60 * TS, y: 6 * TS });
});

test('выход: Уровень пройден у столбца выхода', () => {
  const map = createMap(100, 10, TS);
  const b = createBody(0, 0, 10, 22);
  assert.equal(reachedExit(map, b), false, 'без выхода — никогда');
  map.exit = { tx: 90 };
  b.x = 89 * TS;
  assert.equal(reachedExit(map, b), false);
  b.x = 90 * TS;
  assert.equal(reachedExit(map, b), true);
});
