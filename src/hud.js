import { wowTextures, ok, smooth, baked, drawBaked, drawIcon, wowText, statusFill, tinted, drawInfoTooltip, WOW, WOW_FONT } from './wow.js';

const TAU = Math.PI * 2;

export const LAYOUT = Object.freeze({
  frameK: 0.56,
  barK: 0.56,
  capK: 0.56,
  plateK: 0.22,
});

const FRAME = Object.freeze({
  crop: { sx: 26, sy: 6, sw: 196, sh: 82 },
  elite: { sx: 26, sy: 0, sw: 230, sh: 100 },
  name: { x: 31, y: 23, w: 116, h: 17 },
  hp: { x: 31, y: 41, w: 116, h: 11 },
  mana: { x: 31, y: 53, w: 116, h: 10 },
  portrait: { x: 182, y: 44, r: 31 },
  level: { x: 202, y: 65 },
});

const STRIPS = Object.freeze([
  { sy: 137, centers: [21.5, 63.5, 105.5, 147.5, 189, 231] },
  { sy: 201, centers: [24, 68, 110, 152, 194, 236] },
]);
const STRIP = Object.freeze({ w: 256, h: 55, cy: 34, button: 36, xp: { y: 5, h: 7 } });

export const HUD_BAR_HEIGHT = Math.ceil(STRIP.h * LAYOUT.barK);
const AURA = Object.freeze({ size: 12, gap: 2.5 });

const COLORS = Object.freeze({
  hp: '#00ff00',
  hpLow: '#ffd200',
  hostile: '#ff0000',
  neutral: '#ffff00',
  friendly: '#00ff00',
  mana: '#0000ff',
  shield: '#7ab8ff',
  trail: '#ffffff',
  xp: '#9400d1',
  nameHostile: '#ff0000',
  nameFriendly: '#00ff00',
});

let beerCan = null;

export function setHudBeerCan(img) {
  beerCan = img;
}

export function buildHudAssets() {
  wowTextures();
  return { slotState: [], trails: {}, lastTime: null, shelf: null };
}

function buildShelf(W, h, res) {
  if (!ok(beerCan)) return null;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * res);
  cv.height = Math.ceil(h * res);
  const g = cv.getContext('2d');
  g.scale(res, res);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1b1309');
  bg.addColorStop(0.55, '#0e0a05');
  bg.addColorStop(1, '#050302');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, h);
  const ch = h - 5.5;
  const cw = ch * (beerCan.naturalWidth / beerCan.naturalHeight);
  const step = cw + 2.2;
  const floor = h - 2.2;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  for (let i = 0, x = 1.5; x < W; i++, x += step) {
    const y = floor - ch - (i % 2 ? 0.6 : 0);
    g.fillStyle = 'rgba(0, 0, 0, 0.55)';
    g.beginPath();
    g.ellipse(x + cw / 2 + 0.6, floor + 0.2, cw * 0.55, 0.9, 0, 0, TAU);
    g.fill();
    g.drawImage(beerCan, x, y, cw, ch);
    g.save();
    g.globalAlpha = 0.18;
    g.translate(0, floor * 2);
    g.scale(1, -1);
    g.drawImage(beerCan, x, y, cw, ch);
    g.restore();
  }
  g.fillStyle = 'rgba(0, 0, 0, 0.35)';
  g.fillRect(0, 0, W, h);
  const lip = g.createLinearGradient(0, floor - 0.2, 0, h);
  lip.addColorStop(0, '#6b4b22');
  lip.addColorStop(0.3, '#3a2610');
  lip.addColorStop(1, '#140c04');
  g.fillStyle = lip;
  g.fillRect(0, floor, W, h - floor);
  g.fillStyle = 'rgba(255, 220, 150, 0.35)';
  g.fillRect(0, floor, W, 0.3);
  g.fillStyle = 'rgba(0, 0, 0, 0.8)';
  g.fillRect(0, 0, W, 0.6);
  return { canvas: cv, w: W, h };
}

function trail(A, key, value, dt) {
  const t = A.trails[key] ?? (A.trails[key] = { v: value, hold: 0 });
  if (value >= t.v) {
    t.v = value;
    t.hold = 0;
  } else if ((t.hold += dt) > 0.35) {
    t.v = Math.max(value, t.v - dt * 0.6);
  }
  return t.v;
}

function fmtTime(sec) {
  if (sec >= 60) return `${Math.ceil(sec / 60)}m`;
  if (sec >= 3) return `${Math.ceil(sec)}`;
  return sec.toFixed(1);
}

