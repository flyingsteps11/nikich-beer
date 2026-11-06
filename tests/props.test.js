import { test } from 'node:test';
import assert from 'node:assert/strict';

import { placeProps, propSize, PROP_TYPES } from '../src/props.js';
import { TILE } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { PROPS, TILE_SIZE } from '../src/config.js';

const TS = TILE_SIZE;

function markers(map) {
  const cols = [Math.floor(map.spawn.x / TS), map.exit.tx];
  for (const s of map.spawns) if (s.type === 'door') cols.push(s.tx);
  for (const c of map.checkpoints) cols.push(c.tx);
  for (const l of map.locks) cols.push(l.tx0, l.tx1 + 1);
  return cols;
}

LEVELS.forEach((level, i) => {
  test(`Декор Уровня ${i + 1}: на земле, с запасом над головой, не мешает игре`, () => {
    const map = level.build(TS);
    const props = placeProps(map, level.theme.props, i + 1);
    if (!level.arena) assert.ok(props.length >= 15, `всего ${props.length}`);
    const spans = [];
    for (const p of props) {
      assert.ok(PROP_TYPES.includes(p.type), p.type);
      const { w, h } = propSize(p.type);
      const tx0 = Math.floor((p.x - w / 2) / TS);
      const tx1 = Math.floor((p.x + w / 2 - 0.01) / TS);
      const row = p.y / TS;
      assert.ok(Number.isInteger(row));
      for (let tx = tx0; tx <= tx1; tx++) {
        assert.equal(map.get(tx, row), TILE.SOLID, `${p.type} в ${tx} — под ногами земля`);
        for (let d = 1; d <= Math.ceil(h / TS); d++) {
          const t = map.get(tx, row - d);
          assert.ok(t === TILE.EMPTY || t === TILE.DECOR || t === TILE.PIT, `${p.type} в ${tx}: над ним свободно`);
        }
        for (const m of markers(map)) assert.ok(Math.abs(tx - m) > PROPS.keepAway - 1, `${p.type} в ${tx} рядом с ${m}`);
      }
      for (const [a, b] of spans) assert.ok(tx1 < a || tx0 > b, `${p.type} в ${tx0} налезает на соседа`);
      spans.push([tx0, tx1]);
    }
  });
});

test('декор расставляется одинаково при каждом запуске', () => {
  const level = LEVELS[0];
  const a = placeProps(level.build(TS), level.theme.props, 1);
  const b = placeProps(level.build(TS), level.theme.props, 1);
  assert.deepEqual(a, b);
});

test('Żabka — минимум две на каждом Уровне 1–4, разнесены по Уровню', () => {
  LEVELS.forEach((level, i) => {
    if (level.arena) return;
    const map = level.build(TS);
    const z = placeProps(map, level.theme.props, i + 1).filter((p) => p.type === 'zabka');
    assert.ok(z.length >= 2, `Уровень ${i + 1}: ${z.length}`);
    assert.ok(Math.abs(z[z.length - 1].x - z[0].x) > map.pixelWidth * 0.3, `Уровень ${i + 1}: слишком близко`);
  });
});
