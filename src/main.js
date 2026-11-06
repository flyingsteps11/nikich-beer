// Игровой цикл с фиксированным шагом 1/60 и машина экранов (SPEC §15).
// Этап 6: титульный (Начать / Продолжить / Новая игра) → Уровень → Выбор Улучшения → … → Уровень 5 → титульный.
// Проигрыш — тот же Уровень заново. Сохранение — после выбора Улучшения и при Проигрыше (SPEC §11).

import { SCREEN, LOOP, TILE_SIZE, PHYSICS, CAMERA, DEBUG, ATTACKS, EFFECTS, SPEECH, ITEMS, LEVEL, UPGRADES, GMAN, CUTSCENE, PHOTOS, TOAST, CREDITS, SPAWN, LOCKS, VOICE, DEATH, PROPS } from './config.js';
import { Input, bindInput, readMoveIntent } from './input.js';
import { fellOut, moveX } from './physics.js';
import {
  createCamera, updateCamera, snapCamera, createTimer, updateTimer, formatTime,
  createCheckpoints, updateCheckpoints, reachedExit, createMovers, updateMovers, landOnMovers,
} from './world.js';
import {
  createNikich, steerAim, updateNikich, tryShoot, updateShots, tryDog, updateDogs,
  tryStun, trySuper, createSpeech, say, updateSpeech, pick, stunNikich, takeDamage, loseLife,
  isRiding, ramZozniki, setFace, nikichFace, senseNear,
} from './nikich.js';
import { itemsFromMap, updateItems, collectItems, applyItem, rollLoot, createItem, attractItems } from './items.js';
import { applyUpgrades, rollChoices, extraScooterDefs, isUpgrade } from './upgrades.js';
import { createSave, loadSave, writeSave, clearSave, addLevelStats } from './save.js';
import {
  updateZoznik, updateEnemyShots, contactDamage, separateFromBody, touching, recoil, createSpawner, updateSpawner, resetSpawner,
  spawnFromRequest, isFarBehind,
} from './zozniki.js';
import { buildTileset, drawTilesTextured } from './tiles.js';
import { setPosterImages, shufflePosters } from './signs.js';
import { seededRandom } from './world.js';
import { placeProps, buildPropSprites, buildGlow, drawProps, propLight } from './props.js';
import { buildBackdrop, drawBackdrop } from './backdrop.js';
import { createLocks, updateLocks, activeLock, confine, resetLocks } from './locks.js';
import { createGman, updateGman, gmanContactDamage, gmanGrace, isGone, isFighting, sceneLines } from './gman.js';
import {
  drawNikich, drawZoznik, drawDog, drawShot, drawDoor, drawRamp, drawItem, drawCheckpoint, setBeerCan,
  drawTram, drawGman, drawEnemyShot, drawBarDoor, drawLockGate,
} from './art.js';
import { LEVELS } from './levels/index.js';
import {
  drawLevelBanner, drawTitle, drawUpgradeChoice, menuItemRect, upgradeCardRect, inRect, drawPause, drawCrosshair, drawText, drawBubble, drawLose, drawLevelDone, COLORS,
  drawCutsceneBackdrop, drawCutsceneDialog, drawToast, drawFinal,
} from './ui.js';
import { UI, LINES, NIKICH_LINE_KEYS, CRAWL, HUD, UPGRADE_TEXT } from './lines.js';
import { buildHudAssets, drawWowHud, drawNameplate, drawPersonalBars, HUD_BAR_HEIGHT, setHudBeerCan } from './hud.js';
import { wowText } from './wow.js';
import { buildCrawl, buildStars, crawlEnd, drawCrawl, drawIntro, drawLogo } from './crawl.js';
import { Voice } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input();
bindInput(input, canvas, SCREEN.width, SCREEN.height);

const CHEATS = Object.freeze({ infiniteLives: new URLSearchParams(location.search).get('wtf') === '1' });

const R = SCREEN.renderScale;
canvas.width = SCREEN.width * R;
canvas.height = SCREEN.height * R;

function fitScale(winW, winH) {
  return Math.min(winW / SCREEN.width, winH / SCREEN.height);
}

function resize() {
  const scale = fitScale(window.innerWidth, window.innerHeight);
  canvas.style.width = `${Math.floor(SCREEN.width * scale)}px`;
  canvas.style.height = `${Math.floor(SCREEN.height * scale)}px`;
}

const screenFx = { drunk: 0, time: 0, style: '' };

function applyScreenFx(dt) {
  const top = machine.top();
  const target = top instanceof PlayScreen && !top.over ? top.n.drunk : 0;
  screenFx.drunk += (target - screenFx.drunk) * Math.min(1, dt * 2.5);
  screenFx.time += dt;
  const B = ITEMS.beerZero;
  const d = screenFx.drunk < 0.02 ? 0 : screenFx.drunk;
  const blur = (B.blurPerStack * d).toFixed(2);
  const tilt = (Math.sin(screenFx.time * B.swaySpeed * 0.6) * B.tiltPerStack * d).toFixed(2);
  const zoom = (1 + d * 0.015).toFixed(3);
  const style = d ? `blur(${blur}px)|rotate(${tilt}deg) scale(${zoom})` : '|';
  if (style === screenFx.style) return;
  screenFx.style = style;
  const [filter, transform] = style.split('|');
  canvas.style.filter = filter;
  canvas.style.transform = transform;
}

function render() {
  ctx.setTransform(R, 0, 0, R, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = 'low';
  machine.top().draw(ctx);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
window.addEventListener('resize', resize);
resize();

function loadPhoto(spec) {
  const photo = { img: null, w: spec.w, h: spec.h };
  const img = new Image();
  img.onload = () => {
    if (spec.native) {
      photo.w = img.naturalWidth / SCREEN.renderScale;
      photo.h = img.naturalHeight / SCREEN.renderScale;
    }
    photo.img = img;
  };
  img.src = `assets/img/${spec.file}`;
  return photo;
}

const photos = Object.fromEntries(Object.entries(PHOTOS).map(([k, spec]) => [k, loadPhoto(spec)]));

const beerCanImg = new Image();
beerCanImg.src = 'assets/img/beer-can.png';
setBeerCan(beerCanImg);
setHudBeerCan(beerCanImg);

function loadPosters() {
  fetch('assets/img/posters/index.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const items = list.map((p) => {
        const item = { id: p.id, img: null };
        const img = new Image();
        img.onload = () => { item.img = img; };
        img.src = `assets/img/posters/${p.id}.jpg`;
        return item;
      });
      setPosterImages(items);
    })
    .catch(() => {});
}

loadPosters();
const faceHeads = {
  happy: photos.headHappy,
  near: photos.headNear,
  fight: photos.headFight,
  laugh: photos.headLaugh,
  tipsy: photos.headTipsy,
  hurt: photos.headHurt,
  fed: photos.headFed,
  smoke: photos.headSmoke,
  jump: photos.headJump,
  pout: photos.headPout,
};

const ITEM_FACES = {
  chip: 'laugh',
  vodka: 'tipsy',
  hotdog: 'fed',
  cigarette: 'smoke',
  beerZero: 'pout',
};

function headFor(n) {
  const head = faceHeads[nikichFace(n)];
  return head && head.img ? head : photos.headHappy;
}

