import { seededRandom, layerWidth } from './world.js';
import { poster, shopSign, pickPoster, pickShop, zabkaSign } from './signs.js';
import { NEON_SIGNS } from './lines.js';

const TAU = Math.PI * 2;

const TIMES = {
  morning: {
    sky: ['#7fb8e0', '#cbe5f1', '#f7dcb6'],
    haze: '#d4e6ef',
    sun: { x: 0.18, y: 0.42, r: 14, color: '#fff2c4', glow: 'rgba(255, 236, 190, 0.45)' },
    clouds: 'rgba(255, 255, 255, 0.85)',
    wall: '#e8e4dc', glass: ['#9cc3dc', '#5f8fb3'], window: '#5d7d95', lit: '#8fb6cc', trim: '#b8b2a8',
    foliage: '#5f9e4f', trunk: '#5a4632', night: 0,
  },
  day: {
    sky: ['#3d82c4', '#8cc3e6', '#d6edf5'],
    haze: '#c8e0ee',
    sun: { x: 0.72, y: 0.16, r: 11, color: '#fffbe6', glow: 'rgba(255, 250, 220, 0.4)' },
    clouds: 'rgba(255, 255, 255, 0.95)',
    wall: '#dcdad5', glass: ['#7fb3d9', '#2f5f8f'], window: '#46637a', lit: '#9fcbe6', trim: '#a9a49b',
    foliage: '#4f8f3f', trunk: '#4f3d2a', night: 0,
  },
  afternoon: {
    sky: ['#5b8fc6', '#e7c79f', '#f2a35e'],
    haze: '#eac7a0',
    sun: { x: 0.82, y: 0.36, r: 13, color: '#ffe0a3', glow: 'rgba(255, 200, 120, 0.45)' },
    clouds: 'rgba(255, 236, 214, 0.85)',
    wall: '#e2cfb5', glass: ['#d9b48c', '#6b6f8a'], window: '#6b5a4f', lit: '#ffd59e', trim: '#b89c7e',
    foliage: '#6f8f3f', trunk: '#4f3a2a', night: 0.15,
  },
  sunset: {
    sky: ['#2b2a66', '#b8507a', '#f4a259'],
    haze: '#d77d78',
    sun: { x: 0.3, y: 0.7, r: 22, color: '#ffb35c', glow: 'rgba(255, 150, 80, 0.5)' },
    clouds: 'rgba(255, 170, 150, 0.7)',
    wall: '#b5867f', glass: ['#f4a259', '#3d2f5e'], window: '#4a3550', lit: '#ffcf70', trim: '#8f6a6a',
    foliage: '#3f4f3a', trunk: '#2f2622', night: 0.55,
  },
  night: {
    sky: ['#04050e', '#101030', '#2b1f4f'],
    haze: '#2a2450',
    sun: { x: 0.8, y: 0.18, r: 7, color: '#f0f0e0', glow: 'rgba(220, 220, 255, 0.25)', moon: true },
    clouds: 'rgba(80, 70, 120, 0.5)',
    wall: '#3a3552', glass: ['#3a3f6e', '#141530'], window: '#1d1a33', lit: '#ffd166', trim: '#4f4868',
    foliage: '#1f2a28', trunk: '#151515', night: 1,
  },
};

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

function shade(hex, k) {
  return k < 0 ? mix(hex, '#000000', -k) : mix(hex, '#ffffff', k);
}

const HAZE = { far: 0.55, mid: 0.25, near: 0 };

function paletteFor(T, tone) {
  const h = HAZE[tone] ?? 0;
  const dark = tone === 'near' ? 0.25 : 0;
  const m = (c) => shade(mix(c, T.haze, h), -dark);
  return {
    wall: m(T.wall),
    wallShade: m(shade(T.wall, -0.18)),
    glassTop: m(T.glass[0]),
    glassBottom: m(T.glass[1]),
    window: m(T.window),
    lit: T.night > 0.3 ? T.lit : m(T.lit),
    trim: m(T.trim),
    foliage: m(T.foliage),
    foliageLight: m(shade(T.foliage, 0.2)),
    trunk: m(T.trunk),
    sand: m(T.night > 0.5 ? '#6a5c58' : '#d9c6a3'),
    sandShade: m(T.night > 0.5 ? '#4f4446' : '#b39f7c'),
    detail: tone !== 'far',
    glow: T.night > 0.3,
    brick: m(T.night > 0.5 ? '#5a2f2a' : '#a24a2c'),
    brickLight: m(T.night > 0.5 ? '#7a443a' : '#c97a4c'),
    night: T.night,
  };
}

