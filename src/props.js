import { TILE } from './physics.js';
import { seededRandom } from './world.js';
import { blob, disc, shade, wheel, OUTLINE } from './rig.js';
import { PROPS } from './config.js';
import { UI, NEON_SIGNS } from './lines.js';
import { poster, shopSign, pickPoster, pickShop, zabkaSign, zabkaLogo, ZABKA } from './signs.js';

const TAU = Math.PI * 2;

function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function foliage(g, cx, cy, r, base, rnd) {
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU;
    const d = rnd() * r * 0.65;
    g.fillStyle = shade(base, (rnd() - 0.6) * 0.35);
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.35 + rnd() * 0.25), 0, TAU);
    g.fill();
  }
  g.fillStyle = shade(base, 0.25);
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(cx - r * 0.3 + rnd() * r * 0.5, cy - r * 0.45 + rnd() * r * 0.3, r * 0.16, 0, TAU);
    g.fill();
  }
}

const DEFS = {
  tree: {
    w: 30, h: 50, variants: 3,
    draw(g, w, h, rnd, v) {
      const base = ['#4f8f3f', '#5f9e4f', '#6f8f3f'][v];
      const cx = w / 2;
      blob(g, cx - 5, h - 1.4, 10, 1.4, 0.4, '#5c5f66');
      for (let i = -4; i <= 4; i += 1.6) rect(g, cx + i, h - 1.2, 0.4, 1, '#3a3c42');
      g.fillStyle = '#5a4632';
      g.beginPath();
      g.moveTo(cx - 1.6, h - 1);
      g.lineTo(cx - 1, h - 26);
      g.lineTo(cx + 1, h - 26);
      g.lineTo(cx + 1.6, h - 1);
      g.fill();
      g.strokeStyle = '#5a4632';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx, h - 20);
      g.lineTo(cx - 6, h - 30);
      g.moveTo(cx, h - 22);
      g.lineTo(cx + 5, h - 32);
      g.stroke();
      foliage(g, cx, h - 34, 13, base, rnd);
      rect(g, cx - 0.8, h - 14, 1.6, 0.6, '#c9ccd1');
    },
  },

  lamp: {
    w: 14, h: 44, variants: 1, light: { dx: 10.5, dy: -41.5 },
    draw(g, w, h) {
      const x = 4;
      blob(g, x - 1.8, h - 3, 3.6, 3, 0.6, '#55595f');
      rect(g, x - 0.7, h - 40, 1.4, 38, '#7a7f86');
      rect(g, x - 0.7, h - 40, 0.5, 38, '#a3a8ae');
      g.strokeStyle = '#7a7f86';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, h - 40);
      g.quadraticCurveTo(x + 1, h - 43, x + 6, h - 42);
      g.stroke();
      blob(g, x + 4, h - 42.4, 5, 1.8, 0.8, '#55595f');
      rect(g, x + 4.6, h - 40.8, 3.8, 0.6, '#fff3c4');
    },
  },

  lampOld: {
    w: 12, h: 40, variants: 1, light: { dx: 6, dy: -34.5 },
    draw(g, w, h) {
      const cx = w / 2;
      blob(g, cx - 2.4, h - 4, 4.8, 4, 1, '#1f2226');
      rect(g, cx - 0.8, h - 31, 1.6, 27, '#23262b');
      for (let y = h - 26; y < h - 6; y += 5) rect(g, cx - 1.2, y, 2.4, 0.8, '#2f3338');
      g.fillStyle = '#23262b';
      g.beginPath();
      g.moveTo(cx - 3.2, h - 31);
      g.lineTo(cx + 3.2, h - 31);
      g.lineTo(cx + 2, h - 38);
      g.lineTo(cx - 2, h - 38);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255, 236, 170, 0.85)';
      g.fillRect(cx - 2, h - 37, 4, 5.4);
      rect(g, cx - 0.3, h - 37, 0.6, 5.4, '#23262b');
      g.fillStyle = '#23262b';
      g.beginPath();
      g.moveTo(cx - 3, h - 38);
      g.lineTo(cx, h - 40);
      g.lineTo(cx + 3, h - 38);
      g.fill();
    },
  },

  busStop: {
    w: 44, h: 30, variants: 2,
    draw(g, w, h, rnd, v) {
      const frame = v ? '#c8102e' : '#6c757d';
      g.fillStyle = 'rgba(170, 215, 235, 0.35)';
      g.fillRect(2, 4, 30, h - 6);
      g.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(5, 6);
      g.lineTo(12, 22);
      g.moveTo(18, 6);
      g.lineTo(25, 22);
      g.stroke();
      for (const x of [2, 32]) rect(g, x - 0.6, 3, 1.2, h - 3, frame);
      g.fillStyle = frame;
      g.beginPath();
      g.moveTo(0, 4.5);
      g.quadraticCurveTo(17, 0, 35, 3);
      g.lineTo(35, 4.6);
      g.quadraticCurveTo(17, 1.8, 0, 6);
      g.fill();
      blob(g, 6, h - 8, 22, 1.4, 0.5, '#8b5a2b');
      rect(g, 8, h - 6.6, 0.8, 5, '#55595f');
      rect(g, 25, h - 6.6, 0.8, 5, '#55595f');
      blob(g, 21, 6.5, 10, 14, 0.4, '#2b2b2b');
      poster(g, 21.8, 7.3, 8.4, 12.4, pickPoster(rnd));
      g.fillStyle = 'rgba(255, 255, 255, 0.18)';
      g.fillRect(21.8, 7.3, 8.4, 12.4);
      rect(g, 39, 2, 1, h - 2, '#55595f');
      blob(g, 35.5, 1, 8, 6, 0.6, '#f4f1de');
      rect(g, 35.5, 1, 8, 1.6, '#ffd400');
      rect(g, 35.5, 2.6, 8, 0.6, '#c8102e');
      g.fillStyle = '#1b1b1b';
      g.font = 'bold 1.5px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(UI.stopSign, 39.5, 4.6);
      blob(g, 37.6, 9, 4, 5.6, 0.3, '#f4f1de');
      for (let i = 0; i < 4; i++) rect(g, 38.2, 9.8 + i * 1.2, 2.8, 0.3, '#6c757d');
    },
  },

  bin: {
    w: 8, h: 11, variants: 2,
    draw(g, w, h, rnd, v) {
      const body = v ? '#2d6a4f' : '#495057';
      rect(g, 3.4, h - 3, 1.2, 3, '#343a40');
      blob(g, 1, 1.6, 6, 7, 1.2, body);
      rect(g, 1.6, 3, 0.6, 5, shade(body, 0.2));
      blob(g, 0.6, 0.8, 6.8, 1.6, 0.6, shade(body, -0.25));
      rect(g, 2.6, 4.2, 2.8, 1.6, '#c9ccd1');
      if (v) disc(g, 4, 5, 0.6, '#c8102e', null);
    },
  },

  recycle: {
    w: 20, h: 12, variants: 1,
    draw(g) {
      ['#ffd60a', '#3a86ff', '#2d6a4f'].forEach((c, i) => {
        blob(g, 0.6 + i * 6.4, 1.4, 6, 10.4, 0.8, c);
        blob(g, 0.4 + i * 6.4, 0.6, 6.4, 1.6, 0.5, shade(c, -0.3));
        disc(g, 3.6 + i * 6.4, 5, 1.2, shade(c, -0.35), null);
      });
    },
  },

  bench: {
    w: 20, h: 9, variants: 1,
    draw(g, w, h) {
      for (const x of [3, 16]) rect(g, x, h - 5, 1, 5, '#2f3338');
      for (let i = 0; i < 3; i++) blob(g, 1, h - 5.4 - i * 1.4, 18, 1, 0.3, i === 0 ? '#8b5a2b' : '#a0703c');
      rect(g, 1, 0.6, 18, 0.9, '#a0703c');
      rect(g, 1, 2, 18, 0.9, '#8b5a2b');
      for (const x of [3, 16]) rect(g, x, 0.6, 1, 4, '#2f3338');
    },
  },

  column: {
    w: 14, h: 34, variants: 2,
    draw(g, w, h, rnd) {
      const cx = w / 2;
      blob(g, cx - 5.4, h - 2, 10.8, 2, 0.6, '#2d6a4f');
      rect(g, cx - 4.6, 6, 9.2, h - 8, '#e9ecef');
      poster(g, cx - 4.6, 7.5, 9.2, 10, pickPoster(rnd));
      poster(g, cx - 4.6, 18.2, 9.2, 10, pickPoster(rnd));
      g.fillStyle = 'rgba(0, 0, 0, 0.25)';
      g.fillRect(cx + 1.6, 6, 3, h - 8);
      g.fillStyle = 'rgba(255, 255, 255, 0.2)';
      g.fillRect(cx - 4, 6, 1.2, h - 8);
      rect(g, cx - 5.2, 5, 10.4, 1.4, '#2d6a4f');
      g.fillStyle = '#2d6a4f';
      g.beginPath();
      g.ellipse(cx, 5, 5.2, 3.6, 0, Math.PI, TAU);
      g.fill();
      disc(g, cx, 1, 0.9, '#c9a227', null);
    },
  },

  billboard: {
    w: 48, h: 40, variants: 2,
    draw(g, w, h, rnd) {
      for (const x of [12, 34]) rect(g, x, 18, 1.6, h - 18, '#55595f');
      rect(g, 10, 30, 26, 0.8, '#55595f');
      blob(g, 1, 1, w - 2, 19, 0.6, '#2b2b2b');
      poster(g, 2.2, 2.2, w - 4.4, 16.6, pickPoster(rnd));
      for (const x of [8, 24, 40]) {
        rect(g, x, 0, 0.5, 1.2, '#55595f');
        blob(g, x - 1.2, -0.6, 3, 0.9, 0.3, '#2b2b2b');
      }
    },
  },

  veturilo: {
    w: 40, h: 14, variants: 1,
    draw(g, w, h) {
      blob(g, 1, 0, 4, h, 1, '#f4f1de');
      rect(g, 1.6, 2, 2.8, 4, '#1b263b');
      rect(g, 1, 9, 4, 1, '#2ec4b6');
      rect(g, 5, h - 2, w - 6, 0.8, '#6c757d');
      for (let i = 0; i < 3; i++) {
        const x = 10 + i * 10;
        wheel(g, x - 3, h - 3, 2.8, i, '#1b1b1b', '#6c757d');
        wheel(g, x + 3.4, h - 3, 2.8, i + 1, '#1b1b1b', '#6c757d');
        g.strokeStyle = '#2ec4b6';
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(x - 3, h - 3);
        g.lineTo(x, h - 7);
        g.lineTo(x + 3.4, h - 3);
        g.moveTo(x, h - 7);
        g.lineTo(x + 2.6, h - 8.6);
        g.stroke();
        rect(g, x - 1.6, h - 8, 2.4, 0.8, '#1b1b1b');
        blob(g, x + 2.2, h - 9.6, 2.4, 1.8, 0.4, '#2ec4b6');
      }
    },
  },

  kiosk: {
    w: 22, h: 26, variants: 1,
    draw(g, w, h) {
      blob(g, 1, 4, w - 2, h - 4, 0.6, '#f4f1de');
      rect(g, 1, h - 2, w - 2, 2, '#adb5bd');
      blob(g, 0, 2, w, 3, 0.6, '#c8102e');
      g.fillStyle = '#f4f1de';
      g.font = 'bold 2.2px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(UI.kioskSign, w / 2, 3.6);
      rect(g, 3, 7, w - 6, 9, '#9ad7ff');
      for (let i = 0; i < 4; i++) rect(g, 4 + i * 4, 8, 2.6, 3.4, ['#ffd166', '#e63946', '#2a9d8f', '#f4a261'][i]);
      rect(g, 3, 13, w - 6, 0.6, '#adb5bd');
      g.fillStyle = 'rgba(255, 255, 255, 0.3)';
      g.fillRect(3, 7, 3, 9);
      rect(g, 3, 17, w - 6, 1, '#8b5a2b');
    },
  },

  cone: {
    w: 6, h: 8, variants: 1,
    draw(g, w, h) {
      rect(g, 0, h - 1, 6, 1, '#1b1b1b');
      g.fillStyle = '#ff6d00';
      g.beginPath();
      g.moveTo(1, h - 1);
      g.lineTo(2.4, 0.4);
      g.lineTo(3.6, 0.4);
      g.lineTo(5, h - 1);
      g.closePath();
      g.fill();
      rect(g, 1.7, 3, 2.6, 1, '#f4f1de');
      rect(g, 1.3, 5, 3.4, 0.9, '#f4f1de');
    },
  },

  fence: {
    w: 36, h: 20, variants: 2,
    draw(g, w, h, rnd) {
      for (const x of [1, w / 2, w - 2]) rect(g, x, 0, 1.2, h, '#9aa0a6');
      g.strokeStyle = '#adb5bd';
      g.lineWidth = 0.25;
      for (let x = 0; x < w; x += 1.4) {
        g.beginPath();
        g.moveTo(x, 1);
        g.lineTo(x + 6, h - 2);
        g.moveTo(x + 6, 1);
        g.lineTo(x, h - 2);
        g.stroke();
      }
      poster(g, 3, 4, 13, 10, pickPoster(rnd));
      poster(g, w / 2 + 2, 4, 13, 10, pickPoster(rnd));
      for (const x of [0, w - 5]) blob(g, x, h - 2.4, 5.4, 2.4, 0.5, '#e9c46a');
    },
  },

  stall: {
    w: 30, h: 22, variants: 2,
    draw(g, w, h, rnd, v) {
      for (const x of [2, w - 3]) rect(g, x, 4, 1, h - 4, '#6c757d');
      for (let x = 0; x < w; x += 3) rect(g, x, 1, 3, 4, (x / 3) % 2 ? '#f4f1de' : (v ? '#2a9d8f' : '#e63946'));
      for (let x = 0; x < w; x += 3) {
        g.fillStyle = (x / 3) % 2 ? '#f4f1de' : (v ? '#2a9d8f' : '#e63946');
        g.beginPath();
        g.arc(x + 1.5, 5, 1.5, 0, Math.PI);
        g.fill();
      }
      blob(g, 1, h - 9, w - 2, 9, 0.5, '#8b5a2b');
      for (let i = 0; i < 3; i++) {
        const x = 3 + i * 8.6;
        blob(g, x, h - 12, 7.6, 4, 0.4, '#a0703c');
        const fruit = ['#e63946', '#ffb703', '#80b918', '#ff8fab'][(i + v) % 4];
        for (let k = 0; k < 6; k++) disc(g, x + 1 + (k % 3) * 2.6, h - 12.4 - Math.floor(k / 3) * 1.6, 1.1, fruit, null);
      }
      rect(g, 2, h - 6, w - 4, 0.6, '#6b4423');
    },
  },

  flowers: {
    w: 18, h: 10, variants: 2,
    draw(g, w, h, rnd, v) {
      blob(g, 1, h - 5, w - 2, 5, 0.6, '#6c757d');
      rect(g, 1, h - 5, w - 2, 1, '#adb5bd');
      const cols = v ? ['#ff8fab', '#ffd166', '#f4f1de'] : ['#e63946', '#c77dff', '#ffd166'];
      for (let i = 0; i < 12; i++) {
        const x = 2.5 + rnd() * (w - 5);
        const y = h - 5.5 - rnd() * 3;
        rect(g, x, y, 0.4, h - 5 - y, '#2d6a4f');
        disc(g, x + 0.2, y, 0.9, cols[i % 3], null);
      }
    },
  },

  shop: {
    w: 46, h: 34, variants: 6,
    draw(g, w, h, rnd, v) {
      const wall = ['#e8e4dc', '#d9c6a3', '#c9ccd1', '#e2cfb5', '#b5a99a', '#f1e3c8'][v];
      rect(g, 0, 0, w, h, wall);
      rect(g, 0, 0, w, 1.2, shade(wall, -0.25));
      const sign = pickShop(rnd);
      shopSign(g, 3, 2.5, w - 6, 6.5, sign);
      const aw = sign.bg;
      for (let x = 2; x < w - 2; x += 4) {
        g.fillStyle = (x / 4) % 2 ? '#f4f1de' : aw;
        g.beginPath();
        g.moveTo(x, 10);
        g.lineTo(x + 4, 10);
        g.lineTo(x + 4.6, 14);
        g.lineTo(x - 0.6, 14);
        g.closePath();
        g.fill();
      }
      rect(g, 3, 15, 26, h - 17, '#1b2838');
      g.fillStyle = 'rgba(160, 210, 230, 0.35)';
      g.fillRect(3, 15, 26, h - 17);
      for (let i = 0; i < 5; i++) {
        rect(g, 5 + i * 4.8, h - 7, 3.4, 4, ['#ffd166', '#e63946', '#80b918', '#ff8fab', '#4cc9f0'][(i + v) % 5]);
      }
      rect(g, 3, h - 8, 26, 0.6, '#adb5bd');
      g.fillStyle = 'rgba(255, 255, 255, 0.25)';
      g.beginPath();
      g.moveTo(5, 15);
      g.lineTo(10, 15);
      g.lineTo(5, 24);
      g.fill();
      blob(g, 32, 15, 10, h - 15, 0.4, '#3d2b1f');
      rect(g, 33.4, 16.4, 7.2, 8, '#9ad7ff');
      rect(g, 39.6, 25, 0.8, 2, '#f4d35e');
      poster(g, 33.6, 27, 6.8, 5, pickPoster(rnd));
      rect(g, 0, h - 1, w, 1, shade(wall, -0.3));
    },
  },

  zabka: {
    w: 54, h: 34, variants: 2, light: { dx: 27, dy: -16, color: 'rgba(126, 217, 87, 0.28)', r: 30 },
    draw(g, w, h, rnd, v) {
      const wall = v ? '#e8e4dc' : '#c9ccd1';
      rect(g, 0, 0, w, h, wall);
      rect(g, 0, 0, w, 1, shade(wall, -0.25));
      zabkaSign(g, 1, 2, w - 9, 7.5);
      blob(g, w - 7.5, 3, 7, 7, 0.6, '#f4f1de');
      zabkaLogo(g, w - 4, 6.6, 2.6, { text: ZABKA.green, smile: ZABKA.green });
      rect(g, w - 4.5, 2, 1, 1.2, '#55595f');
      const glassTop = 11;
      rect(g, 2, glassTop, 30, h - glassTop - 1.4, '#1f3b2c');
      g.fillStyle = 'rgba(180, 235, 200, 0.28)';
      g.fillRect(2, glassTop, 30, h - glassTop - 1.4);
      for (let row = 0; row < 3; row++) {
        const sy = glassTop + 3 + row * 6.4;
        rect(g, 3, sy + 4, 28, 0.6, '#adb5bd');
        for (let i = 0; i < 9; i++) rect(g, 3.4 + i * 3.1, sy + 1.2, 2.2, 2.8, ['#ffd166', '#e63946', '#80b918', '#4cc9f0', '#ff8fab', '#f4a261', '#ffffff', '#2a9d8f', '#c77dff'][(i * 3 + row + v) % 9]);
      }
      for (const x of [2, 17, 32]) rect(g, x - 0.5, glassTop, 1, h - glassTop - 1.4, ZABKA.green);
      poster(g, 5, glassTop + 1.4, 9, 6, pickPoster(rnd));
      rect(g, 35, glassTop, 15, h - glassTop - 1.4, ZABKA.green);
      rect(g, 36.2, glassTop + 1.2, 12.6, h - glassTop - 3.6, '#a8dadc');
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.fillRect(36.2, glassTop + 1.2, 2.4, h - glassTop - 3.6);
      rect(g, 42.3, glassTop + 1.2, 0.5, h - glassTop - 3.6, ZABKA.green);
      rect(g, 37, glassTop + 4, 11, 1.4, ZABKA.light);
      g.fillStyle = ZABKA.white;
      g.font = 'bold 1.3px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('24/7', 42.5, glassTop + 4.7);
      rect(g, 0, h - 1.4, w, 1.4, '#6c757d');
      rect(g, 34, h - 1.4, 17, 1.4, '#3a3c42');
    },
  },

  citylight: {
    w: 14, h: 30, variants: 4,
    draw(g, w, h, rnd) {
      rect(g, w / 2 - 1, h - 6, 2, 6, '#55595f');
      blob(g, 0.5, 0, w - 1, h - 5, 0.8, '#2b2b2b');
      poster(g, 1.6, 1.2, w - 3.2, h - 7.4, pickPoster(rnd), { lit: true });
      g.fillStyle = 'rgba(255, 255, 255, 0.18)';
      g.fillRect(1.6, 1.2, 2, h - 7.4);
    },
  },

  posterWall: {
    w: 40, h: 22, variants: 3,
    draw(g, w, h, rnd) {
      rect(g, 0, 2, w, h - 2, '#8d8882');
      for (let y = 4; y < h; y += 3) rect(g, 0, y, w, 0.3, '#77736d');
      rect(g, 0, 0, w, 2, '#6c6862');
      for (let i = 0; i < 7; i++) {
        const pw = 7 + rnd() * 5;
        const ph = 8 + rnd() * 5;
        const px = rnd() * (w - pw);
        const py = 3 + rnd() * (h - ph - 4);
        g.save();
        g.translate(px + pw / 2, py + ph / 2);
        g.rotate((rnd() - 0.5) * 0.2);
        poster(g, -pw / 2, -ph / 2, pw, ph, pickPoster(rnd));
        if (rnd() < 0.4) {
          g.fillStyle = 'rgba(244, 241, 222, 0.7)';
          g.beginPath();
          g.moveTo(pw / 2, -ph / 2);
          g.lineTo(pw / 2 - 2.4, -ph / 2);
          g.lineTo(pw / 2, -ph / 2 + 2.4);
          g.fill();
        }
        g.restore();
      }
    },
  },

  syrenka: {
    w: 22, h: 48, variants: 1,
    draw(g, w, h) {
      const cx = w / 2;
      blob(g, 1, h - 6, w - 2, 6, 0.6, '#9a958a');
      blob(g, 3, h - 18, w - 6, 12, 0.6, '#b8b2a8');
      rect(g, 3, h - 18, w - 6, 1.2, '#cfc9bf');
      blob(g, cx - 3, h - 14, 6, 4, 0.3, '#6c757d');
      const bronze = '#3f5a4f';
      g.fillStyle = bronze;
      g.strokeStyle = OUTLINE;
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(cx - 4, h - 18);
      g.quadraticCurveTo(cx - 6, h - 24, cx - 1, h - 26);
      g.quadraticCurveTo(cx + 3, h - 28, cx + 1, h - 31);
      g.lineTo(cx - 1.5, h - 31);
      g.quadraticCurveTo(cx - 0.5, h - 28, cx - 4, h - 25.5);
      g.quadraticCurveTo(cx - 8, h - 22, cx - 6, h - 18);
      g.closePath();
      g.fill();
      g.stroke();
      blob(g, cx - 2, h - 37, 3.4, 7, 1.2, bronze);
      disc(g, cx - 0.4, h - 39.4, 1.8, bronze);
      g.strokeStyle = bronze;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx, h - 36);
      g.lineTo(cx + 3, h - 40);
      g.stroke();
      g.strokeStyle = '#8a9a92';
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(cx + 3, h - 40);
      g.lineTo(cx + 3.6, h - 47);
      g.stroke();
      g.fillStyle = bronze;
      g.beginPath();
      g.ellipse(cx - 4, h - 33, 2.4, 3.2, -0.2, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255, 255, 255, 0.15)';
      g.fillRect(cx - 1.6, h - 36, 0.6, 5);
    },
  },

  love: {
    w: 64, h: 16, variants: 1,
    draw(g, w, h) {
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.font = 'bold 13px sans-serif';
      g.fillStyle = '#f4f1de';
      g.fillText('I', 1, h - 1);
      g.fillStyle = '#e63946';
      g.beginPath();
      const hx = 10;
      const hy = h - 9;
      g.moveTo(hx + 4, hy + 8);
      g.bezierCurveTo(hx - 3, hy + 3, hx, hy - 3, hx + 4, hy + 1);
      g.bezierCurveTo(hx + 8, hy - 3, hx + 11, hy + 3, hx + 4, hy + 8);
      g.fill();
      g.font = 'bold 9px sans-serif';
      g.fillStyle = '#f4f1de';
      g.fillText(UI.loveSign, 20, h - 1);
      g.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      g.lineWidth = 0.4;
      g.strokeText(UI.loveSign, 20, h - 1);
    },
  },

  neon: {
    w: 26, h: 34, variants: 3, light: { dx: 13, dy: -27.4, color: 'rgba(255, 79, 163, 0.35)', r: 22 },
    draw(g, w, h, rnd, v) {
      const cx = w / 2;
      rect(g, cx - 0.6, 10, 1.2, h - 10, '#2b2b2b');
      blob(g, 1, 2, w - 2, 9, 1, '#14101f');
      const col = ['#ff4fa3', '#4cc9f0', '#ffd166'][v];
      g.strokeStyle = col;
      g.lineWidth = 0.7;
      g.strokeRect(2.2, 3.2, w - 4.4, 6.6);
      g.fillStyle = col;
      g.font = 'bold 4.4px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(NEON_SIGNS[v % NEON_SIGNS.length], cx, 6.6);
    },
  },
};

