import { TILE, createBody, stepPlatformer } from './physics.js';
import { GMAN } from './config.js';
import { GMAN_SCENES, GMAN_VERDICT } from './lines.js';

export const PHASES = Object.freeze(['briefcase', 'summon', 'mirror']);

const IDLE = Object.freeze({ move: 0, jumpPressed: false, jumpHeld: false, dropHeld: false });

function centerOf(b) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function perchPos(map, p, G = GMAN) {
  const ts = map.tileSize;
  return { x: p.tx * ts + ts / 2 - G.w / 2, y: (p.ty + 1) * ts - G.h };
}

function placeAt(g, map, i, G) {
  const pos = perchPos(map, map.arena.perches[i], G);
  g.body.x = pos.x;
  g.body.y = pos.y;
  g.body.vx = 0;
  g.body.vy = 0;
  g.perch = i;
}

export function createGman(map, G = GMAN) {
  const g = {
    kind: 'gman',
    body: createBody(0, 0, G.w, G.h),
    health: G.health,
    maxHealth: G.health,
    alive: true,
    stun: 0,
    held: 0,
    flash: 0,
    ramCd: 0,
    takenMul: G.takenMul,
    superMul: G.superMul,
    shielded: false,
    invuln: 0,
    floor: G.health,
    phase: -1,
    state: 'wait',
    timer: G.introDelay,
    act: null,
    actTimer: 0,
    throwsLeft: 0,
    wave: 0,
    windup: 0,
    cd: { shot: 0, stun: 0, jump: 0, throw: 0 },
    dir: -1,
    perch: map.arena.start,
    bubble: null,
  };
  placeAt(g, map, map.arena.start, G);
  return g;
}

export function phaseName(g) {
  return PHASES[g.phase] ?? null;
}

export function isFighting(g) {
  return g.state === 'fight';
}

export function isGone(g) {
  return g.state === 'gone';
}

function startPhase(g, i, map, events, G) {
  g.phase = i;
  g.state = 'creatine';
  g.timer = G.creatineTime;
  g.invuln = G.creatineTime;
  g.floor = Math.max(0, G.health - (i + 1) * G.phaseHealth);
  g.windup = 0;
  g.act = null;
  if (PHASES[i] === 'summon') placeAt(g, map, map.arena.top, G);
  events.push({ type: 'phase', phase: i, name: PHASES[i] });
  events.push({ type: 'say', key: `gmanPhase${i + 1}` });
}

function beginFight(g, G) {
  g.state = 'fight';
  const name = PHASES[g.phase];
  if (name === 'briefcase') {
    g.act = 'aim';
    g.actTimer = G.briefcase.aimTime;
    g.throwsLeft = G.briefcase.throws;
  } else if (name === 'summon') {
    g.actTimer = G.summon.firstWave;
    g.cd.throw = G.summon.throwEvery;
  } else {
    g.cd.shot = G.mirror.shotCooldown;
    g.cd.stun = G.mirror.stunCooldown / 2;
  }
}

export function briefcaseShot(sx, sy, tx, ty, B = GMAN.briefcase) {
  const dx = tx - sx;
  const dy = ty - sy;
  const T = Math.max(B.minFlight, Math.min(B.maxFlight, Math.hypot(dx, dy) * B.flightPerPx));
  return {
    kind: 'briefcase',
    x: sx,
    y: sy,
    vx: dx / T,
    vy: (dy - 0.5 * B.gravity * T * T) / T,
    g: B.gravity,
    damage: B.damage,
    life: B.life,
    alive: true,
  };
}

function buttShot(g, tc, M) {
  const b = g.body;
  const sx = b.x + b.w / 2;
  const sy = b.y + 9;
  const dx = tc.x - sx;
  const dy = tc.y - sy;
  const len = Math.hypot(dx, dy) || 1;
  return {
    kind: 'butt',
    x: sx,
    y: sy,
    vx: (dx / len) * M.shotSpeed,
    vy: (dy / len) * M.shotSpeed,
    g: 0,
    damage: M.shotDamage,
    life: M.shotRange / M.shotSpeed,
    alive: true,
  };
}

