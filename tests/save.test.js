import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVE_KEY, createSave, emptyStats, addLevelStats, normalizeSave, loadSave, writeSave, clearSave,
} from '../src/save.js';
import { isUpgrade } from '../src/upgrades.js';

// Хранилище с интерфейсом localStorage
function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

// Хранилище, которое падает на всём (приватный режим, квота)
const brokenStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};

const OPTS = { maxLevel: 5, isUpgrade };

test('ключ из SPEC §11', () => {
  assert.equal(SAVE_KEY, 'nikich-beer:save:v1');
});

test('запись и чтение: формат из SPEC §11', () => {
  const st = memoryStorage();
  const save = createSave(3, ['salo', 'heavy-hand'], { kills: 12, shots: 2, deaths: 1, timeMs: 95000 });
  assert.equal(writeSave(st, save), true);
  assert.deepEqual(JSON.parse(st.data.get(SAVE_KEY)), {
    level: 3, upgrades: ['salo', 'heavy-hand'], stats: { kills: 12, shots: 2, deaths: 1, timeMs: 95000 },
  });
  assert.deepEqual(loadSave(st, OPTS), save);
});

test('нет сохранения — null', () => {
  assert.equal(loadSave(memoryStorage(), OPTS), null);
});

test('стирание', () => {
  const st = memoryStorage();
  writeSave(st, createSave(2));
  assert.equal(clearSave(st), true);
  assert.equal(loadSave(st, OPTS), null);
});

test('без хранилища или с падающим хранилищем игра не падает', () => {
  assert.equal(loadSave(null, OPTS), null);
  assert.equal(writeSave(null, createSave()), false);
  assert.equal(clearSave(null), false);
  assert.equal(loadSave(brokenStorage, OPTS), null);
  assert.equal(writeSave(brokenStorage, createSave()), false);
  assert.equal(clearSave(brokenStorage), false);
});

test('битый JSON и чужие данные — null', () => {
  const st = memoryStorage();
  for (const text of ['{не json', 'null', '42', '"строка"', '[]', '{}',
    '{"level":0}', '{"level":6}', '{"level":2.5}', '{"level":"3"}']) {
    st.data.set(SAVE_KEY, text);
    assert.equal(loadSave(st, OPTS), null, text);
  }
});

test('неизвестные Улучшения отбрасываются, кривая статистика обнуляется', () => {
  const st = memoryStorage();
  st.data.set(SAVE_KEY, JSON.stringify({
    level: 2, upgrades: ['salo', 'beer-hat', 7, 'bouncy'], stats: { kills: -3, shots: 'много', deaths: 2.7 },
  }));
  assert.deepEqual(loadSave(st, OPTS), { level: 2, upgrades: ['salo', 'bouncy'], stats: { kills: 0, shots: 0, deaths: 2, timeMs: 0 } });
});

test('сохранение не делит массивы с прохождением', () => {
  const ups = ['salo'];
  const s = createSave(1, ups);
  ups.push('bouncy');
  assert.deepEqual(s.upgrades, ['salo']);
  assert.deepEqual(normalizeSave({ level: 1 }, OPTS), createSave(1));
});

test('статистика Уровня копится в общую, время — в мс', () => {
  let total = emptyStats();
  total = addLevelStats(total, { kills: 5, shots: 1, deaths: 0, time: 61.25 });
  total = addLevelStats(total, { kills: 2, shots: 0, deaths: 3, time: 10 });
  assert.deepEqual(total, { kills: 7, shots: 1, deaths: 3, timeMs: 71250 });
});
