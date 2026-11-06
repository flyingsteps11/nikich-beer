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
    items: [], // предметы на месте: { type, tx, ty } (см. items.js)
    checkpoints: [], // Контрольные точки: { tx, ty } — ряд, в котором стоят ноги
    exit: null, // зона выхода: { tx } — дошёл до этого столбца, Уровень пройден
    movers: [], // Трамваи: { tx0, tx1, ty, w, h, speed, pause } (см. createMovers)
    hints: [], // Подсказки управления: { tx, ty, text }
    locks: [],
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

// ---------- Таймер Уровня (SPEC §9) ----------

export function createTimer(seconds) {
  return { left: seconds, expired: false };
}

// true — ровно в тот шаг, когда время вышло
export function updateTimer(timer, dt) {
  if (timer.expired) return false;
  timer.left = Math.max(0, timer.left - dt);
  if (timer.left <= 0) {
    timer.expired = true;
    return true;
  }
  return false;
}

// «мм:сс», округление вверх: 0:01 показывается до самого конца
export function formatTime(seconds) {
  const s = Math.ceil(Math.max(0, seconds) - 1e-9);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- Контрольные точки и выход ----------

// Старт Уровня — нулевая точка; дальше по возрастанию x
export function createCheckpoints(map) {
  const ts = map.tileSize;
  const list = map.checkpoints
    .map((c) => ({ x: c.tx * ts, y: c.ty * ts, tx: c.tx, reached: false }))
    .sort((a, b) => a.x - b.x);
  return { list, current: { x: map.spawn.x, y: map.spawn.y } };
}

// Никич дошёл до точки — она становится местом возврата. Возвращает новую точку или null.
export function updateCheckpoints(cp, body) {
  let reached = null;
  for (const c of cp.list) {
    if (!c.reached && body.x + body.w / 2 >= c.x) {
      c.reached = true;
      cp.current = { x: c.x, y: c.y };
      reached = c;
    }
  }
  return reached;
}

export function reachedExit(map, body) {
  return !!map.exit && body.x + body.w / 2 >= map.exit.tx * map.tileSize;
}

// ---------- Трамвай: движущаяся платформа (SPEC §9, Уровень 3) ----------

// def: крыша ездит левым краем от tx0 до tx1 и обратно, ty — ряд крыши; w, h — в тайлах;
// speed — px/с, pause — с стоянки на конечных.
export function createMovers(defs, ts) {
  return defs.map((d) => ({
    x: d.tx0 * ts,
    y: d.ty * ts,
    w: d.w * ts,
    h: d.h * ts,
    x0: d.tx0 * ts,
    x1: d.tx1 * ts,
    speed: d.speed,
    pause: d.pause,
    dir: 1,
    wait: d.pause,
    dx: 0, // сдвиг за последний шаг — на столько везём стоящего на крыше
  }));
}

export function updateMovers(movers, dt) {
  for (const m of movers) {
    m.dx = 0;
    if (m.wait > 0) {
      m.wait = Math.max(0, m.wait - dt);
      continue;
    }
    const target = m.dir > 0 ? m.x1 : m.x0;
    const step = Math.min(Math.abs(target - m.x), m.speed * dt);
    m.dx = Math.sign(target - m.x) * step;
    m.x += m.dx;
    if (Math.abs(target - m.x) < 1e-6) {
      m.x = target;
      m.dir = -m.dir;
      m.wait = m.pause;
    }
  }
}

function overlapsX(body, m) {
  return body.x < m.x + m.w && body.x + body.w > m.x;
}

// После шага физики: падал сверху на крышу — ставим на неё как на тонкую платформу.
// prevBottom — низ тела до шага. Возвращает Трамвай, на котором стоит тело, или null.
export function landOnMovers(body, movers, prevBottom) {
  if (body.vy < 0 || body.dropTimer > 0) return null;
  const bottom = body.y + body.h;
  for (const m of movers) {
    if (overlapsX(body, m) && prevBottom <= m.y + 1e-6 && bottom >= m.y) {
      body.y = m.y - body.h;
      body.vy = 0;
      body.onGround = true;
      body.groundTile = TILE.THIN; // S — спрыгнуть, как с тонкой платформы
      return m;
    }
  }
  return null;
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

// Детерминированный генератор: один и тот же Уровень — один и тот же фон
// Попадает ли полоса [x - halfW, x + halfW] в кадр по горизонтали (с запасом margin)
export function inView(x, halfW, camX, viewW, margin = 0) {
  return x + halfW >= camX - margin && x - halfW <= camX + viewW + margin;
}

export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ширина слоя: экран плюс путь, который слой проедет за весь Уровень
export function layerWidth(mapPixelWidth, viewW, factor) {
  return Math.ceil(viewW + Math.max(0, mapPixelWidth - viewW) * factor) + 2;
}
