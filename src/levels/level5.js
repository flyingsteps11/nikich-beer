import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 30;
const G = 15;
const FEET = G - 1;
const SIDE = G - 3;
const TOP = G - 6;

export const THEME = {
  sky: ['#0b0c1e', '#3a2d5c'],
  layers: [
    { factor: 0, base: 56, color: '#2b2650', windows: '#ffe8a3', fill: 'towers',
      landmarks: [{ type: 'pkin', at: 0.3, scale: 0.85 }, { type: 'varso', at: 0.8, scale: 0.6 }] },
    { factor: 0, base: 32, color: '#1c1838', windows: '#ffd166', fill: 'kamienice' },
    { factor: 0, base: 30, color: '#120f26', windows: '#ffe8a3', fill: 'lamps' },
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