function ease(t) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

function unitFrame(c, A, o, dt) {
  const T = wowTextures();
  const k = LAYOUT.frameK;
  const img = o.elite ? T.elite : T.target;
  const crop = o.elite ? FRAME.elite : FRAME.crop;
  const X = (tx) => o.x + (o.mirror ? FRAME.crop.sx + FRAME.crop.sw - tx : tx - FRAME.crop.sx) * k;
  const Y = (ty) => o.y + (ty - FRAME.crop.sy) * k;
  const rect = (r) => {
    const x0 = X(r.x);
    const x1 = X(r.x + r.w);
    return { x: Math.min(x0, x1), y: Y(r.y), w: Math.abs(x1 - x0), h: r.h * k };
  };
  const P = FRAME.portrait;
  const px = X(P.x);
  const py = Y(P.y);
  const pr = P.r * k;
  c.save();
  c.beginPath();
  c.arc(px, py, pr, 0, TAU);
  c.clip();
  c.fillStyle = '#000';
  c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  if (o.face && o.face.img) {
    const s = Math.max((pr * 2.2) / o.face.w, (pr * 2.2) / o.face.h);
    smooth(c, () => c.drawImage(o.face.img, px - (o.face.w * s) / 2, py - (o.face.h * s) / 2 + pr * 0.12, o.face.w * s, o.face.h * s));
  } else if (o.portrait) {
    o.portrait(c, px, py, pr);
  }
  if (o.hurt) {
    c.fillStyle = 'rgba(255, 0, 0, 0.35)';
    c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  c.restore();
  const nb = rect(FRAME.name);
  c.fillStyle = 'rgba(0, 0, 0, 0.55)';
  c.fillRect(nb.x, nb.y, nb.w, nb.h + FRAME.hp.h * k + FRAME.mana.h * k + 2 * k);
  if (o.nameBg) statusFill(c, nb.x, nb.y, nb.w, nb.h, 1, o.nameBg);
  const hb = rect(FRAME.hp);
  const frac = o.hp / o.hpMax;
  const tr = trail(A, o.key, frac, dt);
  if (tr > frac) {
    c.fillStyle = 'rgba(255, 255, 255, 0.75)';
    c.fillRect(hb.x + hb.w * frac, hb.y, hb.w * (tr - frac), hb.h);
  }
  statusFill(c, hb.x, hb.y, hb.w, hb.h, frac, o.hpColor);
  if (o.phaseHealth) {
    for (let v = o.phaseHealth; v < o.hpMax; v += o.phaseHealth) {
      c.fillStyle = 'rgba(0, 0, 0, 0.9)';
      c.fillRect(hb.x + hb.w * (v / o.hpMax) - 0.3, hb.y, 0.6, hb.h);
    }
  }
  const mb = rect(FRAME.mana);
  if (o.manaMax) statusFill(c, mb.x, mb.y, mb.w, mb.h, o.mana / o.manaMax, COLORS.mana);
  if (ok(img)) {
    const cw = crop.sw * k;
    const ch = crop.sh * k;
    const ox = o.x + (crop.sx - FRAME.crop.sx) * k;
    const oy = o.y + (crop.sy - FRAME.crop.sy) * k;
    const e = baked(c, `frame|${o.elite ? 1 : 0}|${o.mirror ? 1 : 0}`, cw, ch, (g) => {
      if (o.mirror) {
        g.translate(cw, 0);
        g.scale(-1, 1);
      }
      g.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cw, ch);
    });
    drawBaked(c, e, o.mirror ? o.x * 2 + FRAME.crop.sw * k - ox - cw : ox, oy);
  }
  if (o.flash) {
    c.save();
    c.globalAlpha = 0.35 + Math.sin(o.time * 8) * 0.25;
    c.strokeStyle = '#ff0000';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(px, py, pr + 1.2, 0, TAU);
    c.stroke();
    c.restore();
  }
  wowText(c, o.name, nb.x + nb.w / 2, nb.y + nb.h / 2 + 0.3, { size: 5.6, color: o.nameColor ?? WOW.gold, align: 'center', outline: 0.7 });
  wowText(c, `${Math.ceil(Math.max(0, o.hp))} / ${Math.round(o.hpMax)}`, hb.x + hb.w / 2, hb.y + hb.h / 2 + 0.3, { size: 4.8, color: WOW.white, align: 'center', outline: 0.7 });
  if (o.manaMax) wowText(c, `${o.manaLabel} ${Math.floor(o.mana)} / ${o.manaMax}`, mb.x + mb.w / 2, mb.y + mb.h / 2 + 0.3, { size: 4.4, color: WOW.white, align: 'center', outline: 0.7 });
  const lx = X(FRAME.level.x);
  const ly = Y(FRAME.level.y);
  if (o.level === '??' && ok(T.skull)) smooth(c, () => c.drawImage(T.skull, lx - 4.5, ly - 4.5, 9, 9));
  else wowText(c, String(o.level), lx, ly + 0.4, { size: 5.6, color: WOW.gold, align: 'center', outline: 0.7 });
  if (o.cls || o.sub) {
    const cy = Y(FRAME.mana.y + FRAME.mana.h) + 6;
    const cx = mb.x + mb.w / 2;
    if (o.cls) {
      c.font = `5px ${WOW_FONT}`;
      const a = c.measureText(o.cls).width;
      const b = c.measureText(` ${o.levelText}`).width;
      const sx = cx - (a + b) / 2;
      wowText(c, o.cls, sx, cy, { size: 5, color: WOW.green, outline: 0.6 });
      wowText(c, ` ${o.levelText}`, sx + a, cy, { size: 5, color: WOW.white, outline: 0.6 });
    }
    if (o.sub) wowText(c, o.sub, cx, cy + (o.cls ? 6 : 0), { size: 4.6, color: WOW.grey, align: 'center', outline: 0.6 });
  }
}

