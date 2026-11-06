// Все числа баланса и экрана — только здесь (SPEC §15).

export const SCREEN = Object.freeze({
  width: 480,
  height: 270,
  renderScale: 4,
});

export const LOOP = Object.freeze({
  step: 1 / 60, // фиксированный шаг симуляции, с (тот же шаг — в поправке прыжка ниже)
  maxFrame: 0.1, // SPEC §13: больше этого за кадр не догоняем — слабый ПК замедляет игру, а не телепортирует
  snapDistance: 32, // px за шаг: скачок дальше не сглаживаем (телепорт, Контрольная точка)
  cullMargin: 48, // px запаса по краям кадра, за ним объекты не рисуем
});

export const TILE_SIZE = 16;
export const MAP_HEIGHT_TILES = 17; // SPEC §9

const gravity = 900; // px/с², SPEC §5
const jumpHeightTiles = 3.5; // полное зажатие
const shortJumpHeightTiles = 1.5; // короткое нажатие
const step = 1 / 60;

// v = √(2gh) + g·dt/2 — поправка на дискретный шаг, чтобы высота совпала со спекой.
// Короткий прыжок: первый кадр подъёма проходит на полной скорости, его вычитаем.
const jumpVelocity = Math.sqrt(2 * gravity * jumpHeightTiles * TILE_SIZE) + (gravity * step) / 2;
const jumpCutVelocity = Math.sqrt(2 * gravity * (shortJumpHeightTiles * TILE_SIZE - jumpVelocity * step)) + (gravity * step) / 2;

export const PHYSICS = Object.freeze({
  gravity,
  maxFallSpeed: 420, // px/с; < TILE_SIZE * 60, чтобы не проскакивать тайлы
  runSpeed: 110, // px/с, SPEC §5
  groundAccel: 1100, // px/с², разгон на земле
  groundDecel: 1500, // px/с², торможение на земле без ввода
  airAccel: 750, // px/с², управление в воздухе
  airDecel: 350, // px/с², в воздухе без ввода инерция сохраняется
  jumpHeightTiles,
  shortJumpHeightTiles,
  jumpVelocity, // скорость отрыва для полной высоты
  jumpCutVelocity, // до неё обрезается скорость, если отпустить прыжок на подъёме
  coyoteTime: 0.1, // с, SPEC §5
  jumpBufferTime: 0.1, // с, SPEC §5
  dropThroughTime: 0.2, // с, сколько тонкие платформы игнорируются после S
  airJumps: 0, // дополнительные прыжки в воздухе (Улучшение «Прыгучий» даст 1)
});

export const NIKICH = Object.freeze({
  hitboxW: 10, // спрайт 16×24, хитбокс уже, чтобы не цепляться за края
  hitboxH: 22,
  handOffsetY: 9, // px от макушки — откуда летят окурки
  maxHealth: 100, // SPEC §5
  lives: 3,
  invulnTime: 1, // с неуязвимости после удара
  hurtLockTime: 0.25, // с без управления после удара (отбрасывание)
  knockbackX: 130, // px/с
  knockbackY: 170, // px/с вверх
});

// Атаки Никича (SPEC §5.1)
export const ATTACKS = Object.freeze({
  shot: Object.freeze({ // Щелбан
    damage: 10,
    speed: 300,
    range: 220,
    cooldown: 0.25,
  }),
  dog: Object.freeze({ // Собака
    cooldown: 6,
    dps: 15,
    holdTime: 3, // с, сколько держит Зожника
    speed: 200, // px/с бега по земле
    jumpVelocity: 230, // px/с — подпрыгивает, упёршись в препятствие
    maxRunTime: 2.5, // с, не нашла Зожника — убегает
    w: 12,
    h: 8,
  }),
  stun: Object.freeze({ // 5:0
    cooldown: 5,
    radius: 70,
    duration: 1.5,
    damage: 5,
  }),
  super: Object.freeze({ // Папа сейчас всё сделает
    damage: 200,
    meterMax: 100,
    meterPerDamage: 1, // +1 к шкале за каждую единицу урона
    shakeTime: 0.4,
    shakeAmp: 4, // px
    flashTime: 0.25,
  }),
});

