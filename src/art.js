import {
  OUTLINE, shade, limb, blob, disc, shadowUnder, gait, airPose, STAND, breathe, humanoid, wheel, face, stripes, plaid,
} from './rig.js';
import { ZOZNIKI, DEATH, EFFECTS } from './config.js';

const SKIN = '#f0c8a0';
const WHITE = '#ffffff';
const TAU = Math.PI * 2;

function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function stars(c, cx, cy, time, color) {
  const t = time * 7;
  for (let i = 0; i < 3; i++) {
    const a = t + (i * TAU) / 3;
    const x = cx + Math.cos(a) * 6;
    const y = cy + Math.sin(a) * 2;
    c.fillStyle = color;
    c.beginPath();
    for (let k = 0; k < 5; k++) {
      const r = k % 2 ? 0.6 : 1.5;
      const ang = (k * TAU) / 5 + t;
      c.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
    }
    c.fill();
  }
}

function sneaker(color, sole = '#f4f1de') {
  return (c, f) => {
    blob(c, f.x - 1.2, f.y - 1.1, 3.4, 1.7, 0.7, color);
    rect(c, f.x - 1.2, f.y + 0.25, 3.4, 0.45, sole);
  };
}

function walkPhase(x, stride) {
  return (x / stride) * TAU;
}

function movePose(b, time, { stride = 9, runAt = 60, amount = 1 } = {}) {
  if (!b.onGround) return airPose(b.vy);
  const speed = Math.abs(b.vx);
  if (speed < 6) return breathe(STAND, time);
  const k = Math.min(1, speed / 60) * amount;
  return gait(walkPhase(b.x, stride), k, { run: speed > runAt });
}

// Мигание при уроне: вторая отрисовка поверх в режиме lighter — без ctx.filter,
// который в Firefox и на слабых видеокартах очень дорог (SPEC §13)
function withFlash(c, on, draw) {
  draw();
  if (!on) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = EFFECTS.hurtFlashAlpha;
  draw();
  c.restore();
}

function deathTransform(c, fx, fy, dir, t) {
  const e = Math.min(1, t / DEATH.fallTime);
  c.translate(fx, fy);
  c.rotate(-dir * e * e * (Math.PI / 2) * 0.95);
  c.translate(-fx, -fy);
  c.globalAlpha = t < DEATH.fallTime ? 1 : Math.max(0, 1 - (t - DEATH.fallTime) / DEATH.fadeTime);
}

// ---------- Никич ----------

const NIKICH_LOOK = {
  legLen: 6.2,
  torsoH: 7,
  torsoW: 9.2,
  legW: 2.7,
  armW: 2.3,
  armLen: 6.6,
  legs: SKIN,
  arms: SKIN,
  shoes: '#f4f4f4',
  shoe: sneaker('#f4f4f4', '#9aa0a6'),
  torso(c, x, y, w, h) {
    blob(c, x, y + h - 3.4, w, 3.6, 1, '#cbb994');
    rect(c, x + w / 2 - 0.2, y + h - 2.6, 0.4, 2.4, shade('#cbb994', -0.25));
    blob(c, x - 0.4, y, w + 0.8, h - 2.6, 2.2, '#8f9396');
    rect(c, x + w * 0.55, y + 0.6, w * 0.35, h - 3.6, shade('#8f9396', -0.12));
    rect(c, x + 1, y + h - 3.4, w - 2, 0.5, shade('#8f9396', -0.3));
  },
  frontHand(c, h) {
    disc(c, h.x, h.y, 1.15, SKIN);
  },
};

export function nikichFrame(n) {
  const b = n.body;
  if (!b.onGround) return 'air';
  return Math.abs(b.vx) > 20 ? 'run' : 'stand';
}

const NECK_OVERLAP = 2.4;

function drawHeadImage(c, head, cx, bottom, flip, opts = {}) {
  const w = head.w;
  const h = head.h;
  c.save();
  c.translate(cx, bottom);
  if (flip) c.scale(-1, 1);
  if (opts.tilt) c.rotate(opts.tilt);
  if (opts.alpha !== undefined) c.globalAlpha *= opts.alpha;
  c.imageSmoothingEnabled = true;
  c.drawImage(head.img, -w / 2, -h, w, h);
  c.imageSmoothingEnabled = false;
  if (opts.tint) {
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = 0.55;
    c.fillStyle = opts.tint;
    c.fillRect(-w / 2, -h, w, h);
  }
  c.restore();
}

function aimAngle(aim, dir) {
  return Math.atan2(aim.x * dir, aim.y);
}

function nikichPose(n, time) {
  const b = n.body;
  const riding = n.effects.scooter > 0;
  let pose;
  if (riding) pose = { ...STAND, arms: [[1.5, -0.6], [1.3, -0.5]], legs: [[0.1, -0.2], [-0.15, 0]], lean: 0.12 };
  else pose = movePose(b, time, { stride: 10, runAt: 70 });
  if (n.stun > 0) pose = { ...pose, lean: Math.sin(time * 9) * 0.18, arms: [[2.6, 0.4], [-2.6, -0.4]] };
  if (n.hurtLock > 0) pose = { ...pose, lean: -0.25, arms: [[-1.2, -0.6], [2.2, 0.4]] };
  const shooting = n.face && n.face.shoot > 0;
  if (shooting && n.stun <= 0) pose = { ...pose, aim: [aimAngle(n.aim, n.facing), 0] };
  return pose;
}

export function drawNikich(c, n, camX, camY, time, squash = 0, head = null) {
  const b = n.body;
  if (n.invuln > 0 && Math.floor(time * 20) % 2 === 0) return;
  const fx = b.x + b.w / 2 - camX;
  const fy = b.y + b.h - camY;
  const f = n.facing;
  const riding = n.effects.scooter > 0;
  shadowUnder(c, fx, fy, 6);
  if (riding) drawScooterUnder(c, fx, fy, f, time, b.vx);
  const lift = riding ? 2.2 : 0;
  const pose = nikichPose(n, time);
  c.save();
  c.translate(fx, fy - lift);
  c.scale(1 + squash * 2, 1 - squash * 2);
  const tint = n.hurtLock > 0 ? '#ff6b6b' : undefined;
  withFlash(c, n.hurtLock > 0, () => {
    const r = humanoid(c, 0, 0, f, pose, NIKICH_LOOK);
    if (head && head.img) {
      const neckX = r.neck.x * f;
      drawHeadImage(c, head, neckX + f * 0.4, r.neck.y + NECK_OVERLAP - (pose.bob ?? 0) * 0.3, f < 0, { tint, tilt: (pose.lean ?? 0) * 0.5 * f });
    } else {
      disc(c, r.neck.x * f, r.neck.y - 4, 4.4, SKIN);
    }
  });
  c.restore();
  const top = head && head.img ? 13 + head.h : 24;
  if (n.stun > 0) stars(c, fx, fy - top - 3, time, '#c77dff');
}

