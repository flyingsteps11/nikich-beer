import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'raw'
OUT = ROOT / 'assets' / 'img'

PORTRAITS = {
    'portrait-face.png': {'src': 'faces/smug-hoodie.png', 'crop': (230, 0, 670, 528), 'size': (320, 384), 'colors': None},
    'portrait-gman.png': {'src': 'faces/gman-suit.png', 'crop': (40, 0, 409, 490), 'size': (288, 384), 'colors': 64},
    'portrait-happy.png': {'src': '3.webp', 'crop': (62, 312, 1062, 1375), 'size': (360, 384), 'colors': 64},
    'portrait-pkin.png': {'src': '2.webp', 'crop': (62, 0, 1312, 1625), 'size': (148, 192), 'colors': 64},
    'portrait-poker.png': {'src': '8.webp', 'crop': (80, 180, 620, 720), 'size': (160, 160), 'colors': 64},
    'portrait-floor.png': {
        'src': '4.webp',
        'crop': (440, 300, 1280, 960),
        'size': (384, 300),
        'colors': 64,
        'masks': [{'box': (980, 150, 1280, 380), 'sample': (1120, 400, 1240, 480)}],
    },
}


HEADS = {
    'nikich-jump.png': {'src': '6.webp', 'height': 60, 'poly': [(688, 714), (716, 714), (744, 722), (772, 730), (806, 738), (828, 751), (842, 778), (848, 810), (839, 836), (817, 858), (783, 869), (744, 863), (705, 850), (671, 831), (651, 804), (651, 770), (665, 735)]},
    'nikich-pout.png': {'src': '1.webp', 'height': 72, 'poly': [(159, 406), (210, 393), (261, 402), (295, 427), (312, 468), (319, 498), (336, 530), (356, 554), (360, 570), (349, 585), (356, 601), (343, 619), (332, 638), (305, 654), (261, 663), (210, 663), (159, 650), (122, 632), (94, 595), (81, 545), (81, 489), (108, 436)]},
    'face-happy.png': {'src': 'faces/smug-hoodie.png', 'height': 72, 'flip': False, 'poly': [(300, 30), (360, 0), (560, 0), (590, 100), (595, 220), (575, 300), (540, 360), (490, 400), (430, 415), (380, 395), (340, 350), (310, 290), (292, 200), (290, 100)]},
    'face-near.png': {'src': 'faces/side-eye.png', 'height': 72, 'flip': False, 'poly': [(170, 30), (300, 0), (560, 0), (640, 120), (660, 260), (640, 400), (590, 500), (520, 580), (450, 620), (380, 610), (300, 560), (230, 490), (170, 430), (140, 330), (135, 200)]},
    'face-fight.png': {'src': 'faces/angry-fist.png', 'height': 72, 'flip': False, 'poly': [(372, 0), (555, 0), (562, 60), (558, 150), (540, 215), (505, 245), (470, 250), (432, 245), (400, 215), (380, 160), (372, 90)]},
    'face-laugh.png': {'src': 'faces/laugh-thumb.png', 'height': 72, 'flip': False, 'poly': [(135, 40), (180, 0), (320, 0), (342, 60), (345, 150), (330, 200), (295, 240), (245, 255), (195, 245), (160, 215), (138, 160), (128, 100)]},
    'face-tipsy.png': {'src': 'faces/laugh-blood.png', 'height': 72, 'flip': False, 'poly': [(150, 0), (600, 0), (614, 200), (610, 400), (590, 520), (540, 640), (470, 730), (390, 780), (320, 775), (240, 720), (180, 640), (140, 560), (115, 450), (115, 300), (130, 150)]},
    'face-hurt.png': {'src': 'faces/squint-wet.png', 'height': 72, 'flip': False, 'poly': [(15, 40), (40, 15), (90, 5), (140, 8), (165, 30), (185, 70), (200, 110), (205, 170), (195, 220), (165, 255), (120, 275), (70, 265), (35, 230), (15, 180), (5, 110)]},
    'face-fed.png': {'src': 'faces/vest-smile.png', 'height': 72, 'flip': False, 'poly': [(78, 40), (120, 0), (225, 0), (252, 30), (256, 95), (244, 128), (214, 155), (185, 175), (150, 182), (112, 168), (85, 130), (75, 85)]},
    'face-smoke.png': {'src': 'faces/smoking.png', 'height': 72, 'flip': True, 'poly': [(330, 40), (400, 10), (480, 15), (560, 40), (605, 120), (610, 220), (585, 300), (545, 360), (490, 410), (430, 430), (360, 425), (330, 470), (300, 480), (290, 455), (320, 400), (300, 360), (286, 300), (286, 180), (300, 100)]},
    'gman-head.png': {'src': 'faces/gman-suit.png', 'height': 72, 'flip': False, 'poly': [(145, 30), (175, 0), (255, 0), (282, 30), (288, 110), (278, 165), (255, 195), (215, 212), (180, 205), (160, 180), (148, 130), (140, 80)]},
}

