// Игровые часы и интерполяция отрисовки (SPEC §13, «Производительность»).
// Чистая логика без DOM — тестируется в Node.

// Сколько шагов логики сделать за кадр. Накопитель не растёт больше maxFrame:
// слабый ПК замедляет игру, а не телепортирует героя. alpha — доля до следующего шага.
export function advanceClock(acc, dt, step, maxFrame) {
  let a = acc + Math.min(Math.max(dt, 0), maxFrame);
  let steps = 0;
  while (a >= step) {
    a -= step;
    steps += 1;
  }
  return { steps, acc: a, alpha: a / step };
}

// Позиции с прошлого шага: объект → [x, y]
export function createInterp(snapDistance) {
  return { prev: new WeakMap(), saved: [], snapDistance };
}

// Запомнить позиции перед шагом логики
export function capture(st, objs) {
  for (const o of objs) {
    const p = st.prev.get(o);
    if (p) {
      p[0] = o.x;
      p[1] = o.y;
    } else {
      st.prev.set(o, [o.x, o.y]);
    }
  }
}

// На время отрисовки сдвинуть объекты к позиции между прошлым и текущим шагом.
// Новые объекты и скачки дальше snapDistance (телепорт, возврат на Контрольную точку) — как есть.
export function blend(st, objs, alpha) {
  const s = st.saved;
  s.length = 0;
  if (alpha >= 1) return;
  for (const o of objs) {
    const p = st.prev.get(o);
    if (!p) continue;
    const dx = o.x - p[0];
    const dy = o.y - p[1];
    if (dx === 0 && dy === 0) continue;
    if (Math.abs(dx) > st.snapDistance || Math.abs(dy) > st.snapDistance) continue;
    s.push(o, o.x, o.y);
    o.x = p[0] + dx * alpha;
    o.y = p[1] + dy * alpha;
  }
}

// Вернуть настоящие позиции после отрисовки
export function unblend(st) {
  const s = st.saved;
  for (let i = 0; i < s.length; i += 3) {
    s[i].x = s[i + 1];
    s[i].y = s[i + 2];
  }
  s.length = 0;
}
