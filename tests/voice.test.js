import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

import { Voice, voiceClips } from '../src/audio.js';
import { VOICE } from '../src/config.js';

const VOICE_DIR = new URL('../assets/voice/', import.meta.url);

function fakeCtx() {
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    createBufferSource: () => {
      const src = {
        buffer: null,
        connect() {},
        disconnect() {},
        start() {},
        stop() { src.stopped = true; },
      };
      return src;
    },
  };
  return ctx;
}

function readyVoice(opts = {}) {
  const v = new Voice({ rng: () => 0, ...opts });
  v.ctx = fakeCtx();
  v.gain = v.ctx.createGain();
  for (const name of voiceClips()) v.buffers.set(name, { name });
  return v;
}

const playing = (v) => v.current && v.current.src.buffer.name;

test('все клипы лежат в assets/voice и лишних файлов нет', () => {
  const files = readdirSync(VOICE_DIR).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual(files, voiceClips().sort());
});

test('у каждого приоритета и кулдауна есть группа', () => {
  for (const key of [...Object.keys(VOICE.priority), ...Object.keys(VOICE.cooldown)]) assert.ok(VOICE.groups[key], key);
});

test('событие играет свой клип', () => {
  const v = readyVoice();
  assert.equal(v.group('firstBeer'), true);
  assert.equal(playing(v), 'first-beer');
  assert.equal(v.group('nope'), false);
});

test('реплика не перебивает равную, но уступает важной', () => {
  const v = readyVoice();
  v.group('hurt');
  assert.equal(v.group('dealDamage'), false);
  assert.equal(playing(v), 'khokhol-1');
  const first = v.current.src;
  assert.equal(v.group('waveClear'), true);
  assert.equal(first.stopped, true);
  assert.equal(v.group('beer'), false);
});

test('кулдаун группы', () => {
  const v = readyVoice();
  assert.equal(v.group('hurt'), true);
  v.current = null;
  v.ctx.currentTime = VOICE.cooldown.hurt / 2;
  assert.equal(v.group('hurt'), false);
  v.ctx.currentTime = VOICE.cooldown.hurt;
  assert.equal(v.group('hurt'), true);
});

test('mute глушит и запоминается, сбой хранилища не роняет', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, val) => data.set(k, val) };
  const v = readyVoice({ storage });
  assert.equal(v.toggleMute(), true);
  assert.equal(v.group('heal'), false);
  assert.equal(new Voice({ storage }).muted, true);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const vb = new Voice({ storage: broken });
  assert.equal(vb.muted, false);
  assert.equal(vb.toggleMute(), true);
});

test('без AudioContext и загрузки — тишина без ошибок', () => {
  const v = new Voice();
  v.unlock();
  v.load();
  assert.equal(v.group('heal'), false);
});
