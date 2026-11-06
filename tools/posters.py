import json
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'tools' / 'posters.json'
RAW = ROOT / 'raw' / 'posters'
OUT = ROOT / 'assets' / 'img' / 'posters'
MAX_SIDE = 220


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items = json.loads(MANIFEST.read_text())
    sizes = []
    for p in items:
        img = Image.open(RAW / f"{p['id']}.jpg").convert('RGB')
        k = MAX_SIDE / max(img.size)
        img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
        img = ImageEnhance.Color(img).enhance(1.15)
        img.save(OUT / f"{p['id']}.jpg", quality=86, optimize=True)
        sizes.append({'id': p['id'], 'w': img.width, 'h': img.height})
    (OUT / 'index.json').write_text(json.dumps(sizes, indent=1) + '\n')
    print(len(items))


if __name__ == '__main__':
    main()