// ---------- Зожники ----------

function sweat(c, x, y, time) {
  const t = (time * 1.6) % 1;
  c.globalAlpha = 1 - t;
  disc(c, x, y + t * 4, 0.6, '#9ad7ff', null);
  c.globalAlpha = 1;
}

const RUNNER = {
  legLen: 8,
  torsoH: 7,
  torsoW: 6.6,
  legW: 2,
  armW: 1.7,
  armLen: 6.4,
  legs: SKIN,
  arms: SKIN,
  shoes: '#9cff3a',
  shoe: sneaker('#9cff3a', '#ffffff'),
  torso(c, x, y, w, h) {
    blob(c, x, y + h - 2.6, w, 2.8, 0.8, '#1d3557');
    rect(c, x, y + h - 2.6, w, 0.4, '#e63946');
    blob(c, x, y, w, h - 2.2, 1.6, '#2a9d8f');
    rect(c, x + w * 0.62, y + 0.5, w * 0.3, h - 3, shade('#2a9d8f', -0.15));
    blob(c, x + 1.2, y + 1.4, w - 2.4, 2.4, 0.3, '#f4f1de');
    rect(c, x + 2.2, y + 2.1, 0.5, 1.1, '#264653');
    rect(c, x + 3.2, y + 2.1, 0.5, 1.1, '#264653');
  },
  head(c, x, y, pose) {
    const r = 3.4;
    const cx = x + 0.6;
    const cy = y - r + 0.4;
    disc(c, cx, cy, r, SKIN);
    c.fillStyle = '#5a3a22';
    c.beginPath();
    c.arc(cx - 0.3, cy - 0.4, r, Math.PI * 0.9, Math.PI * 1.95);
    c.fill();
    rect(c, cx - r, cy - 1.7, r * 2, 0.9, '#e63946');
    rect(c, cx - r - 1.6, cy - 1.6, 1.7, 0.5, '#e63946');
    face(c, cx, cy, r, { open: pose.run ? 0.6 : 0.2 });
  },
  frontHand(c, h) {
    rect(c, h.x - 0.9, h.y - 1.4, 1.8, 0.7, WHITE);
    disc(c, h.x, h.y, 0.95, SKIN);
  },
};

const YOGA = {
  legLen: 8,
  torsoH: 6.4,
  torsoW: 6.4,
  legW: 2,
  armW: 1.5,
  armLen: 6.4,
  legs: '#7b2cbf',
  arms: SKIN,
  shoes: SKIN,
  shoe(c, f) {
    blob(c, f.x - 1, f.y - 0.9, 2.6, 1.3, 0.6, SKIN);
  },
  preBack(c) {
    c.save();
    c.translate(-3.6, -12.5);
    c.rotate(0.55);
    blob(c, -1.4, -4.5, 2.8, 9, 1.4, '#c77dff');
    rect(c, -1.4, -1.6, 2.8, 0.5, shade('#c77dff', -0.3));
    rect(c, -1.4, 1.6, 2.8, 0.5, shade('#c77dff', -0.3));
    c.restore();
  },
  torso(c, x, y, w, h) {
    blob(c, x, y + h - 2.4, w, 2.6, 0.8, '#7b2cbf');
    stripes(c, x, y + h - 2.4, w, 2.4, shade('#7b2cbf', 0.25), 1.6, 0.35);
    rect(c, x + 0.6, y + h - 3.4, w - 1.2, 1.2, SKIN);
    blob(c, x, y, w, h - 3.2, 1.6, '#ff8fab');
    rect(c, x + w * 0.6, y + 0.5, w * 0.3, h - 4, shade('#ff8fab', -0.15));
  },
  head(c, x, y, pose) {
    const r = 3.2;
    const cx = x + 0.4;
    const cy = y - r + 0.4;
    disc(c, cx - 1.6, cy - r - 0.4, 1.6, '#6f4518');
    disc(c, cx, cy, r, SKIN);
    c.fillStyle = '#6f4518';
    c.beginPath();
    c.arc(cx - 0.2, cy - 0.3, r, Math.PI * 0.85, Math.PI * 1.9);
    c.fill();
    rect(c, cx - r, cy - 1.3, r * 2, 0.6, '#ffd6e0');
    if (pose.zen) {
      c.strokeStyle = '#1b1b1b';
      c.lineWidth = 0.4;
      c.beginPath();
      c.arc(cx + r * 0.42, cy - r * 0.1, r * 0.18, 0.1, Math.PI - 0.1);
      c.stroke();
      c.beginPath();
      c.moveTo(cx + r * 0.35, cy + r * 0.5);
      c.quadraticCurveTo(cx + r * 0.55, cy + r * 0.65, cx + r * 0.75, cy + r * 0.45);
      c.stroke();
    } else {
      face(c, cx, cy, r, { open: pose.talk ?? 0, brow: '#6f4518' });
    }
  },
};

