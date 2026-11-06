// Порядок Уровней (SPEC §4, §9). Названия — в lines.js (UI.levelNames), по индексу.

import * as level1 from './level1.js';
import * as level2 from './level2.js';
import * as level3 from './level3.js';
import * as level4 from './level4.js';
import * as level5 from './level5.js';

// timed: false — без Таймера Уровня (Уровень 5: только жизни)
export const LEVELS = Object.freeze([
  { build: level1.build, theme: level1.THEME, timed: true },
  { build: level2.build, theme: level2.THEME, timed: true },
  { build: level3.build, theme: level3.THEME, timed: true },
  { build: level4.build, theme: level4.THEME, timed: true },
  { build: level5.build, theme: level5.THEME, timed: false, arena: true },
]);
