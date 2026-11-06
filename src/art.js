// Отрисовка персонажей и предметов. Сейчас — болванки из прямоугольников,
// у каждого вида Зожника свой силуэт и цвета; настоящий пиксель-арт — этап 8 (SPEC §13).

const SKIN = '#f0c8a0';
const WHITE = '#ffffff';

function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ---------- Никич 16×24 поверх хитбокса ----------

export function drawNikich(c, n, camX, camY, time, squash = 0) {
  const b = n.body;
  if (n.invuln > 0 && Math.floor(time * 20) % 2 === 0) return;
  const w = Math.round(16 * (1 + squash * 2));
  const h = Math.round(24 * (1 - squash * 2));
  const feetX = Math.round(b.x + b.w / 2 - camX);
  const feetY = Math.round(b.y + b.h - camY);
  const x = feetX - Math.floor(w / 2);
  const y = feetY - h;
  const moving = b.onGround && Math.abs(b.vx) > 20 && !(n.effects.scooter > 0);
  const bob = moving ? Math.floor(time * 10) % 2 : 0;
  const f = n.facing;
  const riding = n.effects.scooter > 0;
  if (riding) drawScooterUnder(c, feetX, feetY, f, time);

  const step = moving ? Math.floor(time * 10) % 2 : 0;
  rect(c, x + 4 + step * 2, y + h - 5, 3, 5, '#e9c8a0'); // ноги
  rect(c, x + w - 7 - step * 2, y + h - 5, 3, 5, '#e9c8a0');
  rect(c, x + 3, y + h - 10 + bob, w - 6, 5, '#c8b28a'); // шорты
  rect(c, x + 2, y + Math.round(h * 0.38) + bob, w - 4, Math.round(h * 0.2) + 2, '#8a8d91'); // футболка
  rect(c, x + 3, y + 1 + bob, w - 6, Math.round(h * 0.36), SKIN); // голова
  rect(c, x + 3, y + bob, w - 6, 3, '#2a2018'); // волосы
  rect(c, f > 0 ? x + 3 : x + w - 5, y + bob, 2, 5, '#2a2018');
  rect(c, f > 0 ? x + w - 9 : x + 4, y + 5 + bob, 5, 2, '#1b1b1b'); // авиаторы
  // рука к прицелу
  const hy = feetY - b.h + 9;
  rect(c, feetX + n.aim.x * 7 - 1, hy + n.aim.y * 7 - 1, 2, 2, SKIN);
  // оглушён лекцией — звёздочки над головой
  if (n.stun > 0) stars(c, feetX, y - 3, time, '#c77dff');
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
