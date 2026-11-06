import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

import { Voice, voiceClips } from '../src/audio.js';
import { VOICE } from '../src/config.js';
import { LINES, VOICE_LINES } from '../src/lines.js';

const VOICE_DIR = new URL('../assets/voice/', import.meta.url);

function fakeCtx() {
  const ctx = {
    state: 'running',
    currentTime: 0,
    started: [],
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    createBufferSource: () => {
      const src = {
        buffer: null,
        playbackRate: { value: 1 },
        connect() {},
        disconnect() {},
        start() { ctx.started.push(src); },
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

test('каждая озвученная реплика есть в пулах LINES', () => {
  const all = new Set(Object.values(LINES).flat());
  for (const text of Object.keys(VOICE_LINES)) assert.ok(all.has(text), text);
});

test('все клипы лежат в assets/voice и лишних файлов нет', () => {
  const files = readdirSync(VOICE_DIR).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual(files, voiceClips().sort());
});

test('реплика с клипом звучит, без клипа — запасная группа события', () => {
  const v = readyVoice();
  assert.equal(v.speak('Это пиздец.', 'pit'), true);
  assert.equal(v.current.src.buffer.name, 'pizdec');
  v.current = null;
  assert.equal(v.speak('ПАМАГИТЕ', 'pit'), true);
  assert.equal(v.current.src.buffer.name, VOICE.groups.pit[0]);
  assert.equal(v.speak('5:0!', 'stun'), false);
});

test('междометие не перебивает реплику, реплика перебивает междометие', () => {
  const v = readyVoice();
  v.line('На улицу.');
  assert.equal(v.grunt('hit'), false);
  const v2 = readyVoice();
  v2.grunt('hit');
  const grunt = v2.current.src;
  assert.equal(v2.line('На улицу.'), true);
  assert.equal(grunt.stopped, true);
});

test('междометия не чаще gruntCooldown', () => {
  const v = readyVoice();
  assert.equal(v.grunt('hit'), true);
  v.current = null;
  v.ctx.currentTime = VOICE.gruntCooldown / 2;
  assert.equal(v.grunt('hit'), false);
  v.ctx.currentTime = VOICE.gruntCooldown;
  assert.equal(v.grunt('hit'), true);
});

test('шанс группы: прыжок звучит не всегда', () => {
  const v = readyVoice({ rng: () => 0.99 });
  assert.equal(v.grunt('jump'), false);
});

test('mute глушит и запоминается, сбой хранилища не роняет', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, val) => data.set(k, val) };
  const v = readyVoice({ storage });
  assert.equal(v.toggleMute(), true);
  assert.equal(v.line('На улицу.'), false);
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
  assert.equal(v.speak('Это пиздец.', 'pit'), false);
  assert.equal(v.event('final'), false);
});
