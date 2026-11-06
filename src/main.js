// Игровой цикл с фиксированным шагом 1/60 и машина экранов (SPEC §15).
// Этап 2: титульный экран → тестовая карта с Никичем, 4 атаками и манекенами → пауза.

import { SCREEN, LOOP, TILE_SIZE, PHYSICS, CAMERA, DEBUG, ATTACKS, ZOZNIKI, EFFECTS } from './config.js';
import { Input, bindInput, readMoveIntent } from './input.js';
import { fellOut } from './physics.js';
import { createCamera, updateCamera, snapCamera, drawTiles } from './world.js';
import {
  createNikich, setAim, updateNikich, tryShoot, updateShots, tryDog, updateDogs,
  tryStun, trySuper, createSpeech, say, updateSpeech, pick,
} from './nikich.js';
import { createZoznik, updateZoznik } from './zozniki.js';
import { buildTestMap } from './levels/test.js';
import { drawSky, drawTitle, drawPause, drawCrosshair, drawText, drawBubble, drawHud, COLORS } from './ui.js';
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

class PlayScreen {
  constructor() {
    this.map = buildTestMap(TILE_SIZE);
    this.n = createNikich(0, 0);
    this.cam = createCamera(SCREEN.width, SCREEN.height);
    this.shots = [];
    this.dogs = [];
    this.zozniki = this.map.dummies.map(({ tx, ty }) => {
      const k = ZOZNIKI.dummy;
      return createZoznik('dummy', tx * TILE_SIZE + (TILE_SIZE - k.w) / 2, (ty + 1) * TILE_SIZE - k.h);
    });
    this.speech = createSpeech();
    this.effects = { rings: [], floaters: [], shake: 0, flash: 0 };
    this.stats = { kills: 0 };
    this.debug = false;
    this.squash = 0; // >0 — сплющен после приземления, <0 — вытянут в прыжке
    this.time = 0;
    this.respawn();
  }

  get body() { return this.n.body; }

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

  mouseWorld() {
    return { x: input.mouse.x + this.cam.x, y: input.mouse.y + this.cam.y };
  }

  view() {
    return { x: this.cam.x, y: this.cam.y, w: this.cam.viewW, h: this.cam.viewH };
  }

  floater(x, y, amount) {
    if (amount < 0.5) return;
    this.effects.floaters.push({ x, y, text: String(Math.round(amount)), t: EFFECTS.floaterTime });
  }

  onHits(hits) {
    for (const h of hits) {
      const zb = h.z.body;
      this.floater(h.x ?? zb.x + zb.w / 2, h.y ?? zb.y, h.dealt);
      if (h.killed) this.onKill();
    }
  }

  onKill() {
    this.stats.kills += 1;
    say(this.speech, pick(LINES.kill));
  }

  update(dt) {
    this.time += dt;
    if (input.wasPressed('pause')) { machine.push(new PauseScreen(this)); return; }
    if (input.wasPressed('debug')) this.debug = !this.debug;

    const n = this.n;
    const b = this.body;

    // Прицел: Никич смотрит на курсор
    if (input.mouse.inside) {
      const m = this.mouseWorld();
      setAim(n, m.x, m.y);
    } else if (Math.abs(b.vx) > 1) {
      n.facing = Math.sign(b.vx);
      n.aim = { x: n.facing, y: 0 };
    }

    const ev = updateNikich(n, readMoveIntent(input), dt, this.map, PHYSICS);
    if (ev.jumped) this.squash = -0.12;
    if (ev.landed) this.squash = 0.1;
    this.squash -= Math.sign(this.squash) * Math.min(Math.abs(this.squash), dt);

    // Атаки
    if (input.held('shoot')) {
      const s = tryShoot(n);
      if (s) this.shots.push(s);
    }
    if (input.wasPressed('dog')) {
      const d = tryDog(n, this.mouseWorld().x);
      if (d) this.dogs.push(d);
    }
    if (input.wasPressed('stun')) {
      const r = tryStun(n, this.zozniki);
      if (r) {
        this.effects.rings.push({ x: r.x, y: r.y, radius: r.radius, t: EFFECTS.stunRingTime });
        say(this.speech, pick(LINES.stun), { force: true });
        this.onHits(r.hits);
      }
    }
    if (input.wasPressed('super')) {
      const r = trySuper(n, this.zozniki, this.view());
      if (r) {
        this.effects.shake = ATTACKS.super.shakeTime;
        this.effects.flash = ATTACKS.super.flashTime;
        say(this.speech, pick(LINES.super), { force: true });
        this.onHits(r.hits);
      }
    }

    this.onHits(updateShots(n, this.shots, dt, this.map, this.zozniki));
    for (const e of updateDogs(n, this.dogs, dt, this.map, this.zozniki, PHYSICS)) {
      if (e.type === 'kill') this.onKill();
    }
    for (const z of this.zozniki) updateZoznik(z, dt, this.map, PHYSICS);

    if (fellOut(b, this.map)) {
      this.respawn();
      say(this.speech, pick(LINES.pit), { force: true });
    }

    updateCamera(this.cam, b, this.map, dt, CAMERA);
    updateSpeech(this.speech, dt);
    this.updateEffects(dt);
  }

