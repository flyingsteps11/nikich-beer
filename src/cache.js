// Кэши отрисовки (SPEC §13, фаза 2). Чистая логика без DOM — тестируется в Node.

// Кэш на max записей: при переполнении вытесняется та, что дольше всех не использовалась
// (попадание — только метка времени: дёшево в каждом кадре; поиск старой — лишь при вытеснении)
export function createLru(max) {
  const map = new Map();
  let tick = 0;
  return {
    get(key) {
      const e = map.get(key);
      if (e === undefined) return undefined;
      e.t = ++tick;
      return e.v;
    },
    set(key, value) {
      map.set(key, { v: value, t: ++tick });
      while (map.size > max) {
        let oldKey;
        let oldT = Infinity;
        for (const [k, e] of map) {
          if (e.t < oldT) {
            oldT = e.t;
            oldKey = k;
          }
        }
        map.delete(oldKey);
      }
    },
    get size() {
      return map.size;
    },
    clear() {
      map.clear();
    },
  };
}

// Картинка строки: высота и точка привязки в ней (логические px).
// Глифы для любой базовой линии помещаются в 1,7 размера шрифта.
const BASE_Y = Object.freeze({ top: 0.15, hanging: 0.15, middle: 0.85, alphabetic: 1.25, ideographic: 1.25, bottom: 1.6 });

export function textBox(width, size, pad, align, base) {
  const h = size * 1.7 + pad * 2;
  const ay = pad + size * (BASE_Y[base] ?? BASE_Y.alphabetic);
  let ax = pad;
  if (align === 'center') ax += width / 2;
  else if (align === 'right' || align === 'end') ax += width;
  return { w: width + pad * 2, h, ax, ay };
}

// Округление к шагу: фаза шага Зожника — до RENDER_CACHE.gaitFrames кадров на цикл
export function quantize(v, step) {
  return Math.round(v / step) * step;
}

// Ключ позы: все поля, числа округлены — близкие позы делят один кадр
export function poseKey(pose, digits = 2) {
  const f = 10 ** digits;
  const walk = (v) => {
    if (typeof v === 'number') return String(Math.round(v * f) / f);
    if (Array.isArray(v)) return `[${v.map(walk).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${k}:${walk(v[k])}`).join(',')}}`;
    return String(v);
  };
  return walk(pose);
}

// Какие куски тайлов (по chunk тайлов в ширину) попадают в кадр
export function chunkRange(camX, viewW, tileSize, chunk, mapWidth) {
  const span = tileSize * chunk;
  const last = Math.max(0, Math.ceil(mapWidth / chunk) - 1);
  const c0 = Math.min(last, Math.max(0, Math.floor(camX / span)));
  const c1 = Math.max(c0, Math.min(last, Math.floor((camX + viewW) / span)));
  return [c0, c1];
}
