// HUD и экраны (SPEC §4). Временная отрисовка; пиксель-арт и портреты — этап 8.

import { SCREEN } from './config.js';
import { UI } from './lines.js';

const W = SCREEN.width;
const H = SCREEN.height;

export const COLORS = Object.freeze({
  bg: '#1a1a2e',
  skyTop: '#2b2d5c',
  skyBottom: '#e07a5f',
  text: '#f4f1de',
  accent: '#f4d35e',
  muted: '#8d99ae',
  shadow: '#0b0b10',
});

export function drawText(ctx, text, x, y, { size = 8, color = COLORS.text, align = 'left', shadow = true, bold = false } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if (shadow) {
    ctx.fillStyle = COLORS.shadow;
    ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

let skyGradient = null;
export function drawSky(ctx) {
  if (!skyGradient) {
    skyGradient = ctx.createLinearGradient(0, 0, 0, H);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
  }
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, W, H);
}

export function drawTitle(ctx, time) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, UI.title, W / 2, H / 2 - 30, { size: 16, color: COLORS.accent, align: 'center', bold: true });
  if (Math.floor(time * 2) % 2 === 0) {
    drawText(ctx, UI.start, W / 2, H / 2 + 10, { align: 'center' });
  }
  drawText(ctx, UI.testMap, W / 2, H - 20, { color: COLORS.muted, align: 'center' });
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(11, 11, 16, 0.6)';
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, UI.paused, W / 2, H / 2 - 16, { size: 16, color: COLORS.accent, align: 'center', bold: true });
  drawText(ctx, UI.resume, W / 2, H / 2 + 6, { align: 'center' });
}

// Пиксельный прицел вместо системного курсора (SPEC §3)
export function drawCrosshair(ctx, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(cx - 5, cy - 1, 4, 3);
  ctx.fillRect(cx + 2, cy - 1, 4, 3);
  ctx.fillRect(cx - 1, cy - 5, 3, 4);
  ctx.fillRect(cx - 1, cy + 2, 3, 4);
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(cx - 4, cy, 3, 1);
  ctx.fillRect(cx + 2, cy, 3, 1);
  ctx.fillRect(cx, cy - 4, 1, 3);
  ctx.fillRect(cx, cy + 2, 1, 3);
}

// Реплика над головой (SPEC §5, §12)
export function drawBubble(ctx, text, x, y) {
  ctx.font = 'bold 8px monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 6;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - 14);
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(bx, by, w, 11);
  ctx.fillRect(Math.round(x) - 1, by + 11, 3, 2);
  ctx.fillStyle = COLORS.shadow;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, Math.round(x), by + 2);
}
