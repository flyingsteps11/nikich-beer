// Отрисовка персонажей и предметов. Сейчас — болванки из прямоугольников,
// у каждого вида Зожника свой силуэт и цвета; настоящий пиксель-арт — этап 8 (SPEC §13).

const SKIN = '#f0c8a0';
const WHITE = '#ffffff';

function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

const NIKICH_PAL = {
  K: '#3a2a1e',
  k: '#5a4030',
  S: '#f0c8a0',
  s: '#d9a77f',
  A: '#1f2630',
  a: '#c9ccd1',
  m: '#b5654a',
  G: '#9a9ea3',
  g: '#7d8186',
  H: '#cbb994',
  h: '#a8976f',
  L: '#e9c8a0',
  O: '#eeeeee',
  o: '#555555',
};

const NIKICH_TOP = [
  '.....KKKKK......',
  '....KKKKKKKk....',
  '...KKKKKKKKKk...',
  '...KKSSSSSSSK...',
  '...KSSSSSSSSS...',
  '...KSaAAAaAAAa..',
  '...SSSAAASAAA...',
  '...SSSSSSSSSSs..',
  '....SSSSSmmSS...',
  '....sSSSSSSSs...',
  '.....sSSSSSs....',
  '....GGGGGGGG....',
  '...GGGGGGGGGG...',
  '..GGGGGGGGGGGG..',
  '..SGGGGGGGGGGS..',
  '..SgGGGGGGGGgS..',
  '...GGGGGGGGGG...',
  '...HHHHHHHHHH...',
  '...HHHHHHHHHH...',
];

const NIKICH_LEGS = {
  stand: [
    '...HHHh..hHHH...',
    '....LL....LL....',
    '....LL....LL....',
    '...OOO....OOO...',
    '...ooo....ooo...',
  ],
  run: [
    '...HHHh..hHHH...',
    '...LL......LL...',
    '..LL........LL..',
    '.OOO........OOO.',
    '.ooo........ooo.',
  ],
  air: [
    '...HHHh..hHHH...',
    '...LLL....LLL...',
    '...OOO....OOO...',
    '...ooo....ooo...',
    '................',
  ],
};

export function nikichFrame(n, time) {
  const b = n.body;
  if (!b.onGround) return 'air';
  if (Math.abs(b.vx) > 20 && !(n.effects.scooter > 0)) return Math.floor(time * 10) % 2 ? 'run' : 'stand';
  return 'stand';
}

const NIKICH_HEAD_ROWS = 11;
const NECK_OVERLAP = 2;

function drawHeadImage(c, head, cx, bottom, flip, opts = {}) {
  const w = head.w;
  const h = head.h;
  c.save();
  c.translate(cx, bottom);
  if (flip) c.scale(-1, 1);
  if (opts.alpha !== undefined) c.globalAlpha = opts.alpha;
  c.drawImage(head.img, -w / 2, -h, w, h);
  if (opts.tint) {
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = 0.6;
    c.fillStyle = opts.tint;
    c.fillRect(-w / 2, -h, w, h);
  }
  c.restore();
}

export function drawNikich(c, n, camX, camY, time, squash = 0, head = null) {
  const b = n.body;
  if (n.invuln > 0 && Math.floor(time * 20) % 2 === 0) return;
  const feetX = Math.round(b.x + b.w / 2 - camX);
  const feetY = Math.round(b.y + b.h - camY);
  const f = n.facing;
  const riding = n.effects.scooter > 0;
  if (riding) drawScooterUnder(c, feetX, feetY, f, time);
  const photoHead = head && head.img;
  const top = photoHead ? NIKICH_TOP.slice(NIKICH_HEAD_ROWS) : NIKICH_TOP;
  const rows = [...top, ...NIKICH_LEGS[nikichFrame(n, time)]];
  const bob = nikichFrame(n, time) === 'run' ? 1 : 0;
  const tint = n.hurtLock > 0 ? '#ff6b6b' : undefined;
  c.save();
  c.translate(feetX, feetY);
  c.scale(1 + squash * 2, 1 - squash * 2);
  drawPixels(c, rows, NIKICH_PAL, -8, -rows.length - bob, f < 0, 1, { tint });
  if (photoHead) drawHeadImage(c, head, f, -rows.length - bob + NECK_OVERLAP, f < 0, { tint });
  c.restore();
  const hy = feetY - b.h + (photoHead ? 12 : 9);
  rect(c, feetX + n.aim.x * 8 - 1, hy + n.aim.y * 8 - 1, 2, 2, NIKICH_PAL.S);
  const headTop = photoHead ? rows.length + head.h - NECK_OVERLAP : 24;
  if (n.stun > 0) stars(c, feetX, feetY - headTop - 4, time, '#c77dff');
}

