import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Input, readMoveIntent, toScreen, MOUSE_LEFT } from '../src/input.js';

test('нажатие даёт фронт ровно на один шаг', () => {
  const input = new Input();
  input.press('KeyW');
  assert.equal(input.wasPressed('jump'), true);
  assert.equal(input.held('jump'), true);
  input.endStep();
  assert.equal(input.wasPressed('jump'), false);
  assert.equal(input.held('jump'), true);
});

test('автоповтор клавиши не даёт нового фронта', () => {
  const input = new Input();
  input.press('Space');
  input.endStep();
  input.press('Space');
  assert.equal(input.wasPressed('jump'), false);
});

test('отпускание даёт фронт released', () => {
  const input = new Input();
  input.press('KeyA');
  input.endStep();
  input.release('KeyA');
  assert.equal(input.wasReleased('left'), true);
  assert.equal(input.held('left'), false);
});

test('потеря фокуса отпускает всё', () => {
  const input = new Input();
  input.press('KeyD');
  input.press(MOUSE_LEFT);
  input.releaseAll();
  assert.equal(input.held('right'), false);
  assert.equal(input.held('shoot'), false);
});

test('намерение движения: A и D вместе гасят друг друга', () => {
  const input = new Input();
  input.press('KeyA');
  assert.equal(readMoveIntent(input).move, -1);
  input.press('KeyD');
  assert.equal(readMoveIntent(input).move, 0);
  input.release('KeyA');
  assert.equal(readMoveIntent(input).move, 1);
});

test('намерение прыжка и спрыгивания', () => {
  const input = new Input();
  input.press('Space');
  input.press('KeyS');
  const i = readMoveIntent(input);
  assert.equal(i.jumpPressed, true);
  assert.equal(i.jumpHeld, true);
  assert.equal(i.dropHeld, true);
});

test('координаты мыши переводятся в экран 480×270 при любом масштабе', () => {
  const rect = { left: 100, top: 50, width: 1440, height: 810 };
  assert.deepEqual(toScreen(100, 50, rect, 480, 270), { x: 0, y: 0 });
  assert.deepEqual(toScreen(820, 455, rect, 480, 270), { x: 240, y: 135 });
});
