// Уровень 3 — Hala Mirowska (SPEC §9). Прилавки, ящики, тенты, крыша Трамвая.
// Первые Самокаты, Трамвай — движущаяся платформа через провал. Зожники — Йога-тётки, Бегуны, Смузи.

import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 190;
const G = 15;
const FEET = G - 1;
const BOTTOM = MAP_HEIGHT_TILES - 1;

export const THEME = {
  sky: ['#6d597a', '#f28f6b'],
  layers: [
    { factor: 0.12, base: 46, color: '#8a6d88', fill: 'kamienice',
      landmarks: [{ type: 'pkin', at: 0.78, scale: 0.6 }] },
    { factor: 0.3, base: 36, color: '#6a4656', windows: '#ffcf70', fill: 'kamienice',
      landmarks: [{ type: 'hala', at: 0.3, scale: 1 }, { type: 'hala', at: 0.62, scale: 0.9 }] },
    { factor: 0.55, base: 30, color: '#3d2835', fill: 'trees' },
  ],
};

export function build(ts) {
  const m = createMap(WIDTH, MAP_HEIGHT_TILES, ts);
  const { SOLID, THIN, EMPTY, BARRIER } = TILE;
  const pit = (x0, x1) => m.fill(x0, G, x1, BOTTOM, EMPTY);
  const stall = (x, w) => { // прилавок 2 в высоту и тент над ним
    m.fill(x, G - 2, x + w - 1, FEET, SOLID);
    m.fill(x - 1, G - 5, x + w, G - 5, THIN);
  };
  const crates = (x, h) => m.fill(x, G - h, x + 1, FEET, SOLID);

  m.fill(0, G, WIDTH - 1, BOTTOM, SOLID);

  // Рынок у входа
  stall(8, 4);
  crates(16, 1);
  crates(18, 2);
  stall(24, 5);
  pit(32, 34);
  stall(38, 3);
  m.fill(36, G - 8, 40, G - 8, THIN); // тент повыше — Йога-тётка в позе

  // Самокат и Барьер: на Самокате — напрямик, пешком — поверху по тентам
  crates(48, 2);
  m.fill(54, G - 5, 57, FEET, BARRIER);
  m.fill(50, G - 4, 53, G - 4, THIN);
  m.fill(53, G - 7, 58, G - 7, THIN);
  m.fill(59, G - 4, 62, G - 4, THIN);
  pit(64, 67);
  stall(70, 4);

  // Трамвай: провал, через который возит крыша Трамвая
  m.fill(78, G - 2, 78, FEET, SOLID);
  m.fill(79, G - 4, 83, FEET, SOLID); // платформа остановки слева
  pit(84, 97);
  m.fill(98, G - 4, 102, FEET, SOLID); // остановка справа
  m.fill(103, G - 2, 103, FEET, SOLID);
  m.movers = [{ tx0: 84, tx1: 92, ty: G - 4, w: 6, h: 3, speed: 40, pause: 1 }];

  // Ящики и тенты
  crates(110, 3);
  crates(112, 1);
  stall(118, 4);
  m.fill(124, G - 8, 128, G - 8, THIN);
  pit(126, 129);
  stall(132, 3);

  // Второй Самокат перед вторым Барьером
  m.fill(144, G - 5, 146, FEET, BARRIER);
  m.fill(140, G - 4, 143, G - 4, THIN);
  m.fill(143, G - 7, 147, G - 7, THIN);
  m.fill(148, G - 4, 151, G - 4, THIN);
  pit(150, 153);

  stall(158, 4);
  crates(166, 2);
  crates(168, 3);
  stall(174, 3);

  m.spawn = { x: 3 * ts, y: FEET * ts };
  m.checkpoints = [{ tx: 44, ty: FEET }, { tx: 106, ty: FEET }, { tx: 155, ty: FEET }];
  m.exit = { tx: 183 };

  m.items = [
    { type: 'hotdog', tx: 10, ty: G - 7 },
    { type: 'chip', tx: 38, ty: G - 10 },
    { type: 'scooter', tx: 46, ty: FEET },
    { type: 'cigarette', tx: 56, ty: G - 9 },
    { type: 'beerZero', tx: 72, ty: G - 3 },
    { type: 'chip', tx: 90, ty: G - 9 }, // над Трамваем
    { type: 'vodka', tx: 113, ty: G - 3 },
    { type: 'chip', tx: 126, ty: G - 10 },
    { type: 'hotdog', tx: 136, ty: FEET },
    { type: 'scooter', tx: 138, ty: FEET },
    { type: 'cigarette', tx: 145, ty: G - 9 },
    { type: 'beerZero', tx: 164, ty: FEET },
    { type: 'chip', tx: 169, ty: G - 5 },
  ];

  m.spawns = [
    { type: 'edge', atTx: 6, kinds: ['runner', 'runner'], interval: 1 },
    { type: 'point', tx: 38, ty: G - 9, kind: 'yoga' },
    { type: 'edge', atTx: 30, kinds: ['smoothie', 'runner'], interval: 1 },
    { type: 'door', tx: 74, ty: FEET, kinds: ['runner', 'smoothie', 'runner'], every: 3, count: 3 },
    { type: 'point', tx: 100, ty: G - 5, kind: 'yoga' },
    { type: 'edge', atTx: 106, kinds: ['runner', 'smoothie', 'runner'], interval: 0.8 },
    { type: 'point', tx: 126, ty: G - 9, kind: 'yoga' },
    { type: 'edge', atTx: 135, kinds: ['runner', 'runner', 'smoothie'], interval: 0.8 },
    { type: 'point', tx: 160, ty: G - 6, kind: 'yoga' },
    { type: 'edge', atTx: 160, kinds: ['smoothie', 'runner', 'runner', 'smoothie'], interval: 0.7 },
  ];
  m.locks = [
    { tx0: 8, tx1: 31, waves: [['runner', 'yoga', 'runner'], ['smoothie', 'runner', 'runner']] },
    { tx0: 107, tx1: 125, waves: [['yoga', 'runner', 'smoothie'], ['runner', 'runner', 'yoga', 'smoothie']] },
    { tx0: 157, tx1: 180, waves: [['runner', 'smoothie', 'runner'], ['yoga', 'runner', 'smoothie', 'runner'], ['runner', 'runner', 'runner', 'smoothie']] },
  ];
  return m;
}
