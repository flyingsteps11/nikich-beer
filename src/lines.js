// Все тексты игры (SPEC §12). Заказчик правит тексты здесь, логику не трогая.

export const UI = Object.freeze({
  title: 'Никич: Путь к Пиву',
  start: 'Клик или Пробел — начать',
  paused: 'Пауза',
  resume: 'Esc — продолжить',
  testMap: 'Тестовая карта · манекены',
  controlsHint: 'A/D бег · W прыжок · S вниз · ЛКМ Щелбан · ПКМ Собака · E 5:0 · R Папа · Esc пауза',
  lives: 'Жизни',
  abilityShot: 'Щелбан',
  abilityDog: 'Собака',
  abilityStun: '5:0',
  abilitySuper: 'Папа',
  keyShot: 'ЛКМ',
  keyDog: 'ПКМ',
  keyStun: 'E',
  keySuper: 'R',
});

export const LINES = Object.freeze({
  pit: ['ПАМАГИТЕ'],
  stun: ['5:0!'],
  super: ['Папа сейчас всё сделает'],
  kill: ['Легендарная игра', 'Дал бы под хвост'],
});
