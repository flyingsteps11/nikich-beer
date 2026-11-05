// Клавиатура и мышь (SPEC §3). Логика состояния чистая, привязка к DOM — в bindInput.
// Клавиши — по e.code, чтобы управление работало и в русской раскладке.

export const MOUSE_LEFT = 'Mouse0';
export const MOUSE_RIGHT = 'Mouse2';

export const BINDINGS = Object.freeze({
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['KeyW', 'Space', 'ArrowUp'],
  drop: ['KeyS', 'ArrowDown'],
  shoot: [MOUSE_LEFT],
  dog: [MOUSE_RIGHT],
  stun: ['KeyE'],
  super: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space', MOUSE_LEFT],
  pick1: ['Digit1', 'Numpad1'],
  pick2: ['Digit2', 'Numpad2'],
  pick3: ['Digit3', 'Numpad3'],
  debug: ['F3', 'Backquote'],
});

export class Input {
  constructor(bindings = BINDINGS) {
    this.bindings = bindings;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
  }

  press(code) {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }

  release(code) {
    if (this.down.has(code)) this.released.add(code);
    this.down.delete(code);
  }

  releaseAll() {
    for (const code of this.down) this.released.add(code);
    this.down.clear();
  }

  setMouse(x, y, inside = true) {
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.inside = inside;
  }

  // Вызывается после каждого шага симуляции: фронты нажатий живут ровно один шаг.
  endStep() {
    this.pressed.clear();
    this.released.clear();
  }

  held(action) {
    return this.bindings[action].some((c) => this.down.has(c));
  }

  wasPressed(action) {
    return this.bindings[action].some((c) => this.pressed.has(c));
  }

  wasReleased(action) {
    return this.bindings[action].some((c) => this.released.has(c));
  }
}

// Намерение движения для физики платформера.
export function readMoveIntent(input) {
  const move = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
  return {
    move,
    jumpPressed: input.wasPressed('jump'),
    jumpHeld: input.held('jump'),
    dropHeld: input.held('drop'),
  };
}

// Перевод координат окна в координаты внутреннего экрана.
export function toScreen(clientX, clientY, rect, screenW, screenH) {
  return {
    x: ((clientX - rect.left) / rect.width) * screenW,
    y: ((clientY - rect.top) / rect.height) * screenH,
  };
}

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3', 'Backquote']);

export function bindInput(input, canvas, screenW, screenH) {
  window.addEventListener('keydown', (e) => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    input.press(e.code);
  });
  window.addEventListener('keyup', (e) => input.release(e.code));
  window.addEventListener('blur', () => input.releaseAll());

  const updateMouse = (e) => {
    const p = toScreen(e.clientX, e.clientY, canvas.getBoundingClientRect(), screenW, screenH);
    const inside = p.x >= 0 && p.y >= 0 && p.x < screenW && p.y < screenH;
    input.setMouse(p.x, p.y, inside);
  };
  window.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    updateMouse(e);
    input.press(`Mouse${e.button}`);
  });
  window.addEventListener('mouseup', (e) => input.release(`Mouse${e.button}`));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mouseleave', () => {
    input.mouse.inside = false;
  });
}
