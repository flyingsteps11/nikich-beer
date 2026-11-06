// Зожники (SPEC §6): виды, поведение, появление. Чистая логика, без DOM.

import { TILE, createBody, stepPlatformer, isBlocking } from './physics.js';
import { ZOZNIKI, HIT_FLASH_TIME, SPAWN, DROPS, TILE_SIZE } from './config.js';

const IDLE = Object.freeze({ move: 0, jumpPressed: false, jumpHeld: true, dropHeld: false });

function intent(move, jump = false) {
  return { move, jumpPressed: jump, jumpHeld: true, dropHeld: false };
}

function initialState(kind) {
  if (kind === 'cyclist' || kind === 'moto') return 'idle';
  if (kind === 'yoga') return 'pose';
  return 'walk';
}

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
    dir: -1, // приходят справа — смотрят влево
    state: initialState(kind),
    timer: 0,
    dashLeft: 0,
    lectureCd: 0,
    throwCd: (k.throwCooldown ?? 0) / 2,
    ramCd: 0, // с, пока Самокат не может сбить снова
  };
}

export function isAlive(z) {
  return z.alive;
}

// Наносит урон, возвращает сколько реально снято и убит ли.
export function damageZoznik(z, amount) {
  if (!z.alive || amount <= 0 || z.invuln > 0 || z.shielded) return { dealt: 0, killed: false };
  const dealt = Math.min(amount * (z.takenMul ?? 1), z.health - (z.floor ?? 0));
  if (dealt <= 0) return { dealt: 0, killed: false };
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

// Оглушённый или схваченный Собакой не ходит и не бьёт.
export function canAct(z) {
  return z.alive && z.stun <= 0 && z.held <= 0;
}

// С убитого Зожника выпадает Пиво 0,0 (SPEC §6)
export function rollDrop(rng = Math.random, D = DROPS) {
  return rng() < D.beerZeroChance;
}

// ---------- Окружение ----------

function isStandable(t) {
  return t === TILE.SOLID || t === TILE.THIN || t === TILE.BARRIER;
}

function centerOf(b) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Есть ли опора за передним краем на расстоянии ahead px (чтобы не шагнуть с обрыва)
export function groundAhead(body, dir, map, ahead = 1) {
  const ts = map.tileSize;
  const fx = dir > 0 ? body.x + body.w + ahead : body.x - ahead;
  const ty = Math.floor((body.y + body.h + 1) / ts);
  return isStandable(map.get(Math.floor(fx / ts), ty));
}

// Высота препятствия прямо впереди, в тайлах (0 — свободно)
export function obstacleAhead(body, dir, map) {
  const ts = map.tileSize;
  const fx = dir > 0 ? body.x + body.w + 2 : body.x - 2;
  const tx = Math.floor(fx / ts);
  const feetRow = Math.floor((body.y + body.h - 1) / ts);
  let h = 0;
  while (h < 8 && isBlocking(map.get(tx, feetRow - h))) h++;
  return h;
}

export function isOnRamp(body, map) {
  if (!map.ramps || map.ramps.length === 0) return false;
  const ts = map.tileSize;
  const tx = Math.floor((body.x + body.w / 2) / ts);
  const ty = Math.floor((body.y + body.h - 1) / ts);
  return map.ramps.some((r) => r.tx === tx && r.ty === ty);
}

// Физика вида: своя скорость, разгон, торможение и прыжок
const physCache = new WeakMap();
function physFor(k, P) {
  const cached = physCache.get(k);
  if (cached && cached.P === P) return cached.phys;
  const phys = {
    ...P,
    runSpeed: k.speed,
    groundAccel: k.accel || P.groundAccel,
    airAccel: k.accel || P.airAccel,
    groundDecel: k.brakeDecel ?? P.groundDecel,
    jumpVelocity: k.jumpTiles ? Math.sqrt(2 * P.gravity * k.jumpTiles * TILE_SIZE) : (k.rampJumpVelocity ?? P.jumpVelocity),
    jumpCutVelocity: 0,
    airJumps: 0,
  };
  physCache.set(k, { P, phys });
  return phys;
}

// Шаг пешком с проверкой обрыва и препятствий
function walk(z, dir, map, k, canJump) {
  if (!dir) return IDLE;
  z.dir = dir;
  const b = z.body;
  if (!b.onGround) return intent(dir);
  const obstacle = obstacleAhead(b, dir, map);
  if (obstacle > 0) {
    if (canJump && obstacle <= k.obstacleMaxTiles) return intent(dir, true);
    return IDLE;
  }
  // Запас на тормозной путь: остановиться до края, а не повиснуть над Ямой
  if (!groundAhead(b, dir, map, 1 + Math.abs(b.vx) * 0.1)) return IDLE;
  return intent(dir);
}

// ---------- Поведение видов ----------

const BRAINS = {
  // Бежит к Никичу, перепрыгивает низкие препятствия
  runner(z, k, dt, map, t) {
    const dx = t.x - centerOf(z.body).x;
    return walk(z, Math.abs(dx) > 4 ? Math.sign(dx) : 0, map, k, true);
  },

  // Велосипедист и Мотоциклист: разгон через весь экран, потом торможение 1 с
  cyclist: dasher,
  moto: dasher,

  // Стоит в позе; подойдёшь — идёт к Никичу и читает лекцию про чакры
  yoga(z, k, dt, map, t, events) {
    const c = centerOf(z.body);
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    if (z.state === 'pose') {
      if (Math.abs(dx) <= k.aggroRange && Math.abs(dy) < 48) z.state = 'walk';
      z.dir = Math.sign(dx) || z.dir;
      return IDLE;
    }
    if (z.state === 'lecture') {
      z.timer -= dt;
      if (z.timer <= 0) z.state = 'walk';
      return IDLE;
    }
    if (Math.abs(dx) <= k.lectureRange && Math.abs(dy) < 20 && z.lectureCd <= 0) {
      z.state = 'lecture';
      z.timer = k.lectureTime;
      z.lectureCd = k.lectureCooldown;
      events.push({ type: 'lecture', z, stun: k.lectureStun });
      return IDLE;
    }
    if (Math.abs(dx) > k.aggroRange * 1.5) {
      z.state = 'pose';
      return IDLE;
    }
    return walk(z, Math.abs(dx) > 4 ? Math.sign(dx) : 0, map, k, false);
  },

  // Держит дистанцию и кидает смузи по дуге
  smoothie(z, k, dt, map, t, events) {
    const c = centerOf(z.body);
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    const dist = Math.abs(dx);
    let move = 0;
    if (dist < k.minDistance) move = -(Math.sign(dx) || 1);
    else if (dist > k.maxDistance) move = Math.sign(dx);
    if (z.throwCd <= 0 && Math.hypot(dx, dy) <= k.throwRange) {
      events.push({ type: 'throw', shot: makeSmoothie(z, k, t) });
      z.throwCd = k.throwCooldown;
    }
    const it = walk(z, move, map, k, false);
    z.dir = Math.sign(dx) || z.dir; // пятится, но смотрит на Никича
    return it;
  },

  dummy() {
    return IDLE;
  },
};

function dasher(z, k, dt, map, t, events, rng) {
  const b = z.body;
  const c = centerOf(b);
  const dx = t.x - c.x;
  const dy = t.y - c.y;
  const startBrake = () => {
    z.state = 'brake';
    z.timer = k.brakeTime;
  };

  if (z.state === 'idle') {
    z.dir = Math.sign(dx) || z.dir;
    if (b.onGround && Math.abs(dx) <= k.triggerRange && Math.abs(dy) <= k.triggerHeight) {
      z.state = 'dash';
      z.dashLeft = k.dashDistance;
      if (k.jokeChance && rng() < k.jokeChance) events.push({ type: 'joke', z });
    }
    return IDLE;
  }

  if (z.state === 'dash') {
    const ramp = k.rampJumpVelocity ? isOnRamp(b, map) : false;
    if (b.onGround) {
      if (ramp) return intent(z.dir, true); // трамплин — прыжок дугой, обрыв не страшен
      if (obstacleAhead(b, z.dir, map) > 0 || !groundAhead(b, z.dir, map, 2 + Math.abs(b.vx) * dt)) {
        b.vx = 0;
        startBrake();
        return IDLE;
      }
    }
    z.dashLeft -= Math.abs(b.vx) * dt;
    if (z.dashLeft <= 0) {
      startBrake();
      return IDLE;
    }
    return intent(z.dir);
  }

  // brake
  z.timer -= dt;
  const slideDir = Math.sign(b.vx);
  if (b.onGround && slideDir && !groundAhead(b, slideDir, map, 2 + Math.abs(b.vx) * dt)) b.vx = 0;
  if (z.timer <= 0) z.state = 'idle';
  return IDLE;
}

// ---------- Смузи ----------

function makeSmoothie(z, k, t) {
  const sx = z.body.x + z.body.w / 2;
  const sy = z.body.y + 6;
  const dx = t.x - sx;
  const dy = t.y - sy;
  const T = Math.max(k.minFlight, Math.min(k.maxFlight, Math.hypot(dx, dy) * k.flightPerPx));
  const g = k.projectileGravity;
  return {
    x: sx,
    y: sy,
    vx: dx / T,
    vy: (dy - 0.5 * g * T * T) / T,
    g,
    damage: k.projectileDamage,
    life: k.projectileLife,
    alive: true,
  };
}

// Летит по дуге; попадание в Никича — урон, стена — брызги.
export function updateEnemyShots(shots, dt, map, targetBody) {
  const hits = [];
  const ts = map.tileSize;
  for (const s of shots) {
    if (!s.alive) continue;
    s.life -= dt;
    s.vy += s.g * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.life <= 0 || s.y > map.pixelHeight) { s.alive = false; continue; }
    if (isBlocking(map.get(Math.floor(s.x / ts), Math.floor(s.y / ts)))) { s.alive = false; continue; }
    const b = targetBody;
    if (b && s.x >= b.x - 2 && s.x <= b.x + b.w + 2 && s.y >= b.y - 2 && s.y <= b.y + b.h + 2) {
      hits.push({ damage: s.damage, x: s.x, y: s.y });
      s.alive = false;
    }
  }
  let j = 0;
  for (const s of shots) if (s.alive) shots[j++] = s;
  shots.length = j;
  return hits;
}

