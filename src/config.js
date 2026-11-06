// Все числа баланса и экрана — только здесь (SPEC §15).

export const SCREEN = Object.freeze({
  width: 480,
  height: 270,
});

export const LOOP = Object.freeze({
  step: 1 / 60, // фиксированный шаг симуляции, с (тот же шаг — в поправке прыжка ниже)
  maxFrame: 0.25, // больше этого за кадр не догоняем (вкладка спала)
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
    health: 20, speed: 100, touchDamage: 10,
    w: 10, h: 22, accel: 900,
    jumpTiles: 2.5, // высота прыжка через препятствие
    obstacleMaxTiles: 2, // выше — не прыгает
  }),
  cyclist: Object.freeze({ // Велосипедист
    health: 30, speed: 200, touchDamage: 20,
    w: 18, h: 20, accel: 350,
    triggerRange: 280, // px по горизонтали — начинает рывок
    triggerHeight: 64, // px по вертикали
    dashDistance: 380, // px — «через весь экран»
    brakeTime: 1, // с торможения (SPEC §6)
    brakeDecel: 400,
  }),
  moto: Object.freeze({ // Мотоциклист
    health: 60, speed: 240, touchDamage: 30,
    w: 22, h: 20, accel: 380,
    triggerRange: 300,
    triggerHeight: 80,
    dashDistance: 440,
    brakeTime: 1,
    brakeDecel: 450,
    rampJumpVelocity: 330, // px/с вверх с трамплина
    jokeChance: 0.5, // шанс шутки Никича про мотоциклистов при рывке
  }),
  yoga: Object.freeze({ // Йога-тётка
    health: 40, speed: 40, touchDamage: 5,
    w: 12, h: 20, accel: 300,
    aggroRange: 140, // px — выходит из позы и идёт к Никичу
    lectureRange: 26, // px — начинает лекцию про чакры
    lectureStun: 1, // с оглушения Никича (SPEC §6)
    lectureTime: 1.2, // с стоит и вещает
    lectureCooldown: 3,
  }),
  smoothie: Object.freeze({ // Смузи-хипстер
    health: 25, speed: 60, touchDamage: 0, projectileDamage: 10,
    w: 10, h: 22, accel: 500,
    minDistance: 90, // ближе — отходит
    maxDistance: 160, // дальше — подходит
    throwRange: 220,
    throwCooldown: 2,
    projectileGravity: 600,
    flightPerPx: 1 / 180, // с полёта на px расстояния
    minFlight: 0.5,
    maxFlight: 1.1,
    projectileLife: 3,
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
  cigarette: Object.freeze({ time: 15 }),
  chip: Object.freeze({ score: 100 }),
  beerZero: Object.freeze({ damage: 15, duration: 4, speedMul: 0.6, jumpHeightMul: 0.6 }),
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
  ironLiver: Object.freeze({ beerDamageMul: 0.5 }),
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

export const HIT_FLASH_TIME = 0.1; // с, Зожник мигает от попадания

export const SPEECH = Object.freeze({
  minInterval: 3, // с между репликами над головой (SPEC §12)
  holdTime: 2, // с, сколько реплика висит
});

export const EFFECTS = Object.freeze({
  floaterTime: 0.6, // с, всплывающая цифра урона
  floaterRise: 20, // px вверх за время жизни
  stunRingTime: 0.25, // с, кольцо 5:0
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