const HIPSTER = {
  legLen: 8,
  torsoH: 7.4,
  torsoW: 6.6,
  legW: 1.8,
  armW: 1.8,
  armLen: 6.6,
  legs: '#2b3a67',
  arms: '#bc4749',
  shoes: '#f4f1de',
  shoe: sneaker('#f4f1de', '#c8102e'),
  torso(c, x, y, w, h) {
    blob(c, x, y + h - 2.4, w, 2.6, 0.6, '#2b3a67');
    blob(c, x - 0.3, y, w + 0.6, h - 1.6, 1.4, '#bc4749');
    plaid(c, x - 0.3, y, w + 0.6, h - 1.6, '#3a0a0a', '#2b0b0b');
    rect(c, x + w / 2 - 0.2, y + 0.4, 0.4, h - 2.2, '#f4f1de');
  },
  head(c, x, y) {
    const r = 3.3;
    const cx = x + 0.5;
    const cy = y - r + 0.3;
    disc(c, cx, cy, r, SKIN);
    c.fillStyle = '#6f4518';
    c.beginPath();
    c.moveTo(cx - r * 0.6, cy + r * 0.1);
    c.quadraticCurveTo(cx - r * 0.2, cy + r * 1.9, cx + r * 1.05, cy + r * 0.2);
    c.lineTo(cx + r * 0.9, cy + r * 0.05);
    c.closePath();
    c.fill();
    c.fillStyle = '#ee9b00';
    c.beginPath();
    c.arc(cx - 0.2, cy - 0.6, r + 0.3, Math.PI * 1.02, Math.PI * 2.0);
    c.lineTo(cx + r, cy - 0.3);
    c.lineTo(cx - r - 0.2, cy - 0.3);
    c.fill();
    rect(c, cx - r - 0.2, cy - 1, r * 2 + 0.6, 0.8, shade('#ee9b00', -0.2));
    disc(c, cx - 0.5, cy - r - 0.6, 0.8, '#ee9b00');
    c.strokeStyle = '#1b1b1b';
    c.lineWidth = 0.35;
    c.beginPath();
    c.arc(cx + r * 0.45, cy - r * 0.05, r * 0.28, 0, TAU);
    c.stroke();
    disc(c, cx + r * 0.45, cy - r * 0.05, r * 0.1, '#1b1b1b', null);
  },
  frontHand(c, h, pose) {
    if (pose.noCup) return disc(c, h.x, h.y, 0.9, SKIN);
    blob(c, h.x - 0.9, h.y - 2.6, 2, 3, 0.4, '#80b918');
    rect(c, h.x - 0.9, h.y - 2.6, 2, 0.6, '#f4f1de');
    rect(c, h.x + 0.2, h.y - 4, 0.35, 1.6, WHITE);
    disc(c, h.x, h.y, 0.9, SKIN);
  },
};

const CYCLIST = {
  legLen: 6.6,
  torsoH: 6.6,
  torsoW: 5.8,
  legW: 1.9,
  armW: 1.6,
  armLen: 6.4,
  legs: '#1b1b1b',
  arms: '#ffd60a',
  shoes: '#3a86ff',
  shoe: sneaker('#3a86ff', '#1b1b1b'),
  torso(c, x, y, w, h) {
    blob(c, x, y, w, h + 0.6, 1.6, '#ffd60a');
    rect(c, x + w - 1.6, y + 0.6, 1, h, '#1b1b1b');
    rect(c, x + 0.8, y + h - 1.6, w - 1.6, 0.5, '#3a86ff');
  },
  head(c, x, y) {
    const r = 3;
    const cx = x + 1;
    const cy = y - r + 0.6;
    disc(c, cx, cy, r, SKIN);
    c.fillStyle = '#3a86ff';
    c.beginPath();
    c.ellipse(cx - 0.6, cy - 1.1, r + 1.4, r * 0.8, -0.15, Math.PI, TAU);
    c.fill();
    c.strokeStyle = OUTLINE;
    c.lineWidth = 0.5;
    c.stroke();
    rect(c, cx + 0.2, cy - 0.6, r + 0.6, 1, '#1b1b1b');
    rect(c, cx + 0.6, cy - 0.5, 1.2, 0.3, '#8ecae6');
  },
};

const MOTO = {
  legLen: 6.4,
  torsoH: 6.8,
  torsoW: 6.4,
  legW: 2.1,
  armW: 1.9,
  armLen: 6.2,
  legs: '#212529',
  arms: '#212529',
  shoes: '#111111',
  shoe: sneaker('#111111', '#555555'),
  torso(c, x, y, w, h) {
    blob(c, x, y, w, h + 0.6, 1.4, '#212529');
    rect(c, x + w * 0.45, y + 0.4, 0.4, h - 0.6, '#adb5bd');
    rect(c, x + 0.6, y + 1.2, w - 1.2, 0.6, '#d00000');
  },
  head(c, x, y) {
    const r = 3.6;
    const cx = x + 0.8;
    const cy = y - r + 0.8;
    disc(c, cx, cy, r, '#d00000');
    c.fillStyle = shade('#d00000', 0.25);
    c.beginPath();
    c.arc(cx - 0.8, cy - 1.2, r * 0.45, 0, TAU);
    c.fill();
    blob(c, cx + 0.2, cy - 1.2, r + 0.4, 2.2, 0.9, '#1b263b');
    rect(c, cx + 0.9, cy - 0.9, 1.6, 0.4, '#90e0ef');
  },
};

const DUMMY = {
  legLen: 8,
  torsoH: 7,
  torsoW: 7,
  legW: 2,
  armW: 1.8,
  armLen: 6,
  legs: '#8d99ae',
  arms: '#8d99ae',
  shoes: '#6c757d',
  shoe: sneaker('#6c757d', '#495057'),
  torso(c, x, y, w, h) {
    blob(c, x, y, w, h + 1, 1.4, '#8d99ae');
  },
  head(c, x, y) {
    disc(c, x, y - 3.2, 3.2, '#edf2f4');
  },
};

function drawBike(c, x, y, dir, spin, lean, color = '#adb5bd') {
  c.save();
  c.translate(x, y);
  if (dir < 0) c.scale(-1, 1);
  const r = 3.6;
  wheel(c, -6, -r, r, spin);
  wheel(c, 6, -r, r, spin);
  c.strokeStyle = color;
  c.lineWidth = 0.9;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-6, -r);
  c.lineTo(-1.5, -9);
  c.lineTo(4.5, -9.4);
  c.lineTo(6, -r);
  c.moveTo(-1.5, -9);
  c.lineTo(0.5, -r);
  c.lineTo(-6, -r);
  c.moveTo(0.5, -r);
  c.lineTo(4.5, -9.4);
  c.stroke();
  c.lineWidth = 0.8;
  c.strokeStyle = '#1b1b1b';
  c.beginPath();
  c.moveTo(4.5, -9.4);
  c.lineTo(5.2, -11.2);
  c.lineTo(6.6, -11);
  c.stroke();
  blob(c, -3, -10.6, 3, 0.9, 0.4, '#1b1b1b');
  c.restore();
  return lean;
}

