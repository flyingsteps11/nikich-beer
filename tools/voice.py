import struct
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'raw' / 'voice'
OUT = ROOT / 'assets' / 'voice'

WORK_RATE = 44100
OUT_RATE = 22050
TARGET_RMS_DB = -17
PEAK = 0.89
FADE_IN = 0.008
FADE_OUT = 0.03
HIGHPASS_HZ = 80

SOURCES = {
    'beer-can': 'beer-can.mov',
    'ulica': 'ulica.mov',
    'misha': 'misha.ogg',
}

CLIPS = {
    'first-beer': ('beer-can', 0.10, 3.34, 'Всем привет! Это моя первая банка пива. Безалкогольная.'),
    'two-liters': ('beer-can', 3.80, 7.72, 'Я с утра въебал 2 литра нахуй, это было в 11 утра, блядь.'),
    'beer-156': ('beer-can', 15.08, 16.98, '156 пиво.'),
    'khokhol-1': ('ulica', 1.42, 3.30, 'Меня этот хохел хочет пиздить.'),
    'khokhol-2': ('ulica', 3.86, 7.04, 'Этот хохел меня хочет уничтожить, бля.'),
    'bury': ('ulica', 8.30, 11.62, 'Да мы его закопаем нахуй, ёбаный рот.'),
    'ready': ('ulica', 13.62, 15.86, 'Что ты, готов нахуй на улицу ехать, бля?'),
    'saw-dude': ('misha', 3.08, 6.87, 'Я вчера видел, как, блять, чувака лущили нахуй.'),
}


def read_wav(path):
    data = path.read_bytes()
    pos, rate, channels, pcm = 12, None, None, None
    while pos < len(data) - 8:
        cid, size = data[pos:pos + 4], struct.unpack('<I', data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b'fmt ':
            channels, rate = struct.unpack('<HI', body[2:8])
        elif cid == b'data':
            pcm = body
        pos += 8 + size + (size & 1)
    x = np.frombuffer(pcm, dtype='<i2').astype(np.float64) / 32768
    return x.reshape(-1, channels).mean(axis=1), rate


def write_wav(path, x, rate):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    fmt = struct.pack('<IHHIIHH', 16, 1, 1, rate, rate * 2, 2, 16)
    path.write_bytes(b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ' + fmt + b'data' + struct.pack('<I', len(pcm)) + pcm)


def decode(src, tmp):
    out = tmp / f'{src.stem}.wav'
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEI16@{WORK_RATE}', '-c', '1', str(src), str(out)], check=True)
    return read_wav(out)


def highpass(x, rate, hz):
    rc = 1 / (2 * np.pi * hz)
    a = rc / (rc + 1 / rate)
    y = np.zeros_like(x)
    for i in range(1, len(x)):
        y[i] = a * (y[i - 1] + x[i] - x[i - 1])
    return y


def loudness_db(x, rate):
    hop = int(rate * 0.02)
    frames = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    db = 20 * np.log10(frames + 1e-9)
    active = frames[db > db.max() - 20]
    return 20 * np.log10(np.sqrt(np.mean(active ** 2)) + 1e-9)


def process(x, rate):
    x = highpass(x - x.mean(), rate, HIGHPASS_HZ)
    x = x * 10 ** ((TARGET_RMS_DB - loudness_db(x, rate)) / 20)
    x = np.tanh(x / PEAK) * PEAK
    n_in, n_out = int(rate * FADE_IN), int(rate * FADE_OUT)
    x[:n_in] *= np.linspace(0, 1, n_in)
    x[-n_out:] *= np.linspace(1, 0, n_out) ** 2
    return x


def main(only):
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        sources = {k: decode(RAW / v, tmp) for k, v in SOURCES.items()}
        for name, (src, start, end, text) in CLIPS.items():
            if only and name not in only:
                continue
            x, rate = sources[src]
            clip = process(x[int(start * rate):int(end * rate)].copy(), rate)
            mid = tmp / f'{name}.wav'
            write_wav(mid, clip, rate)
            dst = OUT / f'{name}.wav'
            subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEI16@{OUT_RATE}', '-c', '1', '-q', '127', str(mid), str(dst)], check=True)
            print(f'{name:12s} {end - start:4.2f} с  {text}')


if __name__ == '__main__':
    main(set(sys.argv[1:]))
