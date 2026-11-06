// HUD и экраны (SPEC §4). Временная отрисовка; пиксель-арт и портреты — этап 8.

import { SCREEN } from './config.js';
import { UI, UPGRADE_TEXT } from './lines.js';
import { WOW, WOW_FONT, drawDialog, drawButton, drawChatBubble, drawIcon } from './wow.js';

export { WOW, WOW_FONT };

const W = SCREEN.width;
const H = SCREEN.height;

export const COLORS = Object.freeze({
  bg: '#1a1a2e',
  text: '#f4f1de',
  accent: '#f4d35e',
  muted: '#8d99ae',
  shadow: '#0b0b10',
});

export function drawText(ctx, text, x, y, { size = 8, color = COLORS.text, align = 'left', shadow = true, bold = false, font = 'monospace', outline = 0 } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if (shadow) {
    ctx.fillStyle = COLORS.shadow;
    ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
  }
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.strokeText(text, Math.round(x), Math.round(y));
  }
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

function wowText(ctx, text, x, y, opts = {}) {
  drawText(ctx, text, x, y, { font: WOW_FONT, outline: 1, color: WOW.white, ...opts, bold: false });
}

export function drawWowPanel(ctx, x, y, w, h, title = null) {
  drawDialog(ctx, x, y, w, h, title);
}

export function drawWowButton(ctx, box, label, selected = false, time = 0) {
  drawButton(ctx, box, label, { selected, time, size: Math.min(8, box.h * 0.55) });
}

export function drawLevelBanner(ctx, label, name, alpha) {
  ctx.globalAlpha = Math.max(0, alpha);
  wowText(ctx, name, W / 2, H / 2 - 56, { size: 20, color: WOW.gold, align: 'center', bold: true, outline: 2 });
  wowText(ctx, label, W / 2, H / 2 - 32, { size: 9, color: WOW.white, align: 'center', outline: 1.4 });
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

export function drawPhoto(ctx, img, x, y, w, h, scale = 1) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(px - 3, py - 3, w * scale + 6, h * scale + 6);
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(px - 2, py - 2, w * scale + 4, h * scale + 4);
  if (img) {
    ctx.imageSmoothingEnabled = w * scale * ctx.getTransform().a < img.naturalWidth;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(img, px, py, w * scale, h * scale);
    ctx.imageSmoothingQuality = 'low';
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(px, py, w * scale, h * scale);
    drawText(ctx, '?', px + (w * scale) / 2, py + (h * scale) / 2 - 4, { align: 'center', color: COLORS.muted });
  }
}

// Пункты меню титульного экрана: прямоугольники для мыши и отрисовки
export function menuItemRect(i) {
  return { x: W / 2 - 70, y: H / 2 + 2 + i * 20, w: 140, h: 16 };
}

export function inRect(r, x, y) {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

// menu: { items: [подписи], selected, question?, note? }
export function drawTitle(ctx, time, menu) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  const bob = Math.round(Math.sin(time * 2) * 2);
  if (menu.face) drawPhoto(ctx, menu.face.img, 30, 70 + bob, menu.face.w, menu.face.h);
  if (menu.gman) drawPhoto(ctx, menu.gman.img, W - 30 - menu.gman.w, 70 - bob, menu.gman.w, menu.gman.h);
  wowText(ctx, UI.title, W / 2, H / 2 - 62, { size: 20, color: WOW.gold, align: 'center', bold: true, outline: 2 });
  const last = menuItemRect(menu.items.length - 1);
  const top = H / 2 - (menu.question || menu.note ? 28 : 8);
  drawWowPanel(ctx, W / 2 - 86, top, 172, last.y + last.h + 10 - top);
  if (menu.question) wowText(ctx, menu.question, W / 2, H / 2 - 18, { size: 8, color: WOW.red, align: 'center' });
  else if (menu.note) wowText(ctx, menu.note, W / 2, H / 2 - 18, { size: 7, color: WOW.grey, align: 'center' });
  menu.items.forEach((label, i) => drawWowButton(ctx, menuItemRect(i), label, i === menu.selected, time));
  wowText(ctx, UI.menuHint, W / 2, H - 16, { size: 7, color: WOW.grey, align: 'center' });
}

// Карточки выбора Улучшения
const CARD = Object.freeze({ w: 140, h: 132, gap: 10, y: 46 });

export function upgradeCardRect(i, count = 3) {
  const x0 = (W - (count * CARD.w + (count - 1) * CARD.gap)) / 2;
  return { x: x0 + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h };
}