function drawMotorbike(c, x, y, dir, spin, time, dashing) {
  c.save();
  c.translate(x, y);
  if (dir < 0) c.scale(-1, 1);
  const r = 4;
  wheel(c, -7, -r, r, spin, '#111111', '#6c757d', '#adb5bd');
  wheel(c, 7, -r, r, spin, '#111111', '#6c757d', '#adb5bd');
  c.fillStyle = '#d00000';
  c.strokeStyle = OUTLINE;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-7.5, -7);
  c.lineTo(-2, -10.5);
  c.lineTo(5.5, -11);
  c.lineTo(9.5, -8);
  c.lineTo(7, -5.5);
  c.lineTo(-4, -5);
  c.closePath();
  c.fill();
  c.stroke();
  rect(c, -2, -10, 6, 1.4, shade('#d00000', -0.35));
  blob(c, -6.5, -9.6, 5, 1.6, 0.7, '#1b1b1b');
  rect(c, -9.5, -5.8, 5, 1, '#adb5bd');
  disc(c, 9.2, -9, 1, '#fff3b0');
  c.restore();
  if (dashing) {
    for (let i = 0; i < 3; i++) {
      const t = (time * 3 + i / 3) % 1;
      c.globalAlpha = 0.5 * (1 - t);
      disc(c, x - dir * (10 + t * 8), y - 5 - t * 2, 1 + t * 2, '#adb5bd', null);
    }
    c.globalAlpha = 1;
  }
}

function riderPose(spin, { lean = 0.8, pedal = true } = {}) {
  const s = Math.sin(spin);
  const k = Math.cos(spin);
  return {
    legs: pedal ? [[0.9 + s * 0.45, -1.3 - k * 0.4], [0.9 - s * 0.45, -1.3 + k * 0.4]] : [[1.1, -1.6], [1.0, -1.5]],
    arms: [[2.0, -0.4], [1.9, -0.4]],
    bob: 0,
    lean,
  };
}

