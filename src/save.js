// Сохранение (SPEC §11). Хранилище передаётся параметром (в игре — localStorage), поэтому тестируется в Node.
// Любая ошибка хранилища глотается: без него игра идёт, просто не продолжает.

export const SAVE_KEY = 'nikich-beer:save:v1';

export function emptyStats() {
  return { kills: 0, shots: 0, deaths: 0, timeMs: 0 };
}

// level — номер Уровня (с 1), с которого продолжать
export function createSave(level = 1, upgrades = [], stats = emptyStats()) {
  return { level, upgrades: [...upgrades], stats: { ...stats } };
}

// Статистика Уровня (time в секундах) добавляется к общей
export function addLevelStats(total, level) {
  return {
    kills: total.kills + level.kills,
    shots: total.shots + level.shots,
    deaths: total.deaths + level.deaths,
    timeMs: total.timeMs + Math.round(level.time * 1000),
  };
}

const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

// Проверка прочитанного: битое — null, неизвестные Улучшения отбрасываются
export function normalizeSave(raw, { maxLevel = Infinity, isUpgrade = () => true } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const { level } = raw;
  if (!Number.isInteger(level) || level < 1 || level > maxLevel) return null;
  const upgrades = Array.isArray(raw.upgrades) ? raw.upgrades.filter((id) => typeof id === 'string' && isUpgrade(id)) : [];
  const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  return createSave(level, upgrades, {
    kills: count(st.kills), shots: count(st.shots), deaths: count(st.deaths), timeMs: count(st.timeMs),
  });
}

export function loadSave(storage, opts) {
  if (!storage) return null;
  try {
    const text = storage.getItem(SAVE_KEY);
    if (text == null) return null;
    return normalizeSave(JSON.parse(text), opts);
  } catch {
    return null;
  }
}

export function writeSave(storage, save) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
