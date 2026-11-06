import { VOICE } from './config.js';
import { VOICE_LINES } from './lines.js';

export function voiceClips(V = VOICE, lines = VOICE_LINES) {
  return [...new Set([...Object.values(lines), ...Object.values(V.groups).flat()])];
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
  constructor({ V = VOICE, lines = VOICE_LINES, storage = null, rng = Math.random } = {}) {
    this.V = V;
    this.lines = lines;
    this.storage = storage;
    this.rng = rng;
    this.ctx = null;
    this.gain = null;
    this.buffers = new Map();
    this.current = null;
    this.gruntUntil = 0;
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
    for (const name of voiceClips(this.V, this.lines)) {
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

  play(name, { rate = 1, priority = 1 } = {}) {
    if (this.muted || !this.ctx || this.ctx.state === 'closed') return false;
    const buf = this.buffers.get(name);
    if (!buf) return false;
    if (this.current && this.current.priority > priority) return false;
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
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

  line(text, opts = {}) {
    const name = this.lines[text];
    return name ? this.play(name, { priority: this.V.priority.line, ...opts }) : false;
  }

  group(key, { priority = this.V.priority.grunt } = {}) {
    const clips = this.V.groups[key];
    if (!clips || this.rng() >= (this.V.chance[key] ?? 1)) return false;
    return this.play(clips[Math.floor(this.rng() * clips.length)], { priority });
  }

  grunt(key) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (now < this.gruntUntil) return false;
    const played = this.group(key);
    if (played) this.gruntUntil = now + this.V.gruntCooldown;
    return played;
  }

  speak(text, key) {
    return this.line(text) || this.group(key);
  }

  event(key) {
    return this.group(key, { priority: this.V.priority.event });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stop();
    writeMuted(this.storage, this.V.muteKey, this.muted);
    return this.muted;
  }
}