function slotCenters(bx, by) {
  const k = LAYOUT.barK;
  const out = [];
  STRIPS.forEach((s, i) => {
    for (const cx of s.centers) out.push([bx + (i * STRIP.w + cx) * k, by + STRIP.cy * k]);
  });
  return out;
}

function drawBar(c, x, y, progress) {
  const T = wowTextures();
  const k = LAYOUT.barK;
  const w = STRIP.w * 2 * k;
  c.fillStyle = '#000';
  c.fillRect(x, y + STRIP.xp.y * k, w, STRIP.xp.h * k);
  statusFill(c, x, y + STRIP.xp.y * k, w, STRIP.xp.h * k, progress, COLORS.xp);
  if (!ok(T.bar)) return;
  const e = baked(c, 'bar', w, STRIP.h * k, (g) => {
    STRIPS.forEach((s, i) => g.drawImage(T.bar, 0, s.sy, STRIP.w, STRIP.h, i * STRIP.w * k, 0, STRIP.w * k, STRIP.h * k));
  });
  drawBaked(c, e, x, y);
}

function drawCaps(c, x, y, w) {
  const T = wowTextures();
  if (!ok(T.cap)) return;
  const k = LAYOUT.capK;
  const s = 128 * k;
  const bottom = y + STRIP.h * LAYOUT.barK;
  const left = baked(c, 'cap|0', s, s, (g) => g.drawImage(T.cap, 0, 0, s, s));
  const right = baked(c, 'cap|1', s, s, (g) => {
    g.translate(s, 0);
    g.scale(-1, 1);
    g.drawImage(T.cap, 0, 0, s, s);
  });
  drawBaked(c, left, x - s + 30 * k, bottom - s);
  drawBaked(c, right, x + w - 30 * k, bottom - s);
}

function sweep(c, x, y, s, frac) {
  if (frac <= 0) return;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const a = -Math.PI / 2 + TAU * (1 - frac);
  c.save();
  c.beginPath();
  c.rect(x, y, s, s);
  c.clip();
  c.fillStyle = 'rgba(0, 0, 0, 0.72)';
  c.beginPath();
  c.moveTo(cx, cy);
  c.arc(cx, cy, s, a, -Math.PI / 2 + TAU);
  c.closePath();
  c.fill();
  const g = c.createLinearGradient(cx, cy, cx + Math.cos(a) * s * 0.75, cy + Math.sin(a) * s * 0.75);
  g.addColorStop(0, 'rgba(255, 240, 200, 0)');
  g.addColorStop(1, 'rgba(255, 240, 200, 0.95)');
  c.strokeStyle = g;
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
  c.stroke();
  c.restore();
}

function bling(c, cx, cy, s, t) {
  const img = wowTextures().star;
  if (!ok(img) || t >= 1) return;
  const k = ease(t);
  const size = s * (0.9 + k * 0.9);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 1 - t;
  c.translate(cx, cy);
  c.rotate(k * 1.2);
  smooth(c, () => c.drawImage(img, -size / 2, -size / 2, size, size));
  c.restore();
}