const KIND_DRAW = {
  runner(c, z, fx, fy, time) {
    const b = z.body;
    let pose;
    if (!b.onGround) pose = airPose(b.vy);
    else if (Math.abs(b.vx) > 8) pose = gait(walkPhase(b.x, 11), Math.min(1, Math.abs(b.vx) / 50), { run: true });
    else pose = gait(time * 9, 0.45, { run: true });
    pose.run = true;
    humanoid(c, fx, fy, z.dir, pose, RUNNER);
    if (Math.floor(time * 2) % 3 === 0) sweat(c, fx + z.dir * 2, fy - 21, time);
  },

  yoga(c, z, fx, fy, time) {
    const b = z.body;
    let pose;
    if (z.state === 'pose') {
      pose = {
        legs: [[0, 0], [1.5, -2.6]],
        arms: [[Math.PI - 0.3, 0.7], [Math.PI + 0.3, -0.7]],
        bob: 0,
        lean: Math.sin(time * 1.5) * 0.05,
        zen: true,
      };
    } else if (z.state === 'lecture') {
      pose = { ...breathe(STAND, time), aim: [1.9 + Math.sin(time * 18) * 0.3, -0.5], talk: 0.5 + Math.sin(time * 14) * 0.5 };
    } else {
      pose = movePose(b, time, { stride: 7, runAt: 999 });
    }
    humanoid(c, fx, fy, z.dir, pose, YOGA);
    if (z.state === 'pose') {
      c.globalAlpha = 0.35 + Math.sin(time * 2) * 0.15;
      c.strokeStyle = '#ffd6ff';
      c.lineWidth = 0.5;
      c.beginPath();
      c.arc(fx, fy - 14, 9 + Math.sin(time * 2) * 0.8, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
    }
  },

  smoothie(c, z, fx, fy, time) {
    const b = z.body;
    const pose = movePose(b, time, { stride: 8, runAt: 999 });
    const sinceThrow = ZOZNIKI.smoothie.throwCooldown - z.throwCd;
    if (sinceThrow >= 0 && sinceThrow < 0.4) {
      const k = sinceThrow / 0.4;
      pose.aim = [-2.6 + k * 4.4, -0.2];
      pose.noCup = k > 0.4;
    }
    humanoid(c, fx, fy, z.dir, pose, HIPSTER);
  },

  cyclist(c, z, fx, fy, time) {
    const b = z.body;
    const spin = b.x / 3.6;
    const brake = z.state === 'brake';
    drawBike(c, fx, fy, z.dir, spin, 0);
    humanoid(c, fx - z.dir * 1.2, fy - 7.6, z.dir, riderPose(spin * 0.6, { lean: brake ? 0.3 : 0.85, pedal: !brake }), CYCLIST);
    if (brake && Math.abs(b.vx) > 20) {
      for (let i = 0; i < 3; i++) {
        const t = (time * 4 + i / 3) % 1;
        c.globalAlpha = 0.5 * (1 - t);
        disc(c, fx - z.dir * (7 + t * 5), fy - 1 - t * 3, 0.8 + t * 1.5, '#d9c9a3', null);
      }
      c.globalAlpha = 1;
    }
  },

  moto(c, z, fx, fy, time) {
    const b = z.body;
    const spin = b.x / 4;
    const tilt = b.onGround ? 0 : Math.max(-0.5, Math.min(0.5, Math.atan2(b.vy, Math.abs(b.vx) + 1) * 0.6)) * -z.dir;
    c.save();
    c.translate(fx, fy - 4);
    c.rotate(tilt);
    c.translate(-fx, -(fy - 4));
    drawMotorbike(c, fx, fy, z.dir, spin, time, z.state === 'dash');
    humanoid(c, fx - z.dir * 1.6, fy - 9.4, z.dir, riderPose(0, { lean: 0.6, pedal: false }), MOTO);
    c.restore();
  },

  dummy(c, z, fx, fy, time) {
    humanoid(c, fx, fy, z.dir, breathe(STAND, time), DUMMY);
  },
};

export function drawZoznik(c, z, camX, camY, time, colors, deathT = -1) {
  const dead = deathT >= 0;
  if (!z.alive && !dead) return;
  const b = z.body;
  let fx = b.x + b.w / 2 - camX;
  const fy = b.y + b.h - camY;
  if (z.held > 0) fx += Math.sin(time * 40) * 0.6;
  c.save();
  if (!dead) shadowUnder(c, fx, fy, b.w * 0.55);
  if (dead) deathTransform(c, fx, fy, z.dir, deathT);
  if (z.stun > 0 && !dead) {
    c.translate(fx, fy);
    c.rotate(Math.sin(time * 10) * 0.12);
    c.translate(-fx, -fy);
  }
  withFlash(c, z.flash > 0 && !dead, () => KIND_DRAW[z.kind](c, z, fx, fy, time));
  c.restore();
  if (dead) {
    if (deathT < DEATH.poofTime) poof(c, fx, fy - b.h / 2, deathT / DEATH.poofTime);
    return;
  }
  if (z.stun > 0) stars(c, fx, fy - b.h - 4, time, colors.accent);
}

function poof(c, x, y, k) {
  c.save();
  c.globalAlpha = 0.8 * (1 - k);
  for (let i = 0; i < 7; i++) {
    const a = (i * TAU) / 7 + 0.4;
    disc(c, x + Math.cos(a) * (2 + k * 9), y + Math.sin(a) * (2 + k * 6), 1.4 * (1 - k) + 0.4, i % 2 ? '#f4f1de' : '#ffd166', null);
  }
  c.restore();
}

// ---------- Собака ----------

export function drawDog(c, d, camX, camY, time) {
  const b = d.body;
  const x = b.x + b.w / 2 - camX;
  const y = b.y + b.h - camY;
  const dir = d.dir;
  const hold = d.state !== 'run';
  const ph = hold ? time * 30 : (b.x / 6) * TAU;
  c.save();
  c.translate(x, y);
  if (dir < 0) c.scale(-1, 1);
  if (hold) c.rotate(Math.sin(time * 25) * 0.08);
  const legs = [[-3.5, 0], [-2, Math.PI], [2.5, Math.PI / 2], [4, Math.PI * 1.5]];
  for (const [lx, off] of legs) {
    const a = Math.sin(ph + off) * (hold ? 0.3 : 0.6);
    limb(c, lx, -3.2, a, 1.8, -Math.max(0, Math.cos(ph + off)) * 0.6, 1.6, 1.1, off > 3 || off === Math.PI ? '#6b4423' : '#8b5a2b');
  }
  const wag = Math.sin(time * (hold ? 25 : 15)) * 0.5;
  limb(c, -5.6, -5.4, -2.4 + wag, 2.4, 0.3, 1.4, 0.9, '#8b5a2b');
  blob(c, -6, -7, 11, 4.4, 2, '#8b5a2b');
  rect(c, -4, -6.4, 6, 1, shade('#8b5a2b', 0.2));
  disc(c, 5.6, -7.8, 2.6, '#8b5a2b');
  blob(c, 6.6, -8, 3.2, 2, 0.9, shade('#8b5a2b', -0.1));
  disc(c, 9.6, -7.4, 0.6, '#1b1b1b', null);
  disc(c, 6.2, -8.8, 0.45, '#1b1b1b', null);
  c.fillStyle = '#5a3a1a';
  c.beginPath();
  c.ellipse(4.2, -9.2, 1, 1.9, -0.5 + Math.sin(ph) * 0.2, 0, TAU);
  c.fill();
  rect(c, 3.2, -6.2, 1.2, 1.2, '#e63946');
  c.restore();
}

// ---------- Снаряды ----------

export function drawShot(c, s, camX, camY) {
  const x = s.x - camX;
  const y = s.y - camY;
  const a = Math.atan2(s.vy, s.vx);
  c.save();
  c.translate(x, y);
  c.rotate(a);
  rect(c, -2.4, -0.55, 3.2, 1.1, '#f4f1de');
  rect(c, -2.4, -0.55, 1.1, 1.1, '#d4a373');
  rect(c, 0.8, -0.55, 0.6, 1.1, '#ff7b00');
  c.globalAlpha = 0.5;
  disc(c, 1.8, 0, 0.9, '#ffd166', null);
  c.globalAlpha = 0.25;
  disc(c, -4, 0, 0.8, '#adb5bd', null);
  c.restore();
}

export function drawSmoothieShot(c, s, camX, camY) {
  const x = s.x - camX;
  const y = s.y - camY;
  blob(c, x - 1.6, y - 2.2, 3.2, 4, 0.6, '#80b918');
  rect(c, x - 1.6, y - 2.2, 3.2, 0.8, '#f4f1de');
  rect(c, x + 0.3, y - 3.6, 0.4, 1.6, WHITE);
  c.globalAlpha = 0.5;
  disc(c, x - 2.5, y + 1, 0.6, '#b5e48c', null);
  c.globalAlpha = 1;
}

// ---------- Карта ----------

export function drawDoor(c, x, feetY, camX, camY) {
  const left = x - 11 - camX;
  const top = feetY - 32 - camY;
  blob(c, left - 1.5, top - 2.5, 25, 34.5, 0.8, '#6c757d');
  rect(c, left - 1.5, top - 2.5, 25, 2, '#495057');
  blob(c, left + 1, top + 1, 20, 31, 0.6, '#3d2b1f');
  rect(c, left + 2.4, top + 2.6, 7.6, 12, '#1b2838');
  rect(c, left + 12, top + 2.6, 7.6, 12, '#1b2838');
  c.globalAlpha = 0.25;
  rect(c, left + 3, top + 3, 2, 10, '#9ad7ff');
  rect(c, left + 12.6, top + 3, 2, 10, '#9ad7ff');
  c.globalAlpha = 1;
  rect(c, left + 10.6, top + 1, 0.8, 31, '#21160f');
  rect(c, left + 8.4, top + 17, 1.2, 3, '#f4d35e');
  rect(c, left + 12.4, top + 17, 1.2, 3, '#f4d35e');
  blob(c, left + 22.4, top + 9, 2.6, 4, 0.4, '#adb5bd');
  for (let i = 0; i < 3; i++) disc(c, left + 23.7, top + 10 + i * 1.1, 0.3, '#495057', null);
  c.globalAlpha = 0.35;
  rect(c, left - 1.5, top + 31, 25, 1.5, '#000');
  c.globalAlpha = 1;
}

export function drawRamp(c, tx, ty, ts, camX, camY) {
  const x0 = tx * ts - camX;
  const y0 = (ty + 1) * ts - camY;
  c.fillStyle = '#8b5a2b';
  c.strokeStyle = OUTLINE;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(x0, y0 - 9);
  c.lineTo(x0 + ts, y0);
  c.lineTo(x0, y0);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = '#f4a261';
  c.lineWidth = 0.5;
  for (let i = 2; i < ts; i += 3) {
    c.beginPath();
    c.moveTo(x0 + i, y0 - 9 * (1 - i / ts));
    c.lineTo(x0 + i, y0);
    c.stroke();
  }
  stripes(c, x0, y0 - 1.2, ts, 1.2, '#1b1b1b', 2, 0.8);
}

export function drawTram(c, m, camX, camY) {
  const x = m.x - camX;
  const y = m.y - camY;
  const w = m.w;
  const h = m.h;
  c.strokeStyle = '#2b2b2b';
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(x + w / 2 - 8, y - 1);
  c.lineTo(x + w / 2 - 2, y - 8);
  c.lineTo(x + w / 2 + 4, y - 1);
  c.moveTo(x + w / 2 - 6, y - 8);
  c.lineTo(x + w / 2 + 2, y - 8);
  c.stroke();
  blob(c, x, y, w, 3, 1, '#c9ccd1');
  blob(c, x, y + 2.4, w, h - 7.4, 2, '#d62828');
  rect(c, x + 1, y + 7.4, w - 2, 9.6, '#f1c453');
  for (let wx = x + 5; wx < x + w - 10; wx += 13) {
    blob(c, wx, y + 8.4, 10, 7.6, 0.8, '#1b263b');
    c.globalAlpha = 0.35;
    rect(c, wx + 1, y + 9, 2, 6.4, '#9ad7ff');
    c.globalAlpha = 1;
  }
  rect(c, x, y + h - 6.2, w, 1.6, '#7a1212');
  rect(c, x + 2, y + 3.6, w - 4, 0.6, shade('#d62828', 0.3));
  for (const wx of [x + 10, x + w - 18]) {
    blob(c, wx - 1, y + h - 5.4, 10, 3.6, 1, '#2b2b2b');
    disc(c, wx + 1.5, y + h - 1.6, 1.8, '#1b1b1b');
    disc(c, wx + 6.5, y + h - 1.6, 1.8, '#1b1b1b');
  }
  disc(c, x + w - 2, y + h - 9, 0.9, '#fff3b0', null);
}

// ---------- Предметы (SPEC §7) ----------

function drawScooterUnder(c, fx, fy, f, time, vx) {
  const spin = (time * vx) / 2;
  c.save();
  c.translate(fx, fy);
  if (f < 0) c.scale(-1, 1);
  blob(c, -9, -2.2, 17, 1.8, 0.8, '#2ec4b6');
  wheel(c, -8, 0, 1.8, spin, '#1b1b1b', '#6c757d');
  wheel(c, 7.5, 0, 1.8, spin, '#1b1b1b', '#6c757d');
  c.strokeStyle = '#adb5bd';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(7.5, 0);
  c.lineTo(5.8, -15);
  c.stroke();
  blob(c, 3.8, -15.8, 4.6, 1.2, 0.5, '#1b1b1b');
  c.restore();
}

const ITEM_DRAW = {
  hotdog(c, x, y) {
    blob(c, x - 6.5, y - 1.4, 13, 4.6, 2.2, '#e9c46a');
    rect(c, x - 5.5, y - 0.8, 11, 1, shade('#e9c46a', 0.25));
    blob(c, x - 6.8, y - 2.6, 13.6, 2.6, 1.3, '#b5452b');
    c.strokeStyle = '#ffd60a';
    c.lineWidth = 0.6;
    c.beginPath();
    for (let i = 0; i <= 10; i++) c.lineTo(x - 5 + i, y - 1.8 + (i % 2 ? -0.7 : 0.4));
    c.stroke();
    blob(c, x - 7.8, y + 2.4, 15.6, 1.4, 0.6, '#2d6a4f');
  },
  vodka(c, x, y, t) {
    c.fillStyle = 'rgba(202, 240, 248, 0.55)';
    c.strokeStyle = '#caf0f8';
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(x - 3.4, y - 4.6);
    c.lineTo(x + 3.4, y - 4.6);
    c.lineTo(x + 2.6, y + 4.2);
    c.lineTo(x - 2.6, y + 4.2);
    c.closePath();
    c.fill();
    c.stroke();
    rect(c, x - 2.9, y - 1.4, 5.8, 5.2, 'rgba(255, 255, 255, 0.85)');
    rect(c, x - 2.6, y + 3.6, 5.2, 0.9, '#90e0ef');
    rect(c, x - 2.2, y - 4, 0.7, 7, 'rgba(255, 255, 255, 0.9)');
    const tw = (Math.sin(t * 5) + 1) / 2;
    c.globalAlpha = tw;
    disc(c, x + 2.6, y - 5, 0.6, WHITE, null);
    c.globalAlpha = 1;
  },
  cigarette(c, x, y, t) {
    blob(c, x - 5.5, y - 0.9, 8.5, 1.9, 0.8, '#f4f1de');
    rect(c, x - 5.5, y - 0.9, 2.6, 1.9, '#d4a373');
    rect(c, x + 3, y - 0.9, 1.8, 1.9, '#9a9a9a');
    disc(c, x + 5.2, y, 0.9, '#ff7b00', null);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.8 + i / 3) % 1;
      c.globalAlpha = 0.5 * (1 - k);
      disc(c, x + 5.5 + Math.sin(k * 6 + i) * 1.4, y - 2 - k * 7, 0.7 + k * 1.2, '#ced4da', null);
    }
    c.globalAlpha = 1;
  },
  chip(c, x, y, t) {
    const squeeze = Math.abs(Math.cos(t * 2.5));
    c.save();
    c.translate(x, y);
    c.scale(0.35 + squeeze * 0.65, 1);
    disc(c, 0, 0, 4.6, '#d00000');
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6;
      c.save();
      c.rotate(a);
      rect(c, -0.7, -4.6, 1.4, 1.6, WHITE);
      c.restore();
    }
    disc(c, 0, 0, 2.6, '#f4f1de', '#9d0208');
    disc(c, 0, 0, 1, '#d00000', null);
    c.restore();
  },
  beerZero(c, x, y) {
    if (beerCan && beerCan.complete && beerCan.naturalWidth) {
      const h = 14;
      const w = h * (beerCan.naturalWidth / beerCan.naturalHeight);
      const was = c.imageSmoothingEnabled;
      c.imageSmoothingEnabled = true;
      c.drawImage(beerCan, x - w / 2, y - h / 2, w, h);
      c.imageSmoothingEnabled = was;
      return;
    }
    blob(c, x - 3.2, y - 5.4, 6.4, 10.8, 1.4, '#2a9d8f');
    rect(c, x - 3.2, y - 5.4, 6.4, 1, '#c9ccd1');
    rect(c, x - 3.2, y + 4.6, 6.4, 0.8, '#adb5bd');
    blob(c, x - 2.6, y - 2.4, 5.2, 4, 0.6, '#f4f1de');
    rect(c, x - 2, y - 1.4, 0.8, 1.8, '#2a9d8f');
    rect(c, x - 0.4, y + 0.1, 0.5, 0.5, '#2a9d8f');
    rect(c, x + 0.6, y - 1.4, 0.8, 1.8, '#2a9d8f');
    rect(c, x + 2, y - 5, 0.6, 9.4, 'rgba(255, 255, 255, 0.35)');
    rect(c, x - 1, y - 6.2, 2, 0.8, '#adb5bd');
  },
  scooter(c, x, y, t) {
    c.save();
    c.translate(x, y + 5);
    blob(c, -8, -2.2, 15, 1.8, 0.8, '#2ec4b6');
    wheel(c, -7, 0, 1.8, 0, '#1b1b1b', '#6c757d');
    wheel(c, 6.5, 0, 1.8, 0, '#1b1b1b', '#6c757d');
    c.strokeStyle = '#adb5bd';
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(6.5, 0);
    c.lineTo(5, -13);
    c.stroke();
    blob(c, 3, -13.8, 4.6, 1.2, 0.5, '#1b1b1b');
    c.globalAlpha = 0.5 + Math.sin(t * 4) * 0.3;
    disc(c, 5, -11, 0.7, '#9cff3a', null);
    c.restore();
  },
};

