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

// ---------- Параллакс: силуэты Варшавы (SPEC §9, §13) ----------
// theme: { sky: [верх, низ], layers: [{ factor, color, windows?, base, fill, landmarks: [{ type, at, scale }] }] }
// factor — доля скорости камеры; base — px от низа экрана до подножия слоя;
// fill — чем засыпать промежутки: 'blocks' | 'towers' | 'trees' | 'lamps' | 'kamienice' | 'none'.
// makeCanvas(w, h) даёт офскрин-канвас — так модуль не трогает DOM сам.

// Детерминированный генератор: один и тот же Уровень — один и тот же фон
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

function box(g, x, y, w, h) {
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function litWindows(g, x, y, w, h, color, rnd, { step = 4, size = 1, chance = 0.35 } = {}) {
  if (!color) return;
  g.fillStyle = color;
  for (let wy = y + 3; wy < y + h - 2; wy += step) {
    for (let wx = x + 2; wx < x + w - 2; wx += step - 1) {
      if (rnd() < chance) box(g, wx, wy, size, size);
    }
  }
}

// Ориентиры: подножие в (cx, base), s — масштаб
const LANDMARKS = {
  // Дворец культуры и науки: ярусы, башенки по углам, шпиль
  pkin(g, cx, base, s, L, rnd) {
    const tiers = [[200, 26], [120, 44], [78, 40], [52, 46], [34, 30], [22, 22], [12, 18]];
    let y = base;
    for (const [w, h] of tiers) {
      y -= h * s;
      box(g, cx - (w * s) / 2, y, w * s, h * s);
      if (w >= 78) { // башенки по углам яруса
        box(g, cx - (w * s) / 2, y - 8 * s, 6 * s, 8 * s);
        box(g, cx + (w * s) / 2 - 6 * s, y - 8 * s, 6 * s, 8 * s);
      }
    }
    box(g, cx - 1.5 * s, y - 46 * s, 3 * s, 46 * s);
    litWindows(g, cx - 40 * s, base - 150 * s, 80 * s, 120 * s, L.windows, rnd, { chance: 0.25 });
    g.fillStyle = L.color;
  },
  // Varso: тонкая башня с сужением и иглой
  varso(g, cx, base, s, L, rnd) {
    box(g, cx - 14 * s, base - 190 * s, 28 * s, 190 * s);
    box(g, cx - 10 * s, base - 215 * s, 20 * s, 25 * s);
    box(g, cx - 5 * s, base - 232 * s, 10 * s, 17 * s);
    box(g, cx - 1 * s, base - 290 * s, 2 * s, 58 * s);
    litWindows(g, cx - 12 * s, base - 185 * s, 24 * s, 180 * s, L.windows, rnd, { chance: 0.2 });
    g.fillStyle = L.color;
  },
  // Warsaw Spire: стекло с косой крышей и двумя низкими корпусами
  spire(g, cx, base, s, L, rnd) {
    box(g, cx - 40 * s, base - 60 * s, 18 * s, 60 * s);
    box(g, cx + 22 * s, base - 60 * s, 18 * s, 60 * s);
    box(g, cx - 18 * s, base - 160 * s, 36 * s, 160 * s);
    g.beginPath();
    g.moveTo(Math.round(cx - 18 * s), Math.round(base - 160 * s));
    g.lineTo(Math.round(cx + 18 * s), Math.round(base - 160 * s));
    g.lineTo(Math.round(cx + 18 * s), Math.round(base - 200 * s));
    g.closePath();
    g.fill();
    litWindows(g, cx - 16 * s, base - 155 * s, 32 * s, 150 * s, L.windows, rnd, { chance: 0.2 });
    g.fillStyle = L.color;
  },
  // Złote Tarasy: волнистая стеклянная крыша
  tarasy(g, cx, base, s) {
    const w = 220 * s;
    box(g, cx - w / 2, base - 30 * s, w, 30 * s);
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(Math.round(cx - w / 2 + (i + 0.5) * (w / 5)), Math.round(base - 30 * s), w / 10, (14 + (i % 2) * 8) * s, 0, Math.PI, 0);
      g.fill();
    }
  },
  // Hala Mirowska: длинный кирпичный зал с двускатной крышей и арками
  hala(g, cx, base, s, L) {
    const w = 190 * s;
    box(g, cx - w / 2, base - 42 * s, w, 42 * s);
    g.beginPath();
    g.moveTo(Math.round(cx - w / 2), Math.round(base - 42 * s));
    g.lineTo(Math.round(cx), Math.round(base - 62 * s));
    g.lineTo(Math.round(cx + w / 2), Math.round(base - 42 * s));
    g.closePath();
    g.fill();
    if (L.windows) {
      g.fillStyle = L.windows;
      for (let i = 0; i < 9; i++) box(g, cx - w / 2 + 8 * s + i * 20 * s, base - 32 * s, 10 * s, 18 * s);
      g.fillStyle = L.color;
    }
  },
  // Стройка: башенный кран
  crane(g, cx, base, s) {
    box(g, cx - 2 * s, base - 150 * s, 4 * s, 150 * s);
    box(g, cx - 30 * s, base - 150 * s, 110 * s, 3 * s);
    box(g, cx - 30 * s, base - 147 * s, 12 * s, 8 * s); // противовес
    box(g, cx + 60 * s, base - 147 * s, 1, 50 * s); // трос
    box(g, cx - 2 * s, base - 162 * s, 4 * s, 12 * s);
  },
};

