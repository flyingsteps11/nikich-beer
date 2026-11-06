import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGman, updateGman, perchPos, phaseName, isFighting, isGone, gmanContactDamage, gmanGrace,
  briefcaseShot, sceneLines, PHASES,
} from '../src/gman.js';
import { damageZoznik, stunZoznik, updateEnemyShots } from '../src/zozniki.js';
import { createBody } from '../src/physics.js';
import { build } from '../src/levels/level5.js';
import { GMAN, PHYSICS, TILE_SIZE, LOOP } from '../src/config.js';
import { GMAN_SCENES, GMAN_VERDICT, LINES } from '../src/lines.js';
import { LEVELS } from '../src/levels/index.js';

const TS = TILE_SIZE;
const DT = LOOP.step;
const GROUND_FEET = 15 * TS;

function arena() {
  return build(TS);
}

function nikichBody(x, feet = GROUND_FEET) {
  const b = createBody(x, feet - 22, 10, 22);
  b.onGround = true;
  return b;
}

function run(g, map, target, seconds, ctx = { alive: 0 }, rng = () => 0) {
  const events = [];
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) events.push(...updateGman(g, DT, map, PHYSICS, target, ctx, GMAN, rng));
  return events;
}

function untilFight(g, map, target) {
  const phase = g.phase + 1;
  const events = [];
  for (let i = 0; i < 600 && !(isFighting(g) && g.phase === phase); i++) {
    events.push(...updateGman(g, DT, map, PHYSICS, target, { alive: 0 }, GMAN, () => 0));
  }
  assert.ok(isFighting(g) && g.phase === phase, `фаза ${phase + 1} началась`);
  return events;
}

function feetOnPerch(g, map) {
  return map.arena.perches.some((p) => {
    const pos = perchPos(map, p);
    return Math.abs(g.body.x - pos.x) < 1 && Math.abs(g.body.y - pos.y) < 1;
  });
}

test('G-man: 600 здоровья, до боя и во время Креатинчика неуязвим', () => {
  const map = arena();
  const g = createGman(map);
  assert.equal(g.health, 600);
  assert.equal(damageZoznik(g, 50).dealt, 0, 'до первой фазы');
  const events = run(g, map, nikichBody(40), GMAN.introDelay + DT * 2);
  assert.ok(events.some((e) => e.type === 'phase' && e.phase === 0));
  assert.ok(events.some((e) => e.type === 'say' && e.key === 'gmanPhase1'));
  assert.equal(g.state, 'creatine');
  assert.equal(damageZoznik(g, 50).dealt, 0, 'Креатинчик');
  run(g, map, nikichBody(40), GMAN.creatineTime);
  assert.ok(isFighting(g));
  assert.equal(damageZoznik(g, 50).dealt, 50 * GMAN.takenMul, 'костюм гасит часть урона');
});

test('у каждой фразы G-man есть текст', () => {
  for (const key of ['gmanPhase1', 'gmanPhase2', 'gmanPhase3', 'gmanSummon', 'gmanStun', 'gmanDefeat', 'victory']) {
    assert.ok(Array.isArray(LINES[key]) && LINES[key].length > 0, key);
  }
});

test('3 фазы по 200: урон не перескакивает границу фазы, каждая начинается с Креатинчика', () => {
  const map = arena();
  const g = createGman(map);
  const t = nikichBody(40);
  untilFight(g, map, t);
  assert.equal(phaseName(g), 'briefcase');
  assert.equal(damageZoznik(g, 500).dealt, 200, 'больше 200 за фазу не снять');
  assert.equal(g.health, 400);
  assert.equal(g.alive, true);
  const ev = untilFight(g, map, t);
  assert.ok(ev.some((e) => e.type === 'phase' && e.phase === 1));
  assert.equal(phaseName(g), 'summon');
  damageZoznik(g, 999);
  assert.equal(g.health, 200);
  untilFight(g, map, t);
  assert.equal(phaseName(g), 'mirror');
  const r = damageZoznik(g, 999);
  assert.equal(r.dealt, 200);
  assert.equal(r.killed, true);
  assert.deepEqual(PHASES, ['briefcase', 'summon', 'mirror']);
});

