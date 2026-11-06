const BASE = 'assets/wow/';

const FILES = Object.freeze({
  target: 'UI-TargetingFrame.PNG',
  elite: 'UI-TargetingFrame-Elite.PNG',
  flash: 'UI-TARGETINGFRAME-FLASH.PNG',
  bar: 'UI-MAINMENUBAR-DWARF.PNG',
  cap: 'UI-MainMenuBar-EndCap-Dwarf.PNG',
  slot: 'UI-Quickslot2.PNG',
  depress: 'UI-Quickslot-Depress.PNG',
  hilight: 'ButtonHilight-Square.PNG',
  checked: 'CheckButtonHilight.PNG',
  alert: 'IconAlert.PNG',
  ants: 'IconAlertAnts.PNG',
  star: 'star4.PNG',
  status: 'UI-StatusBar.PNG',
  plate: 'Nameplate-Border.PNG',
  skull: 'UI-TargetingFrame-Skull.PNG',
  btnUp: 'UI-Panel-Button-Up.PNG',
  btnDown: 'UI-Panel-Button-Down.PNG',
  btnHi: 'UI-Panel-Button-Highlight.PNG',
  dlgBorder: 'UI-DialogBox-Border.PNG',
  dlgBg: 'UI-DialogBox-Background-Dark.PNG',
  dlgHeader: 'UI-DialogBox-Header.PNG',
  tipBorder: 'UI-Tooltip-Border.PNG',
  bubble: 'CHATBUBBLE-BACKDROP.PNG',
  bubbleTail: 'CHATBUBBLE-TAIL.PNG',
  check: 'UI-CheckBox-Check.PNG',
  checkUp: 'UI-CheckBox-Up.PNG',
  debuff: 'UI-Debuff-Border.PNG',
});

export const ICON_FILES = Object.freeze({
  shot: 'Spell_Fire_FlameBolt',
  dog: 'Ability_Hunter_Pet_Wolf',
  stun: 'Ability_Warrior_BattleShout',
  super: 'Ability_Warrior_Rampage',
  vodka: 'INV_Drink_06',
  beer: 'INV_Drink_05',
  smoke: 'ability_rogue_smoke',
  scooter: 'INV_Gizmo_RocketBoot_01',
  beerPower: 'Spell_Nature_Strength',
  drunk: 'INV_Drink_05',
  stunned: 'Ability_Rogue_KidneyShot',
  luck: 'INV_Misc_Coin_06',
  'up:salo': 'INV_Misc_Food_14',
  'up:heavy-hand': 'INV_Gauntlets_04',
  'up:late-for-bar': 'Ability_Rogue_Sprint',
  'up:chain-smoker': 'INV_Misc_Pipe_01',
  'up:dad-coming': 'Spell_Nature_ShamanRage',
  'up:angry-dog': 'Ability_Druid_FerociousBite',
  'up:magnet': 'INV_MISC_MAGNET',
  'up:renter': 'Ability_Mount_MechaStrider',
  'up:iron-liver': 'INV_Drink_13',
  'up:five-zero': 'Spell_Frost_Stun',
  'up:bouncy': 'Spell_Magic_FeatherFall',
});

export const WOW_FONT = '"Friz Quadrata TT", Optima, Candara, "Segoe UI", sans-serif';
export const WOW = Object.freeze({ gold: '#ffd100', white: '#ffffff', grey: '#9d9d9d', green: '#abd473', red: '#ff2020', yellow: '#ffff00' });

let tex = null;

function load(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}

export function wowTextures() {
  if (tex) return tex;
  tex = { icons: {}, tints: new Map() };
  if (typeof FontFace !== 'undefined' && typeof document !== 'undefined') {
    const face = new FontFace('Friz Quadrata TT', `url(${BASE.replace('wow/', 'fonts/')}frizqt___cyr.ttf)`);
    face.load().then((f) => document.fonts.add(f)).catch(() => {});
  }
  for (const [k, f] of Object.entries(FILES)) tex[k] = load(BASE + f);
  for (const [k, f] of Object.entries(ICON_FILES)) tex.icons[k] = load(`${BASE}icons/${f}.PNG`);
  return tex;
}

export function ok(img) {
  return Boolean(img && img.complete && img.naturalWidth);
}