export const PROP_TYPES = Object.freeze(Object.keys(DEFS));

export function propSize(type) {
  const d = DEFS[type];
  return { w: d.w, h: d.h };
}

function blocked(map, tx, ty) {
  const t = map.get(tx, ty);
  return t === TILE.SOLID || t === TILE.BARRIER || t === TILE.THIN;
}

function avoidColumns(map) {
  const ts = map.tileSize;
  const cols = new Set();
  const add = (tx, r = PROPS.keepAway) => {
    for (let d = -r; d <= r; d++) cols.add(tx + d);
  };
  add(Math.floor(map.spawn.x / ts));
  if (map.exit) add(map.exit.tx, PROPS.keepAway + 1);
  for (const s of map.spawns) if (s.type === 'door') add(s.tx);
  for (const c of map.checkpoints) add(c.tx);
  for (const l of map.locks ?? []) {
    add(l.tx0);
    add(l.tx1 + 1);
  }
  for (const r of map.ramps) add(r.tx);
  for (const h of map.hints) add(h.tx, 1);
  for (const m of map.movers) for (let tx = m.tx0 - 1; tx <= m.tx1 + m.w + 1; tx++) cols.add(tx);
  if (map.door) for (let tx = map.door.tx - 2; tx <= map.door.tx + map.door.w + 1; tx++) cols.add(tx);
  return cols;
}

