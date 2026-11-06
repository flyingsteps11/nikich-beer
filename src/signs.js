import { POSTERS, SHOP_SIGNS, UI } from './lines.js';

const TAU = Math.PI * 2;

const deck = { images: [], order: [], i: 0, last: -1 };

export function setPosterImages(images) {
  deck.images = images;
  deck.order = [];
  deck.i = 0;
}

export function shufflePosters(rnd) {
  const n = deck.images.length;
  deck.order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck.order[i], deck.order[j]] = [deck.order[j], deck.order[i]];
  }
  deck.i = 0;
}

export function pickPoster(rnd) {
  const ready = deck.images.filter((p) => p.img);
  if (ready.length === 0) return POSTERS[Math.floor(rnd() * POSTERS.length)];
  if (deck.order.length !== deck.images.length) shufflePosters(rnd);
  for (let tries = 0; tries < deck.order.length; tries++) {
    if (deck.i >= deck.order.length) {
      shufflePosters(rnd);
      if (deck.order[0] === deck.last && deck.order.length > 1) [deck.order[0], deck.order[1]] = [deck.order[1], deck.order[0]];
    }
    const k = deck.order[deck.i++];
    if (!deck.images[k].img) continue;
    deck.last = k;
    return { image: deck.images[k], focus: rnd() };
  }
  return POSTERS[Math.floor(rnd() * POSTERS.length)];
}

function imagePoster(g, x, y, w, h, p, lit) {
  const img = p.image.img;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const k = Math.max(w / iw, h / ih);
  const sw = w / k;
  const sh = h / k;
  const sx = (iw - sw) * (iw > sw ? 0.5 : 0);
  const sy = (ih - sh) * (ih > sh ? Math.min(1, p.focus * 0.6) : 0);
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = true;
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  g.imageSmoothingEnabled = smooth;
  g.fillStyle = 'rgba(255, 255, 255, 0.08)';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w * 0.45, y);
  g.lineTo(x, y + h * 0.6);
  g.fill();
  g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  g.lineWidth = Math.max(0.25, Math.min(w, h) * 0.02);
  g.strokeRect(x, y, w, h);
  if (lit) {
    g.fillStyle = 'rgba(255, 245, 220, 0.14)';
    g.fillRect(x, y, w, h);
  }
}

export function pickShop(rnd) {
  return SHOP_SIGNS[Math.floor(rnd() * SHOP_SIGNS.length)];
}

function fitFont(g, text, w, h, weight = 'bold') {
  let size = h;
  g.font = `${weight} ${size}px sans-serif`;
  const tw = g.measureText(text).width;
  if (tw > w) size *= w / tw;
  g.font = `${weight} ${size}px sans-serif`;
  return size;
}

export function poster(g, x, y, w, h, p, { lit = false } = {}) {
  if (p.image) {
    imagePoster(g, x, y, w, h, p, lit);
    return;
  }
  g.fillStyle = p.bg;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.16)';
  g.beginPath();
  g.arc(x + w * 0.78, y + h * 0.28, Math.min(w, h) * 0.34, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(0, 0, 0, 0.12)';
  g.fillRect(x, y + h * 0.86, w, h * 0.14);
  g.fillStyle = p.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, p.title, w * 0.9, h * 0.34);
  g.fillText(p.title, x + w / 2, y + h * 0.4);
  fitFont(g, p.sub, w * 0.86, h * 0.17, 'normal');
  g.fillText(p.sub, x + w / 2, y + h * 0.7);
  if (lit) {
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    g.fillRect(x, y, w, h);
  }
}

export function shopSign(g, x, y, w, h, s, { lit = false } = {}) {
  g.fillStyle = s.bg;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.15)';
  g.fillRect(x, y, w, h * 0.22);
  g.fillStyle = 'rgba(0, 0, 0, 0.25)';
  g.fillRect(x, y + h * 0.85, w, h * 0.15);
  let left = x;
  if (s.cross) {
    const c = h * 0.7;
    const cx = x + h * 0.55;
    const cy = y + h / 2;
    g.fillStyle = lit ? '#9cff3a' : '#f4f1de';
    g.fillRect(cx - c * 0.15, cy - c / 2, c * 0.3, c);
    g.fillRect(cx - c / 2, cy - c * 0.15, c, c * 0.3);
    left += h * 0.9;
  }
  g.fillStyle = s.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, s.text, (x + w - left) * 0.88, h * 0.62);
  g.fillText(s.text, (left + x + w) / 2, y + h * 0.54);
  if (lit) {
    g.fillStyle = 'rgba(255, 240, 200, 0.12)';
    g.fillRect(x, y, w, h);
  }
}

export const ZABKA = Object.freeze({ green: '#0a6b3a', light: '#7ed957', white: '#ffffff' });

export function zabkaLogo(g, cx, cy, h, { text = ZABKA.white, smile = ZABKA.light } = {}) {
  g.save();
  g.fillStyle = text;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `bold ${h}px sans-serif`;
  const w = g.measureText(UI.zabka).width;
  g.fillText(UI.zabka, cx, cy + h * 0.32);
  g.strokeStyle = smile;
  g.lineCap = 'round';
  g.lineWidth = Math.max(0.3, h * 0.12);
  g.beginPath();
  g.arc(cx + w * 0.02, cy + h * 0.1, w * 0.34, Math.PI * 0.22, Math.PI * 0.78);
  g.stroke();
  g.restore();
  return w;
}

export function zabkaSign(g, x, y, w, h, { lit = false } = {}) {
  g.fillStyle = ZABKA.green;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.12)';
  g.fillRect(x, y, w, h * 0.2);
  g.fillStyle = ZABKA.light;
  g.fillRect(x, y + h - Math.max(0.3, h * 0.1), w, Math.max(0.3, h * 0.1));
  zabkaLogo(g, x + w / 2, y + h * 0.42, Math.min(h * 0.62, w * 0.3));
  if (lit) {
    g.fillStyle = 'rgba(126, 217, 87, 0.18)';
    g.fillRect(x, y, w, h);
  }
}