export function tinted(img, color) {
  const T = wowTextures();
  const key = `${img.src}|${color}`;
  let cv = T.tints.get(key);
  if (cv) return cv;
  if (!ok(img)) return null;
  cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  T.tints.set(key, cv);
  return cv;
}

export function smooth(c, draw) {
  const was = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  draw();
  c.imageSmoothingEnabled = was;
}

export function drawIcon(c, name, x, y, s) {
  const img = wowTextures().icons[name];
  if (!ok(img)) {
    c.fillStyle = '#111';
    c.fillRect(x, y, s, s);
    return;
  }
  const w = img.naturalWidth;
  smooth(c, () => c.drawImage(img, w * 0.08, w * 0.08, w * 0.84, w * 0.84, x, y, s, s));
}

export function wowText(c, text, x, y, { size = 6, color = WOW.white, align = 'left', outline = 0.8, base = 'middle', shadow = true } = {}) {
  c.font = `${size}px ${WOW_FONT}`;
  c.textAlign = align;
  c.textBaseline = base;
  if (shadow) {
    c.fillStyle = 'rgba(0, 0, 0, 0.85)';
    c.fillText(text, x + size * 0.08, y + size * 0.1);
  }
  if (outline) {
    c.lineJoin = 'round';
    c.lineWidth = outline;
    c.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    c.strokeText(text, x, y);
  }
  c.fillStyle = color;
  c.fillText(text, x, y);
}

export function statusFill(c, x, y, w, h, frac, color) {
  const f = Math.max(0, Math.min(1, frac));
  if (f <= 0 || w <= 0) return;
  const img = tinted(wowTextures().status, color);
  if (!img) {
    c.fillStyle = color;
    c.fillRect(x, y, w * f, h);
    return;
  }
  smooth(c, () => c.drawImage(img, 0, 0, img.width * f, img.height, x, y, w * f, h));
}

function piece(c, img, i, e, x, y, w, h, rot = 0) {
  if (!rot) {
    c.drawImage(img, i * e, 0, e, e, x, y, w, h);
    return;
  }
  c.save();
  c.translate(x + w / 2, y + h / 2);
  c.rotate(rot);
  c.drawImage(img, i * e, 0, e, e, -h / 2, -w / 2, h, w);
  c.restore();
}

export function drawBackdrop(c, img, x, y, w, h, s) {
  if (!ok(img)) return;
  const e = img.naturalHeight;
  smooth(c, () => {
    piece(c, img, 0, e, x, y + s, s, h - s * 2);
    piece(c, img, 1, e, x + w - s, y + s, s, h - s * 2);
    piece(c, img, 2, e, x + s, y, w - s * 2, s, Math.PI / 2);
    piece(c, img, 3, e, x + s, y + h - s, w - s * 2, s, Math.PI / 2);
    piece(c, img, 4, e, x, y, s, s);
    piece(c, img, 5, e, x + w - s, y, s, s);
    piece(c, img, 6, e, x, y + h - s, s, s);
    piece(c, img, 7, e, x + w - s, y + h - s, s, s);
  });
}

function tile(c, img, x, y, w, h, s) {
  if (!ok(img)) return;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  smooth(c, () => {
    for (let ty = y; ty < y + h; ty += s) for (let tx = x; tx < x + w; tx += s) c.drawImage(img, tx, ty, s, s);
  });
  c.restore();
}

export function drawDialog(c, x, y, w, h, title = null) {
  const T = wowTextures();
  const inset = 3.4;
  c.save();
  c.shadowColor = 'rgba(0, 0, 0, 0.7)';
  c.shadowBlur = 6;
  c.shadowOffsetY = 2;
  c.fillStyle = 'rgba(0, 0, 0, 0.85)';
  c.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  c.restore();
  tile(c, T.dlgBg, x + inset, y + inset, w - inset * 2, h - inset * 2, 20);
  drawBackdrop(c, T.dlgBorder, x, y, w, h, 10);
  if (title) drawHeader(c, x + w / 2, y, title);
}

export function drawHeader(c, cx, y, title) {
  const img = wowTextures().dlgHeader;
  c.font = `8px ${WOW_FONT}`;
  const tw = Math.max(70, c.measureText(title).width + 34);
  const k = tw / 276;
  const h = 78 * k;
  if (ok(img)) smooth(c, () => c.drawImage(img, 118, 2, 276, 78, cx - tw / 2, y - h * 0.42, tw, h));
  wowText(c, title, cx, y - h * 0.42 + h * 0.47, { size: 8, align: 'center', color: WOW.gold, outline: 0.9 });
}