// ---------- Зожники ----------

function stars(c, cx, cy, time, color) {
  const t = time * 8;
  for (let i = 0; i < 3; i++) {
    const a = t + (i * Math.PI * 2) / 3;
    rect(c, cx + Math.cos(a) * 6 - 1, cy + Math.sin(a) * 2, 2, 2, color);
  }
}

// Ноги-ножницы при беге
function legs(c, x, y, w, h, time, moving, color) {
  const s = moving ? Math.floor(time * 12) % 2 : 0;
  rect(c, x + 1 + s * 2, y + h - 6, 3, 6, color);
  rect(c, x + w - 4 - s * 2, y + h - 6, 3, 6, color);
}

const KIND_DRAW = {
  // Бегун: бирюзовый костюм, красная повязка, кроссовки
  runner(c, z, x, y, b, time, pal) {
    const moving = Math.abs(b.vx) > 10;
    legs(c, x, y, b.w, b.h, time, moving, pal('#264653'));
    rect(c, x, y + 7, b.w, b.h - 13, pal('#2a9d8f'));
    rect(c, x + 2, y, b.w - 4, 7, pal(SKIN));
    rect(c, x + 2, y + 1, b.w - 4, 1, pal('#e63946'));
    rect(c, x, y + b.h - 1, 4, 1, pal(WHITE));
    rect(c, x + b.w - 4, y + b.h - 1, 4, 1, pal(WHITE));
  },

  // Велосипедист: велосипед и жёлтая лайкра, шлем
  cyclist(c, z, x, y, b, time, pal) {
    const spin = Math.floor(time * Math.abs(b.vx) * 0.1) % 2;
    for (const wx of [x, x + b.w - 6]) {
      rect(c, wx, y + b.h - 6, 6, 6, pal('#1b1b1b'));
      rect(c, wx + 2, y + b.h - 4, 2, 2, pal(spin ? '#adb5bd' : '#495057'));
    }
    rect(c, x + 3, y + b.h - 7, b.w - 6, 2, pal('#adb5bd')); // рама
    const rx = z.dir > 0 ? x + 4 : x + b.w - 11;
    rect(c, rx, y + 5, 7, 8, pal('#ffd60a')); // торс в лайкре
    rect(c, rx + 1, y, 5, 5, pal(SKIN));
    rect(c, rx, y - 1, 7, 2, pal('#3a86ff')); // шлем
  },

  // Мотоциклист: чёрный байк, красный шлем с визором, выхлоп
  moto(c, z, x, y, b, time, pal) {
    for (const wx of [x, x + b.w - 7]) rect(c, wx, y + b.h - 7, 7, 7, pal('#111111'));
    rect(c, x + 3, y + b.h - 10, b.w - 6, 5, pal('#343a40'));
    rect(c, z.dir > 0 ? x + b.w - 5 : x + 1, y + b.h - 12, 4, 2, pal('#adb5bd')); // руль
    const rx = z.dir > 0 ? x + 6 : x + b.w - 14;
    rect(c, rx, y + 5, 8, 6, pal('#212529')); // кожанка
    rect(c, rx + 1, y - 1, 7, 7, pal('#d00000')); // шлем
    rect(c, z.dir > 0 ? rx + 5 : rx + 1, y + 1, 3, 2, pal('#90e0ef')); // визор
    if (z.state === 'dash' && Math.floor(time * 20) % 2) rect(c, z.dir > 0 ? x - 3 : x + b.w, y + b.h - 6, 3, 2, '#adb5bd');
  },

  // Йога-тётка: фиолетовые лосины, розовый топ, пучок; в позе — «дерево»
  yoga(c, z, x, y, b, time, pal) {
    const pose = z.state === 'pose';
    if (pose) {
      rect(c, x + 5, y + b.h - 8, 2, 8, pal('#7b2cbf'));
      rect(c, x + 7, y + b.h - 9, 4, 2, pal('#7b2cbf')); // согнутая нога
    } else {
      legs(c, x, y, b.w, b.h, time, Math.abs(b.vx) > 5, pal('#7b2cbf'));
    }
    rect(c, x + 2, y + 6, b.w - 4, 7, pal('#ff8fab'));
    rect(c, x + 3, y + 1, b.w - 6, 5, pal(SKIN));
    rect(c, x + 4, y - 2, 4, 3, pal('#6f4518')); // пучок
    if (pose) {
      rect(c, x + 5, y - 7, 2, 6, pal(SKIN)); // руки над головой
    } else if (z.state === 'lecture') {
      rect(c, z.dir > 0 ? x + b.w - 2 : x - 2, y + 7, 4, 2, pal(SKIN)); // поучающий палец
    }
  },

  // Смузи-хипстер: шапка-бини, борода, клетчатая рубашка, стакан смузи
  smoothie(c, z, x, y, b, time, pal) {
    legs(c, x, y, b.w, b.h, time, Math.abs(b.vx) > 5, pal('#3d405b'));
    rect(c, x, y + 8, b.w, b.h - 14, pal('#bc4749'));
    rect(c, x + 3, y + 8, 1, b.h - 14, pal('#6a040f'));
    rect(c, x + 2, y + 2, b.w - 4, 6, pal(SKIN));
    rect(c, x + 2, y + 5, b.w - 4, 3, pal('#6f4518')); // борода
    rect(c, x + 1, y - 1, b.w - 2, 3, pal('#ee9b00')); // бини
    const cx = z.dir > 0 ? x + b.w : x - 3;
    rect(c, cx, y + 9, 3, 4, pal('#80b918')); // стакан
    rect(c, cx + 1, y + 7, 1, 2, pal(WHITE)); // трубочка
  },

  // Манекен для проверок
  dummy(c, z, x, y, b, time, pal) {
    rect(c, x, y + 7, b.w, b.h - 7, pal('#8d99ae'));
    rect(c, x + 2, y, b.w - 4, 7, pal('#edf2f4'));
  },
};