test('победа: поправляет галстук, растворяется, потом gone', () => {
  const map = arena();
  const g = createGman(map);
  const t = nikichBody(40);
  for (let i = 0; i < 3; i++) {
    untilFight(g, map, t);
    damageZoznik(g, 999);
  }
  const ev = run(g, map, t, DT);
  assert.ok(ev.some((e) => e.type === 'defeated'));
  assert.equal(g.state, 'tie');
  run(g, map, t, GMAN.tieTime);
  assert.equal(g.state, 'dissolve');
  const end = run(g, map, t, GMAN.dissolveTime + DT);
  assert.ok(end.some((e) => e.type === 'gone'));
  assert.ok(isGone(g));
});

test('фаза Портфель: броски дугой, потом телепорт на другую платформу', () => {
  const map = arena();
  const g = createGman(map);
  const t = nikichBody(40);
  untilFight(g, map, t);
  const start = g.perch;
  const B = GMAN.briefcase;
  const ev = run(g, map, t, B.aimTime + (B.throws - 1) * B.throwEvery + B.vanishTime + DT * 3);
  const throws = ev.filter((e) => e.type === 'throw');
  assert.equal(throws.length, B.throws);
  assert.equal(throws[0].shot.kind, 'briefcase');
  assert.ok(ev.some((e) => e.type === 'teleport'));
  assert.notEqual(g.perch, start);
  assert.ok(feetOnPerch(g, map), 'стоит на платформе');
});

test('G-man исчезает неуязвимым, пока телепортируется', () => {
  const map = arena();
  const g = createGman(map);
  const t = nikichBody(40);
  untilFight(g, map, t);
  const B = GMAN.briefcase;
  run(g, map, t, B.aimTime + (B.throws - 1) * B.throwEvery + DT * 2);
  assert.equal(g.act, 'vanish');
  assert.equal(damageZoznik(g, 10).dealt, 0);
});

test('портфель долетает до Никича', () => {
  const map = arena();
  const target = nikichBody(60);
  const shot = briefcaseShot(15 * TS, 8 * TS, target.x + 5, target.y + 11);
  const shots = [shot];
  let hit = false;
  for (let i = 0; i < 200 && shots.length; i++) {
    if (updateEnemyShots(shots, DT, map, target).length) hit = true;
  }
  assert.ok(hit);
});

test('фаза Призыв: стоит на верхней платформе, волны не больше лимита', () => {
  const map = arena();
  const g = createGman(map);
  const t = nikichBody(40);
  untilFight(g, map, t);
  damageZoznik(g, 999);
  untilFight(g, map, t);
  assert.equal(g.perch, map.arena.top);
  const ev = run(g, map, t, GMAN.summon.firstWave + DT, { alive: GMAN.summon.maxAlive - 1 });
  const s = ev.filter((e) => e.type === 'summon');
  assert.equal(s.length, 1);
  assert.equal(s[0].requests.length, 1, 'места только на одного');
  const far = s[0].requests[0];
  assert.ok(far.x > 300, 'появляется подальше от Никича');
  assert.ok(ev.some((e) => e.type === 'say' && e.key === 'gmanSummon'));
  const full = run(g, map, t, GMAN.summon.waveEvery + DT, { alive: GMAN.summon.maxAlive });
  assert.equal(full.filter((e) => e.type === 'summon').length, 0);
  assert.ok(feetOnPerch(g, map));
});

function mirrorGman(map, t) {
  const g = createGman(map);
  untilFight(g, map, t);
  damageZoznik(g, 999);
  untilFight(g, map, t);
  damageZoznik(g, 999);
  untilFight(g, map, t);
  assert.equal(phaseName(g), 'mirror');
  return g;
}

test('фаза Призыв: пока живы призванные Зожники, G-man неуязвим', () => {
  const map = arena();
  const g = createGman(map);
  const t = nikichBody(40);
  untilFight(g, map, t);
  damageZoznik(g, 999);
  untilFight(g, map, t);
  run(g, map, t, DT, { alive: 2 });
  assert.equal(damageZoznik(g, 50).dealt, 0);
  run(g, map, t, DT, { alive: 0 });
  assert.ok(damageZoznik(g, 50).dealt > 0);
});

