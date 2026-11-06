// Тайловая карта и камера (SPEC §9). Чистая логика; отрисовка принимает ctx параметром.

import { TILE } from './physics.js';

export function createMap(width, height, tileSize) {
  const tiles = new Uint8Array(width * height);
  return {
    width,
    height,
    tileSize,
    tiles,
    pixelWidth: width * tileSize,
    pixelHeight: height * tileSize,
    spawn: { x: tileSize, y: 0 },
    ramps: [], // трамплины для Мотоциклиста: клетка {tx, ty}, в которой стоят колёса
    spawns: [], // записи появления Зожников (см. createSpawner в zozniki.js)
    // За левым и правым краем — стена, над картой и под ней — пусто (там Яма).
    get(tx, ty) {
      if (tx < 0 || tx >= width) return TILE.SOLID;
      if (ty < 0 || ty >= height) return TILE.EMPTY;
      return tiles[ty * width + tx];
    },
    set(tx, ty, t) {
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) return;
      tiles[ty * width + tx] = t;
    },
    // Прямоугольник тайлов включительно
    fill(x0, y0, x1, y1, t) {
      for (let ty = Math.min(y0, y1); ty <= Math.max(y0, y1); ty++) {
        for (let tx = Math.min(x0, x1); tx <= Math.max(x0, x1); tx++) this.set(tx, ty, t);
      }
    },
  };
}

// Карта из строк: каждая строка — ряд тайлов, символы по легенде.
export const DEFAULT_LEGEND = Object.freeze({
  '.': TILE.EMPTY,
  ' ': TILE.EMPTY,
  '#': TILE.SOLID,
  '-': TILE.THIN,
  'B': TILE.BARRIER,
  'v': TILE.PIT,
  '~': TILE.DECOR,
});

export function parseMap(rows, tileSize, legend = DEFAULT_LEGEND) {
  const width = Math.max(...rows.map((r) => r.length));
  const map = createMap(width, rows.length, tileSize);
  rows.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      if (ch === 'N') {
        map.spawn = { x: tx * tileSize, y: ty * tileSize };
        continue;
      }
      if (!(ch in legend)) throw new Error(`Неизвестный тайл «${ch}» в (${tx}, ${ty})`);
      map.set(tx, ty, legend[ch]);
    }
  });
  return map;
}

// ---------- Камера ----------

export function createCamera(viewW, viewH) {
  return { x: 0, y: 0, viewW, viewH, lookAhead: 0, dir: 1 };
}

function clampCamera(cam, map) {
  cam.x = Math.max(0, Math.min(cam.x, map.pixelWidth - cam.viewW));
  cam.y = Math.max(0, Math.min(cam.y, map.pixelHeight - cam.viewH));
}

function targetPos(cam, body, C) {
  return {
    x: body.x + body.w / 2 + cam.lookAhead - cam.viewW / 2,
    y: body.y + body.h / 2 - cam.viewH * C.verticalAnchor,
  };
}

// Мгновенно поставить камеру на цель (старт, возврат на контрольную точку).
export function snapCamera(cam, body, map, C) {
  cam.lookAhead = C.lookAhead * cam.dir;
  const t = targetPos(cam, body, C);
  cam.x = t.x;
  cam.y = t.y;
  clampCamera(cam, map);
}

export function updateCamera(cam, body, map, dt, C) {
  if (Math.abs(body.vx) >= C.lookAheadMinVx) cam.dir = Math.sign(body.vx);
  const lookTarget = C.lookAhead * cam.dir;
  // Упреждение переезжает с постоянной скоростью — без рывка при развороте
  cam.lookAhead += Math.sign(lookTarget - cam.lookAhead) * Math.min(Math.abs(lookTarget - cam.lookAhead), C.lookAheadSpeed * dt);
  const t = targetPos(cam, body, C);
  const kx = 1 - Math.exp(-C.horizontalSmoothing * dt);
  const ky = 1 - Math.exp(-C.verticalSmoothing * dt);
  cam.x += (t.x - cam.x) * kx;
  cam.y += (t.y - cam.y) * ky;
  clampCamera(cam, map);
}

// ---------- Отрисовка тайлов (временная, пиксель-арт — этап 8) ----------

const TILE_COLORS = {
  [TILE.SOLID]: { body: '#5c5470', top: '#8f86a8', edge: '#3b3548' },
  [TILE.THIN]: { body: '#a0703c', top: '#d29a5a' },
  [TILE.BARRIER]: { a: '#c0392b', b: '#ecf0f1' },
  [TILE.DECOR]: { body: '#2c2c44' },
};

export function drawTiles(ctx, map, cam) {
  const ts = map.tileSize;
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const tx0 = Math.floor(camX / ts);
  const tx1 = Math.floor((camX + cam.viewW) / ts);
  const ty0 = Math.floor(camY / ts);
  const ty1 = Math.floor((camY + cam.viewH) / ts);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
      const t = map.get(tx, ty);
      const x = tx * ts - camX;
      const y = ty * ts - camY;
      const c = TILE_COLORS[t];
      if (!c) continue;
      if (t === TILE.SOLID) {
        ctx.fillStyle = c.body;
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = c.edge;
        ctx.fillRect(x, y + ts - 1, ts, 1);
        ctx.fillRect(x + ts - 1, y, 1, ts);
        if (map.get(tx, ty - 1) !== TILE.SOLID) {
          ctx.fillStyle = c.top;
          ctx.fillRect(x, y, ts, 2);
        }
      } else if (t === TILE.THIN) {
        ctx.fillStyle = c.body;
        ctx.fillRect(x, y, ts, 5);
        ctx.fillStyle = c.top;
        ctx.fillRect(x, y, ts, 2);
      } else if (t === TILE.BARRIER) {
        for (let i = 0; i < ts; i += 4) {
          ctx.fillStyle = (i / 4 + ty) % 2 ? c.a : c.b;
          ctx.fillRect(x + 3, y + i, ts - 6, 4);
        }
      } else if (t === TILE.DECOR) {
        ctx.fillStyle = c.body;
        ctx.fillRect(x, y, ts, ts);
      }
    }
  }
}
