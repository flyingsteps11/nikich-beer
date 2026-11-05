// Игровой цикл с фиксированным шагом 1/60 и машина экранов (SPEC §15).
// Этап 1: титульный экран → тестовая карта с болванкой Никича → пауза.

import { SCREEN, LOOP, TILE_SIZE, PHYSICS, NIKICH, CAMERA, DEBUG } from './config.js';
import { Input, bindInput, readMoveIntent } from './input.js';
import { createBody, stepPlatformer, fellOut } from './physics.js';
import { createCamera, updateCamera, snapCamera, drawTiles } from './world.js';
import { buildTestMap } from './levels/test.js';
import { drawSky, drawTitle, drawPause, drawCrosshair, drawText, drawBubble, COLORS } from './ui.js';
import { UI, LINES } from './lines.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input();
bindInput(input, canvas, SCREEN.width, SCREEN.height);

function integerScale(winW, winH) {
  return Math.max(1, Math.floor(Math.min(winW / SCREEN.width, winH / SCREEN.height)));
}

function resize() {
  const scale = integerScale(window.innerWidth, window.innerHeight);
  canvas.style.width = `${SCREEN.width * scale}px`;
  canvas.style.height = `${SCREEN.height * scale}px`;
}
window.addEventListener('resize', resize);
resize();

// ---------- Машина экранов: стек, верхний получает update ----------

const screens = [];
const machine = {
  top: () => screens[screens.length - 1],
  push: (s) => screens.push(s),
  pop: () => screens.pop(),
  replace: (s) => { screens.length = 0; screens.push(s); },
};

class TitleScreen {
  constructor() { this.time = 0; }
  update(dt) {
    this.time += dt;
    if (input.wasPressed('confirm')) machine.replace(new PlayScreen());
  }
  draw(c) { drawTitle(c, this.time); }
}

class PauseScreen {
  constructor(under) { this.under = under; }
  update() {
    if (input.wasPressed('pause') || input.wasPressed('confirm')) machine.pop();
  }
  draw(c) {
    this.under.draw(c);
    drawPause(c);
  }
}

const BUBBLE_TIME = 2; // TODO(этап 4): реплики и их частота уедут в config/lines

class PlayScreen {
  constructor() {
    this.map = buildTestMap(TILE_SIZE);
    this.body = createBody(0, 0, NIKICH.hitboxW, NIKICH.hitboxH);
    this.cam = createCamera(SCREEN.width, SCREEN.height);
    this.facing = 1;
    this.debug = false;
    this.squash = 0; // >0 — сплющен после приземления, <0 — вытянут в прыжке
    this.bubble = null;
    this.time = 0;
    this.respawn();
  }

  respawn() {
    const { spawn, tileSize } = this.map;
    const b = this.body;
    b.x = spawn.x + (tileSize - b.w) / 2;
    b.y = spawn.y + tileSize - b.h;
    b.vx = 0;
    b.vy = 0;
    this.cam.dir = 1;
    snapCamera(this.cam, b, this.map, CAMERA);
  }

  say(text) {
    this.bubble = { text, t: BUBBLE_TIME };
  }

  update(dt) {
    this.time += dt;
    if (input.wasPressed('pause')) { machine.push(new PauseScreen(this)); return; }
    if (input.wasPressed('debug')) this.debug = !this.debug;

    const b = this.body;
    const ev = stepPlatformer(b, readMoveIntent(input), dt, this.map, PHYSICS);
    if (ev.jumped) this.squash = -0.12;
    if (ev.landed) this.squash = 0.1;
    this.squash -= Math.sign(this.squash) * Math.min(Math.abs(this.squash), dt);

    if (fellOut(b, this.map)) {
      this.respawn();
      this.say(LINES.pit[0]);
    }

    updateCamera(this.cam, b, this.map, dt, CAMERA);

    // Никич смотрит на курсор; без мыши — по направлению бега
    if (input.mouse.inside) {
      const mx = input.mouse.x + this.cam.x;
      this.facing = mx >= b.x + b.w / 2 ? 1 : -1;
    } else if (Math.abs(b.vx) > 1) {
      this.facing = Math.sign(b.vx);
    }

    if (this.bubble && (this.bubble.t -= dt) <= 0) this.bubble = null;
  }

