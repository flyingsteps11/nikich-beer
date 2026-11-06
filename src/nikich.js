// Никич: здоровье, жизни, движение и 4 атаки (SPEC §5, §5.1). Чистая логика, без DOM.

import { createBody, stepPlatformer, isBlocking, fellOut } from './physics.js';
import { damageZoznik, stunZoznik, holdZoznik, touching } from './zozniki.js';
import { NIKICH, ATTACKS, SPEECH, ITEMS, FACES } from './config.js';

export function createNikich(x, y, N = NIKICH) {
  return {
    body: createBody(x, y, N.hitboxW, N.hitboxH),
    maxHealth: N.maxHealth,
    health: N.maxHealth,
    lives: N.lives,
    invuln: 0,
    hurtLock: 0,
    stun: 0, // оглушён (лекция Йога-тётки, падение с Самоката): ни движения, ни атак
    facing: 1,
    aim: { x: 1, y: 0 }, // единичный вектор на курсор
    cooldowns: { shot: 0, dog: 0, stun: 0 },
    superMeter: 0,
    face: { mood: null, t: 0, shoot: 0, near: false },
    // Временные эффекты Предметов, с до конца (SPEC §7)
    effects: { vodka: 0, beer: 0, scooter: 0, smoke: 0, luck: 0 },
    missGrace: 0,
    drunk: 0,
    infiniteLives: false,
    // Множители от Улучшений и Бонусов (этапы 4 и 6)
    mods: {
      damageMul: 1,
      shotRateMul: 1,
      superChargeMul: 1,
      dogHoldBonus: 0,
      stunRadiusMul: 1,
      beerTimeMul: 1,
      speedMul: 1,
      airJumps: 0, // «Прыгучий» — двойной прыжок
      magnetRadius: 0, // px, 0 — магнита нет
      extraScooters: 0, // «Прокатчик»: Самокатов у старта каждого Уровня
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

export function steerAim(n, worldX, worldY, dt, I = ITEMS, N = NIKICH) {
  if (n.drunk <= 0) {
    setAim(n, worldX, worldY, N);
    return;
  }
  const prev = n.aim;
  setAim(n, worldX, worldY, N);
  const from = Math.atan2(prev.y, prev.x);
  let delta = Math.atan2(n.aim.y, n.aim.x) - from;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  const a = from + delta * (1 - Math.exp(-dt / (I.beerZero.aimLagPerStack * n.drunk)));
  n.aim = { x: Math.cos(a), y: Math.sin(a) };
  if (Math.abs(n.aim.x) > 0.05) n.facing = Math.sign(n.aim.x);
}

// Урон всех атак с учётом Стопарика
export function damageMul(n, I = ITEMS) {
  return n.mods.damageMul * (n.effects.vodka > 0 ? I.vodka.damageMul : 1);
}

export function isRiding(n) {
  return n.effects.scooter > 0;
}

// Скорость и прыжок от Улучшений, Самоката и Пива 0,0
export function movementMods(n, I = ITEMS) {
  let speedMul = n.mods.speedMul;
  let jumpHeight = 1;
  if (isRiding(n)) {
    speedMul *= I.scooter.speedMul;
    jumpHeight *= I.scooter.jumpHeightMul;
  }
  let accelMul = 1;
  if (n.effects.smoke > 0) {
    speedMul *= I.cigarette.speedMul;
    jumpHeight *= I.cigarette.jumpHeightMul;
  }
  if (n.drunk > 0) {
    const B = I.beerZero;
    speedMul *= Math.max(B.minSpeedMul, 1 - B.speedPerStack * n.drunk);
    jumpHeight *= Math.max(B.minSpeedMul, 1 - B.jumpPerStack * n.drunk);
    accelMul = 1 / (1 + B.accelPerStack * n.drunk);
  }
  return { speedMul, jumpMul: Math.sqrt(jumpHeight), passBarriers: isRiding(n), accelMul };
}

// Падение с Самоката: лицом в асфальт
function crash(n, I) {
  n.effects.scooter = 0;
  stunNikich(n, I.scooter.crashStun);
}

// События физики + scooterEnded (Самокат кончился, Никич упал)
export function updateNikich(n, intent, dt, map, P, I = ITEMS) {
  for (const k of Object.keys(n.cooldowns)) n.cooldowns[k] = Math.max(0, n.cooldowns[k] - dt);
  n.invuln = Math.max(0, n.invuln - dt);
  n.effects.luck = Math.max(0, n.effects.luck - dt);
  n.missGrace = Math.max(0, n.missGrace - dt);
  n.hurtLock = Math.max(0, n.hurtLock - dt);
  n.stun = Math.max(0, n.stun - dt);
  n.effects.vodka = Math.max(0, n.effects.vodka - dt);
  n.effects.beer = Math.max(0, n.effects.beer - dt);
  n.effects.smoke = Math.max(0, n.effects.smoke - dt);
  if (n.drunk > 0 && n.effects.beer <= 0) {
    n.drunk -= 1;
    if (n.drunk > 0) n.effects.beer = I.beerZero.stackTime * n.mods.beerTimeMul;
  }
  n.face.t = Math.max(0, n.face.t - dt);
  n.face.shoot = Math.max(0, n.face.shoot - dt);
  if (n.face.t <= 0) n.face.mood = null;
  const wasRiding = isRiding(n);
  const locked = n.hurtLock > 0 || n.stun > 0;
  const effective = locked ? { ...intent, move: 0, jumpPressed: false } : intent;
  const speedBefore = Math.abs(n.body.vx);
  const phys = n.mods.airJumps > 0 ? { ...P, airJumps: P.airJumps + n.mods.airJumps } : P;
  const ev = stepPlatformer(n.body, effective, dt, map, phys, movementMods(n, I));
  ev.scooterEnded = false;
  if (wasRiding) {
    n.effects.scooter = Math.max(0, n.effects.scooter - dt);
    if (ev.hitWall && speedBefore >= I.scooter.crashMinSpeed) {
      n.body.vx = 0;
      crash(n, I);
      ev.scooterEnded = true;
    } else if (n.effects.scooter <= 0) {
      crash(n, I);
      ev.scooterEnded = true;
    }
  }
  return ev;
}

// Сесть на Самокат (наездом)
export function mountScooter(n, I = ITEMS) {
  if (isRiding(n)) return false;
  n.effects.scooter = I.scooter.duration;
  return true;
}

// На Самокате сбивает Зожников: урон, отбрасывание, короткое оглушение
export function ramZozniki(n, zozniki, I = ITEMS) {
  const hits = [];
  if (!isRiding(n)) return hits;
  const S = I.scooter;
  for (const z of zozniki) {
    if (!z.alive || (z.ramCd ?? 0) > 0 || !touching(n.body, z.body)) continue;
    z.ramCd = S.ramCooldown;
    const dir = Math.sign(z.body.x + z.body.w / 2 - (n.body.x + n.body.w / 2)) || n.facing;
    z.body.vx = dir * S.ramKnockX;
    z.body.vy = -S.ramKnockY;
    z.body.onGround = false;
    stunZoznik(z, S.ramCooldown);
    const res = applyDamage(n, z, S.ramDamage * damageMul(n, I));
    hits.push({ z, ...res });
  }
  return hits;
}

export function stunNikich(n, duration) {
  n.stun = Math.max(n.stun, duration);
}

function canAttack(n) {
  return n.stun <= 0;
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
  if (n.cooldowns.shot > 0 || !canAttack(n)) return null;
  const S = A.shot;
  n.cooldowns.shot = S.cooldown / n.mods.shotRateMul / (n.effects.smoke > 0 ? ITEMS.cigarette.shotRateMul : 1);
  n.face.shoot = FACES.shootTime;
  const h = handPos(n, N);
  return {
    x: h.x,
    y: h.y,
    vx: n.aim.x * S.speed,
    vy: n.aim.y * S.speed,
    travelled: 0,
    range: S.range,
    damage: S.damage * damageMul(n) * (1 + ITEMS.beerZero.shotDamagePerStack * n.drunk),
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
  if (n.cooldowns.dog > 0 || !canAttack(n)) return null;
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
    dps: D.dps * damageMul(n),
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
  if (n.cooldowns.stun > 0 || !canAttack(n)) return null;
  const S = A.stun;
  n.cooldowns.stun = S.cooldown;
  const radius = S.radius * n.mods.stunRadiusMul;
  const c = centerOf(n.body);
  const hits = [];
  for (const z of zozniki) {
    if (z.alive && distToBox(c.x, c.y, z.body) <= radius) {
      stunZoznik(z, S.duration);
      hits.push({ z, ...applyDamage(n, z, S.damage * damageMul(n)) });
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
  if (!canSuper(n, A) || !canAttack(n)) return null;
  n.superMeter = 0;
  const hits = [];
  for (const z of zozniki) {
    if (z.alive && overlaps(z.body, view)) {
      hits.push({ z, ...applyDamage(n, z, A.super.damage * damageMul(n) * (z.superMul ?? 1), { charge: false }) });
    }
  }
  return { hits };
}

// ---------- Урон по Никичу ----------

export function takeDamage(n, amount, fromX, N = NIKICH, rng = Math.random) {
  if (n.invuln > 0 || amount <= 0) return { hit: false, lifeLost: false, gameOver: false };
  if (n.missGrace > 0) return { hit: false, missed: false, lifeLost: false, gameOver: false };
  if (n.effects.luck > 0 && rng() < ITEMS.chip.missChance) {
    n.missGrace = ITEMS.chip.missGrace;
    return { hit: false, missed: true, lifeLost: false, gameOver: false };
  }
  amount *= Math.max(0, 1 - ITEMS.beerZero.armorPerStack * n.drunk);
  n.health -= amount;
  n.invuln = N.invulnTime;
  n.hurtLock = N.hurtLockTime;
  setFace(n, 'hurt', FACES.hurtTime);
  const c = centerOf(n.body);
  const dir = Math.sign(c.x - fromX) || -n.facing;
  n.body.vx = dir * N.knockbackX;
  n.body.vy = -N.knockbackY;
  n.body.onGround = false;
  return { hit: true, ...loseHealth(n, amount, { already: true }) };
}

// Снять здоровье без отбрасывания (Пиво 0,0). Кончилось — минус жизнь.
export function loseHealth(n, amount, { already = false } = {}) {
  if (!already) n.health -= amount;
  if (n.health <= 1e-9) return { lifeLost: true, ...loseLife(n) };
  return { lifeLost: false, gameOver: false };
}

// Минус жизнь (здоровье кончилось или Яма): здоровье полное, эффекты сброшены
export function loseLife(n) {
  if (!n.infiniteLives) n.lives -= 1;
  n.health = n.maxHealth;
  n.effects = { vodka: 0, beer: 0, scooter: 0, smoke: 0, luck: 0 };
  n.missGrace = 0;
  n.drunk = 0;
  n.stun = 0;
  n.hurtLock = 0;
  setFace(n, 'hurt', FACES.hurtTime);
  return { gameOver: n.lives <= 0 };
}

export function setFace(n, mood, duration = FACES.moodTime) {
  n.face.mood = mood;
  n.face.t = duration;
}

export function nikichFace(n, F = FACES) {
  if (n.stun > 0 || n.face.mood === 'hurt') return 'hurt';
  if (n.face.mood) return n.face.mood;
  if (n.face.shoot > 0) return 'fight';
  if (!n.body.onGround && n.body.vy < -F.jumpMinRise) return 'jump';
  if (n.face.near) return 'near';
  if (n.effects.smoke > 0) return 'smoke';
  if (n.drunk >= 2 || n.health <= n.maxHealth * F.lowHealth) return 'tipsy';
  return 'happy';
}

export function senseNear(n, targets, F = FACES) {
  const c = centerOf(n.body);
  n.face.near = targets.some((z) => z.alive && Math.hypot(z.body.x + z.body.w / 2 - c.x, z.body.y + z.body.h / 2 - c.y) <= F.nearRadius);
  return n.face.near;
}

export function heal(n, amount) {
  const before = n.health;
  n.health = Math.min(n.maxHealth, n.health + amount);
  return n.health - before;
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