// ---------- Машина экранов: стек, верхний получает update ----------

const screens = [];
const machine = {
  top: () => screens[screens.length - 1],
  push: (s) => screens.push(s),
  pop: () => screens.pop(),
  replace: (s) => { screens.length = 0; screens.push(s); },
};

// ---------- Сохранение ----------

// localStorage может быть недоступен (приватный режим, запрет cookies) — тогда играем без сохранения
function browserStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
const storage = browserStorage();
const voice = new Voice({ storage });
voice.load();
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => voice.unlock());
const SAVE_OPTS = { maxLevel: LEVELS.length, isUpgrade };

// Прохождение: номер Уровня (с 1), взятые Улучшения, общая статистика. Живёт между Уровнями и Проигрышами.
function newCampaign() {
  return createSave(1);
}

function persist(cp) {
  if (!cp.debug) writeSave(storage, cp);
}

function forget(cp) {
  if (!cp.debug) clearSave(storage);
}

// ---------- Меню: мышь или клавиши ----------

// state: { selected, mx, my }. Возвращает индекс выбранного пункта или -1.
// Наведение мышью меняет выбор только когда мышь двигалась — иначе неподвижный курсор мешал бы клавишам.
function menuInput(state, count, rectOf, prevAction, nextAction) {
  const m = input.mouse;
  let hovered = -1;
  if (m.inside) {
    for (let i = 0; i < count; i++) if (inRect(rectOf(i, count), m.x, m.y)) hovered = i;
  }
  if (hovered >= 0 && (m.x !== state.mx || m.y !== state.my)) state.selected = hovered;
  state.mx = m.x;
  state.my = m.y;
  if (input.wasPressed(prevAction)) state.selected = (state.selected + count - 1) % count;
  if (input.wasPressed(nextAction)) state.selected = (state.selected + 1) % count;
  if (input.wasPressed('accept')) return state.selected;
  if (input.wasPressed('click') && hovered >= 0) return hovered;
  return -1;
}

class TitleScreen {
  constructor() {
    this.time = 0;
    this.save = loadSave(storage, SAVE_OPTS);
    this.confirmErase = false;
    this.menu = { selected: 0, mx: -1, my: -1 };
  }

  items() {
    if (this.confirmErase) return [UI.eraseNo, UI.eraseYes];
    return this.save ? [UI.menuContinue, UI.menuNewGame] : [UI.menuStart];
  }

  update(dt) {
    this.time += dt;
    const items = this.items();
    if (this.confirmErase && input.wasPressed('pause')) { this.confirmErase = false; this.menu.selected = 1; return; }
    const i = menuInput(this.menu, items.length, menuItemRect, 'menuUp', 'menuDown');
    if (i < 0) return;
    if (this.confirmErase) {
      if (i === 1) {
        clearSave(storage);
        machine.replace(new CutsceneScreen(0, newCampaign()));
      } else {
        this.confirmErase = false;
        this.menu.selected = 1;
      }
    } else if (!this.save) {
      machine.replace(new CutsceneScreen(0, newCampaign()));
    } else if (i === 0) {
      machine.replace(new CutsceneScreen(this.save.level - 1, this.save));
    } else {
      this.confirmErase = true;
      this.menu.selected = 0; // по умолчанию — «Нет»
    }
  }

  draw(c) {
    let note = null;
    if (this.save && !this.confirmErase) {
      note = `${UI.levelLabel} ${this.save.level} · ${UI.upgradesOwned}: ${this.save.upgrades.length}`;
    }
    drawTitle(c, this.time, {
      items: this.items(), selected: this.menu.selected, question: this.confirmErase ? UI.eraseQuestion : null, note,
      face: photos.face, gman: photos.gman,
    });
  }
}

// Выбор Улучшения после Уровня (SPEC §8): 1 из 3, сохранение, следующий Уровень
class UpgradeScreen {
  constructor(under, campaign, nextIndex, prev) {
    this.under = under;
    this.campaign = campaign;
    this.nextIndex = nextIndex;
    this.prev = prev;
    this.choices = rollChoices();
    this.menu = { selected: 0, mx: -1, my: -1 };
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    if (this.time < RESULT_DELAY) return;
    let i = menuInput(this.menu, this.choices.length, upgradeCardRect, 'menuLeft', 'menuRight');
    ['pick1', 'pick2', 'pick3'].forEach((a, k) => {
      if (k < this.choices.length && input.wasPressed(a)) i = k;
    });
    if (i < 0) return;
    const cp = this.campaign;
    cp.upgrades.push(this.choices[i]);
    cp.level = this.nextIndex + 1;
    persist(cp);
    machine.replace(new CutsceneScreen(this.nextIndex, cp, this.prev));
  }

  draw(c) {
    this.under.draw(c);
    drawUpgradeChoice(c, this.choices, this.menu.selected, this.time >= RESULT_DELAY, this.time);
  }
}

class CutsceneScreen {
  constructor(levelIndex, campaign, prev = null) {
    this.levelIndex = levelIndex;
    this.campaign = campaign;
    this.lines = sceneLines(levelIndex, prev);
    this.page = 0;
    this.time = 0;
    this.lineTime = 0;
  }

  typed() {
    return Math.floor(this.lineTime * CUTSCENE.charsPerSec);
  }

  start() {
    machine.replace(new PlayScreen(this.levelIndex, this.campaign));
  }

  update(dt) {
    this.time += dt;
    this.lineTime += dt;
    if (input.wasPressed('pause')) { this.start(); return; }
    if (this.time < CUTSCENE.minTime || !input.wasPressed('confirm')) return;
    if (this.typed() < this.lines[this.page].length) {
      this.lineTime = this.lines[this.page].length / CUTSCENE.charsPerSec;
    } else if (this.page + 1 < this.lines.length) {
      this.page += 1;
      this.lineTime = 0;
    } else {
      this.start();
    }
  }

  draw(c) {
    drawCutsceneBackdrop(c, this.time);
    const text = this.lines[this.page];
    drawCutsceneDialog(c, {
      label: `${UI.levelLabel} ${this.levelIndex + 1}`,
      name: UI.levelNames[this.levelIndex],
      text: text.slice(0, this.typed()),
      page: this.page + 1,
      pages: this.lines.length,
      ready: this.time >= CUTSCENE.minTime,
      time: this.time,
      speaker: photos.gman,
      photo: this.levelIndex === 3 ? photos.pkin : null,
    });
    if (input.mouse.inside) drawCrosshair(c, input.mouse.x, input.mouse.y);
  }
}

class PauseScreen {
  constructor(under) { this.under = under; }
  update() {
    if (input.wasPressed('pause') || input.wasPressed('confirm')) machine.pop();
  }
  draw(c) {
    this.under.draw(c);
    drawPause(c);
  }
}

// Проигрыш и «Уровень пройден» рисуются поверх замершего Уровня; «Ещё раз» — тот же Уровень заново
const RESULT_DELAY = 0.8; // с, чтобы случайный клик не пропустил экран

