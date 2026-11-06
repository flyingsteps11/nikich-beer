import { VOICE } from './config.js';

export function voiceClips(V = VOICE) {
  return [...new Set(Object.values(V.groups).flat())];
}

function readMuted(storage, key) {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeMuted(storage, key, muted) {
  try {
    storage?.setItem(key, muted ? '1' : '0');
  } catch {
    return;
  }
}

export class Voice {
  constructor({ V = VOICE, storage = null, rng = Math.random } = {}) {
    this.V = V;
    this.storage = storage;
    this.rng = rng;
    this.ctx = null;
    this.gain = null;
    this.buffers = new Map();
    this.current = null;
    this.readyAt = {};
    this.quietUntil = 0;
    this.muted = readMuted(storage, V.muteKey);
  }

  load(fetchFn = globalThis.fetch) {
    const Offline = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
    if (!fetchFn || !Offline) return;
    let decoder;
    try {
      decoder = new Offline(1, 1, this.V.decodeRate);
    } catch {
      return;
    }
    for (const name of voiceClips(this.V)) {
      fetchFn(`${this.V.dir}${name}.wav`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
        .then((data) => decoder.decodeAudioData(data))
        .then((buf) => this.buffers.set(name, buf))
        .catch(() => {});
    }
  }

  unlock() {
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      try {
        this.ctx = new Ctx();
      } catch {
        return;
      }
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.V.volume;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  play(name, priority = 1) {
    if (this.muted || !this.ctx || this.ctx.state === 'closed') return false;
    const buf = this.buffers.get(name);
    if (!buf) return false;
    if (this.current && this.current.priority >= priority) return false;
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    const cur = { src, priority };
    src.onended = () => {
      if (this.current === cur) this.current = null;
    };
    src.start();
    this.current = cur;
    return true;
  }

  stop() {
    const cur = this.current;
    this.current = null;
    if (!cur) return;
    try {
      cur.src.stop();
    } catch {
      cur.src.disconnect();
    }
  }

  group(key) {
    const clips = this.V.groups[key];
    const now = this.now();
    if (!clips || now < (this.readyAt[key] ?? 0)) return false;
    if (now < this.quietUntil && !this.V.ignoreGap.includes(key)) return false;
    const name = clips[Math.floor(this.rng() * clips.length)];
    const played = this.play(name, this.V.priority[key] ?? 1);
    if (played) {
      this.readyAt[key] = now + (this.V.cooldown[key] ?? 0);
      // Общая пауза голоса — от конца фразы
      this.quietUntil = now + (this.buffers.get(name).duration ?? 0) + this.V.gap;
    }
    return played;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stop();
    writeMuted(this.storage, this.V.muteKey, this.muted);
    return this.muted;
  }
}
