// Никич: здоровье, жизни, движение и 4 атаки (SPEC §5, §5.1). Чистая логика, без DOM.

import { createBody, stepPlatformer, isBlocking, fellOut } from './physics.js';
import { damageZoznik, stunZoznik, holdZoznik } from './zozniki.js';
import { NIKICH, ATTACKS, SPEECH } from './config.js';

export function createNikich(x, y, N = NIKICH) {
  return {
    body: createBody(x, y, N.hitboxW, N.hitboxH),
    maxHealth: N.maxHealth,
    health: N.maxHealth,
    lives: N.lives,
    invuln: 0,
    hurtLock: 0,
    facing: 1,
    aim: { x: 1, y: 0 }, // единичный вектор на курсор
    cooldowns: { shot: 0, dog: 0, stun: 0 },
    superMeter: 0,
    // Множители от Улучшений и Бонусов (этапы 4 и 6)
    mods: {
      damageMul: 1,
      shotRateMul: 1,
      superChargeMul: 1,
      dogHoldBonus: 0,
      stunRadiusMul: 1,
    },
  };
}

export function centerOf(body) {
  return { x: body.x + body.w / 2, y: body.y + body.h / 2 };
}

export function handPos(n, N = NIKICH) {
  return { x: n.body.x + n.body.w / 2, y: n.body.y + N.handOffsetY };
}

// Прицел на 360°: Никич разворачивается к курсору (SPEC §3)
export function setAim(n, worldX, worldY, N = NIKICH) {
  const h = handPos(n, N);
  const dx = worldX - h.x;
  const dy = worldY - h.y;
  const len = Math.hypot(dx, dy);
  if (len > 1e-6) n.aim = { x: dx / len, y: dy / len };
  if (Math.abs(dx) > 0.5) n.facing = Math.sign(dx);
}

export function updateNikich(n, intent, dt, map, P) {
  for (const k of Object.keys(n.cooldowns)) n.cooldowns[k] = Math.max(0, n.cooldowns[k] - dt);
  n.invuln = Math.max(0, n.invuln - dt);
  n.hurtLock = Math.max(0, n.hurtLock - dt);
  const effective = n.hurtLock > 0 ? { ...intent, move: 0, jumpPressed: false } : intent;
  return stepPlatformer(n.body, effective, dt, map, P);
}

// Урон Зожнику от Никича: множитель уже учтён в amount; шкала супера копится от снятого здоровья.
export function applyDamage(n, z, amount, { charge = true } = {}, A = ATTACKS) {
  const res = damageZoznik(z, amount);
  if (charge && res.dealt > 0) {
    n.superMeter = Math.min(A.super.meterMax, n.superMeter + res.dealt * A.super.meterPerDamage * n.mods.superChargeMul);
  }
  return res;
}