function box(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function windowsGrid(g, x, y, w, h, P, rnd, { cols, rows, ww = 2, wh = 2.6, litChance = 0.35 } = {}) {
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = P.night > 0.3 ? rnd() < litChance * P.night + 0.05 : rnd() < 0.15;
      box(g, x + c * cw + (cw - ww) / 2, y + r * rh + (rh - wh) / 2, ww, wh, lit ? P.lit : P.window);
    }
  }
}

function dimmed(g, P, draw) {
  g.save();
  if (!P.glow) g.globalAlpha = 0.88;
  draw();
  g.restore();
}

function streetShop(g, x, w, base, P, rnd) {
  const sw = Math.min(w - 4, 24 + rnd() * 14);
  const sx = x + (w - sw) / 2;
  const zabka = rnd() < 0.35;
  dimmed(g, P, () => (zabka ? zabkaSign(g, sx, base - 11, sw, 4, { lit: P.glow }) : shopSign(g, sx, base - 11, sw, 4, pickShop(rnd), { lit: P.glow })));
  box(g, sx, base - 6.5, sw, 6.5, zabka ? (P.glow ? 'rgba(150, 230, 150, 0.85)' : 'rgba(25, 60, 40, 0.85)') : (P.glow ? 'rgba(255, 214, 140, 0.85)' : 'rgba(30, 40, 56, 0.85)'));
  box(g, sx + sw * 0.65, base - 6.5, 0.6, 6.5, P.trim);
}

function facadeWrap(g, x, top, w, h, P, rnd) {
  const ww = w * (0.45 + rnd() * 0.3);
  const wh = Math.min(h * 0.6, ww * 1.3);
  const wx = x + (rnd() < 0.5 ? 2 : w - ww - 2);
  const wy = top + 4 + rnd() * (h * 0.15);
  dimmed(g, P, () => poster(g, wx, wy, ww, wh, pickPoster(rnd), { lit: P.glow }));
}

function roofBillboard(g, x, top, w, P, rnd) {
  const bw = Math.min(w * 0.8, 30 + rnd() * 10);
  const bx = x + (w - bw) / 2;
  const bh = bw * 0.42;
  box(g, bx + bw * 0.2, top - 4, 0.8, 4, '#3a3a3a');
  box(g, bx + bw * 0.78, top - 4, 0.8, 4, '#3a3a3a');
  box(g, bx - 0.6, top - 4 - bh - 0.6, bw + 1.2, bh + 1.2, '#2b2b2b');
  dimmed(g, P, () => poster(g, bx, top - 4 - bh, bw, bh, pickPoster(rnd), { lit: P.glow }));
}

function glassFacade(g, x, y, w, h, P, rnd, { mull = 3, floors = 4 } = {}) {
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, P.glassTop);
  grad.addColorStop(1, P.glassBottom);
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.08)';
  g.beginPath();
  g.moveTo(x, y + h * 0.2);
  g.lineTo(x + w * 0.5, y);
  g.lineTo(x + w * 0.75, y);
  g.lineTo(x, y + h * 0.5);
  g.fill();
  g.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let mx = x + mull; mx < x + w; mx += mull) g.fillRect(mx, y, 0.35, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let my = y + floors; my < y + h; my += floors) g.fillRect(x, my, w, 0.3);
  if (P.night > 0.3) {
    for (let my = y + 2; my < y + h - 2; my += floors) {
      for (let mx = x + 1; mx < x + w - 1; mx += mull) if (rnd() < 0.3 * P.night) box(g, mx + 0.4, my, mull - 0.8, floors * 0.55, P.lit);
    }
  }
}