export function drawZoznik(c, z, camX, camY, time, colors) {
  if (!z.alive) return;
  const b = z.body;
  const x = Math.round(b.x - camX);
  const y = Math.round(b.y - camY);
  const pal = z.flash > 0 ? () => WHITE : (col) => col;
  KIND_DRAW[z.kind](c, z, x, y, b, time, pal);
  if (z.held > 0) rect(c, x - 1, y + b.h - 6, b.w + 2, 1, WHITE);
  if (z.stun > 0) stars(c, x + b.w / 2, y - 3, time, colors.accent);
  if (z.health < z.maxHealth) {
    rect(c, x - 2, y - 7, b.w + 4, 3, colors.shadow);
    rect(c, x - 1, y - 6, (b.w + 2) * (z.health / z.maxHealth), 1, '#e63946');
  }
}

// ---------- Собака ----------

export function drawDog(c, d, camX, camY, time) {
  const b = d.body;
  const x = Math.round(b.x - camX);
  const y = Math.round(b.y - camY);
  const run = d.state === 'run' ? Math.floor(time * 14) % 2 : 0;
  rect(c, x, y + 2, b.w, b.h - 4, '#8b5a2b');
  rect(c, d.dir > 0 ? x + b.w - 4 : x, y, 4, 4, '#8b5a2b');
  rect(c, x + 1 + run, y + b.h - 2, 2, 2, '#5a3a1a');
  rect(c, x + b.w - 3 - run, y + b.h - 2, 2, 2, '#5a3a1a');
  rect(c, d.dir > 0 ? x - 2 : x + b.w, y + 2, 2, 1, '#5a3a1a'); // хвост
}

// ---------- Снаряды ----------

export function drawShot(c, s, camX, camY) {
  const x = Math.round(s.x - camX);
  const y = Math.round(s.y - camY);
  rect(c, x - 1, y, 3, 1, '#f4f1de');
  rect(c, x + (s.vx >= 0 ? 2 : -2), y, 1, 1, '#ff7b00');
}

export function drawSmoothieShot(c, s, camX, camY) {
  const x = Math.round(s.x - camX);
  const y = Math.round(s.y - camY);
  rect(c, x - 2, y - 2, 4, 4, '#80b918');
  rect(c, x - 1, y - 1, 2, 1, '#d4f5a0');
}

// ---------- Карта: двери и трамплины ----------

// Подъезд или магазин, откуда выходят Зожники; x — центр, feetY — пол
export function drawDoor(c, x, feetY, camX, camY) {
  const left = Math.round(x - 10 - camX);
  const top = Math.round(feetY - 30 - camY);
  rect(c, left, top, 20, 30, '#6c584c');
  rect(c, left + 2, top + 2, 16, 28, '#1b1b2f');
  rect(c, left + 13, top + 15, 2, 2, '#f4d35e'); // ручка
}