class LoseScreen {
  constructor(under, reason) {
    this.under = under;
    this.reason = reason;
    this.line = pick(LINES.lose);
    this.time = 0;
    // Улучшения остаются, статистика копится; продолжить можно с этого же Уровня
    const cp = under.campaign;
    cp.stats = addLevelStats(cp.stats, under.stats);
    cp.level = under.levelIndex + 1;
    persist(cp);
  }
  update(dt) {
    this.time += dt;
    if (this.time >= RESULT_DELAY && input.wasPressed('confirm')) {
      machine.replace(new PlayScreen(this.under.levelIndex, this.under.campaign, this.under.retries + 1));
    }
  }
  draw(c) {
    this.under.draw(c);
    drawLose(c, this.reason, this.line, this.time >= RESULT_DELAY, this.time, photos.floor);
  }
}

class LevelDoneScreen {
  constructor(under) {
    this.under = under;
    this.time = 0;
    this.next = under.levelIndex + 1; // после последнего — пока на титульный (Финал и Титры — этап 11)
    const cp = under.campaign;
    cp.stats = addLevelStats(cp.stats, under.stats);
    const { stats } = under.run;
    this.lines = [
      `${UI.statKills}: ${stats.kills}`,
      `${UI.statShots}: ${stats.shots}`,
      `${UI.statDeaths}: ${stats.deaths}`,
      `${UI.statTime}: ${formatTime(stats.time)}`,
    ];
  }
  update(dt) {
    this.time += dt;
    if (this.time >= RESULT_DELAY && input.wasPressed('confirm')) {
      if (this.next < LEVELS.length) {
        const prev = { flawless: this.under.stats.deaths === 0 && this.under.retries === 0 };
        machine.replace(new UpgradeScreen(this.under, this.under.campaign, this.next, prev));
      } else {
        clearSave(storage); // игра пройдена — на титульном снова «Начать»
        machine.replace(new TitleScreen());
      }
    }
  }
  draw(c) {
    this.under.draw(c);
    const prompt = this.next < LEVELS.length ? UI.next : UI.toTitle;
    drawLevelDone(c, this.lines, prompt, this.time >= RESULT_DELAY, this.time);
  }
}

function statLines(stats) {
  return [
    `${UI.statKills}: ${stats.kills}`,
    `${UI.statShots}: ${stats.shots}`,
    `${UI.statDeaths}: ${stats.deaths}`,
    `${UI.statTime}: ${formatTime(stats.timeMs / 1000)}`,
  ];
}

class FinalScreen {
  constructor(under) {
    this.time = 0;
    const cp = under.campaign;
    cp.stats = addLevelStats(cp.stats, under.stats);
    this.lines = statLines(cp.stats);
    forget(cp);
  }
  update(dt) {
    this.time += dt;
    if (this.time >= CREDITS.finalDelay && input.wasPressed('confirm')) machine.replace(new CreditsScreen());
  }
  draw(c) {
    drawFinal(c, photos.happy, this.lines, UI.next, this.time >= CREDITS.finalDelay, this.time);
  }
}

function nikichPhrases() {
  const seen = new Set();
  for (const key of NIKICH_LINE_KEYS) for (const text of LINES[key]) seen.add(text);
  return [...seen];
}

class CreditsScreen {
  constructor() {
    this.time = 0;
    this.crawl = buildCrawl(CRAWL, nikichPhrases(), makeCanvas, SCREEN.renderScale);
    this.stars = buildStars(makeCanvas, 2, SCREEN.width, SCREEN.height);
    this.end = crawlEnd(this.crawl);
    const C = CREDITS.crawl;
    this.crawlStart = C.introTime + C.logoTime * 0.55;
  }
  scroll() {
    return Math.max(0, (this.time - this.crawlStart) * CREDITS.crawl.speed);
  }
  done() {
    return this.scroll() >= this.end;
  }
  update(dt) {
    this.time += dt;
    if (input.wasPressed('pause')) { machine.replace(new TitleScreen()); return; }
    if (this.time < RESULT_DELAY || !input.wasPressed('confirm')) return;
    if (this.done()) machine.replace(new CutsceneScreen(0, newCampaign()));
    else this.time = this.crawlStart + this.end / CREDITS.crawl.speed;
  }
  draw(c) {
    const C = CREDITS.crawl;
    const W = SCREEN.width;
    const H = SCREEN.height;
    c.imageSmoothingEnabled = true;
    c.drawImage(this.stars, 0, 0, W, H);
    c.imageSmoothingEnabled = false;
    const t = this.time;
    if (t < C.introTime) {
      const a = Math.min(1, t / 0.8, (C.introTime - t) / 0.8);
      drawIntro(c, CRAWL.intro, Math.max(0, a), W, H);
    } else if (t < C.introTime + C.logoTime) {
      drawLogo(c, CRAWL.logo, (t - C.introTime) / C.logoTime, W, H);
    }
    if (t >= this.crawlStart) drawCrawl(c, this.crawl, this.scroll(), W, H);
    const hint = this.done() ? UI.creditsAgain : UI.creditsSkip;
    if (!this.done() || Math.floor(t * 2) % 2 === 0) drawText(c, hint, W / 2, this.done() ? H / 2 - 4 : 6, { size: this.done() ? 9 : 7, align: 'center', color: this.done() ? COLORS.accent : COLORS.muted });
  }
}

const NIGHT_TIMES = new Set(['sunset', 'night']);

function buildGlows(props) {
  const glows = new Map();
  for (const type of new Set(props.map((p) => p.type))) {
    const l = propLight(type);
    if (l) glows.set(type, buildGlow(makeCanvas, 2, l.color, l.r ?? PROPS.glowRadius));
  }
  return glows;
}

const LEVEL_BANNER_TIME = 2.5; // с, название Уровня на старте

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

let hudAssets = null;

function getHudAssets() {
  if (!hudAssets) hudAssets = buildHudAssets();
  return hudAssets;
}

const TARGET_TIME = 4;
const PRESS_FLASH = 0.15;

let motionBuffer = null;

function getMotionBuffer() {
  if (!motionBuffer) {
    const cv = makeCanvas(canvas.width, canvas.height);
    motionBuffer = { canvas: cv, g: cv.getContext('2d') };
  }
  return motionBuffer;
}