const FILLERS = {
  apartments(g, x, base, rnd, P) {
    const w = 46 + rnd() * 40;
    const floors = 5 + Math.floor(rnd() * 5);
    const fh = 7;
    const h = floors * fh + 4;
    const top = base - h;
    box(g, x, top, w, h, P.wall);
    box(g, x + w * 0.72, top, w * 0.28, h, P.wallShade);
    if (rnd() < 0.6) box(g, x + w * 0.35, top, w * 0.18, h, shade(P.wall, -0.32));
    box(g, x - 1, top - 2, w + 2, 2, P.trim);
    box(g, x + w * 0.2, top - 5, 6, 3, P.trim);
    for (let f = 0; f < floors; f++) {
      const fy = top + 4 + f * fh;
      windowsGrid(g, x + 2, fy, w - 4, 4, P, rnd, { cols: Math.floor(w / 7), rows: 1, ww: 3, wh: 3.4 });
      box(g, x + 1, fy + 4.2, w - 2, 0.9, P.trim);
      g.fillStyle = 'rgba(170, 215, 235, 0.35)';
      g.fillRect(x + 1, fy + 2.4, w - 2, 1.8);
    }
    if (P.detail) {
      if (rnd() < 0.7) streetShop(g, x, w, base, P, rnd);
      if (rnd() < 0.3) facadeWrap(g, x, top, w, h - 12, P, rnd);
      else if (rnd() < 0.25) roofBillboard(g, x, top - 2, w, P, rnd);
    }
    return w + 6 + rnd() * 14;
  },

  glass(g, x, base, rnd, P) {
    const w = 22 + rnd() * 30;
    const h = 70 + rnd() * 110;
    glassFacade(g, x, base - h, w, h, P, rnd, { mull: 2.6 + rnd(), floors: 3.4 });
    box(g, x - 0.5, base - h - 1.5, w + 1, 1.5, P.trim);
    if (rnd() < 0.4) box(g, x + w * 0.4, base - h - 6, 1, 4.5, P.trim);
    if (P.detail && rnd() < 0.3) {
      const bw = w - 4;
      dimmed(g, P, () => poster(g, x + 2, base - h + 6 + rnd() * 20, bw, bw * 0.55, pickPoster(rnd), { lit: P.glow }));
    }
    if (P.detail && rnd() < 0.5) streetShop(g, x, w, base, P, rnd);
    return w + 3 + rnd() * 12;
  },

  kamienice(g, x, base, rnd, P) {
    const w = 30 + rnd() * 18;
    const floors = 4 + Math.floor(rnd() * 2);
    const fh = 8;
    const h = floors * fh + 5;
    const hue = [P.wall, mix(P.wall, '#d9a86c', 0.35), mix(P.wall, '#9aa3a8', 0.3), mix(P.wall, '#c98f7a', 0.3)][Math.floor(rnd() * 4)];
    const top = base - h;
    box(g, x, top, w, h, hue);
    box(g, x, top + 6, w, 0.8, shade(hue, -0.2));
    g.fillStyle = shade(hue, -0.35);
    g.beginPath();
    g.moveTo(x - 1, top);
    g.lineTo(x + 4, top - 6);
    g.lineTo(x + w - 4, top - 6);
    g.lineTo(x + w + 1, top);
    g.fill();
    box(g, x + w * 0.7, top - 9, 2.5, 4, shade(hue, -0.4));
    for (let f = 0; f < floors; f++) {
      const fy = top + 8 + f * fh;
      for (let c = 0; c < Math.floor(w / 7); c++) {
        const wx = x + 3 + c * 7;
        const lit = P.night > 0.3 ? rnd() < 0.5 * P.night : false;
        box(g, wx - 0.6, fy - 0.8, 4.2, 0.8, shade(hue, 0.15));
        box(g, wx, fy, 3, 4.6, lit ? P.lit : P.window);
        box(g, wx - 0.4, fy + 4.6, 3.8, 0.7, shade(hue, 0.2));
        if (f === 1 && c % 2 === 0) box(g, wx - 1, fy + 5.2, 5, 0.6, shade(hue, -0.4));
      }
      box(g, x, fy + 6.2, w, 0.5, shade(hue, -0.15));
    }
    box(g, x + w / 2 - 2.5, base - 7, 5, 7, shade(hue, -0.45));
    if (P.detail) {
      if (rnd() < 0.75) {
        const sw = w * 0.8;
        if (rnd() < 0.3) dimmed(g, P, () => zabkaSign(g, x + (w - sw) / 2, base - 13, sw, 4, { lit: P.glow }));
        else dimmed(g, P, () => shopSign(g, x + (w - sw) / 2, base - 13, sw, 4, pickShop(rnd), { lit: P.glow }));
      }
      if (rnd() < 0.35) {
        const pw = 6 + rnd() * 4;
        dimmed(g, P, () => poster(g, x + 2 + rnd() * (w - pw - 4), base - 8.5, pw, pw * 1.2, pickPoster(rnd)));
      }
      if (rnd() < 0.18) roofBillboard(g, x, top - 6, w, P, rnd);
    }
    return w;
  },

  socrealist(g, x, base, rnd, P) {
    const w = 60 + rnd() * 40;
    const floors = 6;
    const fh = 8;
    const h = floors * fh + 10;
    const top = base - h;
    box(g, x, top, w, h, P.sand);
    box(g, x - 1.5, top - 3, w + 3, 3, P.sandShade);
    box(g, x - 1, top + 12, w + 2, 1.2, P.sandShade);
    for (let px = x + 3; px < x + w - 2; px += 10) box(g, px, top + 13, 1.2, h - 22, shade(P.sand, -0.1));
    windowsGrid(g, x + 2, top + 14, w - 4, h - 24, P, rnd, { cols: Math.floor(w / 5), rows: floors - 1, ww: 2.2, wh: 3.6, litChance: 0.6 });
    if (P.detail) {
      for (let sx = x + 3; sx < x + w - 14; sx += 18 + rnd() * 10) {
        if (rnd() < 0.25) dimmed(g, P, () => zabkaSign(g, sx, base - 12, 13, 3.6, { lit: P.glow }));
        else if (rnd() < 0.7) dimmed(g, P, () => shopSign(g, sx, base - 12, 13, 3.6, pickShop(rnd), { lit: P.glow }));
      }
      if (rnd() < 0.35) facadeWrap(g, x, top + 12, w, h - 24, P, rnd);
    }
    for (let ax = x + 2; ax < x + w - 6; ax += 9) {
      g.fillStyle = P.night > 0.5 ? '#ffcf70' : shade(P.sand, -0.45);
      g.beginPath();
      g.moveTo(ax, base);
      g.lineTo(ax, base - 6);
      g.arc(ax + 3.5, base - 6, 3.5, Math.PI, 0);
      g.lineTo(ax + 7, base);
      g.fill();
    }
    return w + 2;
  },

  trees(g, x, base, rnd, P) {
    const r = 7 + rnd() * 9;
    box(g, x + r - 1, base - r * 1.2, 2.4, r * 1.2, P.trunk);
    const cx = x + r;
    const cy = base - r * 1.5;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      g.fillStyle = i % 2 ? P.foliage : shade(P.foliage, -0.12);
      g.beginPath();
      g.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.35, r * 0.62, 0, TAU);
      g.fill();
    }
    g.fillStyle = P.foliageLight;
    g.beginPath();
    g.arc(cx - r * 0.25, cy - r * 0.3, r * 0.45, 0, TAU);
    g.fill();
    return r * 2 + 8 + rnd() * 26;
  },

  lamps(g, x, base, rnd, P) {
    box(g, x, base - 30, 1.2, 30, '#2b2b2b');
    box(g, x - 0.8, base - 3, 2.8, 3, '#2b2b2b');
    g.strokeStyle = '#2b2b2b';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x + 0.6, base - 30);
    g.quadraticCurveTo(x + 0.6, base - 34, x + 5, base - 33);
    g.stroke();
    box(g, x + 3.6, base - 33, 3.2, 1.6, '#2b2b2b');
    if (P.night > 0.3) {
      g.fillStyle = 'rgba(255, 214, 140, 0.25)';
      g.beginPath();
      g.moveTo(x + 3.6, base - 31.4);
      g.lineTo(x + 6.8, base - 31.4);
      g.lineTo(x + 12, base);
      g.lineTo(x - 2, base);
      g.fill();
      box(g, x + 3.8, base - 31.6, 2.8, 0.8, '#ffe8a3');
    }
    box(g, x + 8, base - 7, 22 + rnd() * 10, 0.8, '#2b2b2b');
    for (let i = 0; i < 6; i++) box(g, x + 9 + i * 4, base - 7, 0.6, 7, '#2b2b2b');
    return 46 + rnd() * 30;
  },

  construction(g, x, base, rnd, P) {
    const w = 40 + rnd() * 30;
    const h = 50 + rnd() * 50;
    box(g, x, base - h, w, h, shade(P.wall, -0.15));
    g.fillStyle = 'rgba(40, 120, 70, 0.55)';
    g.fillRect(x, base - h, w, h);
    g.strokeStyle = 'rgba(30, 30, 30, 0.6)';
    g.lineWidth = 0.4;
    for (let yy = base - h; yy < base; yy += 6) {
      g.beginPath();
      g.moveTo(x, yy);
      g.lineTo(x + w, yy);
      g.stroke();
    }
    for (let xx = x; xx <= x + w; xx += 8) {
      g.beginPath();
      g.moveTo(xx, base - h);
      g.lineTo(xx, base);
      g.stroke();
    }
    if (P.detail && rnd() < 0.65) {
      const bw = w * 0.8;
      dimmed(g, P, () => poster(g, x + w * 0.1, base - h + 6, bw, Math.min(h - 20, bw * 0.6), pickPoster(rnd)));
    }
    box(g, x - 4, base - 9, w + 8, 9, '#d9d4c7');
    for (let xx = x - 4; xx < x + w + 4; xx += 5) box(g, xx, base - 9, 0.5, 9, '#9a958a');
    if (P.detail && rnd() < 0.5) dimmed(g, P, () => poster(g, x + rnd() * (w - 10), base - 8.5, 10, 7.5, pickPoster(rnd)));
    return w + 10 + rnd() * 20;
  },

  none() {
    return 1e9;
  },
};