export function drawUpgradeChoice(ctx, ids, selected, ready, time) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(0, 0, W, H);
  wowText(ctx, UI.upgradeTitle, W / 2, 20, { size: 15, color: WOW.gold, align: 'center', bold: true, outline: 1.6 });
  ids.forEach((id, i) => {
    const t = UPGRADE_TEXT[id];
    const r = upgradeCardRect(i, ids.length);
    const sel = i === selected;
    drawWowPanel(ctx, r.x, r.y, r.w, r.h);
    if (sel) {
      const p = 0.5 + Math.sin(time * 5) * 0.5;
      ctx.save();
      ctx.shadowColor = '#ffcc33';
      ctx.shadowBlur = 4 + p * 4;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(255, 209, 0, ${0.7 + p * 0.3})`;
      ctx.beginPath();
      ctx.roundRect(r.x + 0.6, r.y + 0.6, r.w - 1.2, r.h - 1.2, 3);
      ctx.stroke();
      ctx.restore();
    }
    wowText(ctx, String(i + 1), r.x + 10, r.y + 8, { size: 8, color: WOW.grey });
    const is = 24;
    drawIcon(ctx, `up:${id}`, r.x + (r.w - is) / 2, r.y + 10, is);
    ctx.strokeStyle = sel ? WOW.gold : '#000';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(r.x + (r.w - is) / 2, r.y + 10, is, is);
    let y = r.y + 40;
    ctx.font = `10px ${WOW_FONT}`;
    for (const l of wrapText(ctx, t.name, r.w - 14)) {
      wowText(ctx, l, r.x + r.w / 2, y, { size: 10, bold: true, align: 'center', color: WOW.gold });
      y += 12;
    }
    y += 6;
    ctx.font = `8px ${WOW_FONT}`;
    for (const l of wrapText(ctx, t.effect, r.w - 14)) {
      wowText(ctx, l, r.x + r.w / 2, y, { size: 8, align: 'center', color: WOW.green });
      y += 10;
    }
    y += 8;
    ctx.font = `7px ${WOW_FONT}`;
    for (const l of wrapText(ctx, `«${t.joke}»`, r.w - 14)) {
      wowText(ctx, l, r.x + r.w / 2, y, { size: 7, align: 'center', color: WOW.grey });
      y += 9;
    }
  });
  if (ready) {
    ctx.globalAlpha = 0.6 + Math.sin(time * 4) * 0.4;
    wowText(ctx, UI.upgradeHint, W / 2, H - 30, { size: 8, color: WOW.gold, align: 'center' });
    ctx.globalAlpha = 1;
  }
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const items = UI.controlsHint.split(' · ');
  const cols = 2;
  const rows = Math.ceil(items.length / cols);
  const pw = 230;
  const ph = 34 + rows * 11;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  drawWowPanel(ctx, px, py, pw, ph, UI.paused);
  items.forEach((it, i) => {
    const [key, ...rest] = it.split(' ');
    const x = px + 14 + (i % cols) * (pw / 2 - 4);
    const y = py + 14 + Math.floor(i / cols) * 11;
    wowText(ctx, key, x, y, { size: 7, bold: true, color: WOW.gold });
    ctx.font = `7px ${WOW_FONT}`;
    wowText(ctx, rest.join(' '), x + ctx.measureText(key).width + 4, y, { size: 7, color: WOW.white });
  });
  wowText(ctx, UI.resume, W / 2, py + ph - 14, { size: 7, color: WOW.grey, align: 'center' });
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

// Проигрыш (SPEC §4): «Я гнию изнутри» + фраза из пула, «Ещё раз». Фото «на полу» — этап 8.
export function drawLose(ctx, reason, line, ready, time, photo = null) {
  ctx.fillStyle = 'rgba(20, 4, 6, 0.85)';
  ctx.fillRect(0, 0, W, H);
  let cx = W / 2;
  let left = 20;
  if (photo) {
    drawPhoto(ctx, photo.img, 22, (H - photo.h * 2) / 2, photo.w, photo.h, 2);
    left = 22 + photo.w * 2 + 12;
    cx = left + (W - left - 12) / 2;
  }
  const pw = W - left - 12;
  drawWowPanel(ctx, left, H / 2 - 58, pw, 106);
  wowText(ctx, UI.loseTitle, cx, H / 2 - 44, { size: 16, color: WOW.red, align: 'center', bold: true, outline: 1.6 });
  wowText(ctx, reason, cx, H / 2 - 20, { size: 8, color: WOW.grey, align: 'center' });
  ctx.font = `8px ${WOW_FONT}`;
  wrapText(ctx, `«${line}»`, pw - 24).forEach((l, i) => wowText(ctx, l, cx, H / 2 - 4 + i * 10, { size: 8, align: 'center' }));
  if (ready) drawWowButton(ctx, { x: cx - 50, y: H / 2 + 26, w: 100, h: 15 }, UI.retry, Math.floor(time * 2) % 2 === 0, time);
}

export function drawToast(ctx, photo, text, alpha) {
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  const s = 0.5;
  const w = photo.w * s;
  const h = photo.h * s;
  const x = W - w - 10;
  const y = 30;
  drawPhoto(ctx, photo.img, x, y, photo.w, photo.h, s);
  drawText(ctx, text, x + w / 2, y + h + 5, { size: 7, align: 'center', color: COLORS.accent, bold: true });
  ctx.globalAlpha = 1;
}

// Уровень пройден: статистика и «дальше»
export function drawLevelDone(ctx, lines, prompt, ready, time) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, W, H);
  drawWowPanel(ctx, W / 2 - 120, H / 2 - 64, 240, 130);
  wowText(ctx, UI.levelDone, W / 2, H / 2 - 50, { size: 16, color: WOW.gold, align: 'center', bold: true, outline: 1.6 });
  lines.forEach((l, i) => wowText(ctx, l, W / 2, H / 2 - 22 + i * 11, { size: 8, align: 'center' }));
  if (ready) drawWowButton(ctx, { x: W / 2 - 70, y: H / 2 + 38, w: 140, h: 15 }, prompt, Math.floor(time * 2) % 2 === 0, time);
}

export function drawBubble(ctx, text, x, y, viewW = W) {
  drawChatBubble(ctx, text, x, y, viewW);
}

export function drawCutsceneBackdrop(ctx, time) {
  ctx.fillStyle = '#07070c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#12121e';
  for (let i = 0; i < 9; i++) {
    const x = ((i * 61 + time * 6) % (W + 40)) - 20;
    ctx.fillRect(Math.round(x), 0, 1, H);
  }
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, H - 60, W, 60);
}

export function drawCutsceneDialog(ctx, { label, name, text, page, pages, ready, time, speaker, photo }) {
  if (speaker) drawPhoto(ctx, speaker.img, 6, 40, speaker.w, speaker.h, 2);
  wowText(ctx, label, 170, 30, { size: 8, color: WOW.grey });
  wowText(ctx, name, 170, 41, { size: 13, color: WOW.gold, bold: true, outline: 1.4 });
  const box = { x: 164, y: 70, w: W - 176, h: 110 };
  if (photo) {
    box.w -= photo.w + 12;
    drawPhoto(ctx, photo.img, W - 12 - photo.w, box.y - 6, photo.w, photo.h);
  }
  drawWowPanel(ctx, box.x, box.y, box.w, box.h, UI.bossName);
  ctx.font = `9px ${WOW_FONT}`;
  wrapText(ctx, text, box.w - 20).forEach((l, i) => wowText(ctx, l, box.x + 10, box.y + 16 + i * 13, { size: 9 }));
  wowText(ctx, `${page}/${pages}`, box.x + box.w - 8, box.y + box.h - 13, { size: 7, color: WOW.grey, align: 'right' });
  if (ready && Math.floor(time * 2) % 2 === 0) wowText(ctx, UI.cutsceneHint, W / 2, H - 18, { size: 7, color: WOW.gold, align: 'center' });
}

function drawMug(ctx, x, y, time) {
  const foam = Math.round(Math.sin(time * 4));
  ctx.fillStyle = '#f4f1de';
  ctx.fillRect(x, y - 3 + foam, 22, 6);
  ctx.fillStyle = '#e9a23b';
  ctx.fillRect(x, y + 2, 22, 26);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(x + 3, y + 5, 4, 20);
  ctx.strokeStyle = '#f4f1de';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 23, y + 8, 7, 12);
}

export function drawFinal(ctx, photo, lines, prompt, ready, time) {
  ctx.fillStyle = '#2b1a12';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4a2c1a';
  for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 2, H);
  ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
  ctx.beginPath();
  ctx.arc(110, 130, 120 + Math.sin(time * 2) * 6, 0, Math.PI * 2);
  ctx.fill();
  drawPhoto(ctx, photo.img, 24, (H - photo.h * 2) / 2, photo.w, photo.h, 2);
  const cx = 24 + photo.w * 2 + (W - 24 - photo.w * 2) / 2;
  drawMug(ctx, cx - 15, 22, time);
  wowText(ctx, UI.finalTitle, cx, 60, { size: 20, color: WOW.gold, align: 'center', bold: true, outline: 2 });
  wowText(ctx, UI.finalPlace, cx, 86, { size: 8, color: WOW.grey, align: 'center' });
  lines.forEach((l, i) => wowText(ctx, l, cx, 108 + i * 12, { size: 8, align: 'center' }));
  if (ready) drawWowButton(ctx, { x: cx - 50, y: H - 34, w: 100, h: 15 }, prompt, Math.floor(time * 2) % 2 === 0, time);
}
