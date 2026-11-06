// Уровень 2 — Rondo Daszyńskiego (SPEC §9). Строительные леса, бетонные блоки, Ямы стройки, козырьки офисов.
// Первые Ямы. Зожники — Бегуны и Смузи-хипстеры.

import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 180;
const G = 15;
const FEET = G - 1;
const BOTTOM = MAP_HEIGHT_TILES - 1;

export const THEME = {
  sky: ['#457b9d', '#bfe3e8'],
  layers: [
    { factor: 0.12, base: 44, color: '#7d93ad', fill: 'towers',
      landmarks: [{ type: 'varso', at: 0.35, scale: 0.85 }, { type: 'spire', at: 0.6, scale: 0.8 }] },
    { factor: 0.3, base: 36, color: '#566c88', windows: '#d7ecff', fill: 'towers',
      landmarks: [{ type: 'crane', at: 0.2, scale: 0.8 }, { type: 'crane', at: 0.75, scale: 0.7 }] },
    { factor: 0.55, base: 30, color: '#33435a', windows: '#f4d35e', fill: 'lamps' },
  ],
};

export function build(ts) {
  const m = createMap(WIDTH, MAP_HEIGHT_TILES, ts);
  const { SOLID, THIN, EMPTY } = TILE;
  const pit = (x0, x1) => m.fill(x0, G, x1, BOTTOM, EMPTY);
  const block = (x, w, h) => m.fill(x, G - h, x + w - 1, FEET, SOLID); // бетонный блок

  m.fill(0, G, WIDTH - 1, BOTTOM, SOLID);

  // Начало: блоки и первая узкая Яма
  block(10, 2, 2);
  block(16, 2, 3);
  pit(24, 25);
  block(30, 3, 1);
  pit(36, 38);

  // Строительные леса: этажи из тонких платформ над Ямой
  m.fill(44, G - 3, 52, G - 3, THIN);
  m.fill(46, G - 6, 50, G - 6, THIN);
  m.fill(44, G - 9, 48, G - 9, THIN);
  pit(53, 56);
  m.fill(55, G - 3, 58, G - 3, THIN); // настил через Яму

  // Офисы: козырьки и ступени
  block(64, 6, 3);
  m.fill(62, G - 6, 66, G - 6, THIN); // козырёк
  m.fill(70, G - 5, 74, G - 5, THIN);
  pit(76, 79);
  block(80, 4, 2);

  // Яма стройки с кочкой посередине
  pit(88, 96);
  m.fill(91, G - 2, 93, G - 2, THIN);

  // Высокие леса
  block(100, 2, 2);
  m.fill(103, G - 4, 109, G - 4, THIN);
  m.fill(106, G - 7, 112, G - 7, THIN);
  m.fill(109, G - 10, 114, G - 10, THIN);
  pit(110, 113);
  block(115, 3, 3);

  // Бетонные блоки лесенкой и широкие Ямы
  block(122, 2, 1);
  block(124, 2, 2);
  block(126, 2, 3);
  pit(128, 131);
  block(132, 3, 3);
  pit(135, 137);
  block(138, 2, 2);

  // Козырьки офисов над длинной Ямой
  pit(146, 156);
  m.fill(145, G - 3, 148, G - 3, THIN);
  m.fill(150, G - 4, 152, G - 4, THIN);
  m.fill(154, G - 3, 157, G - 3, THIN);

  block(164, 2, 2);

  m.spawn = { x: 3 * ts, y: FEET * ts };
  m.checkpoints = [{ tx: 41, ty: FEET }, { tx: 85, ty: FEET }, { tx: 141, ty: FEET }];
  m.exit = { tx: 172 };

  m.items = [
    { type: 'chip', tx: 17, ty: G - 5 },
    { type: 'hotdog', tx: 31, ty: G - 3 },
    { type: 'chip', tx: 46, ty: G - 11 }, // на верхнем этаже лесов
    { type: 'beerZero', tx: 60, ty: FEET },
    { type: 'cigarette', tx: 64, ty: G - 8 },
    { type: 'vodka', tx: 92, ty: G - 4 },
    { type: 'chip', tx: 112, ty: G - 12 },
    { type: 'hotdog', tx: 119, ty: FEET },
    { type: 'beerZero', tx: 133, ty: G - 5 },
    { type: 'cigarette', tx: 151, ty: G - 6 },
    { type: 'chip', tx: 165, ty: G - 4 },
  ];

  m.spawns = [
    { type: 'edge', atTx: 8, kinds: ['runner', 'runner'], interval: 1 },
    { type: 'edge', atTx: 30, kinds: ['smoothie'], interval: 1 },
    { type: 'point', tx: 48, ty: G - 7, kind: 'smoothie' }, // на лесах
    { type: 'edge', atTx: 60, kinds: ['runner', 'runner', 'smoothie'], interval: 0.9 },
    { type: 'door', tx: 68, ty: G - 4, kinds: ['runner', 'smoothie', 'runner'], every: 3.5, count: 3 },
    { type: 'edge', atTx: 98, kinds: ['runner', 'smoothie', 'runner'], interval: 0.8 },
    { type: 'point', tx: 111, ty: G - 11, kind: 'smoothie' },
    { type: 'edge', atTx: 120, kinds: ['runner', 'runner', 'runner', 'smoothie'], interval: 0.7 },
    { type: 'edge', atTx: 158, kinds: ['smoothie', 'runner', 'smoothie'], interval: 0.8 },
  ];
  return m;
}
