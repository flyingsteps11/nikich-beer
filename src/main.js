// Этап 0: каркас. Canvas 480×270 с целочисленным масштабированием (SPEC §13).
// Игровой цикл и машина экранов появятся на этапе 1.

import { SCREEN } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Наибольший целый масштаб, при котором экран влезает в окно (минимум 1).
function integerScale(winW, winH, w = SCREEN.width, h = SCREEN.height) {
  return Math.max(1, Math.floor(Math.min(winW / w, winH / h)));
}

function resize() {
  const scale = integerScale(window.innerWidth, window.innerHeight);
  canvas.style.width = `${SCREEN.width * scale}px`;
  canvas.style.height = `${SCREEN.height * scale}px`;
}

function drawPlaceholder() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
  ctx.fillStyle = '#f4d35e';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Никич: Путь к Пиву', SCREEN.width / 2, SCREEN.height / 2 - 10);
  ctx.fillStyle = '#8d99ae';
  ctx.font = '8px monospace';
  ctx.fillText('каркас готов', SCREEN.width / 2, SCREEN.height / 2 + 12);
}

window.addEventListener('resize', resize);
resize();
drawPlaceholder();
