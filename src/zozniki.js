// Зожники (SPEC §6). Этап 2: общая основа (здоровье, оглушение, удержание Собакой) и манекен.
// Поведение видов и появление — этап 3. Чистая логика, без DOM.

import { createBody, stepPlatformer } from './physics.js';
import { ZOZNIKI, HIT_FLASH_TIME } from './config.js';

const IDLE = { move: 0, jumpPressed: false, jumpHeld: false, dropHeld: false };

export function createZoznik(kind, x, y, K = ZOZNIKI) {
  const k = K[kind];
  if (!k) throw new Error(`Неизвестный вид Зожника: ${kind}`);
  return {
    kind,
    body: createBody(x, y, k.w, k.h),
    health: k.health,
    maxHealth: k.health,
    alive: true,
    stun: 0, // с оглушения (5:0)
    held: 0, // с удержания Собакой
    flash: 0,
    respawn: 0,
    home: { x, y },
  };
}

export function isAlive(z) {
  return z.alive;
}

// Наносит урон, возвращает сколько реально снято и убит ли.
export function damageZoznik(z, amount) {
  if (!z.alive || amount <= 0) return { dealt: 0, killed: false };
  const dealt = Math.min(amount, z.health);
  z.health -= dealt;
  z.flash = HIT_FLASH_TIME;
  if (z.health <= 1e-9) {
    z.health = 0;
    z.alive = false;
    z.respawn = 0;
    return { dealt, killed: true };
  }
  return { dealt, killed: false };
}

export function stunZoznik(z, duration) {
  if (z.alive) z.stun = Math.max(z.stun, duration);
}

export function holdZoznik(z, duration) {
  if (z.alive) z.held = Math.max(z.held, duration);
}

export function canAct(z) {
  return z.alive && z.stun <= 0 && z.held <= 0;
}

export function updateZoznik(z, dt, map, P, K = ZOZNIKI) {
  const k = K[z.kind];
  z.flash = Math.max(0, z.flash - dt);
  if (!z.alive) {
    if (k.respawnTime) {
      z.respawn += dt;
      if (z.respawn >= k.respawnTime) {
        Object.assign(z, createZoznik(z.kind, z.home.x, z.home.y, K));
      }
    }
    return;
  }
  z.stun = Math.max(0, z.stun - dt);
  z.held = Math.max(0, z.held - dt);
  // Манекен просто стоит под гравитацией; поведение видов — этап 3
  stepPlatformer(z.body, IDLE, dt, map, P);
}
