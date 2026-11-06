import { TILE } from './physics.js';
import { seededRandom } from './world.js';

const VARIANTS = 4;

function px(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function noise(g, rnd, color, count, size = 0.6) {
  g.fillStyle = color;
  for (let i = 0; i < count; i++) g.fillRect(rnd() * 16, rnd() * 16, size, size);
}

function bricks(g, rnd, base, mortar, { h = 4, w = 8, vary = 0.08 } = {}) {
  px(g, 0, 0, 16, 16, mortar);
  for (let row = 0; row < 16 / h; row++) {
    const off = row % 2 ? w / 2 : 0;
    for (let x = -off; x < 16; x += w) {
      const k = (rnd() - 0.5) * vary;
      g.fillStyle = tint(base, k);
      g.fillRect(x + 0.4, row * h + 0.4, w - 0.8, h - 0.8);
      g.fillStyle = tint(base, k + 0.12);
      g.fillRect(x + 0.4, row * h + 0.4, w - 0.8, 0.5);
    }
  }
}

function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function crack(g, rnd, color) {
  g.strokeStyle = color;
  g.lineWidth = 0.3;
  g.beginPath();
  let x = rnd() * 16;
  let y = rnd() * 6 + 4;
  g.moveTo(x, y);
  for (let i = 0; i < 4; i++) {
    x += (rnd() - 0.3) * 4;
    y += (rnd() - 0.5) * 3;
    g.lineTo(x, y);
  }
  g.stroke();
}

function pavers(g, rnd, a, b, joint) {
  px(g, 0, 0, 16, 16, joint);
  for (let y = 0; y < 16; y += 4) {
    const off = (y / 4) % 2 ? 2 : 0;
    for (let x = -off; x < 16; x += 4) g.fillStyle = rnd() < 0.5 ? a : b, g.fillRect(x + 0.3, y + 0.3, 3.4, 3.4);
  }
}

function cobbles(g, rnd, base, joint) {
  px(g, 0, 0, 16, 16, joint);
  for (let y = 0; y < 16; y += 2.6) {
    for (let x = (y / 2.6) % 2 ? -1.2 : 0; x < 16; x += 2.6) {
      g.fillStyle = tint(base, (rnd() - 0.5) * 0.25);
      g.beginPath();
      g.roundRect(x + 0.25, y + 0.25, 2.1, 2.1, 0.7);
      g.fill();
    }
  }
}

const STYLES = {
  wola: {
    solidTop(g, rnd) {
      pavers(g, rnd, '#b9b4ad', '#aaa59e', '#8d8882');
      px(g, 0, 0, 16, 2.4, '#d6d2cb');
      px(g, 0, 2.4, 16, 0.6, '#77736d');
      noise(g, rnd, 'rgba(0,0,0,0.12)', 18);
    },
    solid(g, rnd) {
      px(g, 0, 0, 16, 16, '#6b5d52');
      noise(g, rnd, '#5a4e45', 40, 1);
      noise(g, rnd, '#857464', 14, 0.8);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#9b9187';
        g.beginPath();
        g.ellipse(rnd() * 16, rnd() * 16, 1.2, 0.8, 0, 0, Math.PI * 2);
        g.fill();
      }
    },
    thin(g, rnd) {
      px(g, 0, 0, 16, 2, '#e9ecef');
      px(g, 0, 2, 16, 1.6, '#adb5bd');
      px(g, 0, 3.6, 16, 0.6, '#6c757d');
      g.fillStyle = 'rgba(160, 210, 230, 0.35)';
      g.fillRect(0, -6, 16, 6);
      noise(g, rnd, 'rgba(0,0,0,0.1)', 6);
    },
  },
  budowa: {
    solidTop(g, rnd) {
      px(g, 0, 0, 16, 16, '#9a9893');
      noise(g, rnd, '#86847f', 30, 0.9);
      noise(g, rnd, '#b0aea8', 16, 0.7);
      px(g, 0, 0, 16, 1.8, '#c9c6bf');
      for (let x = 0; x < 16; x += 4) px(g, x, 1.8, 2, 0.8, x % 8 ? '#1b1b1b' : '#ffd60a');
      crack(g, rnd, '#6a6863');
    },
    solid(g, rnd) {
      px(g, 0, 0, 16, 16, '#807e79');
      px(g, 0, 7.6, 16, 0.5, '#6a6863');
      px(g, 7.6, 0, 0.5, 16, '#6a6863');
      noise(g, rnd, '#706e69', 30, 0.9);
      for (let i = 0; i < 3; i++) px(g, rnd() * 14 + 1, rnd() * 14 + 1, 0.9, 0.9, '#8c4a2f');
      if (rnd() < 0.6) crack(g, rnd, '#5c5a55');
    },
    thin(g, rnd) {
      px(g, 0, 0, 16, 2.6, '#b07d4a');
      for (let x = 0; x < 16; x += 5.3) px(g, x, 0, 0.4, 2.6, '#7a522c');
      px(g, 0, 0, 16, 0.5, '#d4a373');
      noise(g, rnd, '#8f6236', 6, 0.5);
      px(g, 0, 3, 16, 1, '#9aa0a6');
      px(g, 0, 3, 16, 0.3, '#ced4da');
      px(g, 2, 4, 0.8, 12, '#9aa0a6');
    },
  },
  hala: {
    solidTop(g, rnd) {
      cobbles(g, rnd, '#8e8a85', '#5e5a55');
      px(g, 0, 0, 16, 1.4, '#b5b0a8');
    },
    solid(g, rnd) {
      bricks(g, rnd, '#a0472b', '#d9b48f', { vary: 0.18 });
      noise(g, rnd, 'rgba(0,0,0,0.12)', 10, 1);
    },
    thin(g, rnd) {
      for (let x = 0; x < 16; x += 4) px(g, x, 0, 2, 3.2, '#e63946'), px(g, x + 2, 0, 2, 3.2, '#f4f1de');
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 2.6, 16, 0.6);
      for (let x = 0; x < 16; x += 4) {
        g.fillStyle = x % 8 ? '#f4f1de' : '#e63946';
        g.beginPath();
        g.arc(x + 2, 3.2, 2, 0, Math.PI);
        g.fill();
      }
    },
    barrier(g, rnd) {
      px(g, 0, 0, 16, 16, '#8f6236');
      px(g, 0, 0, 16, 1, '#b07d4a');
      px(g, 0, 7.5, 16, 1, '#6b4423');
      px(g, 0, 15, 16, 1, '#6b4423');
      g.strokeStyle = '#6b4423';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(16, 7.5);
      g.moveTo(0, 8.5);
      g.lineTo(16, 16);
      g.stroke();
      noise(g, rnd, '#a87443', 10, 0.6);
    },
  },
  pkin: {
    solidTop(g, rnd) {
      px(g, 0, 0, 16, 16, '#a89c90');
      px(g, 0, 0, 16, 2.2, '#cfc6bb');
      px(g, 0, 2.2, 16, 0.7, '#7c7267');
      px(g, 8, 3, 0.4, 13, '#8e8479');
      noise(g, rnd, 'rgba(255,255,255,0.12)', 16, 0.7);
      noise(g, rnd, 'rgba(0,0,0,0.1)', 16, 0.7);
    },
    solid(g, rnd) {
      px(g, 0, 0, 16, 16, '#d8c7a8');
      px(g, 0, 7.6, 16, 0.6, '#b3a07e');
      px(g, 0, 15.4, 16, 0.6, '#b3a07e');
      px(g, rnd() < 0.5 ? 5 : 11, 0, 0.6, 7.6, '#b3a07e');
      px(g, rnd() < 0.5 ? 3 : 9, 8.2, 0.6, 7.2, '#b3a07e');
      noise(g, rnd, 'rgba(120, 100, 70, 0.25)', 24, 0.8);
      for (let x = 1.5; x < 16; x += 4) px(g, x, 1, 0.5, 6, 'rgba(255,255,255,0.18)');
    },
    thin(g) {
      g.fillStyle = 'rgba(170, 220, 240, 0.55)';
      g.fillRect(0, 0, 16, 3.4);
      px(g, 0, 0, 16, 0.6, '#e0f7ff');
      px(g, 0, 3.2, 16, 0.6, '#5a6b78');
      for (let x = 0; x < 16; x += 4) px(g, x, 0, 0.5, 3.6, '#5a6b78');
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(1, 0.8, 2, 0.4);
    },
  },
  zlota: {
    solidTop(g, rnd) {
      cobbles(g, rnd, '#5c5f6b', '#2c2e36');
      px(g, 0, 0, 16, 2, '#8d909b');
      px(g, 0, 2, 16, 0.5, '#3a3c45');
      g.fillStyle = 'rgba(255, 209, 102, 0.08)';
      g.fillRect(0, 0, 16, 16);
    },
    solid(g, rnd) {
      px(g, 0, 0, 16, 16, '#3b3a46');
      noise(g, rnd, '#2f2e38', 30, 1);
      noise(g, rnd, '#4a4957', 12, 0.8);
    },
    thin(g, rnd) {
      px(g, 0, 0, 16, 2.4, '#4a4e69');
      px(g, 0, 0, 16, 0.5, '#9a8c98');
      px(g, 0, 2.4, 16, 0.7, '#ff4fa3');
      g.fillStyle = 'rgba(255, 79, 163, 0.25)';
      g.fillRect(0, 3.1, 16, 1.6);
      noise(g, rnd, '#22223b', 4, 0.6);
    },
  },
};

