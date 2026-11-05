// Физика платформера и коллизии с тайлами (SPEC §5, §9). Чистая логика, без DOM.

export const TILE = Object.freeze({
  EMPTY: 0,
  SOLID: 1,
  THIN: 2, // тонкая платформа: запрыгнуть снизу, спрыгнуть через S
  BARRIER: 3, // сплошной, кроме езды на Самокате
  PIT: 4, // маркер Ямы: пусто, падение вниз за карту
  DECOR: 5, // декор фона, не сталкивается
});

const EPS = 1e-6;

export function approach(value, target, delta) {
  if (value < target) return Math.min(value + delta, target);
  return Math.max(value - delta, target);
}

export function isBlocking(tile, opts = {}) {
  return tile === TILE.SOLID || (tile === TILE.BARRIER && !opts.passBarriers);
}

export function createBody(x, y, w, h) {
  return {
    x, y, w, h,
    vx: 0, vy: 0,
    onGround: false,
    groundTile: TILE.EMPTY,
    coyote: 0,
    jumpBuffer: 0,
    dropTimer: 0,
    jumping: false,
    airJumpsLeft: 0,
  };
}

function rowSpan(body, ts) {
  return [Math.floor(body.y / ts), Math.floor((body.y + body.h - EPS) / ts)];
}

function colSpan(body, ts) {
  return [Math.floor(body.x / ts), Math.floor((body.x + body.w - EPS) / ts)];
}

// Сдвиг по X с упором в сплошные тайлы. Возвращает true, если упёрся.
export function moveX(body, dx, map, opts = {}) {
  const ts = map.tileSize;
  const maxChunk = ts / 2;
  let remaining = dx;
  while (Math.abs(remaining) > EPS) {
    const chunk = Math.max(-maxChunk, Math.min(maxChunk, remaining));
    remaining -= chunk;
    body.x += chunk;
    const [top, bottom] = rowSpan(body, ts);
    const tx = chunk > 0 ? Math.floor((body.x + body.w - EPS) / ts) : Math.floor(body.x / ts);
    for (let ty = top; ty <= bottom; ty++) {
      if (isBlocking(map.get(tx, ty), opts)) {
        body.x = chunk > 0 ? tx * ts - body.w : (tx + 1) * ts;
        body.vx = 0;
        return true;
      }
    }
  }
  return false;
}

// Сдвиг по Y. Вниз — приземление на сплошные и тонкие (если пришли сверху),
// вверх — удар головой о сплошные. Возвращает 'land' | 'ceiling' | null.
export function moveY(body, dy, map, opts = {}) {
  const ts = map.tileSize;
  const maxChunk = ts / 2;
  let remaining = dy;
  while (Math.abs(remaining) > EPS) {
    const chunk = Math.max(-maxChunk, Math.min(maxChunk, remaining));
    remaining -= chunk;
    const prevBottom = body.y + body.h;
    body.y += chunk;
    const [left, right] = colSpan(body, ts);
    if (chunk > 0) {
      const ty = Math.floor((body.y + body.h - EPS) / ts);
      const tileTop = ty * ts;
      for (let tx = left; tx <= right; tx++) {
        const t = map.get(tx, ty);
        const thinLanding = t === TILE.THIN && !opts.dropThrough && prevBottom <= tileTop + EPS;
        if (isBlocking(t, opts) || thinLanding) {
          body.y = tileTop - body.h;
          body.vy = 0;
          body.groundTile = t;
          return 'land';
        }
      }
    } else {
      const ty = Math.floor(body.y / ts);
      for (let tx = left; tx <= right; tx++) {
        if (isBlocking(map.get(tx, ty), opts)) {
          body.y = (ty + 1) * ts;
          body.vy = 0;
          return 'ceiling';
        }
      }
    }
  }
  return null;
}

// Один шаг управляемого тела платформера.
// intent: { move: -1|0|1, jumpPressed, jumpHeld, dropHeld }
// mods: { speedMul, jumpMul, passBarriers } — для Самоката, Пива 0,0 и т. п.
export function stepPlatformer(body, intent, dt, map, P, mods = {}) {
  const speedMul = mods.speedMul ?? 1;
  const jumpMul = mods.jumpMul ?? 1;
  const events = { jumped: false, airJumped: false, landed: false, bumped: false, hitWall: false, dropped: false };

  // Горизонталь: разгон и торможение
  const target = intent.move * P.runSpeed * speedMul;
  let accel;
  if (body.onGround) accel = intent.move !== 0 ? P.groundAccel : P.groundDecel;
  else accel = intent.move !== 0 ? P.airAccel : P.airDecel;
  // Разворот на земле — сразу с тормозным ускорением, чтобы не «скользить»
  if (body.onGround && intent.move !== 0 && Math.sign(body.vx) === -intent.move) accel = P.groundDecel + P.groundAccel;
  body.vx = approach(body.vx, target, accel * speedMul * dt);

  // Таймеры прыжка
  if (body.onGround) {
    body.coyote = P.coyoteTime;
    body.airJumpsLeft = P.airJumps;
  } else {
    body.coyote = Math.max(0, body.coyote - dt);
  }
  body.jumpBuffer = intent.jumpPressed ? P.jumpBufferTime : Math.max(0, body.jumpBuffer - dt);

  if (body.jumpBuffer > 0 && body.coyote > 0) {
    body.vy = -P.jumpVelocity * jumpMul;
    body.coyote = 0;
    body.jumpBuffer = 0;
    body.onGround = false;
    body.jumping = true;
    events.jumped = true;
  } else if (intent.jumpPressed && !body.onGround && body.airJumpsLeft > 0) {
    body.vy = -P.jumpVelocity * jumpMul;
    body.airJumpsLeft -= 1;
    body.jumpBuffer = 0;
    body.jumping = true;
    events.jumped = true;
    events.airJumped = true;
  }

  // Прыжок разной высоты: отпустил кнопку на подъёме — обрезаем скорость
  if (body.jumping && !intent.jumpHeld && body.vy < -P.jumpCutVelocity * jumpMul) {
    body.vy = -P.jumpCutVelocity * jumpMul;
  }
  if (body.vy >= 0) body.jumping = false;

  // Спрыгнуть с тонкой платформы
  body.dropTimer = Math.max(0, body.dropTimer - dt);
  if (intent.dropHeld && body.onGround && body.groundTile === TILE.THIN) {
    body.dropTimer = P.dropThroughTime;
    body.onGround = false;
    events.dropped = true;
  }

  // Гравитация
  body.vy = Math.min(body.vy + P.gravity * dt, P.maxFallSpeed);

  const opts = { passBarriers: !!mods.passBarriers, dropThrough: body.dropTimer > 0 };
  events.hitWall = moveX(body, body.vx * dt, map, opts);

  const wasOnGround = body.onGround;
  const hit = moveY(body, body.vy * dt, map, opts);
  body.onGround = hit === 'land';
  if (!body.onGround) body.groundTile = TILE.EMPTY;
  if (hit === 'ceiling') {
    events.bumped = true;
    body.jumping = false;
  }
  if (body.onGround && !wasOnGround) events.landed = true;
  return events;
}

// Провалился ниже карты — значит в Яму.
export function fellOut(body, map) {
  return body.y > map.pixelHeight;
}