// Зожники (SPEC §6). health, speed, touchDamage — из спеки; остальное — настройка поведения.
export const ZOZNIKI = Object.freeze({
  runner: Object.freeze({ // Бегун
    health: 20, speed: 70, touchDamage: 10,
    w: 10, h: 22, accel: 600,
    jumpTiles: 2.5, // высота прыжка через препятствие
    obstacleMaxTiles: 2, // выше — не прыгает
    maxDropTiles: 4,
  }),
  cyclist: Object.freeze({ // Велосипедист
    health: 30, speed: 140, touchDamage: 20,
    w: 18, h: 20, accel: 250,
    triggerRange: 280, // px по горизонтали — начинает рывок
    triggerHeight: 64, // px по вертикали
    dashDistance: 380, // px — «через весь экран»
    brakeTime: 1, // с торможения (SPEC §6)
    brakeDecel: 400,
  }),
  moto: Object.freeze({ // Мотоциклист
    health: 60, speed: 170, touchDamage: 30,
    w: 22, h: 20, accel: 270,
    triggerRange: 300,
    triggerHeight: 80,
    dashDistance: 440,
    brakeTime: 1,
    brakeDecel: 450,
    rampJumpVelocity: 330, // px/с вверх с трамплина
    jokeChance: 0.5, // шанс шутки Никича про мотоциклистов при рывке
  }),
  yoga: Object.freeze({ // Йога-тётка
    health: 40, speed: 30, touchDamage: 5,
    w: 12, h: 20, accel: 220,
    aggroRange: 140, // px — выходит из позы и идёт к Никичу
    lectureRange: 26, // px — начинает лекцию про чакры
    lectureStun: 1, // с оглушения Никича (SPEC §6)
    lectureTime: 1.2, // с стоит и вещает
    lectureCooldown: 3,
    maxDropTiles: 4,
  }),
  smoothie: Object.freeze({ // Смузи-хипстер
    health: 25, speed: 45, touchDamage: 0, projectileDamage: 10,
    w: 10, h: 22, accel: 350,
    minDistance: 90, // ближе — отходит
    maxDistance: 160, // дальше — подходит
    throwRange: 220,
    throwCooldown: 2,
    projectileGravity: 600,
    flightPerPx: 1 / 180, // с полёта на px расстояния
    minFlight: 0.5,
    maxFlight: 1.1,
    projectileLife: 3,
    maxDropTiles: 4,
  }),
  dummy: Object.freeze({ health: 100, speed: 0, touchDamage: 0, w: 12, h: 22, accel: 0, respawnTime: 2 }), // манекен для тестов
});

export const DROPS = Object.freeze({
  beerZeroChance: 0.1, // SPEC §6: с убитого Зожника выпадает Пиво 0,0
  bonusChance: 0.05, // SPEC §7: «иногда» выпадает Бонус
  bonusKinds: Object.freeze(['hotdog', 'cigarette', 'chip', 'vodka']),
  popVelocity: 140, // px/с вверх — предмет подскакивает из Зожника
});

// Предметы (SPEC §7). jumpHeightMul — множитель высоты прыжка (скорость отрыва — корень из него).
export const ITEMS = Object.freeze({
  size: 12, // px, квадрат подбора
  bobAmp: 2, // px, висящие предметы покачиваются
  bobSpeed: 3, // рад/с
  hotdog: Object.freeze({ heal: 30 }),
  vodka: Object.freeze({ damageMul: 1.25, duration: 8, swayAmp: 2, swaySpeed: 2 }),
  cigarette: Object.freeze({
    time: 15,
    boostTime: 6,
    speedMul: 1.3,
    jumpHeightMul: 1.3,
    shotRateMul: 1.6,
    blurAlpha: 0.42,
    blurStretch: 2.5,
    blurMinSpeed: 60,
    speedLines: 28,
  }),
  chip: Object.freeze({ luckTime: 10, missChance: 0.5, missGrace: 0.6 }),
  beerZero: Object.freeze({
    duration: 5,
    stackTime: 2.5,
    maxStacks: 4,
    speedPerStack: 0.13,
    minSpeedMul: 0.45,
    jumpPerStack: 0.12,
    accelPerStack: 0.8,
    aimLagPerStack: 0.12,
    shotDamagePerStack: 0.15,
    armorPerStack: 0.1,
    swayAmp: 1.2,
    swaySpeed: 1.7,
    blurMixPerStack: 0.16, // доля размытой копии мира поверх кадра за стак (SPEC §13)
    blurMixMax: 0.6,
    blurDownscale: 6, // во сколько раз уменьшена размытая копия
    tiltPerStack: 0.6,
  }),
  scooter: Object.freeze({
    duration: 10,
    speedMul: 2,
    jumpHeightMul: 1.5,
    ramDamage: 30,
    ramCooldown: 0.5, // с, один Зожник не сбивается чаще
    ramKnockX: 220,
    ramKnockY: 160,
    crashMinSpeed: 120, // px/с — удар о стену быстрее этого сбрасывает с Самоката
    crashStun: 1, // с лицом в асфальт
  }),
});