function procGlow(c, cx, cy, s, time) {
  const T = wowTextures();
  c.save();
  c.globalCompositeOperation = 'lighter';
  if (ok(T.alert)) {
    const g = s * 1.42;
    c.globalAlpha = 0.65 + Math.sin(time * 4) * 0.25;
    smooth(c, () => c.drawImage(T.alert, 1, 71, 64, 64, cx - g / 2, cy - g / 2, g, g));
  }
  if (ok(T.ants)) {
    const f = Math.floor(time / 0.02) % 22;
    const a = s * 1.3;
    c.globalAlpha = 1;
    smooth(c, () => c.drawImage(T.ants, (f % 5) * 48, Math.floor(f / 5) * 48, 48, 48, cx - a / 2, cy - a / 2, a, a));
  }
  c.restore();
}

function drawSlot(c, A, i, sl, cx, cy, time, dt) {
  const T = wowTextures();
  const s = STRIP.button * LAYOUT.barK;
  const st = A.slotState[i] ?? (A.slotState[i] = { prev: 0, bling: 1, press: 0, meter: sl.meter ?? 0 });
  if (st.prev > 0 && sl.cd <= 0) st.bling = 0;
  if (sl.meter !== undefined) {
    if (st.meter < 1 && sl.meter >= 1) st.bling = 0;
    st.meter += (sl.meter - st.meter) * Math.min(1, dt * 8);
  }
  st.prev = sl.cd;
  st.bling = Math.min(1, st.bling + dt / 0.45);
  st.press = sl.pressed ? Math.min(1, st.press + dt / 0.05) : Math.max(0, st.press - dt / 0.15);
  const sz = s * (1 - 0.06 * ease(st.press));
  const x = cx - sz / 2;
  const y = cy - sz / 2;
  drawIcon(c, sl.icon, x, y, sz);
  if (sl.disabled) {
    c.fillStyle = 'rgba(160, 20, 20, 0.55)';
    c.fillRect(x, y, sz, sz);
  }
  sweep(c, x, y, sz, sl.max ? Math.max(0, Math.min(1, sl.cd / sl.max)) : 0);
  if (sl.meter !== undefined && st.meter < 0.999) {
    const mh = sz * (1 - st.meter);
    c.fillStyle = 'rgba(0, 0, 0, 0.68)';
    c.fillRect(x, y, sz, mh);
    c.fillStyle = 'rgba(255, 210, 90, 0.9)';
    c.fillRect(x, y + mh - 0.4, sz, 0.4);
  }
  if (st.press > 0 && ok(T.depress)) {
    c.save();
    c.globalAlpha = st.press;
    smooth(c, () => c.drawImage(T.depress, x, y, sz, sz));
    c.restore();
  }
  if (st.press > 0 && ok(T.hilight)) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = st.press * 0.8;
    smooth(c, () => c.drawImage(T.hilight, x, y, sz, sz));
    c.restore();
  }
  if (ok(T.slot)) {
    const n = s * (66 / 36);
    smooth(c, () => c.drawImage(T.slot, cx - n / 2, cy - n / 2, n, n));
  }
  if (sl.passive && ok(T.checked)) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.35;
    smooth(c, () => c.drawImage(T.checked, x, y, sz, sz));
    c.restore();
  }
  if (sl.glow) procGlow(c, cx, cy, s, time);
  bling(c, cx, cy, s, st.bling);
  if (sl.cd > 0) wowText(c, fmtTime(sl.cd), cx, cy + 0.4, { size: sl.cd < 3 ? 7.4 : 8.4, align: 'center', color: sl.cd < 3 ? '#ff5050' : WOW.white, outline: 1.1 });
  else if (sl.meter !== undefined && st.meter < 0.999) wowText(c, `${Math.floor(st.meter * 100)}%`, cx, cy + 0.4, { size: 5.6, align: 'center', outline: 1 });
  if (sl.key) wowText(c, sl.key, x + sz - 0.8, y + 2.8, { size: 4.6, align: 'right', color: sl.disabled ? '#ff4040' : '#d0d0d0', outline: 0.8 });
  if (sl.count) wowText(c, String(sl.count), x + sz - 0.8, y + sz - 2.6, { size: 5.6, align: 'right', color: WOW.white, outline: 0.9 });
}