// Трамплин в клетке (tx, ty): клин, поднимающийся влево (Мотоциклист едет справа)
export function drawRamp(c, tx, ty, ts, camX, camY) {
  const x0 = tx * ts - camX;
  const y0 = (ty + 1) * ts - camY;
  for (let i = 0; i < ts; i++) {
    const h = Math.ceil(((ts - i) / ts) * 8);
    rect(c, x0 + i, y0 - h, 1, h, i % 4 === 0 ? '#e9c46a' : '#f4a261');
  }
}

// Трамвай: крыша — платформа (m.y), корпус ниже до колёс; красно-жёлтый, как варшавский
export function drawTram(c, m, camX, camY) {
  const x = Math.round(m.x - camX);
  const y = Math.round(m.y - camY);
  rect(c, x + m.w / 2 - 6, y - 6, 1, 6, '#3a3a3a'); // пантограф
  rect(c, x + m.w / 2 - 8, y - 7, 12, 1, '#3a3a3a');
  rect(c, x, y, m.w, 3, '#adb5bd'); // крыша
  rect(c, x, y + 3, m.w, m.h - 9, '#d62828'); // корпус
  rect(c, x, y + 8, m.w, 9, '#f1c453'); // жёлтая полоса с окнами
  for (let wx = x + 4; wx < x + m.w - 10; wx += 14) rect(c, wx, y + 9, 10, 7, '#1b263b');
  rect(c, x, y + m.h - 6, m.w, 2, '#6c1515');
  for (const wx of [x + 8, x + m.w - 16]) rect(c, wx, y + m.h - 4, 8, 4, '#1b1b1b'); // колёса
}

// ---------- Предметы (SPEC §7) ----------

function drawScooterUnder(c, feetX, feetY, f, time) {
  rect(c, feetX - 9, feetY - 2, 18, 2, '#e63946'); // дека
  rect(c, feetX - 9, feetY - 1, 3, 3, '#1b1b1b'); // колёса
  rect(c, feetX + 6, feetY - 1, 3, 3, '#1b1b1b');
  const hx = f > 0 ? feetX + 7 : feetX - 8;
  rect(c, hx, feetY - 16, 1, 14, '#adb5bd'); // стойка
  rect(c, hx - 2, feetY - 16, 5, 1, '#adb5bd'); // руль
}

const ITEM_DRAW = {
  // Хот-дог из Żabki
  hotdog(c, x, y) {
    rect(c, x - 6, y - 1, 12, 4, '#e9c46a');
    rect(c, x - 5, y - 2, 10, 2, '#b5452b');
    rect(c, x - 4, y - 2, 8, 1, '#f4d35e');
  },
  // Стопарик водки
  vodka(c, x, y) {
    rect(c, x - 3, y - 4, 6, 8, '#caf0f8');
    rect(c, x - 2, y - 1, 4, 4, '#ffffff');
    rect(c, x - 3, y + 4, 6, 1, '#90e0ef');
  },
  // Сигарета с дымком
  cigarette(c, x, y, t) {
    rect(c, x - 5, y, 8, 2, '#f4f1de');
    rect(c, x + 3, y, 3, 2, '#e76f51');
    rect(c, x + 5, y - 2 - (Math.floor(t * 4) % 2), 1, 1, '#adb5bd');
  },
  // Покерная фишка
  chip(c, x, y) {
    rect(c, x - 4, y - 4, 8, 8, '#d00000');
    rect(c, x - 2, y - 2, 4, 4, '#ffffff');
    rect(c, x - 4, y - 1, 1, 2, '#ffffff');
    rect(c, x + 3, y - 1, 1, 2, '#ffffff');
  },
  // Пиво 0,0 — банка-обманка
  beerZero(c, x, y) {
    rect(c, x - 3, y - 5, 6, 10, '#2a9d8f');
    rect(c, x - 3, y - 2, 6, 3, '#f4f1de');
    rect(c, x - 1, y - 1, 2, 1, '#2a9d8f'); // «0,0»
    rect(c, x - 2, y - 6, 4, 1, '#adb5bd');
  },
  // Самокат
  scooter(c, x, y) {
    rect(c, x - 7, y + 3, 14, 2, '#e63946');
    rect(c, x - 7, y + 4, 3, 3, '#1b1b1b');
    rect(c, x + 4, y + 4, 3, 3, '#1b1b1b');
    rect(c, x + 5, y - 7, 1, 10, '#adb5bd');
    rect(c, x + 3, y - 7, 5, 1, '#adb5bd');
  },
};

