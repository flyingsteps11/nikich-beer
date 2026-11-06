// Уровень 1 — Дом Никича, Stańczyka (SPEC §9). Подъезд, лестница, двор, крыши машин, мусорные баки.
// Обучение: подсказки управления, без Ям. Зожники — только Бегуны.

import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 160;
const G = 15; // верхний ряд земли
const FEET = G - 1; // ряд, в котором стоят ноги на земле

export const THEME = {
  sky: ['#3d2c5e', '#f4a261'],
  layers: [
    { factor: 0.12, base: 40, color: '#6a5a8a', windows: null, fill: 'blocks',
      landmarks: [{ type: 'spire', at: 0.55, scale: 0.45 }, { type: 'varso', at: 0.72, scale: 0.5 }] },
    { factor: 0.3, base: 34, color: '#46396a', windows: '#ffd166', fill: 'blocks' },
    { factor: 0.55, base: 30, color: '#2a2142', fill: 'trees' },
  ],
};

export function build(ts) {
  const m = createMap(WIDTH, MAP_HEIGHT_TILES, ts);
  const { SOLID, THIN, DECOR } = TILE;
  const car = (x) => { // кузов 5×2 и кабина 3×1 — крыша на 3 тайла вверх
    m.fill(x, G - 2, x + 4, G - 1, SOLID);
    m.fill(x + 1, G - 3, x + 3, G - 3, SOLID);
  };
  const bin = (x) => m.fill(x, G - 2, x + 1, G - 1, SOLID); // мусорный бак 2×2

  m.fill(0, G, WIDTH - 1, MAP_HEIGHT_TILES - 1, SOLID);

  // Подъезд Дома Никича
  m.fill(0, 9, 7, 9, SOLID); // козырёк
  m.fill(1, 10, 2, FEET, DECOR); // дверь

  // Лестница во двор
  m.fill(14, FEET, 14, FEET, SOLID);
  m.fill(15, G - 2, 15, FEET, SOLID);
  m.fill(16, G - 3, 24, FEET, SOLID); // площадка
  m.fill(25, G - 2, 25, FEET, SOLID);
  m.fill(26, FEET, 26, FEET, SOLID);

  // Двор: баки и машины
  bin(32);
  bin(40);
  car(47);
  car(55);
  car(64);
  bin(71);

  // Балконы: тонкие платформы, фишка наверху
  m.fill(76, G - 3, 81, G - 3, THIN);
  m.fill(83, G - 6, 87, G - 6, THIN);
  m.fill(89, G - 9, 92, G - 9, THIN);

  // Гаражи
  m.fill(100, G - 3, 108, FEET, SOLID);
  m.fill(103, G - 6, 106, G - 6, THIN);

  // Ещё машины и баки
  car(116);
  bin(124);
  car(130);
  bin(140);
  bin(142);
  m.fill(142, G - 4, 143, G - 3, SOLID); // бак на баке

  // Арка со двора — выход
  m.fill(151, 9, 156, 9, SOLID);
  m.fill(151, 10, 151, FEET, DECOR);
  m.fill(156, 10, 156, FEET, DECOR);

  m.spawn = { x: 4 * ts, y: FEET * ts };
  m.checkpoints = [{ tx: 60, ty: FEET }, { tx: 112, ty: FEET }];
  m.exit = { tx: 153 };

  m.hints = [
    { tx: 6, ty: 8, text: 'hintRun' },
    { tx: 15, ty: 8, text: 'hintJump' },
    { tx: 33, ty: 8, text: 'hintShot' },
    { tx: 79, ty: 7, text: 'hintDrop' },
    { tx: 96, ty: 7, text: 'hintDog' },
    { tx: 113, ty: 7, text: 'hintStun' },
    { tx: 133, ty: 7, text: 'hintSuper' },
  ];

  m.items = [
    { type: 'chip', tx: 20, ty: G - 5 },
    { type: 'hotdog', tx: 44, ty: FEET },
    { type: 'chip', tx: 57, ty: G - 5 },
    { type: 'cigarette', tx: 85, ty: G - 8 },
    { type: 'chip', tx: 90, ty: G - 11 }, // на верхнем балконе
    { type: 'vodka', tx: 104, ty: G - 8 },
    { type: 'hotdog', tx: 127, ty: FEET },
    { type: 'chip', tx: 142, ty: G - 6 },
  ];

  m.spawns = [
    { type: 'edge', atTx: 28, kinds: ['runner'], interval: 1 },
    { type: 'edge', atTx: 45, kinds: ['runner', 'runner'], interval: 1.2 },
    { type: 'edge', atTx: 70, kinds: ['runner', 'runner'], interval: 1 },
    { type: 'door', tx: 96, ty: FEET, kinds: ['runner', 'runner', 'runner'], every: 3, count: 3 },
    { type: 'edge', atTx: 118, kinds: ['runner', 'runner', 'runner'], interval: 0.9 },
    { type: 'edge', atTx: 135, kinds: ['runner', 'runner'], interval: 0.8 },
  ];
  return m;
}
