// Игровой цикл с фиксированным шагом 1/60 и машина экранов (SPEC §15).
// Этап 3: титульный экран → тестовая карта с Никичем, 4 атаками и Зожниками → пауза.

import { SCREEN, LOOP, TILE_SIZE, PHYSICS, CAMERA, DEBUG, ATTACKS, EFFECTS, SPEECH } from './config.js';
import { Input, bindInput, readMoveIntent } from './input.js';
import { fellOut } from './physics.js';
import { createCamera, updateCamera, snapCamera, drawTiles } from './world.js';
import {
  createNikich, setAim, updateNikich, tryShoot, updateShots, tryDog, updateDogs,
  tryStun, trySuper, createSpeech, say, updateSpeech, pick, stunNikich, takeDamage,
} from './nikich.js';
import {
  updateZoznik, updateEnemyShots, contactDamage, createSpawner, updateSpawner, resetSpawner,
  spawnFromRequest, isFarBehind,
} from './zozniki.js';
import { drawNikich, drawZoznik, drawDog, drawShot, drawSmoothieShot, drawDoor, drawRamp } from './art.js';
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
    this.zozniki = [];
    this.enemyShots = [];
    this.spawner = createSpawner(this.map.spawns, TILE_SIZE);
    this.doors = this.map.spawns
      .filter((d) => d.type === 'door')
      .map((d) => ({ x: d.tx * TILE_SIZE + TILE_SIZE / 2, y: (d.ty + 1) * TILE_SIZE }));
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

  // Потеря жизни: назад на старт, Зожники и снаряды исчезают, волны впереди снова ждут
  loseLife() {
    this.zozniki = [];
    this.enemyShots = [];
    this.shots = [];
    this.dogs = [];
    this.respawn();
    resetSpawner(this.spawner, this.body.x);
  }

  hurt(amount, fromX) {
    const r = takeDamage(this.n, amount, fromX);
    if (!r.hit) return;
    if (r.gameOver) { machine.replace(new PlayScreen()); return; }
    if (r.lifeLost) { this.loseLife(); return; }
    say(this.speech, pick(LINES.hit));
  }

  updateZozniki(dt) {
    const n = this.n;
    const b = this.body;
    const view = this.view();
    for (const req of updateSpawner(this.spawner, dt, {
      map: this.map, view, nikichX: b.x + b.w / 2, nikichFeetY: b.y + b.h, alive: this.zozniki.length,
    })) {
      this.zozniki.push(spawnFromRequest(req));
    }
    for (const z of this.zozniki) {
      for (const e of updateZoznik(z, dt, this.map, PHYSICS, b)) {
        if (e.type === 'lecture') {
          stunNikich(n, e.stun);
          z.bubble = { text: pick(LINES.yoga), t: SPEECH.holdTime };
        } else if (e.type === 'throw') {
          this.enemyShots.push(e.shot);
        } else if (e.type === 'joke') {
          say(this.speech, pick(LINES.moto));
        }
      }
      if (z.bubble && (z.bubble.t -= dt) <= 0) z.bubble = null;
    }
    // Убитые и отставшие далеко позади исчезают
    this.zozniki = this.zozniki.filter((z) => z.alive && !isFarBehind(z, view));
  }

  // Урон по Никичу: касание Зожника и смузи
  updateDanger(dt) {
    const b = this.body;
    for (const h of updateEnemyShots(this.enemyShots, dt, this.map, b)) {
      this.hurt(h.damage, h.x);
      if (machine.top() !== this) return;
    }
    for (const z of this.zozniki) {
      const dmg = contactDamage(z, b);
      if (dmg > 0) {
        this.hurt(dmg, z.body.x + z.body.w / 2);
        if (machine.top() !== this || this.zozniki.length === 0) return;
      }
    }
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
    this.updateZozniki(dt);
    this.updateDanger(dt);
    if (machine.top() !== this) return;

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
    for (const d of this.doors) drawDoor(c, d.x, d.y, camX, camY);
    drawTiles(c, this.map, this.cam);
    for (const r of this.map.ramps) drawRamp(c, r.tx, r.ty, TILE_SIZE, camX, camY);
    for (const z of this.zozniki) drawZoznik(c, z, camX, camY, this.time, COLORS);
    for (const d of this.dogs) drawDog(c, d, camX, camY, this.time);
    drawNikich(c, this.n, camX, camY, this.time, this.squash);
    for (const s of this.shots) drawShot(c, s, camX, camY);
    for (const s of this.enemyShots) drawSmoothieShot(c, s, camX, camY);
    this.drawEffects(c, camX, camY);
    for (const z of this.zozniki) {
      if (z.bubble) drawBubble(c, z.bubble.text, z.body.x + z.body.w / 2 - camX, z.body.y - camY - 8);
    }

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

  drawDebug(c) {
    const b = this.body;
    const lines = [
      `fps ${fps.toFixed(0)}`,
      `x ${b.x.toFixed(1)} y ${b.y.toFixed(1)}`,
      `vx ${b.vx.toFixed(0)} vy ${b.vy.toFixed(0)}`,
      `ground ${b.onGround ? 'да' : 'нет'} coyote ${b.coyote.toFixed(2)} buf ${b.jumpBuffer.toFixed(2)}`,
      `kills ${this.stats.kills} super ${this.n.superMeter.toFixed(0)} зожники ${this.zozniki.length}`,
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