const FILLERS = {
  // Панельные блоки
  blocks(g, x, base, rnd, L) {
    const w = 30 + rnd() * 40;
    const h = 40 + rnd() * 50;
    box(g, x, base - h, w, h);
    litWindows(g, x, base - h, w, h, L.windows, rnd);
    g.fillStyle = L.color;
    return w + 2 + rnd() * 10;
  },
  // Офисные башни
  towers(g, x, base, rnd, L) {
    const w = 20 + rnd() * 26;
    const h = 70 + rnd() * 90;
    box(g, x, base - h, w, h);
    litWindows(g, x, base - h, w, h, L.windows, rnd, { chance: 0.25 });
    g.fillStyle = L.color;
    return w + 4 + rnd() * 16;
  },
  // Старые каменицы с крышами
  kamienice(g, x, base, rnd, L) {
    const w = 26 + rnd() * 22;
    const h = 34 + rnd() * 24;
    box(g, x, base - h, w, h);
    box(g, x + 2, base - h - 6, w - 4, 6);
    litWindows(g, x, base - h, w, h, L.windows, rnd, { step: 7, size: 2, chance: 0.45 });
    g.fillStyle = L.color;
    return w;
  },
  // Деревья во дворах
  trees(g, x, base, rnd) {
    const r = 8 + rnd() * 10;
    box(g, x + r - 1, base - r, 3, r);
    g.beginPath();
    g.arc(Math.round(x + r), Math.round(base - r - r * 0.6), r, 0, Math.PI * 2);
    g.fill();
    return r * 2 + 6 + rnd() * 30;
  },
  // Фонари и заборчики
  lamps(g, x, base, rnd, L) {
    box(g, x, base - 40, 2, 40);
    box(g, x - 3, base - 42, 8, 3);
    if (L.windows) {
      g.fillStyle = L.windows;
      box(g, x - 2, base - 39, 6, 2);
      g.fillStyle = L.color;
    }
    box(g, x + 6, base - 8, 30 + rnd() * 20, 2);
    return 50 + rnd() * 40;
  },
  none() { return 1e9; },
};

export function buildParallax(theme, mapPixelWidth, viewW, viewH, makeCanvas, seed = 1) {
  const layers = theme.layers.map((L, i) => {
    const w = layerWidth(mapPixelWidth, viewW, L.factor);
    const canvas = makeCanvas(w, viewH);
    const g = canvas.getContext('2d');
    const rnd = seededRandom(seed * 97 + i * 13);
    const base = viewH - L.base;
    g.fillStyle = L.color;
    const fill = FILLERS[L.fill ?? 'none'];
    for (let x = -10; x < w;) x += fill(g, x, base, rnd, L);
    for (const lm of L.landmarks ?? []) {
      g.fillStyle = L.color;
      LANDMARKS[lm.type](g, lm.at * w, base, lm.scale ?? 1, L, rnd);
    }
    // Земля под слоем, чтобы не просвечивало небо
    g.fillStyle = L.color;
    g.fillRect(0, base, w, viewH - base);
    return { canvas, factor: L.factor };
  });
  return { sky: theme.sky, layers, gradient: null };
}

export function drawParallax(ctx, px, camX, viewW, viewH) {
  if (!px.gradient) {
    px.gradient = ctx.createLinearGradient(0, 0, 0, viewH);
    px.gradient.addColorStop(0, px.sky[0]);
    px.gradient.addColorStop(1, px.sky[1]);
  }
  ctx.fillStyle = px.gradient;
  ctx.fillRect(0, 0, viewW, viewH);
  for (const l of px.layers) ctx.drawImage(l.canvas, -Math.round(camX * l.factor), 0);
}