const LANDMARKS = {
  pkin(g, cx, base, s, P, rnd) {
    const tiers = [[210, 22], [140, 40], [92, 34], [64, 40], [44, 36], [30, 26], [18, 20]];
    let y = base;
    tiers.forEach(([w, h], i) => {
      y -= h * s;
      const x0 = cx - (w * s) / 2;
      box(g, x0, y, w * s, h * s, P.sand);
      box(g, x0 + w * s * 0.62, y, w * s * 0.38, h * s, P.sandShade);
      g.fillStyle = shade(P.sand, -0.12);
      for (let rx = x0 + 2 * s; rx < x0 + w * s; rx += 4 * s) g.fillRect(rx, y + 2 * s, 0.8 * s, h * s - 3 * s);
      if (i >= 1 && i <= 4) {
        windowsGrid(g, x0 + 2 * s, y + 3 * s, w * s - 4 * s, h * s - 6 * s, P, rnd, { cols: Math.floor(w / 4), rows: Math.floor(h / 6), ww: 1 * s, wh: 2.2 * s, litChance: 0.45 });
      }
      for (let k = 0; k < w * s; k += 3 * s) box(g, x0 + k, y - 1.5 * s, 1.6 * s, 1.5 * s, P.sand);
      if (w >= 64) {
        for (const tx of [x0, x0 + w * s - 7 * s]) {
          box(g, tx, y - 10 * s, 7 * s, 10 * s, P.sand);
          g.fillStyle = P.sandShade;
          g.beginPath();
          g.moveTo(tx, y - 10 * s);
          g.lineTo(tx + 3.5 * s, y - 16 * s);
          g.lineTo(tx + 7 * s, y - 10 * s);
          g.fill();
        }
      }
      if (i === 4) {
        g.fillStyle = P.night > 0.3 ? '#fff3c4' : '#f4f1de';
        g.beginPath();
        g.arc(cx, y + h * s * 0.45, 5 * s, 0, TAU);
        g.fill();
        g.strokeStyle = '#2b2b2b';
        g.lineWidth = 0.6 * s;
        g.beginPath();
        g.moveTo(cx, y + h * s * 0.45);
        g.lineTo(cx, y + h * s * 0.45 - 3.6 * s);
        g.moveTo(cx, y + h * s * 0.45);
        g.lineTo(cx + 2.4 * s, y + h * s * 0.45);
        g.stroke();
      }
    });
    g.fillStyle = P.sandShade;
    g.beginPath();
    g.moveTo(cx - 6 * s, y);
    g.lineTo(cx, y - 18 * s);
    g.lineTo(cx + 6 * s, y);
    g.fill();
    box(g, cx - 0.9 * s, y - 62 * s, 1.8 * s, 46 * s, P.sandShade);
    if (P.night > 0.3) {
      g.fillStyle = 'rgba(255, 60, 60, 0.9)';
      g.fillRect(cx - 1 * s, y - 63 * s, 2 * s, 2 * s);
    }
  },

  varso(g, cx, base, s, P, rnd) {
    const w = 24 * s;
    const h = 190 * s;
    glassFacade(g, cx - w / 2, base - h, w, h, P, rnd, { mull: 2 * s, floors: 3 * s });
    g.fillStyle = P.glassBottom;
    g.beginPath();
    g.moveTo(cx - w / 2, base - h);
    g.lineTo(cx - w * 0.2, base - h - 30 * s);
    g.lineTo(cx + w * 0.2, base - h - 30 * s);
    g.lineTo(cx + w / 2, base - h);
    g.fill();
    box(g, cx - 0.6 * s, base - h - 80 * s, 1.2 * s, 52 * s, P.trim);
    if (P.night > 0.3) box(g, cx - 1 * s, base - h - 81 * s, 2 * s, 2 * s, '#ff4d4d');
  },

  spire(g, cx, base, s, P, rnd) {
    glassFacade(g, cx - 42 * s, base - 55 * s, 18 * s, 55 * s, P, rnd, { mull: 2.4 * s, floors: 3.4 * s });
    glassFacade(g, cx + 24 * s, base - 55 * s, 18 * s, 55 * s, P, rnd, { mull: 2.4 * s, floors: 3.4 * s });
    const w = 40 * s;
    const h = 170 * s;
    g.save();
    g.beginPath();
    g.moveTo(cx - w / 2, base);
    g.lineTo(cx - w / 2, base - h);
    g.quadraticCurveTo(cx, base - h - 6 * s, cx + w / 2, base - h - 30 * s);
    g.lineTo(cx + w / 2, base);
    g.closePath();
    g.clip();
    glassFacade(g, cx - w / 2, base - h - 30 * s, w, h + 30 * s, P, rnd, { mull: 2.2 * s, floors: 3.2 * s });
    g.restore();
    box(g, cx + w / 2 - 1.5 * s, base - h - 44 * s, 1.2 * s, 16 * s, P.trim);
  },

  skyliner(g, cx, base, s, P, rnd) {
    const w = 30 * s;
    const h = 150 * s;
    glassFacade(g, cx - w / 2, base - h, w, h, P, rnd, { mull: 2.4 * s, floors: 3 * s });
    glassFacade(g, cx - w / 2 + 4 * s, base - h - 14 * s, w - 8 * s, 14 * s, P, rnd, { mull: 2 * s, floors: 3 * s });
    box(g, cx - w / 2, base - h, w, 1.2 * s, P.trim);
  },

  zlota44(g, cx, base, s, P, rnd) {
    const w = 30 * s;
    const h = 175 * s;
    g.save();
    g.beginPath();
    g.moveTo(cx - w / 2, base);
    g.lineTo(cx - w / 2, base - h * 0.85);
    g.quadraticCurveTo(cx - w * 0.2, base - h, cx + w / 2, base - h);
    g.quadraticCurveTo(cx + w * 0.55, base - h * 0.5, cx + w / 2, base);
    g.closePath();
    g.clip();
    glassFacade(g, cx - w / 2, base - h, w * 1.1, h, P, rnd, { mull: 2 * s, floors: 3 * s });
    g.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    g.lineWidth = 0.4 * s;
    for (let i = -h; i < h; i += 7 * s) {
      g.beginPath();
      g.moveTo(cx - w / 2, base + i);
      g.lineTo(cx + w / 2, base + i - w * 0.8);
      g.stroke();
    }
    g.restore();
  },

  tarasy(g, cx, base, s, P) {
    const w = 220 * s;
    const x0 = cx - w / 2;
    box(g, x0, base - 22 * s, w, 22 * s, shade(P.wall, -0.3));
    g.save();
    g.beginPath();
    g.moveTo(x0, base - 22 * s);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      g.lineTo(x0 + t * w, base - 22 * s - (14 + Math.sin(t * TAU * 2.2) * 9 + Math.sin(t * TAU * 5) * 3) * s);
    }
    g.lineTo(x0 + w, base - 22 * s);
    g.closePath();
    const grad = g.createLinearGradient(0, base - 50 * s, 0, base - 22 * s);
    grad.addColorStop(0, P.night > 0.3 ? '#6fa8dc' : P.glassTop);
    grad.addColorStop(1, P.glassBottom);
    g.fillStyle = grad;
    g.fill();
    g.clip();
    g.strokeStyle = P.night > 0.3 ? 'rgba(255, 230, 160, 0.5)' : 'rgba(255, 255, 255, 0.35)';
    g.lineWidth = 0.4 * s;
    for (let xx = x0; xx < x0 + w; xx += 5 * s) {
      g.beginPath();
      g.moveTo(xx, base - 60 * s);
      g.lineTo(xx + 6 * s, base);
      g.stroke();
      g.beginPath();
      g.moveTo(xx, base - 60 * s);
      g.lineTo(xx - 6 * s, base);
      g.stroke();
    }
    g.restore();
    if (P.night > 0.3) {
      g.fillStyle = 'rgba(255, 210, 120, 0.6)';
      for (let xx = x0 + 4 * s; xx < x0 + w; xx += 9 * s) g.fillRect(xx, base - 14 * s, 5 * s, 6 * s);
    }
  },

  hala(g, cx, base, s, P) {
    const w = 200 * s;
    const h = 40 * s;
    const x0 = cx - w / 2;
    box(g, x0, base - h, w, h, P.brick);
    g.fillStyle = shade(P.brick, -0.15);
    for (let yy = base - h + 2 * s; yy < base; yy += 2.4 * s) g.fillRect(x0, yy, w, 0.3 * s);
    box(g, x0 - 2 * s, base - h - 2 * s, w + 4 * s, 2.4 * s, P.brickLight);
    g.fillStyle = shade(P.brick, -0.25);
    g.beginPath();
    g.moveTo(x0 + 6 * s, base - h - 2 * s);
    g.lineTo(cx, base - h - 16 * s);
    g.lineTo(x0 + w - 6 * s, base - h - 2 * s);
    g.fill();
    for (let i = 0; i < 12; i++) {
      const ax = x0 + 8 * s + i * 16 * s;
      if (Math.abs(ax + 4 * s - cx) < 16 * s) continue;
      box(g, ax - 1.2 * s, base - h + 4 * s, 10.4 * s, 26 * s, P.brickLight);
      g.fillStyle = P.night > 0.3 ? P.lit : P.window;
      g.beginPath();
      g.moveTo(ax, base - h + 30 * s);
      g.lineTo(ax, base - h + 12 * s);
      g.arc(ax + 4 * s, base - h + 12 * s, 4 * s, Math.PI, 0);
      g.lineTo(ax + 8 * s, base - h + 30 * s);
      g.fill();
      g.fillStyle = 'rgba(0, 0, 0, 0.25)';
      g.fillRect(ax + 3.7 * s, base - h + 9 * s, 0.6 * s, 21 * s);
    }
    const gw = 34 * s;
    box(g, cx - gw / 2, base - h - 16 * s, gw, h + 16 * s, P.brickLight);
    g.fillStyle = P.brickLight;
    g.beginPath();
    g.moveTo(cx - gw / 2 - 2 * s, base - h - 16 * s);
    g.quadraticCurveTo(cx, base - h - 36 * s, cx + gw / 2 + 2 * s, base - h - 16 * s);
    g.fill();
    for (const tx of [cx - gw / 2 - 3 * s, cx + gw / 2]) {
      box(g, tx, base - h - 24 * s, 3 * s, h + 24 * s, shade(P.brickLight, 0.1));
      g.beginPath();
      g.moveTo(tx - 0.6 * s, base - h - 24 * s);
      g.lineTo(tx + 1.5 * s, base - h - 30 * s);
      g.lineTo(tx + 3.6 * s, base - h - 24 * s);
      g.fill();
    }
    g.fillStyle = P.night > 0.3 ? '#ffcf70' : shade(P.brick, -0.5);
    g.beginPath();
    g.moveTo(cx - 9 * s, base);
    g.lineTo(cx - 9 * s, base - 18 * s);
    g.arc(cx, base - 18 * s, 9 * s, Math.PI, 0);
    g.lineTo(cx + 9 * s, base);
    g.fill();
    g.fillStyle = '#f4f1de';
    g.beginPath();
    g.arc(cx, base - h - 18 * s, 3.4 * s, 0, TAU);
    g.fill();
  },

  crane(g, cx, base, s, P) {
    const col = P.night > 0.5 ? '#3a3a4a' : mix('#e0a100', P.wall, 0.25);
    g.strokeStyle = col;
    g.lineWidth = 0.5 * s;
    const top = base - 150 * s;
    g.beginPath();
    for (let y = base; y > top; y -= 5 * s) {
      g.moveTo(cx - 2 * s, y);
      g.lineTo(cx + 2 * s, y - 5 * s);
      g.moveTo(cx + 2 * s, y);
      g.lineTo(cx - 2 * s, y - 5 * s);
    }
    g.moveTo(cx - 2 * s, base);
    g.lineTo(cx - 2 * s, top);
    g.moveTo(cx + 2 * s, base);
    g.lineTo(cx + 2 * s, top);
    g.moveTo(cx - 30 * s, top);
    g.lineTo(cx + 80 * s, top);
    g.moveTo(cx - 30 * s, top + 3 * s);
    g.lineTo(cx + 80 * s, top + 3 * s);
    for (let x = cx - 30 * s; x < cx + 80 * s; x += 4 * s) {
      g.moveTo(x, top);
      g.lineTo(x + 4 * s, top + 3 * s);
    }
    g.moveTo(cx, top);
    g.lineTo(cx, top - 14 * s);
    g.lineTo(cx + 60 * s, top);
    g.moveTo(cx, top - 14 * s);
    g.lineTo(cx - 28 * s, top);
    g.moveTo(cx + 55 * s, top + 3 * s);
    g.lineTo(cx + 55 * s, top + 45 * s);
    g.stroke();
    box(g, cx - 30 * s, top + 3 * s, 10 * s, 6 * s, shade(col, -0.3));
    box(g, cx + 52 * s, top + 45 * s, 6 * s, 3 * s, shade(col, -0.3));
    if (P.night > 0.3) box(g, cx + 79 * s, top - 1 * s, 1.5 * s, 1.5 * s, '#ff4d4d');
  },

  metro(g, cx, base, s) {
    box(g, cx - 0.6 * s, base - 24 * s, 1.2 * s, 24 * s, '#555');
    box(g, cx - 5 * s, base - 32 * s, 10 * s, 9 * s, '#c8102e');
    g.fillStyle = '#ffd400';
    g.font = `bold ${8 * s}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('M', cx, base - 27.4 * s);
  },

  neon(g, cx, base, s, P) {
    g.fillStyle = 'rgba(255, 79, 163, 0.25)';
    g.fillRect(cx - 18 * s, base - 46 * s, 36 * s, 12 * s);
    g.strokeStyle = '#ff4fa3';
    g.lineWidth = 0.8 * s;
    g.strokeRect(cx - 16 * s, base - 44 * s, 32 * s, 8 * s);
    g.fillStyle = '#ffd6ec';
    g.font = `bold ${6 * s}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(NEON_SIGNS[1], cx, base - 40 * s);
  },
};