// Урон касанием (0 — если не касается, оглушён или вид не бьёт касанием)
export function contactDamage(z, body, K = ZOZNIKI) {
  const k = K[z.kind];
  if (!canAct(z) || !k.touchDamage) return 0;
  return overlaps(z.body, body) ? k.touchDamage : 0;
}

// ---------- Шаг Зожника ----------

// target — тело Никича или null; возвращает события: lecture, throw, joke
export function updateZoznik(z, dt, map, P, target = null, K = ZOZNIKI, rng = Math.random) {
  const k = K[z.kind];
  const events = [];
  z.flash = Math.max(0, z.flash - dt);
  if (!z.alive) {
    if (k.respawnTime) {
      z.respawn += dt;
      if (z.respawn >= k.respawnTime) Object.assign(z, createZoznik(z.kind, z.home.x, z.home.y, K));
    }
    return events;
  }
  z.stun = Math.max(0, z.stun - dt);
  z.held = Math.max(0, z.held - dt);
  z.lectureCd = Math.max(0, z.lectureCd - dt);
  z.throwCd = Math.max(0, z.throwCd - dt);
  z.ramCd = Math.max(0, z.ramCd - dt);

  let it = IDLE;
  if (canAct(z) && target) {
    it = BRAINS[z.kind](z, k, dt, map, centerOf(target), events, rng);
  } else if (z.state === 'dash') {
    z.state = 'brake'; // сбили с рывка
    z.timer = k.brakeTime;
  }
  stepPlatformer(z.body, it, dt, map, physFor(k, P));
  return events;
}

