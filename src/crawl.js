import { seededRandom } from './world.js';
import { CREDITS } from './config.js';

const YELLOW = '#ffe81f';
const BLUE = '#4bd5ee';
const FONT = 'sans-serif';

function wrap(g, text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

function layout(g, content, phrases, width) {
  const ops = [];
  let y = 0;
  const C = CREDITS.crawl;
  const add = (op, h) => {
    ops.push({ ...op, y });
    y += h;
  };
  add({ text: content.episode, size: C.episodeSize, bold: false }, C.episodeSize * 1.6);
  g.font = `bold ${C.titleSize}px ${FONT}`;
  for (const l of wrap(g, content.title, width * 0.9)) add({ text: l, size: C.titleSize, bold: true }, C.titleSize * 1.3);
  y += C.gap;
  g.font = `${C.bodySize}px ${FONT}`;
  for (const p of content.story) {
    for (const l of wrap(g, p, width * 0.92)) add({ text: l, size: C.bodySize, bold: false }, C.bodySize * 1.45);
    y += C.bodySize * 0.9;
  }
  y += C.gap;
  add({ text: content.castTitle, size: C.titleSize, bold: true }, C.titleSize * 1.8);
  for (const [role, who] of content.cast) add({ role, who, size: C.bodySize }, C.bodySize * 1.6);
  y += C.gap;
  add({ text: content.phrasesTitle, size: C.titleSize, bold: true }, C.titleSize * 1.8);
  g.font = `${C.bodySize}px ${FONT}`;
  for (const p of phrases) {
    for (const l of wrap(g, `«${p}»`, width * 0.9)) add({ text: l, size: C.bodySize, bold: false }, C.bodySize * 1.4);
    y += C.bodySize * 0.4;
  }
  y += C.gap;
  add({ text: content.thanks, size: C.titleSize, bold: true }, C.titleSize * 2);
  return { ops, height: y };
}

export function buildCrawl(content, phrases, makeCanvas, res) {
  const width = CREDITS.crawl.width;
  const probe = makeCanvas(4, 4).getContext('2d');
  const { ops, height } = layout(probe, content, phrases, width);
  const cv = makeCanvas(Math.ceil(width * res), Math.ceil(height * res));
  const g = cv.getContext('2d');
  g.scale(res, res);
  g.fillStyle = YELLOW;
  g.textBaseline = 'top';
  for (const op of ops) {
    if (op.role) {
      g.font = `${op.size}px ${FONT}`;
      g.textAlign = 'right';
      g.fillText(op.role, width / 2 - 4, op.y);
      g.textAlign = 'left';
      g.font = `italic ${op.size}px ${FONT}`;
      g.fillText(op.who, width / 2 + 4, op.y);
      continue;
    }
    g.font = `${op.bold ? 'bold ' : ''}${op.size}px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(op.text, width / 2, op.y);
  }
  return { canvas: cv, w: width, h: height, res };
}

export function buildStars(makeCanvas, res, w, h, seed = 7) {
  const cv = makeCanvas(Math.ceil(w * res), Math.ceil(h * res));
  const g = cv.getContext('2d');
  g.scale(res, res);
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 420; i++) {
    const big = rnd() < 0.08;
    g.globalAlpha = 0.35 + rnd() * 0.65;
    g.fillStyle = rnd() < 0.15 ? '#cfe0ff' : '#ffffff';
    const s = big ? 0.9 : 0.4;
    g.fillRect(rnd() * w, rnd() * h, s, s);
  }
  g.globalAlpha = 1;
  return cv;
}

export function crawlEnd(crawl) {
  const C = CREDITS.crawl;
  return crawl.h + C.depth * (1 / C.fadeAt - 1);
}

export function drawCrawl(ctx, crawl, scroll, W, H) {
  const C = CREDITS.crawl;
  const yv = C.horizon;
  const span = H - yv;
  const k = C.bottomWidth / crawl.w;
  const r = crawl.res;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for (let y = H; y > yv + 1; y -= C.strip) {
    const t = (y - yv) / span;
    const d = C.depth * (1 / t - 1);
    const v = scroll - d;
    if (v < 0 || v > crawl.h) continue;
    const sh = Math.max(0.2, (C.depth * C.strip) / (t * t * span));
    const sw = crawl.w * k * t;
    ctx.globalAlpha = t < C.fadeAt ? Math.max(0, (t - C.fadeAt * 0.4) / (C.fadeAt * 0.6)) : 1;
    if (ctx.globalAlpha <= 0) continue;
    ctx.drawImage(crawl.canvas, 0, v * r, crawl.w * r, sh * r, W / 2 - sw / 2, y - C.strip, sw, C.strip + 0.05);
  }
  ctx.restore();
}

export function drawIntro(ctx, text, alpha, W, H) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = BLUE;
  ctx.font = `${CREDITS.crawl.introSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);
  ctx.restore();
}

export function drawLogo(ctx, lines, k, W, H) {
  const C = CREDITS.crawl;
  const scale = C.logoStart * Math.pow(C.logoEnd / C.logoStart, k);
  ctx.save();
  ctx.globalAlpha = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  lines.forEach((l, i) => {
    const size = i === 0 ? 40 : 18;
    const y = i === 0 ? -10 : 22;
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = YELLOW;
    ctx.strokeText(l, 0, y);
    ctx.fillStyle = '#000';
    ctx.fillText(l, 0, y);
  });
  ctx.restore();
}