export function drawTooltip(c, x, y, w, h) {
  c.fillStyle = 'rgba(9, 9, 26, 0.92)';
  c.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
  drawBackdrop(c, wowTextures().tipBorder, x, y, w, h, 4);
}

export function drawButton(c, box, label, { selected = false, pressed = false, time = 0, size = 8 } = {}) {
  const T = wowTextures();
  c.font = `${size}px ${WOW_FONT}`;
  const w = Math.max(box.w, c.measureText(label).width + 18);
  const x = box.x - (w - box.w) / 2;
  const { y, h } = box;
  const img = pressed ? T.btnDown : T.btnUp;
  const cap = Math.min(12 * (h / 22), w / 3);
  if (ok(img)) {
    smooth(c, () => {
      c.drawImage(img, 0, 0, 12, 22, x, y, cap, h);
      c.drawImage(img, 12, 0, 56, 22, x + cap, y, w - cap * 2, h);
      c.drawImage(img, 68, 0, 12, 22, x + w - cap, y, cap, h);
      if (selected && ok(T.btnHi)) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.75 + Math.sin(time * 5) * 0.25;
        c.drawImage(T.btnHi, 0, 0, 12, 22, x, y, cap, h);
        c.drawImage(T.btnHi, 12, 0, 56, 22, x + cap, y, w - cap * 2, h);
        c.drawImage(T.btnHi, 68, 0, 12, 22, x + w - cap, y, cap, h);
        c.restore();
      }
    });
  } else {
    c.fillStyle = '#6d0a0a';
    c.fillRect(x, y, w, h);
  }
  wowText(c, label, x + w / 2 + (pressed ? 0.5 : 0), y + h / 2 + (pressed ? 0.5 : 0), { size, bold: true, align: 'center', color: selected ? '#ffffff' : WOW.gold, outline: 0.9 });
}

export function drawChatBubble(c, text, x, y, W) {
  const T = wowTextures();
  c.font = `7px ${WOW_FONT}`;
  const w = Math.ceil(c.measureText(text).width) + 14;
  const h = 15;
  const bx = Math.max(2, Math.min(W - w - 2, x - w / 2));
  const by = y - h - 4;
  c.fillStyle = 'rgba(0, 0, 0, 0.72)';
  c.beginPath();
  c.roundRect(bx + 2, by + 2, w - 4, h - 4, 3);
  c.fill();
  drawBackdrop(c, T.bubble, bx, by, w, h, 6);
  if (ok(T.bubbleTail)) smooth(c, () => c.drawImage(T.bubbleTail, Math.max(bx + 4, Math.min(bx + w - 12, x - 4)), by + h - 2.6, 8, 8));
  wowText(c, text, bx + w / 2, by + h / 2 + 0.3, { size: 7, bold: true, align: 'center', color: WOW.white, outline: 0 });
}

function wrap(c, text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && c.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

export function drawInfoTooltip(c, mx, my, rows, W, H, maxW = 120) {
  const pad = 5;
  const laid = [];
  let w = 0;
  let h = pad;
  for (const r of rows) {
    const size = r.size ?? 6;
    c.font = `${size}px ${WOW_FONT}`;
    for (const l of r.wrap === false ? [r.text] : wrap(c, r.text, maxW)) {
      laid.push({ ...r, text: l, size, y: h + size / 2 + 0.5 });
      w = Math.max(w, c.measureText(l).width);
      h += size + 1.6;
    }
    h += r.gap ?? 0;
  }
  w += pad * 2;
  h += pad - 1.6;
  const x = Math.max(2, Math.min(W - w - 2, mx + 8));
  const y = Math.max(2, Math.min(H - h - 2, my - h - 4));
  drawTooltip(c, x, y, w, h);
  for (const l of laid) wowText(c, l.text, x + pad, y + l.y, { size: l.size, color: l.color ?? WOW.white, outline: 0.5, shadow: false });
  for (const l of laid) if (l.right) wowText(c, l.right, x + w - pad, y + l.y, { size: l.size, color: WOW.white, align: 'right', outline: 0.5, shadow: false });
}