// ---------- Появление ----------
// Записи в карте Уровня (координаты в тайлах; ty — ряд, в котором стоят ноги):
//   { type: 'edge',  atTx, kinds: [...], interval } — Никич дошёл до atTx: волна из-за правого края экрана
//   { type: 'door',  tx, ty, kinds: [...], every, count, delay? } — подъезд или магазин, пока виден
//   { type: 'point', tx, ty, kind } — один Зожник на месте, когда место показалось

function initEntry(def, ts) {
  const base = { def, done: false, timer: def.delay ?? 0, queue: [], left: 0, i: 0 };
  switch (def.type) {
    case 'edge': return { ...base, pos: def.atTx * ts };
    case 'door': return { ...base, pos: def.tx * ts + ts / 2, y: (def.ty + 1) * ts, left: def.count };
    case 'point': return { ...base, pos: def.tx * ts + ts / 2, y: (def.ty + 1) * ts };
    default: throw new Error(`Неизвестный тип появления: ${def.type}`);
  }
}

export function createSpawner(defs, tileSize) {
  return { ts: tileSize, entries: defs.map((d) => initEntry(d, tileSize)) };
}

// Ноги на ближайшей к preferY поверхности в столбце px (null — опоры нет)
export function findSurfaceY(map, px, preferY) {
  const ts = map.tileSize;
  const tx = Math.floor(px / ts);
  if (tx < 0 || tx >= map.width) return null;
  let best = null;
  for (let ty = 2; ty < map.height; ty++) {
    if (!isStandable(map.get(tx, ty))) continue;
    if (isBlocking(map.get(tx, ty - 1)) || isBlocking(map.get(tx, ty - 2))) continue;
    if (map.get(tx, ty - 1) === TILE.THIN) continue;
    const feet = ty * ts;
    if (best === null || Math.abs(feet - preferY) < Math.abs(best - preferY)) best = feet;
  }
  return best;
}