let beerCan = null;

export function setBeerCan(img) {
  beerCan = img;
}

export function drawItem(c, it, camX, camY, I) {
  const bob = it.body ? 0 : Math.sin(it.t * I.bobSpeed) * I.bobAmp;
  const x = it.x - camX;
  const y = it.y - camY + bob;
  if (!it.body && it.type !== 'scooter') {
    c.globalAlpha = 0.18 + Math.sin(it.t * 3) * 0.06;
    disc(c, x, y, 8, it.type === 'beerZero' ? '#ffcf5a' : '#ffe8a3', null);
    c.globalAlpha = 1;
  }
  ITEM_DRAW[it.type](c, x, y, it.t);
}

export function drawCheckpoint(c, x, feetY, reached, camX, camY) {
  const px = x - camX;
  const py = feetY - camY;
  blob(c, px - 2.4, py - 1.6, 4.8, 1.6, 0.6, '#495057');
  rect(c, px - 0.5, py - 24, 1, 23, '#c9ccd1');
  const wave = reached ? Math.sin(Date.now() / 200) * 0.8 : 0;
  const col = reached ? '#f4d35e' : '#6c757d';
  c.fillStyle = col;
  c.strokeStyle = OUTLINE;
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(px + 0.5, py - 24);
  c.quadraticCurveTo(px + 5, py - 23 + wave, px + 9.5, py - 22);
  c.lineTo(px + 9.5, py - 17.6);
  c.quadraticCurveTo(px + 5, py - 18.4 - wave, px + 0.5, py - 18.2);
  c.closePath();
  c.fill();
  c.stroke();
  if (reached) disc(c, px + 4.5, py - 20.6, 1, '#e63946', null);
}