// Улучшения (SPEC §8). Одинаковые Улучшения складываются: множители перемножаются, прибавки суммируются.
export const UPGRADES = Object.freeze({
  choices: 3, // карточек на выбор после Уровня
  salo: Object.freeze({ maxHealth: 10 }),
  heavyHand: Object.freeze({ damageMul: 1.1 }),
  lateForBar: Object.freeze({ speedMul: 1.1 }),
  chainSmoker: Object.freeze({ shotRateMul: 1 / 0.85 }), // перезарядка Щелбана ×0,85
  dadComing: Object.freeze({ superChargeMul: 1.2 }),
  angryDog: Object.freeze({ dogHoldBonus: 1 }), // с
  magnet: Object.freeze({ radius: 80, speed: 180 }), // px, px/с — с какого расстояния и как быстро летят Бонусы
  renter: Object.freeze({ extraScooters: 1, offsetTiles: 3, gapTiles: 2 }), // Самокаты справа от старта
  ironLiver: Object.freeze({ beerTimeMul: 0.5 }),
  fiveZero: Object.freeze({ stunRadiusMul: 1.2 }),
  bouncy: Object.freeze({ airJumps: 1 }),
});

export const LEVEL = Object.freeze({
  time: 180, // с, таймер Уровня (SPEC §9)
  lowTime: 30, // с — таймер краснеет
});

export const SPAWN = Object.freeze({
  maxAlive: 12, // больше Зожников одновременно не бывает (SPEC §18: 60 fps при максимуме)
  edgeOffset: 12, // px за правым краем экрана
  activationMargin: 96, // px вокруг экрана, где оживают двери и точки
  despawnBehind: 480, // px позади экрана — Зожник исчезает
  surfaceSearchTiles: 6, // сколько тайлов вправо искать опору у края экрана
});

export const GMAN = Object.freeze({
  w: 12, h: 24,
  health: 600,
  phaseHealth: 200,
  introDelay: 1.5,
  creatineTime: 1.5,
  respawnGrace: 1.5,
  runSpeed: 90,
  takenMul: 0.6,
  superMul: 0.25,
  briefcase: Object.freeze({
    aimTime: 0.7,
    throwEvery: 0.9,
    throws: 3,
    vanishTime: 0.5,
    damage: 25,
    gravity: 600,
    flightPerPx: 1 / 200,
    minFlight: 0.6,
    maxFlight: 1.2,
    life: 3,
  }),
  summon: Object.freeze({
    firstWave: 0.5,
    waveEvery: 4.5,
    shieldTime: 2.5,
    maxAlive: 8,
    waves: Object.freeze([
      Object.freeze(['runner', 'runner']),
      Object.freeze(['smoothie', 'runner']),
      Object.freeze(['yoga', 'runner', 'runner']),
      Object.freeze(['cyclist', 'smoothie']),
    ]),
    throwEvery: 2.5,
  }),
  mirror: Object.freeze({
    keepDistance: 40,
    shotCooldown: 0.45,
    shotRange: 200,
    shotSpeed: 220,
    shotDamage: 10,
    stunCooldown: 5,
    stunRadius: 60,
    stunTrigger: 0.8,
    stunWindup: 0.45,
    stunTime: 1,
    stunDamage: 5,
    touchDamage: 15,
    jumpRise: 20,
    maxRise: 52,
    jumpAlign: 18,
    jumpCooldown: 0.6,
  }),
  tieTime: 1.2,
  dissolveTime: 1.6,
});

export const PHOTOS = Object.freeze({
  face: Object.freeze({ file: 'portrait-face.png', w: 80, h: 96 }),
  gman: Object.freeze({ file: 'portrait-gman.png', w: 72, h: 96 }),
  happy: Object.freeze({ file: 'portrait-happy.png', w: 90, h: 96 }),
  pkin: Object.freeze({ file: 'portrait-pkin.png', w: 74, h: 96 }),
  poker: Object.freeze({ file: 'portrait-poker.png', w: 80, h: 80 }),
  floor: Object.freeze({ file: 'portrait-floor.png', w: 96, h: 75 }),
  headHappy: Object.freeze({ file: 'face-happy.png', w: 13, h: 18, native: true }),
  headNear: Object.freeze({ file: 'face-near.png', w: 15, h: 18, native: true }),
  headFight: Object.freeze({ file: 'face-fight.png', w: 14, h: 18, native: true }),
  headLaugh: Object.freeze({ file: 'face-laugh.png', w: 15, h: 18, native: true }),
  headTipsy: Object.freeze({ file: 'face-tipsy.png', w: 12, h: 18, native: true }),
  headHurt: Object.freeze({ file: 'face-hurt.png', w: 13.5, h: 18, native: true }),
  headFed: Object.freeze({ file: 'face-fed.png', w: 18, h: 18, native: true }),
  headSmoke: Object.freeze({ file: 'face-smoke.png', w: 12.5, h: 18, native: true }),
  headJump: Object.freeze({ file: 'nikich-jump.png', w: 19, h: 15, native: true }),
  headPout: Object.freeze({ file: 'nikich-pout.png', w: 18.5, h: 18, native: true }),
  gmanHead: Object.freeze({ file: 'gman-head.png', w: 12, h: 18, native: true }),
});