function barrierDefault(g) {
  for (let i = 0; i < 16; i += 4) {
    g.fillStyle = (i / 4) % 2 ? '#c0392b' : '#ecf0f1';
    g.fillRect(3, i, 10, 4);
  }
  px(g, 3, 0, 10, 0.5, '#ffffff');
  px(g, 2, 15, 12, 1, '#555');
}

function decor(g, rnd) {
  px(g, 0, 0, 16, 16, '#2c2c44');
  noise(g, rnd, '#25253a', 20, 1);
}

export function buildTileset(styleName, makeCanvas, res) {
  const style = STYLES[styleName] ?? STYLES.wola;
  const make = (fn, seed) => {
    const cv = makeCanvas(16 * res, 22 * res);
    const g = cv.getContext('2d');
    g.scale(res, res);
    g.translate(0, 6);
    fn(g, seededRandom(seed));
    return cv;
  };
  const set = (fn, base) => Array.from({ length: VARIANTS }, (_, i) => make(fn, base * 31 + i * 7 + 1));
  return {
    res,
    solidTop: set(style.solidTop, 1),
    solid: set(style.solid, 2),
    thin: set(style.thin, 3),
    barrier: set(style.barrier ?? barrierDefault, 4),
    decor: set(style.decor ?? decor, 5),
  };
}

