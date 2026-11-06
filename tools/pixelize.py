import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageStat

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'raw'
OUT = ROOT / 'assets' / 'img'

PORTRAITS = {
    'portrait-face.png': {'src': '7.webp', 'crop': (160, 0, 940, 940), 'size': (80, 96), 'colors': 24},
    'portrait-gman.png': {'src': '10.webp', 'crop': (260, 30, 740, 660), 'size': (72, 96), 'colors': 20},
    'portrait-happy.png': {'src': '3.webp', 'crop': (62, 312, 1062, 1375), 'size': (90, 96), 'colors': 24},
    'portrait-pkin.png': {'src': '2.webp', 'crop': (62, 0, 1312, 1625), 'size': (74, 96), 'colors': 24},
    'portrait-poker.png': {'src': '8.webp', 'crop': (80, 180, 620, 720), 'size': (80, 80), 'colors': 20},
    'portrait-floor.png': {
        'src': '4.webp',
        'crop': (440, 300, 1280, 960),
        'size': (96, 75),
        'colors': 20,
        'masks': [{'box': (980, 150, 1280, 380), 'sample': (1120, 400, 1240, 480)}],
    },
}


def apply_masks(img, masks):
    draw = ImageDraw.Draw(img)
    for m in masks:
        color = tuple(int(c) for c in ImageStat.Stat(img.crop(m['sample'])).mean[:3])
        draw.rectangle(m['box'], fill=color)
    return img


def pixelize(spec):
    img = Image.open(RAW / spec['src']).convert('RGB')
    img = apply_masks(img, spec.get('masks', []))
    img = img.crop(spec['crop'])
    img = ImageEnhance.Contrast(img).enhance(1.15)
    img = ImageEnhance.Color(img).enhance(1.1)
    img = img.resize(spec['size'], Image.LANCZOS)
    return img.quantize(colors=spec['colors'], method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in PORTRAITS.items():
        if names and name not in names:
            continue
        pixelize(spec).save(OUT / name, optimize=True)
        print(name, spec['size'])


if __name__ == '__main__':
    main(sys.argv[1:])
