// Уровень 4 — PKiN / Złote Tarasy (SPEC §9). Ступени Дворца культуры, фонари, стеклянная крыша Złotych Tarasów.
// Длинные пролёты, трамплины для Мотоциклиста. Зожники — Велосипедисты, Мотоциклисты и все остальные.

import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 210;
const G = 15;
const FEET = G - 1;
const BOTTOM = MAP_HEIGHT_TILES - 1;

export const THEME = {
  tiles: 'pkin',
  time: 'sunset',
  props: [{ type: 'lampOld', weight: 3 }, { type: 'tree', weight: 2 }, { type: 'bench', weight: 2 }, { type: 'flowers', weight: 2 }, { type: 'love', weight: 1 }, { type: 'syrenka', weight: 1 }, { type: 'bin', weight: 1 }, { type: 'column', weight: 1 }, { type: 'citylight', weight: 2 }, { type: 'shop', weight: 2 }, { type: 'zabka', weight: 1, min: 2 }],
  layers: [
    { factor: 0.1, base: 54, tone: 'far', fill: 'glass',
      landmarks: [{ type: 'varso', at: 0.15, scale: 0.75 }, { type: 'zlota44', at: 0.3, scale: 0.85 }, { type: 'spire', at: 0.88, scale: 0.6 }] },
    { factor: 0.28, base: 38, tone: 'mid', fill: 'socrealist',
      landmarks: [{ type: 'pkin', at: 0.45, scale: 1.15 }] },
    { factor: 0.55, base: 30, tone: 'near', fill: 'lamps',
      landmarks: [{ type: 'tarasy', at: 0.8, scale: 1.2 }] },
  ],
};