function hash01(i, k) {
  const h = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

class PlayScreen {
  constructor(levelIndex = 0, campaign = newCampaign(), retries = 0) {
    this.levelIndex = levelIndex;
    this.campaign = campaign;
    this.retries = retries;
    this.level = LEVELS[levelIndex];
    this.map = this.level.build(TILE_SIZE);
    shufflePosters(seededRandom(levelIndex * 7919 + 13));
    this.tileset = buildTileset(this.level.theme.tiles, makeCanvas, SCREEN.renderScale);
    this.props = placeProps(this.map, this.level.theme.props, levelIndex + 1);
    this.propSprites = buildPropSprites(this.props, makeCanvas, SCREEN.renderScale);
    this.glows = NIGHT_TIMES.has(this.level.theme.time) ? buildGlows(this.props) : null;
    this.worldH = SCREEN.height - HUD_BAR_HEIGHT;
    this.worldScale = Math.min(1, this.worldH / this.map.pixelHeight);
    const viewW = SCREEN.width / this.worldScale;
    const viewH = this.worldH / this.worldScale;
    this.parallax = buildBackdrop(this.level.theme, this.map.pixelWidth, viewW, viewH, makeCanvas, levelIndex + 1);
    this.movers = createMovers(this.map.movers, TILE_SIZE);
    this.riding = null; // Трамвай, на крыше которого стоит Никич
    this.n = createNikich(0, 0);
    applyUpgrades(this.n, campaign.upgrades);
    this.n.infiniteLives = CHEATS.infiniteLives;
    this.cam = createCamera(viewW, viewH);
    this.shots = [];
    this.dogs = [];
    this.zozniki = [];
    this.corpses = [];
    this.enemyShots = [];
    this.spawner = createSpawner(this.map.spawns, TILE_SIZE);
    this.doors = this.map.spawns
      .filter((d) => d.type === 'door')
      .map((d) => ({ x: d.tx * TILE_SIZE + TILE_SIZE / 2, y: (d.ty + 1) * TILE_SIZE }));
    this.speech = createSpeech();
    this.effects = { rings: [], floaters: [], misses: [], shake: 0, flash: 0 };
    this.items = itemsFromMap(this.map.items, TILE_SIZE);
    this.items.push(...itemsFromMap(extraScooterDefs(this.map, this.n.mods.extraScooters), TILE_SIZE));
    this.checkpoints = createCheckpoints(this.map);
    this.gman = this.map.arena ? createGman(this.map) : null;
    this.locks = createLocks(this.map);
    this.toast = 0;
    this.beers = 0;
    // Прохождение Уровня: таймер, очки, статистика (SPEC §4, §9)
    this.run = { timer: this.level.timed ? createTimer(LEVEL.time) : null, stats: { kills: 0, shots: 0, deaths: 0, time: 0 } };
    this.stats = this.run.stats;
    this.over = false; // Уровень закончился — дальше не обновляем
    this.lowHealthSaid = false;
    this.debug = false;
    this.squash = 0; // >0 — сплющен после приземления, <0 — вытянут в прыжке
    this.time = 0;
    this.respawn();
    say(this.speech, pick(LINES.levelStart), { force: true });
  }

  get body() { return this.n.body; }

  respawn() {
    const spawn = this.checkpoints.current;
    const { tileSize } = this.map;
    const b = this.body;
    b.x = spawn.x + (tileSize - b.w) / 2;
    b.y = spawn.y + tileSize - b.h;
    b.vx = 0;
    b.vy = 0;
    this.riding = null;
    this.cam.dir = 1;
    snapCamera(this.cam, b, this.map, CAMERA);
  }

  finish(screen) {
    this.over = true;
    machine.replace(screen);
  }

  // Жизнь потеряна: назад на Контрольную точку, Зожники и снаряды исчезают, волны впереди снова ждут
  afterLifeLost(gameOver) {
    this.stats.deaths += 1;
    if (gameOver) { this.finish(new LoseScreen(this, UI.loseLives)); return; }
    this.zozniki = [];
    this.enemyShots = [];
    this.shots = [];
    this.dogs = [];
    this.respawn();
    resetSpawner(this.spawner, this.body.x);
    if (this.gman) gmanGrace(this.gman, this.map);
    resetLocks(this.locks);
  }

  hurt(amount, fromX, src = null) {
    const r = takeDamage(this.n, amount, fromX);
    if (r.missed) {
      const b = this.body;
      this.effects.misses.push({ x: src ? src.x : b.x + b.w / 2, y: src ? src.y : b.y, t: 0 });
    }
    if (!r.hit) return false;
    voice.group('hurt');
    if (r.lifeLost) { this.afterLifeLost(r.gameOver); return true; }
    say(this.speech, pick(LINES.hit));
    return true;
  }

  updateZozniki(dt) {
    const n = this.n;
    const b = this.body;
    const view = this.view();
    for (const req of updateSpawner(this.spawner, dt, {
      map: this.map, view, nikichX: b.x + b.w / 2, nikichFeetY: b.y + b.h, alive: this.zozniki.length,
    })) {
      this.zozniki.push(spawnFromRequest(req));
    }
    for (const z of this.zozniki) {
      const near = Math.hypot(z.body.x + z.body.w / 2 - (b.x + b.w / 2), z.body.y + z.body.h / 2 - (b.y + b.h / 2)) <= VOICE.nearDistance;
      if (near && !z.near) voice.group('nearMob');
      z.near = near;
      const events = updateZoznik(z, dt, this.map, PHYSICS, b);
      separateFromBody(z, b, this.map);
      for (const e of events) {
        if (e.type === 'lecture') {
          stunNikich(n, e.stun);
          z.bubble = { text: pick(LINES.yoga), t: SPEECH.holdTime };
        } else if (e.type === 'throw') {
          this.enemyShots.push(e.shot);
        } else if (e.type === 'joke') {
          say(this.speech, pick(LINES.moto));
        }
      }
      if (z.bubble && (z.bubble.t -= dt) <= 0) z.bubble = null;
    }
    // Убитые и отставшие далеко позади исчезают
    for (const z of this.zozniki) if (!z.alive && z.health <= 0) this.corpses.push({ z, t: 0 });
    this.zozniki = this.zozniki.filter((z) => z.alive && !isFarBehind(z, view) && !fellOut(z.body, this.map));
    for (const k of this.corpses) k.t += dt;
    this.corpses = this.corpses.filter((k) => k.t < DEATH.fallTime + DEATH.fadeTime);
  }

  // Урон по Никичу: касание Зожника и смузи
  updateDanger(dt) {
    const b = this.body;
    for (const h of updateEnemyShots(this.enemyShots, dt, this.map, b)) {
      const o = h.owner && h.owner.body;
      this.hurt(h.damage, h.x, o ? { x: o.x + o.w / 2, y: o.y - (h.owner === this.gman ? 22 : 12) } : { x: h.x, y: h.y - 6 });
      if (this.over) return;
    }
    // На Самокате Никич сбивает Зожников, а не получает от них
    if (isRiding(this.n)) { this.onHits(ramZozniki(this.n, this.zozniki)); return; }
    for (const z of this.zozniki) {
      const dmg = contactDamage(z, b);
      if (dmg <= 0) continue;
      const hit = this.hurt(dmg, z.body.x + z.body.w / 2, { x: z.body.x + z.body.w / 2, y: z.body.y - 12 });
      if (this.over || this.zozniki.length === 0) return;
      if (hit) {
        for (const other of this.zozniki) if (other.alive && touching(other.body, b)) recoil(other, b);
      }
      return;
    }
  }

  mouseWorld() {
    return { x: input.mouse.x / this.worldScale + this.cam.x, y: input.mouse.y / this.worldScale + this.cam.y };
  }

  view() {
    return { x: this.cam.x, y: this.cam.y, w: this.cam.viewW, h: this.cam.viewH };
  }

  // amount — число урона или готовая подпись
  floater(x, y, amount) {
    if (typeof amount === 'number' && amount < 0.5) return;
    const text = typeof amount === 'number' ? String(Math.round(amount)) : amount;
    this.effects.floaters.push({ x, y, text, t: EFFECTS.floaterTime });
  }

  onHits(hits) {
    if (hits.some((h) => h.dealt > 0)) voice.group('dealDamage');
    for (const h of hits) {
      const zb = h.z.body;
      this.floater(h.x ?? zb.x + zb.w / 2, h.y ?? zb.y, h.dealt);
      if (h.killed && h.z !== this.gman) this.onKill(h.z);
      if (h.z !== this.gman && h.z.alive) this.target = { z: h.z, t: TARGET_TIME };
    }
  }

  updateLocksStep(dt) {
    const b = this.body;
    const cx = b.x + b.w / 2;
    const aliveIn = (id) => this.zozniki.reduce((k, z) => k + (z.alive && z.lockId === id ? 1 : 0), 0);
    const ctx = { map: this.map, nikichX: cx, nikichFeetY: b.y + b.h, room: SPAWN.maxAlive - this.zozniki.length, aliveIn };
    for (const e of updateLocks(this.locks, dt, ctx)) {
      if (e.type === 'start') {
        this.floater(cx, b.y - 14, UI.lockStart);
        say(this.speech, pick(LINES.lockStart), { force: true });
      } else if (e.type === 'spawn') {
        const z = spawnFromRequest(e);
        z.lockId = e.lock.id;
        if (z.state === 'pose') z.state = 'walk';
        z.dir = e.x < cx ? 1 : -1;
        this.zozniki.push(z);
      } else if (e.type === 'release') {
        for (const z of this.zozniki) if (z.lockId === e.lock.id) z.lockId = null;
      } else if (e.type === 'clear') {
        this.floater(cx, b.y - 14, UI.lockClear);
        say(this.speech, pick(LINES.lockClear), { force: true });
        voice.group('waveClear');
        setFace(this.n, 'laugh');
      }
    }
    const lock = activeLock(this.locks);
    if (!lock) return;
    confine(b, lock);
    for (const z of this.zozniki) if (z.lockId === lock.id) confine(z.body, lock);
  }

  targets() {
    return this.gman && this.gman.alive ? [...this.zozniki, this.gman] : this.zozniki;
  }

  exitOpen() {
    return !this.gman || isGone(this.gman);
  }

  updateBoss(dt) {
    const g = this.gman;
    if (!g) return;
    const n = this.n;
    const b = this.body;
    for (const e of updateGman(g, dt, this.map, PHYSICS, b, { alive: this.zozniki.length })) {
      if (e.type === 'say') {
        g.bubble = { text: pick(LINES[e.key]), t: SPEECH.holdTime };
      } else if (e.type === 'throw' || e.type === 'shot') {
        this.enemyShots.push(e.shot);
      } else if (e.type === 'summon') {
        for (const r of e.requests) {
          const z = spawnFromRequest(r);
          if (z.state === 'pose') z.state = 'walk';
          this.zozniki.push(z);
        }
      } else if (e.type === 'stun') {
        this.effects.rings.push({ x: e.x, y: e.y, radius: e.radius, t: EFFECTS.stunRingTime, color: '157, 180, 255' });
        const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
        if (Math.hypot(c.x - e.x, c.y - e.y) <= e.radius) {
          stunNikich(n, e.duration);
          this.hurt(e.damage, e.x, { x: g.body.x + g.body.w / 2, y: g.body.y - 22 });
          if (this.over) return;
        }
      } else if (e.type === 'defeated') {
        g.bubble = { text: pick(LINES.gmanDefeat), t: GMAN.tieTime + GMAN.dissolveTime };
        this.zozniki = [];
        this.enemyShots = [];
        this.effects.flash = ATTACKS.super.flashTime;
      } else if (e.type === 'gone') {
        say(this.speech, pick(LINES.victory), { force: true });
        setFace(n, 'laugh', 99);
      }
    }
    if (g.bubble && (g.bubble.t -= dt) <= 0) g.bubble = null;
    if (isFighting(g)) separateFromBody(g, b, this.map);
    const dmg = gmanContactDamage(g, b);
    if (dmg > 0) this.hurt(dmg, g.body.x + g.body.w / 2, { x: g.body.x + g.body.w / 2, y: g.body.y - 22 });
  }

  onKill(z) {
    this.stats.kills += 1;
    setFace(this.n, 'laugh');
    say(this.speech, pick(LINES.kill));
    const loot = rollLoot();
    if (loot) this.items.push(createItem(loot, z.body.x + z.body.w / 2, z.body.y + z.body.h / 2, { drop: true }));
  }

  // Подбор Предметов
  updateItemsStep(dt) {
    updateItems(this.items, dt, this.map, PHYSICS);
    attractItems(this.items, this.n, dt, this.n.mods.magnetRadius, UPGRADES.magnet.speed);
    const b = this.body;
    for (const it of collectItems(this.items, this.n)) {
      const r = applyItem(this.n, it.type, this.run);
      if (r.floater) this.floater(b.x + b.w / 2, b.y, r.floater);
      if (it.type === 'chip') this.toast = TOAST.time;
      const mood = ITEM_FACES[it.type];
      if (mood) setFace(this.n, mood);
      if (it.type === 'beerZero') voice.group(this.beers++ === 0 ? 'firstBeer' : 'beer');
      if (it.type === 'hotdog') voice.group('heal');
      if (r.speech && LINES[r.speech]) say(this.speech, pick(LINES[r.speech]), { force: true });
      if (r.lifeLost) { this.afterLifeLost(r.gameOver); return; }
    }
  }

  update(dt) {
    if (this.over) return;
    this.time += dt;
    if (input.wasPressed('pause')) { machine.push(new PauseScreen(this)); return; }
    if (input.wasPressed('debug')) this.debug = !this.debug;

    const n = this.n;
    const b = this.body;

    // Прицел: Никич смотрит на курсор
    if (input.mouse.inside) {
      const m = this.mouseWorld();
      steerAim(n, m.x, m.y, dt);
    } else if (Math.abs(b.vx) > 1) {
      n.facing = Math.sign(b.vx);
      n.aim = { x: n.facing, y: 0 };
    }

    // Трамвай едет и везёт Никича, если тот на крыше
    updateMovers(this.movers, dt);
    if (this.riding) moveX(b, this.riding.dx, this.map);
    const prevBottom = b.y + b.h;
    const ev = updateNikich(n, readMoveIntent(input), dt, this.map, PHYSICS);
    const wasRiding = this.riding;
    this.riding = landOnMovers(b, this.movers, prevBottom);
    if (ev.jumped) this.squash = -0.12;
    if (ev.landed || (this.riding && !wasRiding)) this.squash = 0.1;
    this.squash -= Math.sign(this.squash) * Math.min(Math.abs(this.squash), dt);

    // Атаки
    if (input.held('shoot')) {
      const s = tryShoot(n);
      if (s) this.shots.push(s);
    }
    if (input.wasPressed('dog')) {
      const d = tryDog(n, this.mouseWorld().x);
      if (d) {
        this.dogs.push(d);
        setFace(n, 'fight');
      }
    }
    if (input.wasPressed('stun')) {
      const r = tryStun(n, this.targets());
      if (r) {
        this.effects.rings.push({ x: r.x, y: r.y, radius: r.radius, t: EFFECTS.stunRingTime });
        say(this.speech, pick(LINES.stun), { force: true });
        setFace(n, 'fight');
        this.onHits(r.hits);
      }
    }
    if (input.wasPressed('super')) {
      const r = trySuper(n, this.targets(), this.view());
      if (r) {
        this.effects.shake = ATTACKS.super.shakeTime;
        this.effects.flash = ATTACKS.super.flashTime;
        say(this.speech, pick(LINES.super), { force: true });
        setFace(n, 'fight');
        this.onHits(r.hits);
      }
    }

    this.onHits(updateShots(n, this.shots, dt, this.map, this.targets()));
    for (const e of updateDogs(n, this.dogs, dt, this.map, this.targets(), PHYSICS)) {
      if (e.type === 'kill' && e.z !== this.gman) this.onKill(e.z);
    }
    this.updateBoss(dt);
    if (this.over) return;
    this.updateZozniki(dt);
    this.updateLocksStep(dt);
    senseNear(n, this.targets());
    this.updateDanger(dt);
    if (this.over) return;
    this.updateItemsStep(dt);
    if (this.over) return;

    // Яма: минус жизнь, возврат на Контрольную точку (SPEC §5)
    if (fellOut(b, this.map)) {
      const r = loseLife(n);
      this.afterLifeLost(r.gameOver);
      if (this.over) return;
      say(this.speech, pick(LINES.pit), { force: true });
    }

    if (updateCheckpoints(this.checkpoints, b)) this.floater(b.x + b.w / 2, b.y - 10, UI.checkpoint);
    if (n.health <= n.maxHealth * 0.3) {
      if (!this.lowHealthSaid) this.lowHealthSaid = say(this.speech, pick(LINES.lowHealth));
    } else {
      this.lowHealthSaid = false;
    }

    this.stats.time += dt;
    if (this.run.timer && !activeLock(this.locks) && updateTimer(this.run.timer, dt)) { this.finish(new LoseScreen(this, UI.loseTime)); return; }
    if (this.exitOpen() && reachedExit(this.map, b)) { this.finish(this.gman ? new FinalScreen(this) : new LevelDoneScreen(this)); return; }

    updateCamera(this.cam, b, this.map, dt, CAMERA);
    updateSpeech(this.speech, dt);
    this.updateEffects(dt);
  }

  updateEffects(dt) {
    this.toast = Math.max(0, this.toast - dt);
    if (this.target && ((this.target.t -= dt) <= 0 || !this.target.z.alive)) this.target = null;
    this.pressT = this.pressT ?? [0, 0, 0, 0];
    ['shoot', 'dog', 'stun', 'super'].forEach((a, i) => {
      if (input.wasPressed(a) || (a === 'shoot' && input.held(a))) this.pressT[i] = PRESS_FLASH;
      else this.pressT[i] = Math.max(0, this.pressT[i] - dt);
    });
    const fx = this.effects;
    fx.shake = Math.max(0, fx.shake - dt);
    fx.flash = Math.max(0, fx.flash - dt);
    for (const r of fx.rings) r.t -= dt;
    fx.rings = fx.rings.filter((r) => r.t > 0);
    for (const m of fx.misses) m.t += dt;
    fx.misses = fx.misses.filter((m) => m.t < EFFECTS.missTime);
    for (const f of fx.floaters) f.t -= dt;
    fx.floaters = fx.floaters.filter((f) => f.t > 0);
  }

  draw(c) {
    const fx = this.effects;
    // Тряска экрана: сдвигаем камеру только на время отрисовки
    const shake = fx.shake > 0 ? ATTACKS.super.shakeAmp * (fx.shake / ATTACKS.super.shakeTime) : 0;
    const realX = this.cam.x;
    const realY = this.cam.y;
    this.cam.x += (Math.random() * 2 - 1) * shake;
    this.cam.y += (Math.random() * 2 - 1) * shake;
    // Стопарик: лёгкое «плавание» экрана
    if (this.n.effects.vodka > 0) {
      const V = ITEMS.vodka;
      this.cam.x += Math.sin(this.time * V.swaySpeed) * V.swayAmp;
      this.cam.y += Math.sin(this.time * V.swaySpeed * 1.3) * V.swayAmp * 0.6;
    }
    if (this.n.drunk > 0) {
      const B = ITEMS.beerZero;
      const k = this.n.drunk;
      this.cam.x += Math.sin(this.time * B.swaySpeed * 0.7) * B.swayAmp * k;
      this.cam.y += Math.cos(this.time * B.swaySpeed) * B.swayAmp * 0.5 * k;
    }
    const camX = Math.round(this.cam.x);
    const camY = Math.round(this.cam.y);

    c.save();
    c.beginPath();
    c.rect(0, 0, SCREEN.width, this.worldH);
    c.clip();
    c.scale(this.worldScale, this.worldScale);
    drawBackdrop(c, this.parallax, camX, this.time);
    for (const d of this.doors) drawDoor(c, d.x, d.y, camX, camY);
    const bar = this.map.door;
    if (bar) {
      const feetY = this.map.spawn.y + TILE_SIZE;
      drawBarDoor(c, bar.tx * TILE_SIZE, feetY, bar.w * TILE_SIZE, this.exitOpen(), camX, camY, this.time);
      drawText(c, UI.barSign, (bar.tx + bar.w / 2) * TILE_SIZE - camX, feetY - 56 - camY, { size: 8, align: 'center', color: COLORS.accent, bold: true });
    }
    for (const m of this.movers) drawTram(c, m, camX, camY);
    drawTilesTextured(c, this.map, this.cam, this.tileset);
    drawProps(c, this.props, this.propSprites, camX, camY, this.cam.viewW, this.glows);
    for (const r of this.map.ramps) drawRamp(c, r.tx, r.ty, TILE_SIZE, camX, camY);
    for (const l of this.locks) {
      drawLockGate(c, l.left, l.leftY, LOCKS.gateHeight, l.state, camX, camY, this.time);
      drawLockGate(c, l.right, l.rightY, LOCKS.gateHeight, l.state, camX, camY, this.time);
    }
    for (const cp of this.checkpoints.list) drawCheckpoint(c, cp.x + TILE_SIZE / 2, cp.y + TILE_SIZE, cp.reached, camX, camY);
    for (const it of this.items) drawItem(c, it, camX, camY, ITEMS);
    for (const k of this.corpses) drawZoznik(c, k.z, camX, camY, this.time, COLORS, k.t);
    for (const z of this.zozniki) drawZoznik(c, z, camX, camY, this.time, COLORS);
    if (this.gman) drawGman(c, this.gman, camX, camY, this.time, COLORS, GMAN.dissolveTime, photos.gmanHead);
    for (const d of this.dogs) drawDog(c, d, camX, camY, this.time);
    const head = headFor(this.n);
    drawNikich(c, this.n, camX, camY, this.time, this.squash, head);
    const headTop = this.body.y + this.body.h - camY - (head.img ? 13 + head.h : 24);
    drawPersonalBars(c, this.body.x + this.body.w / 2 - camX, headTop - 7, this.n.health / this.n.maxHealth, this.n.superMeter / ATTACKS.super.meterMax, this.levelIndex + 1);
    for (const s of this.shots) drawShot(c, s, camX, camY);
    for (const s of this.enemyShots) drawEnemyShot(c, s, camX, camY, this.time);
    this.drawEffects(c, camX, camY);
    for (const z of this.zozniki) {
      if (z.bubble) drawBubble(c, z.bubble.text, z.body.x + z.body.w / 2 - camX, z.body.y - camY - 8, this.cam.viewW);
    }
    const g = this.gman;
    this.drawNameplates(c, camX, camY);
    this.drawMisses(c, camX, camY);
    if (g && g.bubble && !isGone(g)) drawBubble(c, g.bubble.text, g.body.x + g.body.w / 2 - camX, g.body.y - camY - 20, this.cam.viewW);

    const b = this.body;
    if (this.speech.text) drawBubble(c, this.speech.text, b.x + b.w / 2 - camX, headTop - 10, this.cam.viewW);
    c.restore();
    c.fillStyle = '#000';
    c.fillRect(0, this.worldH, SCREEN.width, SCREEN.height - this.worldH);

    this.cam.x = realX;
    this.cam.y = realY;
    this.drawMotionBlur(c);

    if (fx.flash > 0) {
      c.fillStyle = `rgba(255, 255, 240, ${(fx.flash / ATTACKS.super.flashTime) * 0.85})`;
      c.fillRect(0, 0, SCREEN.width, SCREEN.height);
    }
    drawWowHud(c, getHudAssets(), this.hudState(), this.time, SCREEN.width);
    if (this.toast > 0) drawToast(c, photos.poker, LINES.chip[0], Math.min(this.toast, TOAST.time - this.toast) / TOAST.fade);
    if (this.time < LEVEL_BANNER_TIME) {
      const label = `${UI.levelLabel} ${this.levelIndex + 1}`;
      drawLevelBanner(c, label, UI.levelNames[this.levelIndex], Math.min(1, (LEVEL_BANNER_TIME - this.time) / 0.5));
    }
    if (this.debug) this.drawDebug(c);
    if (input.mouse.inside) drawCrosshair(c, input.mouse.x, input.mouse.y);
  }

  hudState() {
    const n = this.n;
    const ef = n.effects;
    const timer = this.run.timer;
    const lock = activeLock(this.locks);
    const full = n.superMeter >= ATTACKS.super.meterMax;
    const locked = n.stun > 0;
    const press = this.pressT ?? [0, 0, 0, 0];
    const skill = (id, cd) => ({ ...HUD.skills[id], key: UI[`key${id[0].toUpperCase()}${id.slice(1)}`], cdText: cd ? `${HUD.cooldown}: ${cd} с` : null });
    const fmt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
    const slots = [
      { icon: 'shot', key: UI.keyShot, cd: n.cooldowns.shot, max: ATTACKS.shot.cooldown / n.mods.shotRateMul, disabled: locked, pressed: press[0] > 0, tip: skill('shot', fmt(ATTACKS.shot.cooldown / n.mods.shotRateMul)) },
      { icon: 'dog', key: UI.keyDog, cd: n.cooldowns.dog, max: ATTACKS.dog.cooldown, disabled: locked, pressed: press[1] > 0, tip: skill('dog', fmt(ATTACKS.dog.cooldown)) },
      { icon: 'stun', key: UI.keyStun, cd: n.cooldowns.stun, max: ATTACKS.stun.cooldown, disabled: locked, pressed: press[2] > 0, tip: skill('stun', fmt(ATTACKS.stun.cooldown)) },
      { icon: 'super', key: UI.keySuper, cd: 0, max: 0, meter: n.superMeter / ATTACKS.super.meterMax, glow: full, disabled: locked, pressed: press[3] > 0, tip: skill('super', null) },
    ];
    const owned = new Map();
    for (const id of this.campaign.upgrades) owned.set(id, (owned.get(id) ?? 0) + 1);
    for (const [id, count] of owned) {
      const t = UPGRADE_TEXT[id];
      if (slots.length < 12) slots.push({ icon: `up:${id}`, passive: true, cd: 0, max: 0, count: count > 1 ? count : 0, tip: { name: t.name, desc: t.effect, cdText: HUD.passive } });
    }
    const B = ITEMS.beerZero;
    const aura = (id, left, extra = {}, vars = {}) => {
      const a = HUD.auras[id];
      const desc = a.desc.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
      return { icon: id, left, tip: { name: a.name, desc, leftLabel: HUD.left }, ...extra };
    };
    const buffs = [
      ef.vodka > 0 && aura('vodka', ef.vodka),
      n.drunk > 0 && aura('beerPower', ef.beer, { stacks: n.drunk }, { damage: Math.round(B.shotDamagePerStack * n.drunk * 100), armor: Math.round(Math.min(1, B.armorPerStack * n.drunk) * 100) }),
      ef.smoke > 0 && aura('smoke', ef.smoke),
      ef.scooter > 0 && aura('scooter', ef.scooter),
      ef.luck > 0 && aura('luck', ef.luck, {}, { chance: Math.round(ITEMS.chip.missChance * 100) }),
    ].filter(Boolean);
    const debuffs = [
      n.drunk > 0 && aura('drunk', ef.beer, { stacks: n.drunk }, { speed: Math.round((1 - Math.max(B.minSpeedMul, 1 - B.speedPerStack * n.drunk)) * 100) }),
      n.stun > 0 && aura('stunned', n.stun),
    ].filter(Boolean);
    const g = this.gman;
    let target = null;
    if (g && g.phase >= 0 && g.alive) {
      target = { face: photos.gmanHead, name: UI.bossName, level: '??', hp: g.health, max: g.maxHealth, phaseHealth: GMAN.phaseHealth, shielded: g.invuln > 0 || g.shielded, elite: true, cls: HUD.bossClass, levelText: HUD.bossLevel, sub: HUD.gmanTitle, nameColor: '#ff4d4d', key: 'gman' };
    } else if (this.target) {
      const z = this.target.z;
      const level = this.levelIndex + 1 + (z.kind === 'moto' ? 1 : 0);
      target = {
        name: HUD.kinds[z.kind], level, hp: z.health, max: z.maxHealth, key: `z${z.id ?? z.kind}`,
        cls: HUD.mobClass, levelText: `${level}${HUD.levelSuffix}`,
        portrait: (c, cx, cy, r) => drawZoznik(c, z, z.body.x + z.body.w / 2 - cx, z.body.y + z.body.h - (cy + r * 0.95), this.time, COLORS),
      };
    }
    return {
      face: headFor(n), name: HUD.playerName, level: this.levelIndex + 1,
      hp: n.health, hpMax: n.maxHealth, mana: n.superMeter, manaMax: ATTACKS.super.meterMax, manaLabel: HUD.manaLabel,
      lives: n.lives, infinite: n.infiniteLives, infiniteLabel: HUD.infinite, hurt: n.hurtLock > 0,
      stunned: locked, stunnedLabel: HUD.stunned,
      buffs, debuffs, slots, target,
      mouse: input.mouse.inside ? { x: input.mouse.x, y: input.mouse.y } : null,
      progress: Math.max(0, Math.min(1, (this.body.x + this.body.w / 2) / this.map.pixelWidth)),
      timer: timer ? { text: formatTime(timer.left), low: timer.left <= LEVEL.lowTime } : null,
      wave: lock ? `${UI.lockWave} ${lock.wave + 1}/${lock.def.waves.length}` : null,
    };
  }

  drawNameplates(c, camX, camY) {
    const view = this.view();
    for (const z of this.zozniki) {
      if (!z.alive) continue;
      const b = z.body;
      if (b.x + b.w < view.x || b.x > view.x + view.w) continue;
      const isTarget = this.target && this.target.z === z;
      drawNameplate(c, b.x + b.w / 2 - camX, b.y - camY - 6, HUD.kinds[z.kind], z.health / z.maxHealth, {
        nameColor: '#ffffff', target: isTarget, level: this.levelIndex + 1 + (z.kind === 'moto' ? 1 : 0),
      });
    }
    const g = this.gman;
    if (g && !isGone(g)) {
      const x = g.body.x + g.body.w / 2 - camX;
      const y = g.body.y - camY - 14;
      if (g.phase < 0) drawNameplate(c, x, y, `${UI.bossName} ${HUD.gmanTitle}`, 1, { nameColor: '#40ff40', color: 'friendly', w: 0 });
      else if (g.alive) drawNameplate(c, x, y, UI.bossName, g.health / g.maxHealth, { nameColor: '#ffffff', target: true, level: '??' });
    }
  }

  drawMotionBlur(c) {
    const C = ITEMS.cigarette;
    const b = this.body;
    const top = PHYSICS.runSpeed * this.n.mods.speedMul * C.speedMul;
    const speed = Math.max(0, Math.min(1, (Math.abs(b.vx) - C.blurMinSpeed) / Math.max(1, top - C.blurMinSpeed)));
    const target = this.n.effects.smoke > 0 ? speed * Math.min(1, this.n.effects.smoke / 0.6) : 0;
    this.blurK = (this.blurK ?? 0) + (target - (this.blurK ?? 0)) * 0.15;
    if (Math.abs(b.vx) > 5) this.blurDir = Math.sign(b.vx);
    const camDelta = this.cam.x - (this.blurCamX ?? this.cam.x);
    this.blurCamX = this.cam.x;
    if (this.blurK < 0.02) {
      this.blurPrimed = false;
      return;
    }
    const k = this.blurK;
    const dir = this.blurDir ?? 1;
    const buf = getMotionBuffer();
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.blurPrimed) {
      c.globalAlpha = C.blurAlpha * k;
      c.drawImage(buf.canvas, camDelta * C.blurStretch * SCREEN.renderScale, 0);
    }
    c.restore();
    buf.g.globalCompositeOperation = 'copy';
    buf.g.drawImage(canvas, 0, 0);
    this.blurPrimed = true;
    const W = SCREEN.width;
    const H = SCREEN.height;
    c.save();
    c.lineCap = 'round';
    const n = Math.round(C.speedLines * k);
    for (let i = 0; i < n; i++) {
      const h = hash01(i, 1);
      const y = (h < 0.5 ? h * 0.7 : 0.65 + (h - 0.5) * 0.7) * H;
      const len = 20 + hash01(i, 2) * 50 * k;
      const v = 500 + hash01(i, 3) * 500;
      const span = W + len * 2;
      const p = (hash01(i, 4) * span + this.time * v) % span;
      const x = dir > 0 ? W + len - p : p - len;
      c.globalAlpha = (0.12 + hash01(i, 5) * 0.22) * k;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 0.4 + hash01(i, 6) * 0.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + dir * len, y);
      c.stroke();
    }
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, `rgba(0, 0, 0, ${0.35 * k})`);
    c.globalAlpha = 1;
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  drawMisses(c, camX, camY) {
    for (const m of this.effects.misses) {
      const k = m.t / EFFECTS.missTime;
      const pop = m.t < 0.12 ? 1 + (1 - m.t / 0.12) * 0.6 : 1;
      c.save();
      c.globalAlpha = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
      c.translate(m.x - camX, m.y - camY - (1 - Math.pow(1 - k, 2)) * EFFECTS.missRise);
      c.scale(pop, pop);
      wowText(c, HUD.miss, 0, 0, { size: 8, align: 'center', color: '#ffffff', outline: 1.2 });
      c.restore();
    }
  }

  drawEffects(c, camX, camY) {
    for (const r of this.effects.rings) {
      const k = 1 - r.t / EFFECTS.stunRingTime;
      c.strokeStyle = `rgba(${r.color ?? '244, 211, 94'}, ${1 - k})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(Math.round(r.x - camX), Math.round(r.y - camY), r.radius * (0.4 + 0.6 * k), 0, Math.PI * 2);
      c.stroke();
    }
    for (const f of this.effects.floaters) {
      const k = 1 - f.t / EFFECTS.floaterTime;
      drawText(c, f.text, f.x - camX, f.y - camY - 8 - k * EFFECTS.floaterRise, { size: 8, color: COLORS.accent, align: 'center', bold: true });
    }
  }

  drawDebug(c) {
    const b = this.body;
    const lines = [
      `fps ${fps.toFixed(0)}`,
      `x ${b.x.toFixed(1)} y ${b.y.toFixed(1)}`,
      `vx ${b.vx.toFixed(0)} vy ${b.vy.toFixed(0)}`,
      `ground ${b.onGround ? 'да' : 'нет'} coyote ${b.coyote.toFixed(2)} buf ${b.jumpBuffer.toFixed(2)}`,
      `уровень ${this.levelIndex + 1} тайл ${Math.floor((b.x + b.w / 2) / TILE_SIZE)} трамвай ${this.riding ? 'да' : 'нет'}`,
      `улучшения ${this.campaign.upgrades.join(', ') || '—'}`,
      `kills ${this.stats.kills} super ${this.n.superMeter.toFixed(0)} зожники ${this.zozniki.length}`,
    ];
    lines.forEach((l, i) => drawText(c, l, 4, 28 + i * 10, { color: COLORS.accent }));
    c.strokeStyle = '#00ff88';
    c.strokeRect(Math.round(b.x - this.cam.x) + 0.5, Math.round(b.y - this.cam.y) + 0.5, b.w - 1, b.h - 1);
  }
}

// Вкладку свернули — ставим на паузу
document.addEventListener('visibilitychange', () => {
  if (document.hidden && machine.top() instanceof PlayScreen) machine.push(new PauseScreen(machine.top()));
});

// ---------- Цикл ----------

let fps = 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * DEBUG.fpsSmoothing;
  acc += Math.min(dt, LOOP.maxFrame);
  while (acc >= LOOP.step) {
    if (input.wasPressed('fullscreen')) toggleFullscreen();
    if (input.wasPressed('mute')) voice.toggleMute();
    machine.top().update(LOOP.step);
    input.endStep();
    acc -= LOOP.step;
  }
  applyScreenFx(Math.min(dt, LOOP.maxFrame));
  render();
  requestAnimationFrame(frame);
}

machine.replace(new TitleScreen());
requestAnimationFrame(frame);

// ?debug в адресе — доступ к игре из консоли для проверки (в обычной игре не включается)
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = {
    machine,
    input,
    voice,
    // __game.level(3, ['bouncy']) — сразу на Уровень 3 с Улучшениями (сохранение не трогается)
    level: (n, upgrades = []) => machine.replace(new PlayScreen(n - 1, { ...createSave(n, upgrades), debug: true })),
    step: (n = 1) => {
      for (let i = 0; i < n; i++) { machine.top().update(LOOP.step); input.endStep(); }
      render();
    },
  };
}