  draw(c) {
    drawSky(c);
    drawTiles(c, this.map, this.cam);
    this.drawDummy(c);
    const b = this.body;
    const camX = Math.round(this.cam.x);
    const camY = Math.round(this.cam.y);
    if (this.bubble) drawBubble(c, this.bubble.text, b.x + b.w / 2 - camX, b.y - camY - 4);
    drawText(c, UI.controlsHint, 4, SCREEN.height - 12, { color: COLORS.text });
    if (this.debug) this.drawDebug(c);
    if (input.mouse.inside) drawCrosshair(c, input.mouse.x, input.mouse.y);
  }

  // Болванка Никича 16×24 поверх хитбокса 10×22 (настоящий спрайт — этап 8)
  drawDummy(c) {
    const b = this.body;
    const sx = 1 + this.squash * 2; // сплющивание по ширине
    const sy = 1 - this.squash * 2;
    const w = Math.round(16 * sx);
    const h = Math.round(24 * sy);
    const feetX = Math.round(b.x + b.w / 2 - this.cam.x);
    const feetY = Math.round(b.y + b.h - this.cam.y);
    const x = feetX - Math.floor(w / 2);
    const y = feetY - h;
    const bob = b.onGround && Math.abs(b.vx) > 20 ? Math.floor(this.time * 10) % 2 : 0;
    const f = this.facing;

    // ноги
    c.fillStyle = '#e9c8a0';
    if (b.onGround && Math.abs(b.vx) > 20) {
      const step = Math.floor(this.time * 10) % 2;
      c.fillRect(x + 4 + step * 2, y + h - 5, 3, 5);
      c.fillRect(x + w - 7 - step * 2, y + h - 5, 3, 5);
    } else {
      c.fillRect(x + 4, y + h - 5, 3, 5);
      c.fillRect(x + w - 7, y + h - 5, 3, 5);
    }
    // шорты
    c.fillStyle = '#c8b28a';
    c.fillRect(x + 3, y + h - 10 + bob, w - 6, 5);
    // футболка
    c.fillStyle = '#8a8d91';
    c.fillRect(x + 2, y + Math.round(h * 0.38) + bob, w - 4, Math.round(h * 0.2) + 2);
    // голова
    c.fillStyle = '#f0c8a0';
    c.fillRect(x + 3, y + 1 + bob, w - 6, Math.round(h * 0.36));
    // волосы
    c.fillStyle = '#2a2018';
    c.fillRect(x + 3, y + bob, w - 6, 3);
    c.fillRect(f > 0 ? x + 3 : x + w - 5, y + bob, 2, 5);
    // авиаторы
    c.fillStyle = '#1b1b1b';
    const gx = f > 0 ? x + w - 9 : x + 4;
    c.fillRect(gx, y + 5 + bob, 5, 2);
  }

  drawDebug(c) {
    const b = this.body;
    const lines = [
      `fps ${fps.toFixed(0)}`,
      `x ${b.x.toFixed(1)} y ${b.y.toFixed(1)}`,
      `vx ${b.vx.toFixed(0)} vy ${b.vy.toFixed(0)}`,
      `ground ${b.onGround ? 'да' : 'нет'} coyote ${b.coyote.toFixed(2)} buf ${b.jumpBuffer.toFixed(2)}`,
    ];
    lines.forEach((l, i) => drawText(c, l, 4, 4 + i * 10, { color: COLORS.accent }));
    c.strokeStyle = '#00ff88';
    c.strokeRect(Math.round(b.x - this.cam.x) + 0.5, Math.round(b.y - this.cam.y) + 0.5, b.w - 1, b.h - 1);
  }
}

// Вкладку свернули — ставим на паузу
document.addEventListener('visibilitychange', () => {
  if (document.hidden && machine.top() instanceof PlayScreen) machine.push(new PauseScreen(machine.top()));
});

// ---------- Цикл ----------

let fps = 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * DEBUG.fpsSmoothing;
  acc += Math.min(dt, LOOP.maxFrame);
  while (acc >= LOOP.step) {
    machine.top().update(LOOP.step);
    input.endStep();
    acc -= LOOP.step;
  }
  ctx.imageSmoothingEnabled = false;
  machine.top().draw(ctx);
  requestAnimationFrame(frame);
}

machine.replace(new TitleScreen());
requestAnimationFrame(frame);

// ?debug в адресе — доступ к игре из консоли для проверки (в обычной игре не включается)
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = { machine, input, step: (n = 1) => { for (let i = 0; i < n; i++) { machine.top().update(LOOP.step); input.endStep(); } } };
}
