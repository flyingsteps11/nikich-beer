// Уровень 5 — Złota 63A, U Sióstr (SPEC §9, §10). Арена в один экран: улица у бара, 3 платформы.
// Без таймера. Бой с G-man — этап 7; до тех пор дверь бара открыта и служит выходом.

import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 30; // 480 px — ровно экран
const G = 15;
const FEET = G - 1;

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
  const { SOLID, THIN, DECOR } = TILE;

  m.fill(0, G, WIDTH - 1, MAP_HEIGHT_TILES - 1, SOLID);

  // 3 платформы: две по бокам и верхняя посередине
  m.fill(4, G - 4, 9, G - 4, THIN);
  m.fill(20, G - 4, 25, G - 4, THIN);
  m.fill(11, G - 8, 18, G - 8, THIN);

  // Дверь U Sióstr у правого края
  m.fill(26, 9, 29, 9, DECOR); // вывеска — не мешает прыгать
  m.fill(27, 10, 28, FEET, DECOR);

  m.spawn = { x: 2 * ts, y: FEET * ts };
  m.exit = { tx: 27 };
  m.hints = [{ tx: 15, ty: 4, text: 'bossLater' }]; // уберётся с боем G-man (этап 7)

  m.items = [
    { type: 'hotdog', tx: 6, ty: G - 6 },
    { type: 'hotdog', tx: 23, ty: G - 6 },
    { type: 'chip', tx: 15, ty: G - 10 },
  ];

  // Пока G-man нет — немного Зожников «по его призыву» из точек на платформах
  m.spawns = [
    { type: 'point', tx: 22, ty: G - 5, kind: 'smoothie' },
    { type: 'point', tx: 14, ty: G - 9, kind: 'yoga' },
    { type: 'door', tx: 24, ty: FEET, kinds: ['runner', 'runner', 'cyclist'], every: 3, count: 3 },
  ];
  return m;
}