OUTLINE = (27, 20, 16, 255)
SUPERSAMPLE = 4


def cut_head(spec):
    poly = spec['poly']
    xs = [x for x, _ in poly]
    ys = [y for _, y in poly]
    box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    src = Image.open(RAW / spec['src'])
    has_alpha = 'A' in src.getbands()
    src = src.convert('RGBA').crop(box)
    img = ImageEnhance.Contrast(src.convert('RGB')).enhance(1.08)
    th = spec['height'] - 2
    tw = round(img.width * th / img.height)
    big = Image.new('L', (tw * SUPERSAMPLE, th * SUPERSAMPLE))
    kx = big.width / img.width
    ky = big.height / img.height
    ImageDraw.Draw(big).polygon([((x - box[0]) * kx, (y - box[1]) * ky) for x, y in poly], fill=255)
    if has_alpha:
        big = ImageChops.multiply(big, src.getchannel('A').resize(big.size, Image.LANCZOS))
    alpha = big.resize((tw, th), Image.LANCZOS).point(lambda a: 255 if a >= 128 else 0)
    color = img.resize((tw, th), Image.LANCZOS).convert('RGBA')
    color.putalpha(alpha)
    out = Image.new('RGBA', (tw + 2, th + 2), (0, 0, 0, 0))
    ring = Image.new('L', out.size)
    ring.paste(alpha, (1, 1))
    ring = ring.filter(ImageFilter.MaxFilter(3))
    out.paste(Image.new('RGBA', out.size, OUTLINE), (0, 0), ring)
    out.alpha_composite(color, (1, 1))
    if spec.get('flip'):
        out = out.transpose(Image.FLIP_LEFT_RIGHT)
    return out


def apply_masks(img, masks):
    draw = ImageDraw.Draw(img)
    for m in masks:
        color = tuple(int(c) for c in ImageStat.Stat(img.crop(m['sample'])).mean[:3])
        draw.rectangle(m['box'], fill=color)
    return img


PORTRAIT_BG = (26, 26, 46)


def pixelize(spec):
    src = Image.open(RAW / spec['src'])
    if 'A' in src.getbands():
        flat = Image.new('RGBA', src.size, PORTRAIT_BG + (255,))
        flat.alpha_composite(src.convert('RGBA'))
        src = flat
    img = src.convert('RGB')
    img = apply_masks(img, spec.get('masks', []))
    img = img.crop(spec['crop'])
    img = ImageEnhance.Contrast(img).enhance(1.15)
    img = ImageEnhance.Color(img).enhance(1.1)
    img = img.resize(spec['size'], Image.LANCZOS)
    if not spec['colors']:
        return img
    return img.quantize(colors=spec['colors'], method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in PORTRAITS.items():
        if names and name not in names:
            continue
        pixelize(spec).save(OUT / name, optimize=True)
        print(name, spec['size'])
    for name, spec in HEADS.items():
        if names and name not in names:
            continue
        head = cut_head(spec)
        head.save(OUT / name, optimize=True)
        print(name, head.size)


if __name__ == '__main__':
    main(sys.argv[1:])