export function build(ts) {
  const m = createMap(WIDTH, MAP_HEIGHT_TILES, ts);
  const { SOLID, THIN, EMPTY, BARRIER, DECOR } = TILE;
  const pit = (x0, x1) => m.fill(x0, G, x1, BOTTOM, EMPTY);
  const lamp = (x, top) => { // фонарь: столб-декор и площадка на макушке
    m.fill(x, top + 1, x, FEET, DECOR);
    m.fill(x - 1, top, x + 1, top, THIN);
  };
  const lampInPit = (x, top) => { // фонарь посреди Ямы: столб сплошной до низа
    m.fill(x, top + 1, x, BOTTOM, SOLID);
    m.fill(x - 1, top, x + 1, top, THIN);
  };

  m.fill(0, G, WIDTH - 1, BOTTOM, SOLID);

  // Площадь Defilad: фонари и первый пролёт
  lamp(10, G - 3);
  lamp(16, G - 5);
  pit(22, 25);
  m.ramps = [{ tx: 26, ty: FEET }]; // трамплины справа от Ям: Мотоциклист едет влево

  // Ступени Дворца культуры: вверх и вниз
  for (let i = 0; i < 6; i++) m.fill(30 + i * 2, G - 1 - i, 31 + i * 2, FEET, SOLID);
  m.fill(42, G - 6, 51, FEET, SOLID); // терраса
  m.fill(44, G - 9, 48, G - 9, THIN); // балюстрада
  for (let i = 0; i < 5; i++) m.fill(52 + i * 2, G - 5 + i, 53 + i * 2, FEET, SOLID);

  // Длинный пролёт с фонарями посреди Ямы
  pit(66, 83);
  lampInPit(70, G - 2);
  lampInPit(75, G - 3);
  lampInPit(80, G - 2);

  // Самокат и Барьер; пешком — поверху по фонарям
  m.fill(94, G - 5, 96, FEET, BARRIER);
  lamp(91, G - 3);
  m.fill(93, G - 6, 97, G - 6, THIN); // настил прямо по верху Барьера
  lamp(99, G - 3);
  m.ramps.push({ tx: 110, ty: FEET });
  pit(106, 109);

  // Стеклянная крыша Złotych Tarasów: волна из тонких платформ над Ямой
  m.fill(114, G - 3, 118, FEET, SOLID);
  pit(119, 141);
  m.fill(119, G - 4, 123, G - 4, THIN);
  m.fill(125, G - 6, 129, G - 6, THIN);
  m.fill(131, G - 5, 134, G - 5, THIN);
  m.fill(136, G - 3, 140, G - 3, THIN);
  m.fill(142, G - 3, 145, FEET, SOLID);

  // Рывки по горизонтали: длинная прямая с трамплинами
  m.ramps.push({ tx: 158, ty: FEET });
  pit(154, 157);
  m.ramps.push({ tx: 171, ty: FEET });
  pit(167, 170);

  // Второй Барьер и подъём к выходу
  m.fill(178, G - 5, 179, FEET, BARRIER);
  lamp(176, G - 3);
  m.fill(177, G - 6, 180, G - 6, THIN);
  lamp(182, G - 3);
  for (let i = 0; i < 3; i++) m.fill(188 + i * 2, G - 1 - i, 189 + i * 2, FEET, SOLID);
  m.fill(194, G - 3, WIDTH - 1, FEET, SOLID);

  m.spawn = { x: 3 * ts, y: FEET * ts };
  m.checkpoints = [{ tx: 62, ty: FEET }, { tx: 111, ty: FEET }, { tx: 148, ty: FEET }];
  m.exit = { tx: 202 };

  m.items = [
    { type: 'chip', tx: 16, ty: G - 7 },
    { type: 'hotdog', tx: 46, ty: G - 7 },
    { type: 'chip', tx: 46, ty: G - 11 },
    { type: 'cigarette', tx: 75, ty: G - 5 },
    { type: 'scooter', tx: 88, ty: FEET },
    { type: 'vodka', tx: 95, ty: G - 8 },
    { type: 'beerZero', tx: 112, ty: FEET },
    { type: 'chip', tx: 127, ty: G - 8 },
    { type: 'hotdog', tx: 143, ty: G - 5 },
    { type: 'scooter', tx: 160, ty: FEET },
    { type: 'cigarette', tx: 163, ty: G - 6 },
    { type: 'beerZero', tx: 172, ty: FEET },
    { type: 'chip', tx: 179, ty: G - 8 },
    { type: 'hotdog', tx: 196, ty: G - 5 },
  ];

  m.spawns = [
    { type: 'edge', atTx: 6, kinds: ['cyclist'], interval: 0.5 },
    { type: 'edge', atTx: 14, kinds: ['moto'], interval: 0.5 },
    { type: 'point', tx: 46, ty: G - 10, kind: 'yoga' },
    { type: 'edge', atTx: 40, kinds: ['runner', 'smoothie', 'runner'], interval: 0.8 },
    { type: 'edge', atTx: 86, kinds: ['cyclist', 'runner', 'runner'], interval: 0.8 },
    { type: 'edge', atTx: 100, kinds: ['moto'], interval: 0.5 },
    { type: 'point', tx: 127, ty: G - 7, kind: 'smoothie' },
    { type: 'edge', atTx: 146, kinds: ['moto', 'cyclist'], interval: 1.5 },
    { type: 'door', tx: 162, ty: FEET, kinds: ['runner', 'smoothie', 'runner', 'cyclist'], every: 3, count: 4 },
    { type: 'point', tx: 179, ty: G - 7, kind: 'yoga' },
    { type: 'edge', atTx: 186, kinds: ['cyclist', 'runner', 'smoothie', 'moto'], interval: 0.9 },
  ];
  m.locks = [
    { tx0: 28, tx1: 52, waves: [['runner', 'cyclist'], ['smoothie', 'yoga', 'runner']] },
    { tx0: 180, tx1: 200, waves: [['cyclist', 'runner', 'smoothie'], ['runner', 'yoga', 'runner']] },
  ];
  return m;
}