test('фаза Зеркало: бежит к Никичу и стреляет Щелбаном', () => {
  const map = arena();
  const t = nikichBody(40);
  const g = mirrorGman(map, t);
  const x0 = g.body.x;
  const ev = run(g, map, t, 2);
  assert.ok(g.body.x < x0 - 40, 'бежит влево к Никичу');
  const shots = ev.filter((e) => e.type === 'shot');
  assert.ok(shots.length >= 1);
  assert.equal(shots[0].shot.kind, 'butt');
  assert.ok(shots[0].shot.vx < 0);
});

test('фаза Зеркало: 5:0 с замахом, когда Никич рядом', () => {
  const map = arena();
  const t = nikichBody(40);
  const g = mirrorGman(map, t);
  g.body.x = 60;
  g.body.y = GROUND_FEET - GMAN.h;
  g.cd.stun = 0;
  const first = run(g, map, t, DT);
  assert.ok(first.some((e) => e.type === 'say' && e.key === 'gmanStun'));
  assert.equal(first.some((e) => e.type === 'stun'), false, 'сначала замах');
  const ev = run(g, map, t, GMAN.mirror.stunWindup + DT);
  const stun = ev.find((e) => e.type === 'stun');
  assert.ok(stun);
  assert.equal(stun.radius, GMAN.mirror.stunRadius);
});

test('фаза Зеркало: лезет на платформу следом за Никичем', () => {
  const map = arena();
  const side = perchPos(map, map.arena.perches[0]);
  const t = nikichBody(side.x, side.y + GMAN.h);
  const g = mirrorGman(map, t);
  g.body.x = 200;
  g.body.y = GROUND_FEET - GMAN.h;
  g.cd.stun = 99;
  run(g, map, t, 4);
  assert.ok(g.body.y + g.body.h <= side.y + GMAN.h + 0.5, `ноги на ${g.body.y + g.body.h}`);
});

test('оглушённый G-man не действует; касание опасно только в фазе Зеркало', () => {
  const map = arena();
  const t = nikichBody(40);
  const g = createGman(map);
  untilFight(g, map, t);
  t.x = g.body.x;
  t.y = g.body.y;
  assert.equal(gmanContactDamage(g, t), 0);
  stunZoznik(g, 2);
  const ev = run(g, map, nikichBody(40), 1.5);
  assert.equal(ev.filter((e) => e.type === 'throw').length, 0);
  const m = mirrorGman(map, nikichBody(40));
  const near = nikichBody(m.body.x, m.body.y + m.body.h);
  assert.equal(gmanContactDamage(m, near), GMAN.mirror.touchDamage);
});

test('Собака кусает G-man, но не держит', () => {
  const map = arena();
  const g = createGman(map);
  g.held = 3;
  run(g, map, nikichBody(40), DT);
  assert.equal(g.held, 0);
});

test('после потери жизни Никичем — передышка', () => {
  const map = arena();
  const t = nikichBody(40);
  const g = mirrorGman(map, t);
  gmanGrace(g, map);
  assert.equal(g.perch, map.arena.top);
  assert.ok(g.cd.shot >= GMAN.respawnGrace && g.cd.stun >= GMAN.respawnGrace);
});

test('Заставки: на каждый Уровень 2–4 реплики, вердикт по прошлому Уровню', () => {
  assert.equal(GMAN_SCENES.length, LEVELS.length);
  for (let i = 0; i < LEVELS.length; i++) {
    const first = sceneLines(i, null);
    assert.ok(first.length >= 2 && first.length <= 4, `Уровень ${i + 1}`);
    const after = sceneLines(i, { flawless: false }, () => 0);
    assert.ok(after.length >= 2 && after.length <= 4);
  }
  assert.equal(sceneLines(1, { flawless: true }, () => 0)[0], GMAN_VERDICT.good[0]);
  assert.equal(sceneLines(1, { flawless: false }, () => 0)[0], GMAN_VERDICT.bad[0]);
});

test('Арена: места G-man и точки Призыва на опоре', () => {
  const map = arena();
  const standable = (t) => t === 1 || t === 2;
  for (const p of [...map.arena.perches, ...map.arena.summon]) {
    assert.ok(standable(map.get(p.tx, p.ty + 1)), `${p.tx},${p.ty}`);
    assert.equal(map.spawns.length, 0, 'Зожники только по Призыву');
  }
  assert.equal(map.hints.length, 0);
});