function drawSky(g, T, w, h, rnd) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, T.sky[0]);
  grad.addColorStop(0.55, T.sky[1]);
  grad.addColorStop(1, T.sky[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (T.night > 0.5) {
    for (let i = 0; i < 120; i++) {
      g.globalAlpha = 0.3 + rnd() * 0.7;
      g.fillStyle = '#ffffff';
      const s = rnd() < 0.1 ? 1.2 : 0.6;
      g.fillRect(rnd() * w, rnd() * h * 0.6, s, s);
    }
    g.globalAlpha = 1;
  }
  const S = T.sun;
  const sx = S.x * w;
  const sy = S.y * h;
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, S.r * 5);
  glow.addColorStop(0, S.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = glow;
  g.fillRect(sx - S.r * 5, sy - S.r * 5, S.r * 10, S.r * 10);
  g.fillStyle = S.color;
  g.beginPath();
  g.arc(sx, sy, S.r, 0, TAU);
  g.fill();
  if (S.moon) {
    g.fillStyle = T.sky[0];
    g.beginPath();
    g.arc(sx + S.r * 0.45, sy - S.r * 0.2, S.r * 0.85, 0, TAU);
    g.fill();
  }
}

function drawClouds(g, T, w, h, rnd) {
  g.fillStyle = T.clouds;
  for (let i = 0; i < Math.ceil(w / 120); i++) {
    const cx = rnd() * w;
    const cy = 20 + rnd() * h * 0.35;
    const s = 0.6 + rnd() * 1.1;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.ellipse(cx + (k - 3) * 7 * s, cy + Math.sin(k * 1.7) * 2 * s, 9 * s, (4 + (k % 3)) * s, 0, 0, TAU);
      g.fill();
    }
  }
}