export function drawItem(c, it, camX, camY, I) {
  const bob = it.body ? 0 : Math.sin(it.t * I.bobSpeed) * I.bobAmp;
  ITEM_DRAW[it.type](c, Math.round(it.x - camX), Math.round(it.y - camY + bob), it.t);
}

// Контрольная точка — флажок: серый, пока не пройдена, жёлтый после
export function drawCheckpoint(c, x, feetY, reached, camX, camY) {
  const px = Math.round(x - camX);
  const py = Math.round(feetY - camY);
  rect(c, px, py - 22, 1, 22, '#adb5bd');
  rect(c, px + 1, py - 22, 8, 5, reached ? '#f4d35e' : '#6c757d');
}

const GMAN_PAL = {
  K: '#6b4226',
  S: '#f0c8a0',
  s: '#d9a77f',
  E: '#1b1b1b',
  m: '#a0522d',
  W: '#efe6d2',
  T: '#7a4a24',
  t: '#5a3418',
  B: '#2f4a8a',
  b: '#22356a',
  c: '#5a76b8',
  O: '#5a2e1a',
};

const GMAN_ROWS = [
  '....KKKKKK......',
  '...KKKKKKKKK....',
  '...KKSSSSSSK....',
  '...KSSSESSES....',
  '...KSSSSSSSSs...',
  '....SSSSSSSS....',
  '....sSSSSmmS....',
  '.....sSSSSS.....',
  '....WWWTTWWW....',
  '..bBBBWTTWBBBb..',
  '.bBBBBWTTWBBBBb.',
  '.bBcBBBTTBBBcBb.',
  '.bBBBBBTtBBBBBb.',
  '.bBcBBBBBBBBcBb.',
  '.SBBBBBBBBBBBBS.',
  '..BBBBBBBBBBBB..',
  '..BBBBBBcBBBBB..',
  '...BBBB..BBBB...',
  '...BBBB..BBBB...',
  '...bBBB..BBBb...',
  '...BBBB..BBBB...',
  '...BBBB..BBBB...',
  '..OOOOO..OOOOO..',
  '..OOOOO..OOOOO..',
];