  updateEffects(dt) {
    const fx = this.effects;
    fx.shake = Math.max(0, fx.shake - dt);
    fx.flash = Math.max(0, fx.flash - dt);
    for (const r of fx.rings) r.t -= dt;
    fx.rings = fx.rings.filter((r) => r.t > 0);
    for (const f of fx.floaters) f.t -= dt;
    fx.floaters = fx.floaters.filter((f) => f.t > 0);
  }

  draw(c) {
    const fx = this.effects;
    // Тряска экрана: сдвигаем камеру только на время отрисовки
    const shake = fx.shake > 0 ? ATTACKS.super.shakeAmp * (fx.shake / ATTACKS.super.shakeTime) : 0;
    const realX = this.cam.x;
    const realY = this.cam.y;
    this.cam.x += (Math.random() * 2 - 1) * shake;
    this.cam.y += (Math.random() * 2 - 1) * shake;
    const camX = Math.round(this.cam.x);
    const camY = Math.round(this.cam.y);

    drawSky(c);
    drawTiles(c, this.map, this.cam);
    for (const z of this.zozniki) this.drawZoznik(c, z, camX, camY);
    for (const d of this.dogs) this.drawDog(c, d, camX, camY);
    this.drawNikich(c);
    this.drawShots(c, camX, camY);
    this.drawEffects(c, camX, camY);

    const b = this.body;
    if (this.speech.text) drawBubble(c, this.speech.text, b.x + b.w / 2 - camX, b.y - camY - 4);

    this.cam.x = realX;
    this.cam.y = realY;

    if (fx.flash > 0) {
      c.fillStyle = `rgba(255, 255, 240, ${(fx.flash / ATTACKS.super.flashTime) * 0.85})`;
      c.fillRect(0, 0, SCREEN.width, SCREEN.height);
    }
    drawHud(c, this.n, ATTACKS, this.time);
    drawText(c, UI.controlsHint, 4, SCREEN.height - 11, { size: 7 });
    if (this.debug) this.drawDebug(c);
    if (input.mouse.inside) drawCrosshair(c, input.mouse.x, input.mouse.y);
  }

  drawShots(c, camX, camY) {
    for (const s of this.shots) {
      const x = Math.round(s.x - camX);
      const y = Math.round(s.y - camY);
      c.fillStyle = '#f4f1de';
      c.fillRect(x - 1, y, 3, 1);
      c.fillStyle = '#ff7b00';
      c.fillRect(x + (s.vx >= 0 ? 2 : -2), y, 1, 1);
    }
  }