function surfaceRow(map, tx) {
  for (let ty = 1; ty < map.height; ty++) {
    if (map.get(tx, ty) === TILE.SOLID && !blocked(map, tx, ty - 1)) return ty;
  }
  return -1;
}

export function placeProps(map, set, seed = 1) {
  if (!set || set.length === 0) return [];
  const ts = map.tileSize;
  const rnd = seededRandom(seed * 131 + 7);
  const avoid = avoidColumns(map);
  const total = set.reduce((a, s) => a + s.weight, 0);
  const pickType = () => {
    let r = rnd() * total;
    for (const s of set) if ((r -= s.weight) <= 0) return s.type;
    return set[set.length - 1].type;
  };
  const out = [];
  const fits = (type, tx) => {
    const { w, h } = propSize(type);
    const cw = Math.ceil(w / ts);
    const ch = Math.ceil(h / ts);
    const row = surfaceRow(map, tx);
    if (row <= 0 || avoid.has(tx)) return null;
    for (let k = 0; k < cw; k++) {
      if (avoid.has(tx + k) || surfaceRow(map, tx + k) !== row) return null;
      for (let d = 1; d <= ch; d++) if (blocked(map, tx + k, row - d)) return null;
    }
    return { cw, row };
  };
  const taken = (tx, cw) => {
    for (let k = -PROPS.minGap - 1; k <= cw + PROPS.minGap; k++) avoid.add(tx + k);
  };
  for (const s of set) {
    if (!s.min) continue;
    const spots = [];
    for (let tx = PROPS.startGap; tx < map.width - 2; tx++) {
      const f = fits(s.type, tx);
      if (f) spots.push({ tx, ...f });
    }
    for (let k = 0; k < s.min && spots.length; k++) {
      const target = ((k + 0.5) / s.min) * map.width;
      const free = spots.filter((p) => fits(s.type, p.tx));
      if (!free.length) break;
      const p = free.reduce((a, b) => (Math.abs(b.tx - target) < Math.abs(a.tx - target) ? b : a));
      out.push({ type: s.type, v: Math.floor(rnd() * DEFS[s.type].variants), x: p.tx * ts + (p.cw * ts) / 2, y: p.row * ts });
      taken(p.tx, p.cw);
    }
  }
  let tx = PROPS.startGap;
  let type = pickType();
  let tries = 0;
  while (tx < map.width - 2) {
    const f = fits(type, tx);
    if (f) {
      out.push({ type, v: Math.floor(rnd() * DEFS[type].variants), x: tx * ts + (f.cw * ts) / 2, y: f.row * ts });
      tx += f.cw + PROPS.minGap + Math.floor(rnd() * (PROPS.maxGap - PROPS.minGap + 1));
      type = pickType();
      tries = 0;
    } else {
      tx += 1;
      if (++tries > PROPS.retryTiles) {
        type = pickType();
        tries = 0;
      }
    }
  }
  out.sort((a, b) => a.x - b.x);
  return out;
}