function variant(tx, ty) {
  return ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
}

export function tileImage(set, map, tx, ty) {
  const t = map.get(tx, ty);
  const v = variant(tx, ty) % VARIANTS;
  if (t === TILE.SOLID) return map.get(tx, ty - 1) === TILE.SOLID ? set.solid[v] : set.solidTop[v];
  if (t === TILE.THIN) return set.thin[v];
  if (t === TILE.BARRIER) return set.barrier[v];
  if (t === TILE.DECOR) return set.decor[v];
  return null;
}

export function solidDepth(map, tx, ty, max = 4) {
  let d = 0;
  while (d < max && map.get(tx, ty - d - 1) === TILE.SOLID) d++;
  return d;
}

export function drawTilesTextured(ctx, map, cam, set) {
  const ts = map.tileSize;
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const tx0 = Math.max(0, Math.floor(camX / ts));
  const tx1 = Math.min(map.width - 1, Math.floor((camX + cam.viewW) / ts));
  const ty0 = Math.max(0, Math.floor(camY / ts) - 1);
  const ty1 = Math.min(map.height - 1, Math.floor((camY + cam.viewH) / ts));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const img = tileImage(set, map, tx, ty);
      if (!img) continue;
      const x = tx * ts - camX;
      const y = ty * ts - camY;
      ctx.drawImage(img, x, y - 6, ts, ts + 6);
      if (map.get(tx, ty) === TILE.SOLID) {
        const d = solidDepth(map, tx, ty);
        if (d > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.5, d * 0.14)})`;
          ctx.fillRect(x, y, ts, ts);
        }
        if (map.get(tx - 1, ty) !== TILE.SOLID && tx > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(x, y, 0.8, ts);
        }
        if (map.get(tx + 1, ty) !== TILE.SOLID && tx < map.width - 1) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.fillRect(x + ts - 0.8, y, 0.8, ts);
        }
      }
    }
  }
}
