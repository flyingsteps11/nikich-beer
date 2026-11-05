// Тестовая карта движка (этап 1): все типы тайлов, Ямы, потолок, лестницы.
// В игру не входит — Уровни 1–5 появятся на этапе 5.

import { TILE } from '../physics.js';
import { createMap } from '../world.js';
import { MAP_HEIGHT_TILES } from '../config.js';

const WIDTH = 140;
const GROUND = 15; // верхний ряд земли

export function buildTestMap(tileSize) {
  const m = createMap(WIDTH, MAP_HEIGHT_TILES, tileSize);
  const { SOLID, THIN, BARRIER, EMPTY, DECOR } = TILE;

  m.fill(0, GROUND, WIDTH - 1, MAP_HEIGHT_TILES - 1, SOLID);

  // Старт: ящики-ступеньки
  m.fill(10, 13, 11, 14, SOLID);
  m.fill(12, 11, 13, 14, SOLID);

  // Тонкие платформы лесенкой
  m.fill(17, 10, 22, 10, THIN);
  m.fill(24, 7, 28, 7, THIN);
  m.fill(30, 10, 33, 10, THIN);

  // Первая Яма, 3 тайла
  m.fill(35, GROUND, 37, MAP_HEIGHT_TILES - 1, EMPTY);

  // Низкий потолок: тоннель высотой 3 тайла
  m.fill(44, 11, 52, 11, SOLID);

  // Высокая колонна и тонкие ступени к ней
  m.fill(54, 12, 56, 12, THIN);
  m.fill(55, 9, 57, 9, THIN);
  m.fill(58, 8, 59, 14, SOLID);

  // Площадка с этажами
  m.fill(64, 11, 68, 11, THIN);
  m.fill(70, 8, 74, 8, THIN);
  m.fill(66, 5, 67, 5, SOLID);

  // Широкая Яма с кочкой посередине
  m.fill(78, GROUND, 83, MAP_HEIGHT_TILES - 1, EMPTY);
  m.fill(80, 12, 81, 12, THIN);

  // Лестница из блоков и плато
  m.fill(88, 14, 88, 14, SOLID);
  m.fill(89, 13, 89, 14, SOLID);
  m.fill(90, 12, 90, 14, SOLID);
  m.fill(91, 11, 96, 14, SOLID);

  // Барьер (на Самокате пролетается; здесь можно перепрыгнуть с ящика)
  m.fill(101, 12, 102, 14, SOLID);
  m.fill(104, 10, 104, 14, BARRIER);

  // Третья Яма
  m.fill(112, GROUND, 114, MAP_HEIGHT_TILES - 1, EMPTY);

  // Выход: «дверь» как декор
  m.fill(134, 11, 136, 14, DECOR);

  m.spawn = { x: 3 * tileSize, y: (GROUND - 1) * tileSize };
  return m;
}
