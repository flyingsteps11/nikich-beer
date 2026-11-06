export const OUTLINE = '#1a1622';

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function limb(c, x0, y0, a1, l1, a2, l2, w, color, outline = OUTLINE) {
  const x1 = x0 + Math.sin(a1) * l1;
  const y1 = y0 + Math.cos(a1) * l1;
  const x2 = x1 + Math.sin(a1 + a2) * l2;
  const y2 = y1 + Math.cos(a1 + a2) * l2;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = outline;
  c.lineWidth = w + 0.9;
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = w;
  c.stroke();
  return { x: x2, y: y2, kx: x1, ky: y1, a: a1 + a2 };
}

export function blob(c, x, y, w, h, r, color, outline = OUTLINE) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = color;
  c.fill();
  c.lineWidth = 0.6;
  c.strokeStyle = outline;
  c.stroke();
}

export function disc(c, x, y, r, color, outline = OUTLINE) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  if (outline) {
    c.lineWidth = 0.6;
    c.strokeStyle = outline;
    c.stroke();
  }
}

export function shadowUnder(c, x, y, w, alpha = 0.28) {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export function gait(phase, amount, { run = false } = {}) {
  const s = Math.sin(phase);
  const k = Math.cos(phase);
  const swing = (run ? 0.75 : 0.5) * amount;
  const knee = (run ? 1.3 : 0.8) * amount;
  const arm = (run ? 0.9 : 0.55) * amount;
  return {
    legs: [
      [s * swing, -Math.max(0, k) * knee],
      [-s * swing, -Math.max(0, -k) * knee],
    ],
    arms: [
      [-s * arm, run ? -1.2 * amount - 0.2 : 0.25 * amount],
      [s * arm, run ? -1.2 * amount - 0.2 : 0.25 * amount],
    ],
    bob: Math.abs(Math.cos(phase)) * (run ? 1.2 : 0.6) * amount,
    lean: run ? 0.18 * amount : 0.04 * amount,
  };
}

export function airPose(vy) {
  const up = vy < 0;
  return {
    legs: up ? [[0.7, -1.4], [-0.2, -0.6]] : [[0.25, -0.3], [-0.35, -0.2]],
    arms: up ? [[-2.4, 0.3], [2.6, 0.2]] : [[-1.9, -0.4], [2.0, -0.3]],
    bob: 0,
    lean: up ? -0.05 : 0.08,
  };
}

export const STAND = Object.freeze({
  legs: [[0.06, 0], [-0.06, 0]],
  arms: [[0.12, 0.2], [-0.1, 0.2]],
  bob: 0,
  lean: 0,
});

export function breathe(pose, time, amount = 0.35) {
  return { ...pose, bob: (pose.bob ?? 0) + Math.sin(time * 3) * amount };
}

export function humanoid(c, fx, fy, dir, pose, look) {
  const L = look;
  const bob = pose.bob ?? 0;
  c.save();
  c.translate(fx, fy);
  if (dir < 0) c.scale(-1, 1);
  if (L.preBack) L.preBack(c, pose);
  const hip = { x: 0, y: -L.legLen - bob * 0.3 };
  const shoulderY = hip.y - L.torsoH + 1.2;
  const lean = pose.lean ?? 0;
  const sx = Math.sin(lean) * L.torsoH;
  const half = L.legLen / 2;
  const backLegColor = shade(L.legs, -0.25);
  const backArmColor = shade(L.arms, -0.25);
  const backFoot = limb(c, hip.x - 0.8, hip.y, pose.legs[1][0], half + 0.3, pose.legs[1][1], half, L.legW, backLegColor);
  if (L.shoe) L.shoe(c, backFoot, shade(L.shoes, -0.2));
  const backHand = limb(c, sx - 0.6, shoulderY, pose.arms[1][0], L.armLen / 2, pose.arms[1][1], L.armLen / 2, L.armW, backArmColor);
  if (L.backHand) L.backHand(c, backHand, pose);
  const frontFoot = limb(c, hip.x + 0.8, hip.y, pose.legs[0][0], half + 0.3, pose.legs[0][1], half, L.legW, L.legs);
  if (L.shoe) L.shoe(c, frontFoot, L.shoes);
  c.save();
  c.translate(hip.x, hip.y);
  c.rotate(lean);
  L.torso(c, -L.torsoW / 2, -L.torsoH, L.torsoW, L.torsoH + 1.2, pose);
  c.restore();
  const neck = { x: sx, y: hip.y - L.torsoH };
  if (L.head) L.head(c, neck.x, neck.y, pose);
  const frontArm = pose.aim ?? pose.arms[0];
  const hand = limb(c, sx + 0.6, shoulderY, frontArm[0], L.armLen / 2, frontArm[1], L.armLen / 2, L.armW, L.arms);
  if (L.frontHand) L.frontHand(c, hand, pose);
  c.restore();
  return { neck, hand };
}

export function wheel(c, x, y, r, spin, rim = '#1b1b1b', spokes = '#9aa0a6', hub = '#c9ccd1') {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.lineWidth = 1.4;
  c.strokeStyle = rim;
  c.stroke();
  c.lineWidth = 0.35;
  c.strokeStyle = spokes;
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * Math.PI) / 3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * (r - 0.6), y + Math.sin(a) * (r - 0.6));
    c.stroke();
  }
  disc(c, x, y, 0.8, hub, null);
}

export function headDisc(c, x, y, r, skin, tilt = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  disc(c, 0, 0, r, skin);
  c.restore();
}

export function face(c, x, y, r, { eye = '#1b1b1b', mouth = '#8a3a2a', open = 0, brow = null } = {}) {
  disc(c, x + r * 0.42, y - r * 0.12, r * 0.13, eye, null);
  if (brow) {
    c.strokeStyle = brow;
    c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(x + r * 0.22, y - r * 0.42);
    c.lineTo(x + r * 0.62, y - r * 0.36);
    c.stroke();
  }
  c.fillStyle = shade('#f0c8a0', -0.12);
  c.beginPath();
  c.arc(x + r * 0.92, y + r * 0.08, r * 0.2, -1.2, 1.4);
  c.fill();
  c.strokeStyle = mouth;
  c.lineWidth = 0.45;
  c.beginPath();
  if (open > 0) {
    c.fillStyle = mouth;
    c.ellipse(x + r * 0.55, y + r * 0.5, r * 0.18, r * 0.12 + open * r * 0.2, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    c.moveTo(x + r * 0.35, y + r * 0.5);
    c.lineTo(x + r * 0.72, y + r * 0.46);
    c.stroke();
  }
}

export function stripes(c, x, y, w, h, color, step = 1.2, width = 0.45) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.strokeStyle = color;
  c.lineWidth = width;
  for (let i = -h; i < w + h; i += step) {
    c.beginPath();
    c.moveTo(x + i, y);
    c.lineTo(x + i + h, y + h);
    c.stroke();
  }
  c.restore();
}

export function plaid(c, x, y, w, h, a, b) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.globalAlpha = 0.55;
  c.fillStyle = a;
  for (let i = 0; i < w; i += 2.2) c.fillRect(x + i, y, 0.7, h);
  c.fillStyle = b;
  for (let j = 0; j < h; j += 2.2) c.fillRect(x, y + j, w, 0.7);
  c.restore();
}