function drawAuras(c, list, x, y, time, debuff, hits) {
  const T = wowTextures();
  const border = debuff ? tinted(T.debuff, '#cc0000') : null;
  list.forEach((b, i) => {
    const bx = x + i * (AURA.size + AURA.gap);
    const low = b.left < 3;
    c.save();
    if (low) c.globalAlpha = 0.45 + Math.abs(Math.sin(time * 5)) * 0.55;
    drawIcon(c, b.icon, bx, y, AURA.size);
    c.restore();
    if (border) {
      const e = AURA.size * (34 / 30);
      smooth(c, () => c.drawImage(border, bx - (e - AURA.size) / 2, y - (e - AURA.size) / 2, e, e));
    } else {
      c.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      c.lineWidth = 0.5;
      c.strokeRect(bx, y, AURA.size, AURA.size);
    }
    if (b.stacks > 1) wowText(c, String(b.stacks), bx + AURA.size - 0.4, y + AURA.size - 2.2, { size: 6, align: 'right', outline: 0.9 });
    wowText(c, fmtTime(b.left), bx + AURA.size / 2, y + AURA.size + 3.4, { size: 4.8, align: 'center', color: WOW.gold, outline: 0.7 });
    hits.push({ x: bx, y, w: AURA.size, h: AURA.size, tip: b.tip, left: b.left, debuff });
  });
}

function auraTip(h) {
  const t = h.tip;
  const rows = [{ text: t.name, size: 7, color: h.debuff ? '#ff2020' : WOW.white, gap: 1 }, { text: t.desc, size: 5.6, color: WOW.gold }];
  rows.push({ text: `${t.leftLabel}: ${fmtTime(h.left)} с`, size: 5.4, color: WOW.grey });
  return rows;
}

function slotTip(h) {
  const t = h.tip;
  const rows = [{ text: t.name, size: 7, color: WOW.white, right: t.key, wrap: false, gap: 1 }];
  if (t.cdText) rows.push({ text: t.cdText, size: 5.4, color: WOW.white });
  rows.push({ text: t.desc, size: 5.6, color: WOW.gold });
  return rows;
}

function hitAt(hits, m) {
  return hits.find((h) => m.x >= h.x && m.x < h.x + h.w && m.y >= h.y && m.y < h.y + h.h) ?? null;
}

export function drawWowHud(c, A, s, time, W, H = 270) {
  const dt = A.lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - A.lastTime));
  A.lastTime = time;
  const k = LAYOUT.frameK;
  const low = s.hp <= s.hpMax * 0.3;
  unitFrame(c, A, {
    key: 'player', x: 0, y: 0, mirror: true, face: s.face, name: s.name, level: s.level,
    hp: s.hp, hpMax: s.hpMax, mana: s.mana, manaMax: s.manaMax, manaLabel: s.manaLabel,
    hpColor: COLORS.hp, hurt: s.hurt, flash: low, time,
  }, dt);
  const fy = (FRAME.crop.sh - 6) * k;
  if (s.infinite) {
    wowText(c, s.infiniteLabel, 8, fy + 4, { size: 8, color: '#ff3030', outline: 0.9 });
  } else {
    for (let i = 0; i < Math.min(s.lives, 6); i++) {
      const lx = 6 + i * 7;
      const ly = fy + 1;
      c.save();
      c.shadowColor = 'rgba(0, 0, 0, 0.8)';
      c.shadowBlur = 1.2;
      c.shadowOffsetY = 0.5;
      const g = c.createRadialGradient(lx + 1.6, ly + 1, 0.2, lx + 2.5, ly + 2.5, 4);
      g.addColorStop(0, '#ff9a9a');
      g.addColorStop(1, '#9a0c10');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(lx + 2.5, ly + 4.6);
      c.bezierCurveTo(lx - 1, ly + 2, lx, ly - 1, lx + 2.5, ly + 1);
      c.bezierCurveTo(lx + 5, ly - 1, lx + 6, ly + 2, lx + 2.5, ly + 4.6);
      c.fill();
      c.restore();
    }
  }
  const hits = [];
  drawAuras(c, s.buffs, 6, fy + 9, time, false, hits);
  drawAuras(c, s.debuffs ?? [], 6, fy + 9 + AURA.size + 9, time, true, hits);

  if (s.target) {
    const t = s.target;
    unitFrame(c, A, {
      key: t.key ?? 'target', x: 116, y: 0, mirror: false, elite: t.elite, face: t.face, portrait: t.portrait,
      name: t.name, level: t.level, hp: t.hp, hpMax: t.max, mana: 0, manaMax: 0,
      hpColor: t.shielded && Math.floor(time * 6) % 2 ? COLORS.shield : COLORS.hp,
      nameBg: t.friendly ? COLORS.friendly : COLORS.hostile, nameColor: WOW.white,
      cls: t.cls, levelText: t.levelText, sub: t.sub, phaseHealth: t.phaseHealth, time,
    }, dt);
  }

  if (s.timer || s.wave) {
    const tx = W - 28;
    if (s.timer) wowText(c, s.timer.text, tx, 9, { size: 10, align: 'center', color: s.timer.low && Math.floor(time * 2) % 2 ? '#ff3030' : WOW.white, outline: 1.1 });
    if (s.wave) wowText(c, s.wave, tx, 27, { size: 6.4, align: 'center', color: '#ff5050', outline: 0.8 });
  }

  const bw = STRIP.w * 2 * LAYOUT.barK;
  const bh = STRIP.h * LAYOUT.barK;
  const bx = (W - bw) / 2;
  const by = H - bh;
  if (!A.shelf && ok(beerCan)) A.shelf = buildShelf(W, bh, c.getTransform().a);
  if (A.shelf) c.drawImage(A.shelf.canvas, 0, by, A.shelf.w, A.shelf.h);
  drawBar(c, bx, by, s.progress ?? 0);
  const centers = slotCenters(bx, by);
  const half = STRIP.button * LAYOUT.barK / 2;
  s.slots.forEach((sl, i) => {
    if (!sl || !centers[i]) return;
    drawSlot(c, A, i, sl, centers[i][0], centers[i][1], time, dt);
    if (sl.tip) hits.push({ x: centers[i][0] - half, y: centers[i][1] - half, w: half * 2, h: half * 2, tip: sl.tip, slot: true });
  });
  drawCaps(c, bx, by, bw);
  if (s.mouse) {
    const h = hitAt(hits, s.mouse);
    if (h) drawInfoTooltip(c, s.mouse.x, s.mouse.y, h.slot ? slotTip(h) : auraTip(h), W, H);
  }
}