  drawEffects(c, camX, camY) {
    for (const r of this.effects.rings) {
      const k = 1 - r.t / EFFECTS.stunRingTime;
      c.strokeStyle = `rgba(244, 211, 94, ${1 - k})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(Math.round(r.x - camX), Math.round(r.y - camY), r.radius * (0.4 + 0.6 * k), 0, Math.PI * 2);
      c.stroke();
    }
    for (const f of this.effects.floaters) {
      const k = 1 - f.t / EFFECTS.floaterTime;
      drawText(c, f.text, f.x - camX, f.y - camY - 8 - k * EFFECTS.floaterRise, { size: 8, color: COLORS.accent, align: 'center', bold: true });
    }
  }

  // Манекен-Зожник: спортивный костюм, повязка (настоящие спрайты — этап 8)
  drawZoznik(c, z, camX, camY) {
    if (!z.alive) return;
    const b = z.body;
    const x = Math.round(b.x - camX);
    const y = Math.round(b.y - camY);
    const white = z.flash > 0;
    c.fillStyle = white ? '#ffffff' : '#2a9d8f';
    c.fillRect(x, y + 7, b.w, b.h - 7);
    c.fillStyle = white ? '#ffffff' : '#f0c8a0';
    c.fillRect(x + 2, y, b.w - 4, 7);
    c.fillStyle = white ? '#ffffff' : '#e63946';
    c.fillRect(x + 2, y + 1, b.w - 4, 1);
    if (z.held > 0) {
      c.fillStyle = '#ffffff';
      c.fillRect(x - 1, y + b.h - 6, b.w + 2, 1);
    }
    if (z.stun > 0) {
      const t = this.time * 8;
      c.fillStyle = COLORS.accent;
      for (let i = 0; i < 3; i++) {
        const a = t + (i * Math.PI * 2) / 3;
        c.fillRect(Math.round(x + b.w / 2 + Math.cos(a) * 6), Math.round(y - 3 + Math.sin(a) * 2), 2, 2);
      }
    }
    if (z.health < z.maxHealth) {
      c.fillStyle = COLORS.shadow;
      c.fillRect(x - 2, y - 7, b.w + 4, 3);
      c.fillStyle = '#e63946';
      c.fillRect(x - 1, y - 6, Math.round((b.w + 2) * (z.health / z.maxHealth)), 1);
    }
  }

  drawDog(c, d, camX, camY) {
    const b = d.body;
    const x = Math.round(b.x - camX);
    const y = Math.round(b.y - camY);
    const run = d.state === 'run' ? Math.floor(this.time * 14) % 2 : 0;
    c.fillStyle = '#8b5a2b';
    c.fillRect(x, y + 2, b.w, b.h - 4);
    const hx = d.dir > 0 ? x + b.w - 4 : x;
    c.fillRect(hx, y, 4, 4);
    c.fillStyle = '#5a3a1a';
    c.fillRect(x + 1 + run, y + b.h - 2, 2, 2);
    c.fillRect(x + b.w - 3 - run, y + b.h - 2, 2, 2);
    c.fillRect(d.dir > 0 ? x - 2 : x + b.w, y + 2, 2, 1); // хвост
  }

  // Болванка Никича 16×24 поверх хитбокса 10×22 (настоящий спрайт — этап 8)
  drawNikich(c) {
    const n = this.n;
    const b = n.body;
    if (n.invuln > 0 && Math.floor(this.time * 20) % 2 === 0) return;
    const sx = 1 + this.squash * 2;
    const sy = 1 - this.squash * 2;
    const w = Math.round(16 * sx);
    const h = Math.round(24 * sy);
    const feetX = Math.round(b.x + b.w / 2 - this.cam.x);
    const feetY = Math.round(b.y + b.h - this.cam.y);
    const x = feetX - Math.floor(w / 2);
    const y = feetY - h;
    const moving = b.onGround && Math.abs(b.vx) > 20;
    const bob = moving ? Math.floor(this.time * 10) % 2 : 0;
    const f = n.facing;

    c.fillStyle = '#e9c8a0'; // ноги
    const step = moving ? Math.floor(this.time * 10) % 2 : 0;
    c.fillRect(x + 4 + step * 2, y + h - 5, 3, 5);
    c.fillRect(x + w - 7 - step * 2, y + h - 5, 3, 5);
    c.fillStyle = '#c8b28a'; // шорты
    c.fillRect(x + 3, y + h - 10 + bob, w - 6, 5);
    c.fillStyle = '#8a8d91'; // футболка
    c.fillRect(x + 2, y + Math.round(h * 0.38) + bob, w - 4, Math.round(h * 0.2) + 2);
    c.fillStyle = '#f0c8a0'; // голова
    c.fillRect(x + 3, y + 1 + bob, w - 6, Math.round(h * 0.36));
    c.fillStyle = '#2a2018'; // волосы
    c.fillRect(x + 3, y + bob, w - 6, 3);
    c.fillRect(f > 0 ? x + 3 : x + w - 5, y + bob, 2, 5);
    c.fillStyle = '#1b1b1b'; // авиаторы
    c.fillRect(f > 0 ? x + w - 9 : x + 4, y + 5 + bob, 5, 2);
    // рука к прицелу
    const hx = feetX;
    const hy = feetY - b.h + 9;
    c.fillStyle = '#f0c8a0';
    c.fillRect(Math.round(hx + n.aim.x * 7) - 1, Math.round(hy + n.aim.y * 7) - 1, 2, 2);
  }

  drawDebug(c) {
    const b = this.body;
    const lines = [
      `fps ${fps.toFixed(0)}`,
      `x ${b.x.toFixed(1)} y ${b.y.toFixed(1)}`,
      `vx ${b.vx.toFixed(0)} vy ${b.vy.toFixed(0)}`,
      `ground ${b.onGround ? 'да' : 'нет'} coyote ${b.coyote.toFixed(2)} buf ${b.jumpBuffer.toFixed(2)}`,
      `kills ${this.stats.kills} super ${this.n.superMeter.toFixed(0)}`,
    ];
    lines.forEach((l, i) => drawText(c, l, 4, 28 + i * 10, { color: COLORS.accent }));
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
  window.__game = {
    machine,
    input,
    step: (n = 1) => {
      for (let i = 0; i < n; i++) { machine.top().update(LOOP.step); input.endStep(); }
      machine.top().draw(ctx);
    },
  };
}