// ---------- G-man ----------

const SUIT = '#2f4a8a';

const GMAN_LOOK = {
  legLen: 8.4,
  torsoH: 8.6,
  torsoW: 8.4,
  legW: 2.4,
  armW: 2.1,
  armLen: 7.4,
  legs: SUIT,
  arms: SUIT,
  shoes: '#5a2e1a',
  shoe(c, f, color) {
    blob(c, f.x - 1.2, f.y - 1.2, 3.8, 1.7, 0.8, color);
  },
  torso(c, x, y, w, h) {
    blob(c, x - 0.3, y, w + 0.6, h + 0.6, 1.6, SUIT);
    plaid(c, x - 0.3, y, w + 0.6, h + 0.6, '#5a76b8', '#5a76b8');
    c.fillStyle = '#efe6d2';
    c.beginPath();
    c.moveTo(x + w / 2 - 2, y);
    c.lineTo(x + w / 2 + 2, y);
    c.lineTo(x + w / 2, y + 4.8);
    c.closePath();
    c.fill();
    c.fillStyle = '#7a4a24';
    c.beginPath();
    c.moveTo(x + w / 2 - 0.6, y + 0.4);
    c.lineTo(x + w / 2 + 0.6, y + 0.4);
    c.lineTo(x + w / 2 + 0.7, y + 4.6);
    c.lineTo(x + w / 2, y + 5.4);
    c.lineTo(x + w / 2 - 0.7, y + 4.6);
    c.closePath();
    c.fill();
    disc(c, x + w / 2 + 0.2, y + 6.4, 0.45, '#1b1b1b', null);
    disc(c, x + w / 2 + 0.2, y + 7.8, 0.45, '#1b1b1b', null);
  },
  frontHand(c, h, pose) {
    disc(c, h.x, h.y, 1.2, SKIN);
    if (pose.shaker) {
      blob(c, h.x - 1.2, h.y - 4, 2.6, 4.2, 0.6, '#f4f1de');
      rect(c, h.x - 1.2, h.y - 2.6, 2.6, 1.6, '#ff8fab');
      rect(c, h.x - 1.2, h.y - 4.6, 2.6, 0.8, '#212529');
    }
  },
  backHand(c, h, pose) {
    disc(c, h.x, h.y, 1.2, shade(SKIN, -0.2));
    if (pose.briefcase) {
      blob(c, h.x - 3.4, h.y + 0.4, 7, 5, 0.8, '#5a3418');
      rect(c, h.x - 3.4, h.y + 2, 7, 0.6, '#7a4a24');
      rect(c, h.x - 0.4, h.y + 2, 1, 1, '#c9a227');
    }
  },
};

function gmanPose(g, time) {
  const b = g.body;
  let pose = movePose(b, time, { stride: 11, runAt: 60 });
  if (g.state === 'creatine') pose = { ...breathe(STAND, time), aim: [Math.PI - 0.5, -1.9], shaker: true };
  else if (g.state === 'tie') pose = { ...STAND, aim: [2.6, -2.4 + Math.sin(time * 12) * 0.2] };
  else if (g.windup > 0) pose = { ...STAND, aim: [Math.PI - 0.2, 0], lean: -0.1 };
  else if (g.act === 'aim') pose = { ...STAND, arms: [[0.2, 0.2], [-2.4 + Math.sin(time * 6) * 0.3, -0.6]] };
  pose.briefcase = g.phase <= 1 && g.state !== 'creatine';
  return pose;
}