export function buildBackdrop(theme, mapPixelWidth, viewW, viewH, makeCanvas, seed = 1, res = 2) {
  const T = TIMES[theme.time] ?? TIMES.day;
  const mk = (w, h) => {
    const cv = makeCanvas(Math.ceil(w * res), Math.ceil(h * res));
    const g = cv.getContext('2d');
    g.scale(res, res);
    return { cv, g, w, h };
  };
  const sky = mk(viewW, viewH);
  drawSky(sky.g, T, viewW, viewH, seededRandom(seed * 11));
  const cloudW = layerWidth(mapPixelWidth, viewW, 0.04) + viewW;
  const clouds = mk(cloudW, viewH);
  drawClouds(clouds.g, T, cloudW, viewH, seededRandom(seed * 13 + 5));
  const layers = theme.layers.map((L, i) => {
    const w = layerWidth(mapPixelWidth, viewW, L.factor);
    const layer = mk(w, viewH);
    const g = layer.g;
    const P = paletteFor(T, L.tone ?? ['far', 'mid', 'near'][i] ?? 'near');
    const rnd = seededRandom(seed * 97 + i * 13);
    const base = viewH - L.base;
    for (const lm of (L.landmarks ?? []).filter((m) => m.behind)) LANDMARKS[lm.type](g, lm.at * w, base, lm.scale ?? 1, P, rnd);
    const fill = FILLERS[L.fill ?? 'none'];
    for (let x = -10; x < w;) x += fill(g, x, base, rnd, P);
    for (const lm of (L.landmarks ?? []).filter((m) => !m.behind)) LANDMARKS[lm.type](g, lm.at * w, base, lm.scale ?? 1, P, rnd);
    const ground = g.createLinearGradient(0, base, 0, viewH);
    ground.addColorStop(0, shade(P.wall, -0.45));
    ground.addColorStop(1, shade(P.wall, -0.7));
    g.fillStyle = ground;
    g.fillRect(0, base, w, viewH - base);
    if (i === 0) {
      const haze = g.createLinearGradient(0, base - 60, 0, base);
      haze.addColorStop(0, 'rgba(0, 0, 0, 0)');
      haze.addColorStop(1, T.haze + '88');
      g.fillStyle = haze;
      g.fillRect(0, base - 60, w, 60);
    }
    return { canvas: layer.cv, factor: L.factor, w };
  });
  return { sky: sky.cv, clouds: { canvas: clouds.cv, w: cloudW }, layers, res, viewW, viewH };
}

export function drawBackdrop(ctx, bd, camX, time = 0) {
  const { viewW, viewH } = bd;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bd.sky, 0, 0, viewW, viewH);
  const drift = (camX * 0.04 + time * 2) % (bd.clouds.w - viewW);
  ctx.drawImage(bd.clouds.canvas, -drift, 0, bd.clouds.w, viewH);
  for (const l of bd.layers) ctx.drawImage(l.canvas, -camX * l.factor, 0, l.w, viewH);
  ctx.imageSmoothingEnabled = false;
}
