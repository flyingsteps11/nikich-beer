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

// Зожники (SPEC §6). На этапе 2 — только манекен для проверки атак.
export const ZOZNIKI = Object.freeze({
  dummy: Object.freeze({ health: 100, w: 12, h: 22, respawnTime: 2 }),
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