function hash01(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawPixels(c, rows, pal, left, top, flip, scale, opts = {}) {
  const w = rows[0].length;
  for (let ry = 0; ry < rows.length; ry++) {
    const row = rows[ry];
    for (let rx = 0; rx < w; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      let dy = 0;
      if (opts.dissolve) {
        const h = hash01(rx, ry);
        if (h < opts.dissolve - 0.25) continue;
        if (h < opts.dissolve) dy = -Math.round((opts.dissolve - h) * 40);
      }
      const px = flip ? w - 1 - rx : rx;
      rect(c, left + px * scale, top + (ry + dy) * scale, scale, scale, opts.tint ?? pal[ch]);
    }
  }
}

function drawBriefcase(c, x, y, s) {
  rect(c, x, y + s, 6 * s, 4 * s, '#5a3418');
  rect(c, x + 2 * s, y, 2 * s, s, '#3a2410');
  rect(c, x, y + 2 * s, 6 * s, s, '#7a4a24');
}

function drawShaker(c, x, y, s) {
  rect(c, x, y, 3 * s, 5 * s, '#f4f1de');
  rect(c, x, y + 2 * s, 3 * s, 2 * s, '#ff8fab');
  rect(c, x, y - s, 3 * s, s, '#212529');
}

const GMAN_HEAD_ROWS = 8;

export function drawGmanFigure(c, feetX, feetY, facing, scale, opts = {}) {
  const photoHead = opts.head && opts.head.img;
  const rows = photoHead ? GMAN_ROWS.slice(GMAN_HEAD_ROWS) : GMAN_ROWS;
  const skipped = GMAN_ROWS.length - rows.length;
  const w = 16 * scale;
  const left = Math.round(feetX - w / 2);
  const top = Math.round(feetY - 24 * scale);
  const bodyTop = top + skipped * scale;
  const flip = facing < 0;
  const handX = flip ? left : left + w - 2 * scale;
  const handY = top + 14 * scale;
  if (opts.briefcase && !opts.shaker) drawBriefcase(c, flip ? handX - 4 * scale : handX - scale, handY + scale, scale);
  drawPixels(c, rows, GMAN_PAL, left, bodyTop, flip, scale, opts);
  if (photoHead) {
    const fade = opts.dissolve ? Math.max(0, 1 - opts.dissolve) : 1;
    const head = { img: opts.head.img, w: opts.head.w * scale, h: opts.head.h * scale };
    const rise = opts.dissolve ? opts.dissolve * 6 : 0;
    drawHeadImage(c, head, feetX, bodyTop + NECK_OVERLAP * scale - rise, flip, { alpha: fade, tint: opts.tint });
  }
  const mouthY = photoHead ? bodyTop - 6 * scale : top + 4 * scale;
  if (opts.shaker) drawShaker(c, flip ? left + 1 * scale : left + w - 4 * scale, mouthY, scale);
  if (opts.tie) rect(c, left + 7 * scale, top + 9 * scale, 2 * scale, 2 * scale, GMAN_PAL.S);
}

export function drawGman(c, g, camX, camY, time, colors, dissolveTime, head = null) {
  if (g.state === 'gone') return;
  const b = g.body;
  if (g.act === 'vanish' && Math.floor(time * 24) % 2 === 0) return;
  const feetX = Math.round(b.x + b.w / 2 - camX);
  const feetY = Math.round(b.y + b.h - camY);
  const dissolve = g.state === 'dissolve' ? 1.25 * (1 - g.timer / dissolveTime) : 0;
  drawGmanFigure(c, feetX, feetY, g.dir, 1, {
    briefcase: g.phase <= 1,
    shaker: g.state === 'creatine',
    tie: g.state === 'tie' && Math.floor(time * 6) % 2 === 0,
    dissolve,
    tint: g.flash > 0 ? WHITE : undefined,
    head,
  });
  if (g.windup > 0) {
    c.strokeStyle = colors.accent;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(feetX, feetY - 12, 14 + Math.sin(time * 30) * 2, 0, Math.PI * 2);
    c.stroke();
  }
  if (g.stun > 0) stars(c, feetX, feetY - (head && head.img ? 36 : 27), time, colors.accent);
}

export function drawEnemyShot(c, s, camX, camY, time) {
  const x = Math.round(s.x - camX);
  const y = Math.round(s.y - camY);
  if (s.kind === 'briefcase') {
    const spin = Math.floor(time * 12) % 2;
    if (spin) drawBriefcase(c, x - 3, y - 3, 1);
    else {
      rect(c, x - 2, y - 3, 4, 6, '#5a3418');
      rect(c, x - 2, y - 1, 4, 1, '#7a4a24');
    }
  } else if (s.kind === 'butt') {
    drawShot(c, s, camX, camY);
    rect(c, x - 1, y - 1, 3, 1, '#9db4ff');
  } else {
    drawSmoothieShot(c, s, camX, camY);
  }
}

export function drawBarDoor(c, x, feetY, w, open, camX, camY) {
  const left = Math.round(x - camX);
  const top = Math.round(feetY - 40 - camY);
  rect(c, left - 2, top - 2, w + 4, 42, '#4a2c1a');
  rect(c, left, top, w, 40, open ? '#ffd166' : '#2b1a12');
  if (open) {
    rect(c, left + 2, top + 2, w - 4, 36, '#ffe8a3');
    rect(c, left + w - 6, top + 2, 4, 36, '#6c4426');
  } else {
    rect(c, left + w / 2 - 1, top, 2, 40, '#1b100a');
    rect(c, left + w / 2 + 3, top + 20, 2, 3, '#f4d35e');
  }
}

export function drawLockGate(c, x, feetY, h, state, camX, camY, time) {
  const px = Math.round(x - camX);
  const py = Math.round(feetY - camY);
  rect(c, px - 2, py - h, 4, h, '#6c757d');
  rect(c, px - 3, py - h - 2, 6, 2, '#495057');
  if (state === 'active') {
    for (let y = 0; y < h - 4; y += 6) rect(c, px - 1, py - h + 2 + y, 2, 3, Math.floor(y / 6) % 2 ? '#ecf0f1' : '#e63946');
    for (let i = 0; i < 3; i++) rect(c, px - 8, py - h + 8 + i * 14, 16, 3, i % 2 ? '#ecf0f1' : '#e63946');
    if (Math.floor(time * 4) % 2 === 0) rect(c, px - 2, py - h - 5, 4, 3, '#ff4d4d');
  } else if (state === 'idle') {
    rect(c, px - 8, py - 2, 16, 2, '#e63946');
  }
}
