import { findSurfaceY } from './zozniki.js';
import { LOCKS } from './config.js';

export function createLocks(map, L = LOCKS) {
  const ts = map.tileSize;
  return (map.locks ?? []).map((d, id) => {
    const left = d.tx0 * ts;
    const right = (d.tx1 + 1) * ts;
    const groundY = map.pixelHeight;
    return {
      id,
      def: d,
      left,
      right,
      trigger: left + L.triggerTiles * ts,
      leftY: findSurfaceY(map, left + ts / 2, groundY) ?? groundY,
      rightY: findSurfaceY(map, right - ts / 2, groundY) ?? groundY,
      state: 'idle',
      wave: 0,
      queue: [],
      timer: 0,
      side: 0,
      between: false,
    };
  });
}

export function activeLock(locks) {
  return locks.find((l) => l.state === 'active') ?? null;
}

function startWave(l, i) {
  l.wave = i;
  l.queue = [...l.def.waves[i]];
  l.between = false;
}

export function updateLocks(locks, dt, ctx, L = LOCKS) {
  const events = [];
  for (const l of locks) {
    if (l.state === 'idle') {
      if (ctx.nikichX >= l.trigger && ctx.nikichX < l.right) {
        l.state = 'active';
        startWave(l, 0);
        l.timer = L.firstDelay;
        events.push({ type: 'start', lock: l });
      }
      continue;
    }
    if (l.state !== 'active') continue;
    l.timer -= dt;
    if (l.queue.length > 0) {
      if (l.timer <= 0 && ctx.room > 0) {
        const kind = l.queue.shift();
        const x = l.side % 2 === 0 ? l.left + L.gateInset : l.right - L.gateInset;
        l.side += 1;
        const y = findSurfaceY(ctx.map, x, ctx.map.pixelHeight);
        if (y !== null) events.push({ type: 'spawn', lock: l, kind, x, y });
        l.timer = L.spawnEvery;
      }
      continue;
    }
    if (ctx.aliveIn(l.id) > 0) continue;
    if (l.wave + 1 >= l.def.waves.length) {
      l.state = 'done';
      events.push({ type: 'clear', lock: l });
    } else if (!l.between) {
      l.between = true;
      l.timer = L.waveGap;
    } else if (l.timer <= 0) {
      startWave(l, l.wave + 1);
      l.timer = L.spawnEvery;
      events.push({ type: 'wave', lock: l, wave: l.wave });
    }
  }
  return events;
}

export function confine(body, lock) {
  if (body.x < lock.left) {
    body.x = lock.left;
    body.vx = Math.max(0, body.vx);
    return true;
  }
  if (body.x + body.w > lock.right) {
    body.x = lock.right - body.w;
    body.vx = Math.min(0, body.vx);
    return true;
  }
  return false;
}

export function resetLocks(locks) {
  for (const l of locks) {
    if (l.state !== 'active') continue;
    l.state = 'idle';
    l.queue = [];
    l.side = 0;
    l.between = false;
  }
}
