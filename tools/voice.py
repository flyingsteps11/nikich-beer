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
    'hello': ('beer-can', 0.12, 0.70, 'Всем привет!'),
    'first-can': ('beer-can', 0.72, 2.30, 'Это моя первая банка пива.'),
    'bezalko': ('beer-can', 2.36, 3.30, 'Безалкогольная.'),
    'two-liters': ('beer-can', 3.80, 6.04, 'Я с утра въебал 2 литра нахуй'),
    'eleven-am': ('beer-can', 6.04, 8.45, 'Это было в 11 утра, блядь. Реально.'),
    'beer-156': ('beer-can', 15.15, 16.95, '156 пиво.'),
    'bury': ('ulica', 8.28, 11.62, 'Да мы его закопаем нахуй, ёбаный рот.'),
    'ready': ('ulica', 13.62, 15.80, 'Что ты, готов нахуй на улицу ехать, бля?'),
    'street': ('ulica', 16.70, 17.25, 'На улицу.'),
    'laugh-1': ('ulica', 21.40, 22.36, 'Смех'),
    'laugh-2': ('ulica', 21.90, 23.36, 'Смех'),
    'ha-1': ('ulica', 20.38, 20.66, 'Ха'),
    'ha-2': ('ulica', 21.66, 21.84, 'Ха'),
    'ha-3': ('ulica', 23.14, 23.32, 'Ха'),
    'misha': ('misha', 0.66, 3.02, 'Миша, блять, какая нахуй честь команды?'),
    'blyat': ('misha', 1.09, 1.44, 'Блять'),
    'saw-dude': ('misha', 3.08, 6.87, 'Я вчера видел, как, блять, чувака лущили нахуй.'),
    'nahuy': ('misha', 6.30, 6.80, 'Нахуй'),
    'pizdec': ('misha', 6.86, 7.59, 'Это пиздец.'),
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
