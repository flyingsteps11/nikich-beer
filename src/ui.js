// HUD и экраны (SPEC §4). Временная отрисовка; пиксель-арт и портреты — этап 8.

import { SCREEN } from './config.js';
import { UI, UPGRADE_TEXT } from './lines.js';

const W = SCREEN.width;
const H = SCREEN.height;

export const COLORS = Object.freeze({
  bg: '#1a1a2e',
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

// Табличка Подсказки на Уровне: x — центр, y — низ таблички (экранные координаты)
export function drawSign(ctx, text, x, y) {
  ctx.font = '7px monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 8;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - 12);
  ctx.fillStyle = 'rgba(11, 11, 16, 0.7)';
  ctx.fillRect(bx, by, w, 12);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(bx, by + 11, w, 1);
  drawText(ctx, text, x, by + 2, { size: 7, align: 'center', shadow: false });
}

// Название Уровня на старте; alpha — для затухания
export function drawLevelBanner(ctx, label, name, alpha) {
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = 'rgba(11, 11, 16, 0.6)';
  ctx.fillRect(0, H / 2 - 52, W, 34);
  drawText(ctx, label, W / 2, H / 2 - 49, { size: 8, color: COLORS.muted, align: 'center' });
  drawText(ctx, name, W / 2, H / 2 - 39, { size: 14, color: COLORS.accent, align: 'center', bold: true });
  ctx.globalAlpha = 1;
}

// Разбивка текста на строки не шире maxW (шрифт должен быть уже выставлен в ctx)
export function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Пункты меню титульного экрана: прямоугольники для мыши и отрисовки
export function menuItemRect(i) {
  return { x: W / 2 - 90, y: H / 2 + 2 + i * 20, w: 180, h: 16 };
}

export function inRect(r, x, y) {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

// menu: { items: [подписи], selected, question?, note? }
export function drawTitle(ctx, time, menu) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, UI.title, W / 2, H / 2 - 50, { size: 16, color: COLORS.accent, align: 'center', bold: true });
  if (menu.question) drawText(ctx, menu.question, W / 2, H / 2 - 18, { color: '#e63946', align: 'center' });
  else if (menu.note) drawText(ctx, menu.note, W / 2, H / 2 - 18, { size: 7, color: COLORS.muted, align: 'center' });
  menu.items.forEach((label, i) => {
    const r = menuItemRect(i);
    const sel = i === menu.selected;
    if (sel) {
      ctx.fillStyle = 'rgba(244, 211, 94, 0.15)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    const text = sel ? `> ${label} <` : label;
    drawText(ctx, text, W / 2, r.y + 4, { align: 'center', color: sel ? COLORS.accent : COLORS.text, bold: sel });
  });
  drawText(ctx, UI.menuHint, W / 2, H - 16, { size: 7, color: COLORS.muted, align: 'center' });
}

// Карточки выбора Улучшения
const CARD = Object.freeze({ w: 140, h: 112, gap: 10, y: 58 });

export function upgradeCardRect(i, count = 3) {
  const x0 = (W - (count * CARD.w + (count - 1) * CARD.gap)) / 2;
  return { x: x0 + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h };
}

export function drawUpgradeChoice(ctx, ids, selected, ready, time) {
  ctx.fillStyle = 'rgba(11, 11, 16, 0.88)';
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, UI.upgradeTitle, W / 2, 22, { size: 14, color: COLORS.accent, align: 'center', bold: true });
  ids.forEach((id, i) => {
    const t = UPGRADE_TEXT[id];
    const r = upgradeCardRect(i, ids.length);
    const sel = i === selected;
    ctx.fillStyle = sel ? '#2f3a52' : '#22263a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = sel ? COLORS.accent : '#3a3f58';
    ctx.fillRect(r.x, r.y, r.w, 2);
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    drawText(ctx, String(i + 1), r.x + 6, r.y + 6, { size: 8, color: COLORS.muted });
    let y = r.y + 20;
    ctx.font = 'bold 10px monospace';
    for (const l of wrapText(ctx, t.name, r.w - 12)) {
      drawText(ctx, l, r.x + r.w / 2, y, { size: 10, bold: true, align: 'center', color: COLORS.accent });
      y += 12;
    }
    y += 6;
    ctx.font = '8px monospace';
    for (const l of wrapText(ctx, t.effect, r.w - 12)) {
      drawText(ctx, l, r.x + r.w / 2, y, { size: 8, align: 'center' });
      y += 10;
    }
    y += 8;
    ctx.font = '7px monospace';
    for (const l of wrapText(ctx, `«${t.joke}»`, r.w - 12)) {
      drawText(ctx, l, r.x + r.w / 2, y, { size: 7, align: 'center', color: COLORS.muted });
      y += 9;
    }
  });
  if (ready && Math.floor(time * 2) % 2 === 0) drawText(ctx, UI.upgradeHint, W / 2, H - 30, { color: COLORS.accent, align: 'center' });
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

function bar(ctx, x, y, w, h, frac, color, back = '#2a2a3a') {
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
}

// HUD: здоровье, жизни, шкала супера, эффекты Предметов, таймер, очки, перезарядки атак.
// run: { timeText, lowTime, score }; effects: [{ label, left }]
export function drawHud(ctx, n, A, time, run = null, effects = []) {
  bar(ctx, 6, 6, 70, 6, n.health / n.maxHealth, '#e63946');
  drawText(ctx, `${UI.lives} ${n.lives}`, 82, 4);
  effects.forEach((e, i) => {
    drawText(ctx, `${e.label} ${Math.ceil(e.left)}`, 6, 24 + i * 9, { size: 7, color: e.color ?? COLORS.text });
  });
  if (run && run.timeText) {
    const blinkLow = run.lowTime && Math.floor(time * 2) % 2 === 0;
    drawText(ctx, run.timeText, W / 2 - 40, 3, { size: 12, align: 'center', bold: true, color: blinkLow ? '#e63946' : COLORS.text });
  }
  if (run) drawText(ctx, `${UI.score} ${run.score}`, W / 2 - 40, 17, { size: 7, align: 'center', color: COLORS.accent });
  const full = n.superMeter >= A.super.meterMax;
  const blink = full && Math.floor(time * 4) % 2 === 0;
  bar(ctx, 6, 16, 70, 4, n.superMeter / A.super.meterMax, blink ? '#ffffff' : COLORS.accent);

  const slots = [
    [UI.keyShot, UI.abilityShot, n.cooldowns.shot, A.shot.cooldown],
    [UI.keyDog, UI.abilityDog, n.cooldowns.dog, A.dog.cooldown],
    [UI.keyStun, UI.abilityStun, n.cooldowns.stun, A.stun.cooldown],
    [UI.keySuper, UI.abilitySuper, full ? 0 : 1, 1],
  ];
  const w = 46;
  let x = W - slots.length * (w + 3) - 3;
  for (const [key, name, cd, max] of slots) {
    const ready = cd <= 0;
    ctx.fillStyle = ready ? '#3d5a40' : '#3a2a2a';
    ctx.fillRect(x, 4, w, 18);
    if (!ready) {
      ctx.fillStyle = '#5a3a3a';
      ctx.fillRect(x, 4, Math.round(w * (1 - cd / max)), 18);
    }
    drawText(ctx, key, x + 2, 5, { size: 7, color: COLORS.muted, shadow: false });
    drawText(ctx, name, x + 2, 13, { size: 7, color: ready ? COLORS.text : COLORS.muted, shadow: false });
    x += w + 3;
  }
}

// Реплика над головой (SPEC §5, §12)
// Проигрыш (SPEC §4): «Я гнию изнутри» + фраза из пула, «Ещё раз». Фото «на полу» — этап 8.
export function drawLose(ctx, reason, line, ready, time) {
  ctx.fillStyle = 'rgba(20, 8, 12, 0.85)';
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, UI.loseTitle, W / 2, H / 2 - 44, { size: 16, color: '#e63946', align: 'center', bold: true });
  drawText(ctx, reason, W / 2, H / 2 - 20, { color: COLORS.muted, align: 'center' });
  drawText(ctx, `«${line}»`, W / 2, H / 2 - 4, { align: 'center' });
  if (ready && Math.floor(time * 2) % 2 === 0) drawText(ctx, UI.retry, W / 2, H / 2 + 26, { color: COLORS.accent, align: 'center' });
}

// Уровень пройден: статистика и «дальше»
export function drawLevelDone(ctx, lines, prompt, ready, time) {
  ctx.fillStyle = 'rgba(11, 20, 16, 0.85)';
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, UI.levelDone, W / 2, H / 2 - 50, { size: 16, color: COLORS.accent, align: 'center', bold: true });
  lines.forEach((l, i) => drawText(ctx, l, W / 2, H / 2 - 22 + i * 11, { align: 'center' }));
  if (ready && Math.floor(time * 2) % 2 === 0) drawText(ctx, prompt, W / 2, H / 2 + 40, { color: COLORS.accent, align: 'center' });
}

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