function edgeSpawnPos(map, view, preferY, S) {
  const ts = map.tileSize;
  const start = view.x + view.w + S.edgeOffset;
  for (let i = 0; i <= S.surfaceSearchTiles; i++) {
    const x = start + i * ts;
    if (x >= map.pixelWidth) break;
    const y = findSurfaceY(map, x, preferY);
    if (y !== null) return { x, y };
  }
  return null;
}

// ctx: { map, view: {x,y,w,h}, nikichX, nikichFeetY, alive } → запросы [{ kind, x (центр), y (ноги) }]
export function updateSpawner(sp, dt, ctx, S = SPAWN) {
  const out = [];
  const { map, view } = ctx;
  const room = () => ctx.alive + out.length < S.maxAlive;
  const visible = (x) => x >= view.x - S.activationMargin && x <= view.x + view.w + S.activationMargin;

  for (const e of sp.entries) {
    const d = e.def;
    if (d.type === 'edge') {
      if (!e.done && ctx.nikichX >= e.pos) {
        e.done = true;
        e.queue = [...d.kinds];
        e.timer = 0;
      }
      if (e.queue.length) {
        e.timer -= dt;
        if (e.timer <= 0 && room()) {
          const p = edgeSpawnPos(map, view, ctx.nikichFeetY, S);
          if (p) out.push({ kind: e.queue.shift(), ...p });
          e.timer = d.interval ?? 0.5;
        }
      }
    } else if (d.type === 'door') {
      if (e.left > 0 && visible(e.pos)) {
        e.timer -= dt;
        if (e.timer <= 0 && room()) {
          out.push({ kind: d.kinds[e.i++ % d.kinds.length], x: e.pos, y: e.y });
          e.left -= 1;
          e.timer = d.every;
        }
      }
    } else if (!e.done && visible(e.pos) && room()) {
      e.done = true;
      out.push({ kind: d.kind, x: e.pos, y: e.y });
    }
  }
  return out;
}

// После потери жизни: всё, что впереди точки возврата, снова ждёт Никича
export function resetSpawner(sp, fromX) {
  sp.entries = sp.entries.map((e) => (e.pos > fromX ? initEntry(e.def, sp.ts) : e));
}

// Запрос появления → Зожник, стоящий ногами на y
export function spawnFromRequest(req, K = ZOZNIKI) {
  const k = K[req.kind];
  return createZoznik(req.kind, req.x - k.w / 2, req.y - k.h, K);
}

// Ушёл далеко за левый край экрана — убираем
export function isFarBehind(z, view, S = SPAWN) {
  return z.body.x + z.body.w < view.x - S.despawnBehind;
}