function plate(c, x, y, w, frac, color, level, opts = {}) {
  const T = wowTextures();
  const k = w / 136;
  const h = 17 * k;
  const left = x - (105 * k) / 2 - 2 * k;
  const top = y;
  c.fillStyle = 'rgba(0, 0, 0, 0.75)';
  c.fillRect(left + 4 * k, top + 4 * k, 101 * k, 8 * k);
  statusFill(c, left + 4 * k, top + 4 * k, 101 * k, 8 * k, frac, color);
  if (opts.mana !== undefined) {
    statusFill(c, left + 4 * k, top + 9.5 * k, 101 * k, 2.5 * k, opts.mana, COLORS.mana);
  }
  if (ok(T.plate)) drawBaked(c, baked(c, `plate|${w}`, 136 * k, h, (g) => g.drawImage(T.plate, 0, 15, 136, 17, 0, 0, 136 * k, h)), left, top);
  if (level === '??' && ok(T.skull)) smooth(c, () => c.drawImage(T.skull, left + 113 * k, top + 1.5 * k, 16 * k, 14 * k));
  else if (level !== undefined && level !== null) wowText(c, String(level), left + 120.5 * k, top + h / 2 + 0.2, { size: Math.max(3.4, 9 * k), align: 'center', color: WOW.gold, outline: 0.5 });
  return { left, top, h, k };
}

export function drawNameplate(c, x, y, name, frac, { color = 'hostile', nameColor = WOW.white, w = 22, target = false, level = null } = {}) {
  const pw = (target ? 40 : 32) * (w > 0 ? 1 : 0);
  const textY = y - (pw ? 3.6 : 1);
  wowText(c, name, x, textY, { size: target ? 5 : 4.4, align: 'center', color: nameColor, outline: 0.6 });
  if (!pw) return;
  const cols = { hostile: COLORS.hostile, neutral: COLORS.neutral, friendly: COLORS.friendly };
  const r = plate(c, x, y - 1.6, pw, frac, cols[color] ?? COLORS.hostile, level);
  if (target) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    c.lineWidth = 0.5;
    c.strokeRect(r.left + 2.5 * r.k, r.top + 2.5 * r.k, 104 * r.k, 11 * r.k);
    c.restore();
  }
}

export function drawPersonalBars(c, x, y, hpFrac, manaFrac, level = null) {
  plate(c, x, y, 34, hpFrac, COLORS.hp, level, { mana: manaFrac });
}