export function drawGman(c, g, camX, camY, time, colors, dissolveTime, head = null) {
  if (g.state === 'gone') return;
  const b = g.body;
  if (g.act === 'vanish' && Math.floor(time * 24) % 2 === 0) return;
  const fx = b.x + b.w / 2 - camX;
  const fy = b.y + b.h - camY;
  const dissolve = g.state === 'dissolve' ? 1 - g.timer / dissolveTime : 0;
  c.save();
  shadowUnder(c, fx, fy, 6, 0.28 * (1 - dissolve));
  if (dissolve > 0) c.globalAlpha = Math.max(0, 1 - dissolve * 1.1);
  withFlash(c, g.flash > 0, () => {
    const pose = gmanPose(g, time);
    const r = humanoid(c, fx, fy, g.dir, pose, GMAN_LOOK);
    if (head && head.img) {
      drawHeadImage(c, head, fx + r.neck.x * g.dir + g.dir * 0.3, fy + r.neck.y + NECK_OVERLAP, g.dir < 0, { tilt: (pose.lean ?? 0) * 0.5 * g.dir });
    } else {
      disc(c, fx + r.neck.x * g.dir, fy + r.neck.y - 4, 4.2, SKIN);
    }
  });
  c.restore();
  if (dissolve > 0) {
    for (let i = 0; i < 24; i++) {
      const h = ((i * 7919) % 97) / 97;
      const k = (dissolve * 1.3 + h * 0.4) % 1.2;
      c.globalAlpha = Math.max(0, 1 - k);
      rect(c, fx - 8 + h * 16, fy - 30 + ((i * 31) % 30) - k * 30, 1, 1, i % 3 ? '#5a76b8' : '#f0c8a0');
    }
    c.globalAlpha = 1;
  }
  if (g.shielded) {
    const pulse = 0.5 + Math.sin(time * 6) * 0.15;
    c.save();
    c.globalAlpha = 0.22 * pulse + 0.1;
    disc(c, fx, fy - 17, 19, '#9db4ff', null);
    c.globalAlpha = 0.75;
    c.strokeStyle = '#cfe0ff';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(fx, fy - 17, 19 + Math.sin(time * 9) * 0.6, 0, TAU);
    c.stroke();
    c.globalAlpha = 0.5;
    c.lineWidth = 0.5;
    c.beginPath();
    c.arc(fx, fy - 17, 15, time * 3, time * 3 + 1.4);
    c.stroke();
    c.restore();
  }
  if (g.windup > 0) {
    c.strokeStyle = colors.accent;
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(fx, fy - 14, 14 + Math.sin(time * 30) * 2, 0, TAU);
    c.stroke();
  }
  if (g.stun > 0) stars(c, fx, fy - (head && head.img ? 38 : 28), time, colors.accent);
}

export function drawEnemyShot(c, s, camX, camY, time) {
  const x = s.x - camX;
  const y = s.y - camY;
  if (s.kind === 'briefcase') {
    c.save();
    c.translate(x, y);
    c.rotate(time * 9);
    blob(c, -3.5, -2.5, 7, 5, 0.8, '#5a3418');
    rect(c, -3.5, -0.8, 7, 0.6, '#7a4a24');
    blob(c, -1.2, -3.6, 2.4, 1.2, 0.4, '#3a2410');
    rect(c, -0.4, -0.5, 0.8, 0.8, '#c9a227');
    c.restore();
  } else if (s.kind === 'butt') {
    drawShot(c, s, camX, camY);
    c.globalAlpha = 0.6;
    disc(c, x, y, 1.6, '#9db4ff', null);
    c.globalAlpha = 1;
  } else {
    drawSmoothieShot(c, s, camX, camY);
  }
}

export function drawBarDoor(c, x, feetY, w, open, camX, camY, time = 0) {
  const left = x - camX;
  const top = feetY - 40 - camY;
  blob(c, left - 4, top - 6, w + 8, 46, 1, '#3d2314');
  rect(c, left - 4, top - 6, w + 8, 3, '#2a170d');
  blob(c, left, top, w, 40, 0.6, open ? '#ffd166' : '#2b1a12');
  if (open) {
    c.globalAlpha = 0.5 + Math.sin(time * 3) * 0.1;
    disc(c, left + w / 2, top + 22, 26, '#ffe8a3', null);
    c.globalAlpha = 1;
    rect(c, left + 2, top + 2, w - 4, 36, '#ffe8a3');
    rect(c, left + w - 7, top + 2, 5, 36, '#6c4426');
  } else {
    rect(c, left + w / 2 - 0.5, top, 1, 40, '#1b100a');
    for (const dx of [3, w / 2 + 3]) {
      blob(c, left + dx, top + 4, w / 2 - 6, 12, 0.6, '#3d2314');
      blob(c, left + dx, top + 21, w / 2 - 6, 14, 0.6, '#3d2314');
    }
    rect(c, left + w / 2 + 2, top + 20, 1.2, 4, '#f4d35e');
    rect(c, left + w / 2 - 3.2, top + 20, 1.2, 4, '#f4d35e');
  }
  c.globalAlpha = 0.35;
  rect(c, left - 4, top + 40, w + 8, 1.5, '#000');
  c.globalAlpha = 1;
}

export function drawLockGate(c, x, feetY, h, state, camX, camY, time) {
  const px = x - camX;
  const py = feetY - camY;
  blob(c, px - 2.2, py - h, 4.4, h, 0.8, '#6c757d');
  rect(c, px - 1.2, py - h, 0.8, h, '#adb5bd');
  blob(c, px - 3.4, py - h - 2.5, 6.8, 2.5, 0.8, '#495057');
  if (state === 'active') {
    for (let i = 0; i < 3; i++) {
      blob(c, px - 9, py - h + 7 + i * 14, 18, 3.4, 0.8, '#ecf0f1');
      stripes(c, px - 9, py - h + 7 + i * 14, 18, 3.4, '#e63946', 3, 1.4);
    }
    const on = Math.floor(time * 4) % 2 === 0;
    disc(c, px, py - h - 4.5, 1.8, on ? '#ff4d4d' : '#7a1f1f');
    if (on) {
      c.globalAlpha = 0.3;
      disc(c, px, py - h - 4.5, 5, '#ff4d4d', null);
      c.globalAlpha = 1;
    }
  } else if (state === 'idle') {
    blob(c, px - 9, py - 2.4, 18, 2.2, 0.6, '#ecf0f1');
    stripes(c, px - 9, py - 2.4, 18, 2.2, '#e63946', 3, 1.4);
  }
}