function throwBriefcase(g, t, events, G) {
  const b = g.body;
  const tc = centerOf(t);
  events.push({ type: 'throw', shot: briefcaseShot(b.x + b.w / 2, b.y + 8, tc.x, tc.y, G.briefcase) });
}

const BRAINS = {
  briefcase(g, dt, map, t, events, G, ctx, rng) {
    const B = G.briefcase;
    g.actTimer -= dt;
    if (g.actTimer > 0) return IDLE;
    if (g.act === 'vanish') {
      const others = map.arena.perches.map((_, i) => i).filter((i) => i !== g.perch);
      placeAt(g, map, others[Math.min(others.length - 1, Math.floor(rng() * others.length))], G);
      events.push({ type: 'teleport' });
      g.act = 'aim';
      g.actTimer = B.aimTime;
      g.throwsLeft = B.throws;
      return IDLE;
    }
    throwBriefcase(g, t, events, G);
    g.throwsLeft -= 1;
    if (g.throwsLeft > 0) {
      g.actTimer = B.throwEvery;
    } else {
      g.act = 'vanish';
      g.actTimer = B.vanishTime;
      g.invuln = B.vanishTime;
    }
    return IDLE;
  },

  summon(g, dt, map, t, events, G, ctx) {
    const S = G.summon;
    const ts = map.tileSize;
    g.shielded = ctx.alive > 0;
    g.actTimer -= dt;
    if (g.actTimer <= 0) {
      g.actTimer = S.waveEvery;
      const room = S.maxAlive - ctx.alive;
      if (room > 0) {
        const kinds = S.waves[g.wave % S.waves.length].slice(0, room);
        g.wave += 1;
        const tx = centerOf(t).x;
        const points = map.arena.summon
          .map((p) => ({ x: p.tx * ts + ts / 2, y: (p.ty + 1) * ts }))
          .sort((a, b) => Math.abs(b.x - tx) - Math.abs(a.x - tx));
        const requests = kinds.map((kind, i) => ({ kind, ...points[i % points.length] }));
        events.push({ type: 'summon', requests });
        events.push({ type: 'say', key: 'gmanSummon' });
      }
    }
    if (g.cd.throw <= 0) {
      throwBriefcase(g, t, events, G);
      g.cd.throw = S.throwEvery;
    }
    return IDLE;
  },

  mirror(g, dt, map, t, events, G) {
    const M = G.mirror;
    const b = g.body;
    const c = centerOf(b);
    const tc = centerOf(t);
    const dx = tc.x - c.x;
    if (g.windup > 0) {
      g.windup -= dt;
      if (g.windup <= 0) {
        events.push({ type: 'stun', x: c.x, y: c.y, radius: M.stunRadius, duration: M.stunTime, damage: M.stunDamage });
        g.cd.stun = M.stunCooldown;
      }
      return IDLE;
    }
    const dist = Math.hypot(dx, tc.y - c.y);
    if (g.cd.stun <= 0 && dist <= M.stunRadius * M.stunTrigger) {
      g.windup = M.stunWindup;
      events.push({ type: 'say', key: 'gmanStun' });
      return IDLE;
    }
    if (g.cd.shot <= 0 && dist <= M.shotRange) {
      events.push({ type: 'shot', shot: buttShot(g, tc, M) });
      g.cd.shot = M.shotCooldown;
    }

    const feet = b.y + b.h;
    const tFeet = t.y + t.h;
    let goalX = Math.abs(dx) > M.keepDistance ? tc.x : c.x;
    let jump = false;
    let drop = false;
    if (tFeet < feet - M.jumpRise) {
      const up = map.arena.perches
        .map((p) => perchPos(map, p, G))
        .filter((p) => p.y + G.h < feet - M.jumpRise && p.y + G.h >= feet - M.maxRise)
        .sort((p, q) => Math.abs(p.x + G.w / 2 - c.x) - Math.abs(q.x + G.w / 2 - c.x))[0];
      if (up) {
        goalX = up.x + G.w / 2;
        if (b.onGround && g.cd.jump <= 0 && Math.abs(goalX - c.x) <= M.jumpAlign) jump = true;
      }
    } else if (tFeet > feet + M.jumpRise && b.onGround && b.groundTile === TILE.THIN && g.cd.jump <= 0) {
      drop = true;
    }
    if (jump || drop) g.cd.jump = M.jumpCooldown;
    const gap = goalX - c.x;
    const move = Math.abs(gap) > 4 ? Math.sign(gap) : 0;
    return { move, jumpPressed: jump, jumpHeld: true, dropHeld: drop };
  },
};

