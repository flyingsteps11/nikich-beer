import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 30;
const G = 15;
const FEET = G - 1;
const SIDE = G - 3;
const TOP = G - 6;

export const THEME = {
  tiles: 'zlota',
  time: 'night',
  props: [{ type: 'neon', weight: 2 }, { type: 'lampOld', weight: 3 }, { type: 'bin', weight: 1 }, { type: 'bench', weight: 1 }, { type: 'shop', weight: 2 }, { type: 'citylight', weight: 1 }, { type: 'zabka', weight: 1, min: 1 }],
  layers: [
    { factor: 0, base: 58, tone: 'far', fill: 'glass',
      landmarks: [{ type: 'pkin', at: 0.28, scale: 0.85 }, { type: 'zlota44', at: 0.62, scale: 0.8 }, { type: 'varso', at: 0.82, scale: 0.6 }] },
    { factor: 0, base: 34, tone: 'mid', fill: 'socrealist',
      landmarks: [{ type: 'neon', at: 0.88, scale: 1 }] },
    { factor: 0, base: 30, tone: 'near', fill: 'lamps' },
  ],
};

export function build(ts) {
  const m = createMap(WIDTH, MAP_HEIGHT_TILES, ts);
  const { SOLID, THIN } = TILE;

  m.fill(0, G, WIDTH - 1, MAP_HEIGHT_TILES - 1, SOLID);

  m.fill(4, SIDE, 9, SIDE, THIN);
  m.fill(20, SIDE, 25, SIDE, THIN);
  m.fill(11, TOP, 18, TOP, THIN);

  m.spawn = { x: 2 * ts, y: FEET * ts };
  m.exit = { tx: 27 };
  m.door = { tx: 27, w: 2 };

  m.items = [
    { type: 'hotdog', tx: 6, ty: SIDE - 2 },
    { type: 'hotdog', tx: 23, ty: SIDE - 2 },
    { type: 'vodka', tx: 15, ty: TOP - 2 },
  ];

  m.arena = {
    perches: [
      { tx: 7, ty: SIDE - 1 },
      { tx: 15, ty: TOP - 1 },
      { tx: 22, ty: SIDE - 1 },
    ],
    start: 1,
    top: 1,
    summon: [
      { tx: 1, ty: FEET },
      { tx: 25, ty: FEET },
      { tx: 5, ty: SIDE - 1 },
      { tx: 24, ty: SIDE - 1 },
    ],
  };
  return m;
}
