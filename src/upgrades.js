// Улучшения (SPEC §8): пул, случайная тройка без повторов, применение к Никичу. Чистая логика, без DOM.
// Тексты карточек — в lines.js (UPGRADE_TEXT), числа — в config.js (UPGRADES).

import { UPGRADES } from './config.js';
import { isBlocking } from './physics.js';

// id — те же, что пишутся в сохранение (SPEC §11)
export const UPGRADE_IDS = Object.freeze([
  'salo', 'heavy-hand', 'late-for-bar', 'chain-smoker', 'dad-coming', 'angry-dog',
  'magnet', 'renter', 'iron-liver', 'five-zero', 'bouncy',
]);

const EFFECTS = Object.freeze({
  'salo': (n, U) => {
    n.maxHealth += U.salo.maxHealth;
    n.health += U.salo.maxHealth;
  },
  'heavy-hand': (n, U) => { n.mods.damageMul *= U.heavyHand.damageMul; },
  'late-for-bar': (n, U) => { n.mods.speedMul *= U.lateForBar.speedMul; },
  'chain-smoker': (n, U) => { n.mods.shotRateMul *= U.chainSmoker.shotRateMul; },
  'dad-coming': (n, U) => { n.mods.superChargeMul *= U.dadComing.superChargeMul; },
  'angry-dog': (n, U) => { n.mods.dogHoldBonus += U.angryDog.dogHoldBonus; },
  'magnet': (n, U) => { n.mods.magnetRadius = Math.max(n.mods.magnetRadius, U.magnet.radius); },
  'renter': (n, U) => { n.mods.extraScooters += U.renter.extraScooters; },
  'iron-liver': (n, U) => { n.mods.beerDamageMul *= U.ironLiver.beerDamageMul; },
  'five-zero': (n, U) => { n.mods.stunRadiusMul *= U.fiveZero.stunRadiusMul; },
  'bouncy': (n, U) => { n.mods.airJumps += U.bouncy.airJumps; },
});

export function isUpgrade(id) {
  return UPGRADE_IDS.includes(id);
}

// count разных id из пула; rng — для тестов. Уже взятые Улучшения снова могут выпасть и сложатся.
export function rollChoices(rng = Math.random, count = UPGRADES.choices, pool = UPGRADE_IDS) {
  const rest = [...pool];
  const out = [];
  while (out.length < count && rest.length > 0) {
    const i = Math.min(rest.length - 1, Math.floor(rng() * rest.length));
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

export function applyUpgrade(n, id, U = UPGRADES) {
  const fx = EFFECTS[id];
  if (!fx) throw new Error(`Неизвестное Улучшение: ${id}`);
  fx(n, U);
}

export function applyUpgrades(n, ids, U = UPGRADES) {
  for (const id of ids) applyUpgrade(n, id, U);
}

// «Прокатчик»: Самокаты висят справа от старта Уровня на высоте ног, в первых свободных тайлах
// (прилавок или стена у старта пропускаются) — { type, tx, ty } как в карте
export function extraScooterDefs(map, count, U = UPGRADES) {
  const ts = map.tileSize;
  const ty = Math.floor(map.spawn.y / ts);
  const defs = [];
  let tx = Math.floor(map.spawn.x / ts) + U.renter.offsetTiles;
  while (defs.length < count && tx < map.width) {
    if (isBlocking(map.get(tx, ty))) { tx += 1; continue; }
    defs.push({ type: 'scooter', tx, ty });
    tx += U.renter.gapTiles;
  }
  return defs;
}