export function updateGman(g, dt, map, P, target, ctx = { alive: 0 }, G = GMAN, rng = Math.random) {
  const events = [];
  g.flash = Math.max(0, g.flash - dt);
  g.stun = Math.max(0, g.stun - dt);
  g.held = 0;
  g.invuln = Math.max(0, g.invuln - dt);
  for (const k of Object.keys(g.cd)) g.cd[k] = Math.max(0, g.cd[k] - dt);
  if (g.dir === 0) g.dir = -1;

  if (!g.alive && (g.state === 'fight' || g.state === 'creatine')) {
    g.state = 'tie';
    g.timer = G.tieTime;
    events.push({ type: 'defeated' });
  }

  let it = IDLE;
  switch (g.state) {
    case 'wait':
      g.timer -= dt;
      if (g.timer <= 0) startPhase(g, 0, map, events, G);
      break;
    case 'creatine':
      g.timer -= dt;
      if (g.timer <= 0) beginFight(g, G);
      break;
    case 'fight':
      g.shielded = false;
      if (g.floor > 0 && g.health <= g.floor + 1e-9) {
        startPhase(g, g.phase + 1, map, events, G);
      } else if (g.stun <= 0 && target) {
        it = BRAINS[PHASES[g.phase]](g, dt, map, target, events, G, ctx, rng);
      }
      break;
    case 'tie':
      g.timer -= dt;
      if (g.timer <= 0) {
        g.state = 'dissolve';
        g.timer = G.dissolveTime;
      }
      break;
    case 'dissolve':
      g.timer -= dt;
      if (g.timer <= 0) {
        g.state = 'gone';
        events.push({ type: 'gone' });
      }
      break;
    default:
      break;
  }
  if (target && g.state !== 'gone') {
    const tc = centerOf(target).x - centerOf(g.body).x;
    if (Math.abs(tc) > 2) g.dir = Math.sign(tc);
  }
  if (g.state !== 'gone' && g.state !== 'dissolve') {
    stepPlatformer(g.body, it, dt, map, { ...P, runSpeed: G.runSpeed, airJumps: 0 });
  }
  return events;
}

export function gmanContactDamage(g, body, G = GMAN) {
  if (!isFighting(g) || phaseName(g) !== 'mirror' || g.stun > 0 || !g.alive) return 0;
  return overlaps(g.body, body) ? G.mirror.touchDamage : 0;
}

export function gmanGrace(g, map, G = GMAN) {
  g.windup = 0;
  for (const k of Object.keys(g.cd)) g.cd[k] = Math.max(g.cd[k], G.respawnGrace);
  g.actTimer = Math.max(g.actTimer, G.respawnGrace);
  if (g.state === 'wait') g.timer = Math.max(g.timer, G.respawnGrace);
  if (isFighting(g) && phaseName(g) === 'mirror') placeAt(g, map, map.arena.top, G);
}

export function sceneLines(levelIndex, prev = null, rng = Math.random, scenes = GMAN_SCENES, verdict = GMAN_VERDICT) {
  const lines = [];
  if (prev) {
    const pool = prev.flawless ? verdict.good : verdict.bad;
    lines.push(pool[Math.floor(rng() * pool.length)]);
  }
  lines.push(...scenes[levelIndex]);
  return lines.slice(0, 4);
}