function overlapsPoint(body, x, y) {
  return x >= body.x && x <= body.x + body.w && y >= body.y && y <= body.y + body.h;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------- Щелбан ----------

export function tryShoot(n, A = ATTACKS, N = NIKICH) {
  if (n.cooldowns.shot > 0) return null;
  const S = A.shot;
  n.cooldowns.shot = S.cooldown / n.mods.shotRateMul;
  const h = handPos(n, N);
  return {
    x: h.x,
    y: h.y,
    vx: n.aim.x * S.speed,
    vy: n.aim.y * S.speed,
    travelled: 0,
    range: S.range,
    damage: S.damage * n.mods.damageMul,
    alive: true,
  };
}

// Двигает окурки; попадание — в первого живого Зожника на пути, стена гасит окурок.
export function updateShots(n, shots, dt, map, zozniki) {
  const hits = [];
  const ts = map.tileSize;
  for (const s of shots) {
    if (!s.alive) continue;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.travelled += Math.hypot(s.vx, s.vy) * dt;
    if (s.travelled >= s.range) { s.alive = false; continue; }
    if (isBlocking(map.get(Math.floor(s.x / ts), Math.floor(s.y / ts)))) { s.alive = false; continue; }
    for (const z of zozniki) {
      if (z.alive && overlapsPoint(z.body, s.x, s.y)) {
        const res = applyDamage(n, z, s.damage);
        hits.push({ z, ...res, x: s.x, y: s.y });
        s.alive = false;
        break;
      }
    }
  }
  removeDead(shots);
  return hits;
}

// ---------- Собака ----------

export function tryDog(n, aimWorldX, A = ATTACKS, N = NIKICH) {
  if (n.cooldowns.dog > 0) return null;
  const D = A.dog;
  n.cooldowns.dog = D.cooldown;
  const h = handPos(n, N);
  const dir = Math.sign(aimWorldX - h.x) || n.facing;
  const b = n.body;
  return {
    body: createBody(b.x + b.w / 2 - D.w / 2, b.y + b.h - D.h, D.w, D.h),
    dir,
    state: 'run',
    t: 0,
    target: null,
    holdLeft: 0,
    wantJump: false,
    dps: D.dps * n.mods.damageMul,
    holdTime: D.holdTime + n.mods.dogHoldBonus,
    alive: true,
  };
}

export function updateDogs(n, dogs, dt, map, zozniki, P, A = ATTACKS) {
  const D = A.dog;
  const dogPhys = { ...P, runSpeed: D.speed, jumpVelocity: D.jumpVelocity, airJumps: 0 };
  const events = [];
  for (const d of dogs) {
    if (!d.alive) continue;
    if (d.state === 'run') {
      d.t += dt;
      const ev = stepPlatformer(d.body, { move: d.dir, jumpPressed: d.wantJump, jumpHeld: true, dropHeld: false }, dt, map, dogPhys);
      d.wantJump = ev.hitWall && d.body.onGround;
      if (d.t >= D.maxRunTime || fellOut(d.body, map)) { d.alive = false; continue; }
      const victim = zozniki.find((z) => z.alive && z.held <= 0 && overlaps(d.body, z.body));
      if (victim) {
        d.state = 'hold';
        d.target = victim;
        d.holdLeft = d.holdTime;
        holdZoznik(victim, d.holdTime);
        events.push({ type: 'bite', z: victim });
      }
    } else {
      const z = d.target;
      if (!z.alive) { d.alive = false; continue; }
      const step = Math.min(dt, d.holdLeft);
      d.holdLeft -= step;
      const res = applyDamage(n, z, d.dps * step);
      if (res.killed) events.push({ type: 'kill', z, dealt: res.dealt });
      // Висит на ноге Зожника со стороны, откуда прибежала
      d.body.x = d.dir > 0 ? z.body.x - d.body.w / 2 : z.body.x + z.body.w - d.body.w / 2;
      d.body.y = z.body.y + z.body.h - d.body.h;
      if (d.holdLeft <= 1e-9) d.alive = false;
    }
  }
  removeDead(dogs);
  return events;
}

// ---------- 5:0 ----------

function distToBox(px, py, b) {
  const cx = Math.max(b.x, Math.min(px, b.x + b.w));
  const cy = Math.max(b.y, Math.min(py, b.y + b.h));
  return Math.hypot(px - cx, py - cy);
}

export function tryStun(n, zozniki, A = ATTACKS) {
  if (n.cooldowns.stun > 0) return null;
  const S = A.stun;
  n.cooldowns.stun = S.cooldown;
  const radius = S.radius * n.mods.stunRadiusMul;
  const c = centerOf(n.body);
  const hits = [];
  for (const z of zozniki) {
    if (z.alive && distToBox(c.x, c.y, z.body) <= radius) {
      stunZoznik(z, S.duration);
      hits.push({ z, ...applyDamage(n, z, S.damage * n.mods.damageMul) });
    }
  }
  return { x: c.x, y: c.y, radius, hits };
}

// ---------- Папа сейчас всё сделает ----------

export function canSuper(n, A = ATTACKS) {
  return n.superMeter >= A.super.meterMax;
}

// view — прямоугольник экрана в мировых координатах
export function trySuper(n, zozniki, view, A = ATTACKS) {
  if (!canSuper(n, A)) return null;
  n.superMeter = 0;
  const hits = [];
  for (const z of zozniki) {
    if (z.alive && overlaps(z.body, view)) {
      hits.push({ z, ...applyDamage(n, z, A.super.damage * n.mods.damageMul, { charge: false }) });
    }
  }
  return { hits };
}

// ---------- Урон по Никичу ----------

export function takeDamage(n, amount, fromX, N = NIKICH) {
  if (n.invuln > 0 || amount <= 0) return { hit: false, lifeLost: false, gameOver: false };
  n.health -= amount;
  n.invuln = N.invulnTime;
  n.hurtLock = N.hurtLockTime;
  const c = centerOf(n.body);
  const dir = Math.sign(c.x - fromX) || -n.facing;
  n.body.vx = dir * N.knockbackX;
  n.body.vy = -N.knockbackY;
  n.body.onGround = false;
  if (n.health <= 0) {
    n.lives -= 1;
    n.health = n.maxHealth;
    return { hit: true, lifeLost: true, gameOver: n.lives <= 0 };
  }
  return { hit: true, lifeLost: false, gameOver: false };
}

// ---------- Реплики над головой (SPEC §12) ----------

export function createSpeech() {
  return { text: null, t: 0, cooldown: 0 };
}

// Не чаще одной в minInterval с; force — для важных событий (Яма, супер).
export function say(speech, text, { force = false } = {}, S = SPEECH) {
  if (!text || (speech.cooldown > 0 && !force)) return false;
  speech.text = text;
  speech.t = S.holdTime;
  speech.cooldown = S.minInterval;
  return true;
}

export function updateSpeech(speech, dt) {
  speech.cooldown = Math.max(0, speech.cooldown - dt);
  if (speech.text && (speech.t -= dt) <= 0) speech.text = null;
}

export function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

function removeDead(list) {
  let j = 0;
  for (const e of list) if (e.alive) list[j++] = e;
  list.length = j;
}
