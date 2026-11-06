import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'raw'
OUT = ROOT / 'assets' / 'img'

PORTRAITS = {
    'portrait-face.png': {'src': '7.webp', 'crop': (160, 0, 940, 940), 'size': (320, 384), 'colors': None},
    'portrait-gman.png': {'src': '10.webp', 'crop': (260, 30, 740, 660), 'size': (288, 384), 'colors': 64},
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
    'nikich-head.png': {'src': '3.webp', 'height': 72, 'poly': [(217, 383), (283, 351), (366, 345), (437, 357), (487, 389), (531, 440), (553, 504), (569, 574), (608, 612), (602, 682), (575, 708), (564, 759), (536, 810), (487, 848), (421, 867), (349, 848), (272, 810), (189, 784), (134, 759), (112, 695), (112, 606), (129, 555), (140, 478), (173, 427)]},
    'nikich-grin.png': {'src': '2.webp', 'height': 72, 'poly': [(526, 462), (455, 472), (399, 511), (368, 585), (356, 683), (348, 747), (360, 816), (388, 879), (439, 933), (507, 958), (566, 953), (626, 924), (665, 865), (693, 806), (709, 747), (693, 683), (681, 599), (654, 521), (598, 472)]},
    'nikich-shoot.png': {'src': '8.webp', 'height': 72, 'poly': [(292, 193), (246, 203), (213, 234), (197, 302), (202, 370), (208, 411), (219, 455), (240, 492), (278, 526), (318, 540), (359, 540), (386, 513), (408, 472), (421, 421), (426, 363), (418, 319), (405, 261), (372, 214), (332, 197)]},
    'nikich-hurt.png': {'src': '9.webp', 'height': 72, 'poly': [(492, 388), (531, 362), (583, 353), (622, 366), (648, 391), (664, 430), (690, 449), (695, 500), (690, 564), (669, 612), (635, 644), (583, 660), (539, 641), (508, 602), (487, 564), (474, 516), (469, 468), (476, 423)]},
    'nikich-jump.png': {'src': '6.webp', 'height': 60, 'poly': [(688, 714), (716, 714), (744, 722), (772, 730), (806, 738), (828, 751), (842, 778), (848, 810), (839, 836), (817, 858), (783, 869), (744, 863), (705, 850), (671, 831), (651, 804), (651, 770), (665, 735)]},
    'nikich-pout.png': {'src': '1.webp', 'height': 72, 'poly': [(159, 406), (210, 393), (261, 402), (295, 427), (312, 468), (319, 498), (336, 530), (356, 554), (360, 570), (349, 585), (356, 601), (343, 619), (332, 638), (305, 654), (261, 663), (210, 663), (159, 650), (122, 632), (94, 595), (81, 545), (81, 489), (108, 436)]},
    'gman-head.png': {'src': '10.webp', 'height': 72, 'poly': [(490, 34), (461, 43), (441, 60), (425, 85), (419, 117), (420, 152), (424, 186), (434, 214), (451, 239), (473, 255), (493, 262), (512, 257), (531, 239), (546, 214), (556, 186), (561, 152), (561, 117), (556, 85), (543, 57), (519, 41)]},
}

OUTLINE = (27, 20, 16, 255)
SUPERSAMPLE = 4


def cut_head(spec):
    poly = spec['poly']
    xs = [x for x, _ in poly]
    ys = [y for _, y in poly]
    box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    img = Image.open(RAW / spec['src']).convert('RGB').crop(box)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    th = spec['height'] - 2
    tw = round(img.width * th / img.height)
    big = Image.new('L', (tw * SUPERSAMPLE, th * SUPERSAMPLE))
    kx = big.width / img.width
    ky = big.height / img.height
    ImageDraw.Draw(big).polygon([((x - box[0]) * kx, (y - box[1]) * ky) for x, y in poly], fill=255)
    alpha = big.resize((tw, th), Image.LANCZOS).point(lambda a: 255 if a >= 128 else 0)
    color = img.resize((tw, th), Image.LANCZOS).convert('RGBA')
    color.putalpha(alpha)
    out = Image.new('RGBA', (tw + 2, th + 2), (0, 0, 0, 0))
    ring = Image.new('L', out.size)
    ring.paste(alpha, (1, 1))
    ring = ring.filter(ImageFilter.MaxFilter(3))
    out.paste(Image.new('RGBA', out.size, OUTLINE), (0, 0), ring)
    out.alpha_composite(color, (1, 1))
    return out


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
