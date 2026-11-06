// Текст через кэш картинок (SPEC §13, фаза 2): строка с тенью и обводкой рисуется
// один раз в размере экрана, дальше — одним drawImage вместо 2–3 вызовов текста.

import { RENDER_CACHE } from './config.js';
import { createLru, textBox } from './cache.js';

const lru = createLru(RENDER_CACHE.textEntries);
export const textStats = { built: 0 };

// После загрузки шрифта старые картинки нарисованы запасным — сбрасываем
export function resetTextCache() {
  lru.clear();
}

function paint(g, text, x, y, st) {
  if (st.shadow) {
    g.fillStyle = st.shadow.color;
    g.fillText(text, x + st.shadow.dx, y + st.shadow.dy);
  }
  if (st.outline) {
    g.lineJoin = 'round';
    g.lineWidth = st.outline;
    g.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    g.strokeText(text, x, y);
  }
  g.fillStyle = st.color;
  g.fillText(text, x, y);
}

function build(c, text, st, font, scale) {
  c.font = font;
  const width = c.measureText(text).width;
  const sh = st.shadow ? Math.max(Math.abs(st.shadow.dx), Math.abs(st.shadow.dy)) : 0;
  const pad = (st.outline || 0) / 2 + sh + 1;
  const box = textBox(width, st.size, pad, st.align, st.base);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(box.w * scale));
  cv.height = Math.max(1, Math.ceil(box.h * scale));
  const g = cv.getContext('2d');
  g.scale(scale, scale);
  g.font = font;
  g.textAlign = st.align;
  g.textBaseline = st.base;
  paint(g, text, box.ax, box.ay, st);
  return { cv, w: cv.width / scale, h: cv.height / scale, ax: box.ax, ay: box.ay };
}

// st: { family, size, bold, color, align, base, outline, shadow: null | { dx, dy, color } }
export function drawTextCached(c, text, x, y, st) {
  const font = `${st.bold ? 'bold ' : ''}${st.size}px ${st.family}`;
  const m = c.getTransform();
  // Поворот и наклон — рисуем напрямую (картинка повернулась бы ступеньками)
  if (text === '' || m.b !== 0 || m.c !== 0 || typeof document === 'undefined') {
    c.font = font;
    c.textAlign = st.align;
    c.textBaseline = st.base;
    paint(c, text, x, y, st);
    return;
  }
  const scale = Math.round(Math.abs(m.a) * 100) / 100;
  const sh = st.shadow ? `${st.shadow.dx},${st.shadow.dy},${st.shadow.color}` : '';
  const key = `${scale}|${font}|${st.color}|${st.outline}|${sh}|${st.align}|${st.base}|${text}`;
  let e = lru.get(key);
  if (!e) {
    e = build(c, text, st, font, scale);
    lru.set(key, e);
    textStats.built += 1;
  }
  const was = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(e.cv, x - e.ax, y - e.ay, e.w, e.h);
  c.imageSmoothingEnabled = was;
}