export function buildPropSprites(props, makeCanvas, res) {
  const cache = new Map();
  for (const p of props) {
    const key = `${p.type}:${p.v}`;
    if (cache.has(key)) continue;
    const d = DEFS[p.type];
    const pad = 2;
    const cv = makeCanvas(Math.ceil((d.w + pad * 2) * res), Math.ceil((d.h + pad * 2) * res));
    const g = cv.getContext('2d');
    g.scale(res, res);
    g.translate(pad, pad);
    d.draw(g, d.w, d.h, seededRandom(p.v * 17 + p.type.length * 3 + 1), p.v);
    cache.set(key, { canvas: cv, w: d.w + pad * 2, h: d.h + pad * 2, pad });
  }
  return cache;
}

export function buildGlow(makeCanvas, res, color = 'rgba(255, 220, 150, 0.35)', r = 18) {
  const size = r * 2;
  const cv = makeCanvas(Math.ceil(size * res), Math.ceil(size * res));
  const g = cv.getContext('2d');
  g.scale(res, res);
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return { canvas: cv, r };
}

export function drawProps(ctx, props, sprites, camX, camY, viewW, glows = null) {
  for (const p of props) {
    const d = DEFS[p.type];
    if (p.x + d.w < camX - 4 || p.x - d.w > camX + viewW + 4) continue;
    const s = sprites.get(`${p.type}:${p.v}`);
    const left = p.x - d.w / 2 - s.pad - camX;
    const top = p.y - d.h - s.pad - camY;
    ctx.drawImage(s.canvas, left, top, s.w, s.h);
  }
  if (!glows) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of props) {
    const d = DEFS[p.type];
    if (!d.light) continue;
    if (p.x + 40 < camX || p.x - 40 > camX + viewW) continue;
    const glow = glows.get(p.type) ?? glows.get('default');
    const lx = p.x - d.w / 2 + d.light.dx - camX;
    const ly = p.y + d.light.dy - camY;
    ctx.drawImage(glow.canvas, lx - glow.r, ly - glow.r, glow.r * 2, glow.r * 2);
  }
  ctx.globalCompositeOperation = prev;
}

export function propLight(type) {
  return DEFS[type].light ?? null;
}