export const FACES = Object.freeze({
  hurtTime: 0.7,
  moodTime: 1,
  shootTime: 0.35,
  jumpMinRise: 40,
  lowHealth: 0.3,
  nearRadius: 72,
});

export const TOAST = Object.freeze({
  time: 1.6,
  fade: 0.3,
});

export const CREDITS = Object.freeze({
  finalDelay: 1.2,
  crawl: Object.freeze({
    introTime: 4.5,
    logoTime: 5,
    speed: 15,
    width: 300,
    episodeSize: 11,
    titleSize: 14,
    bodySize: 10,
    introSize: 9,
    gap: 22,
    horizon: 34,
    depth: 115,
    bottomWidth: 520,
    strip: 1,
    fadeAt: 0.22,
    logoStart: 2.6,
    logoEnd: 0.02,
  }),
});

export const CUTSCENE = Object.freeze({
  charsPerSec: 45,
  minTime: 0.4,
});

export const CONTACT = Object.freeze({
  touchMargin: 1.5,
  minVerticalOverlap: 8,
  hitCooldown: 1.6,
  recoilX: 150,
  recoilY: 120,
  recoilStun: 0.35,
});

export const PROPS = Object.freeze({
  keepAway: 2,
  startGap: 3,
  minGap: 0,
  maxGap: 3,
  retryTiles: 3,
  glowRadius: 18,
});

export const LOCKS = Object.freeze({
  triggerTiles: 3,
  firstDelay: 0.6,
  spawnEvery: 0.45,
  waveGap: 1,
  waveTimeout: 12,
  gateInset: 10,
  gateHeight: 48,
});

export const DEATH = Object.freeze({
  fallTime: 0.35,
  fadeTime: 0.4,
  poofTime: 0.5,
});

export const HIT_FLASH_TIME = 0.1; // с, Зожник мигает от попадания

export const SPEECH = Object.freeze({
  minInterval: 3, // с между репликами над головой (SPEC §12)
  holdTime: 2, // с, сколько реплика висит
});

export const EFFECTS = Object.freeze({
  missTime: 1.1,
  missRise: 16,
  floaterTime: 0.6, // с, всплывающая цифра урона
  floaterRise: 20, // px вверх за время жизни
  stunRingTime: 0.25, // с, кольцо 5:0
  hurtFlashAlpha: 0.75, // мигание при уроне: вторая отрисовка в режиме lighter
});

export const CAMERA = Object.freeze({
  lookAhead: 56, // px упреждения по направлению бега
  lookAheadSpeed: 140, // px/с, как быстро упреждение переезжает
  lookAheadMinVx: 20, // px/с, ниже — направление не меняем
  horizontalSmoothing: 14, // 1/с, чем больше, тем жёстче следует
  verticalSmoothing: 5, // 1/с, вертикаль сглажена мягче
  verticalAnchor: 0.6, // доля высоты экрана, где держим Никича по вертикали
});

export const DEBUG = Object.freeze({
  fpsSmoothing: 0.1,
});

export const VOICE = Object.freeze({
  dir: 'assets/voice/',
  decodeRate: 22050,
  volume: 0.9,
  muteKey: 'nikich-beer:mute',
  nearDistance: 48,
  groups: Object.freeze({
    firstBeer: Object.freeze(['first-beer']),
    beer: Object.freeze(['beer-156']),
    heal: Object.freeze(['two-liters']),
    hurt: Object.freeze(['khokhol-1', 'khokhol-2']),
    dealDamage: Object.freeze(['bury']),
    nearMob: Object.freeze(['ready']),
    waveClear: Object.freeze(['saw-dude']),
  }),
  priority: Object.freeze({ firstBeer: 2, beer: 2, heal: 2, waveClear: 3 }),
  cooldown: Object.freeze({ hurt: 5, dealDamage: 10, nearMob: 15 }),
});
