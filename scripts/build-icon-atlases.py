"""Pack downloaded game art into local, lossless WebP atlases (build-time only)."""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import quote
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist' / 'assets' / 'item-icons'
OUT.mkdir(parents=True, exist_ok=True)
targets = json.loads((ROOT / 'work/icon-targets.json').read_text(encoding='utf-8'))
sources, unique, mapping, fallbacks = {}, [], {}, {}
for item in targets:
    source = ROOT / 'work/icon-downloads' / (quote(item, safe="~()*!.'-") + '.png')
    if not source.exists():
        source = ROOT / 'work/icon-extras' / (item + '.webp')
    if not source.exists():
        fallbacks[item] = 'banner' if 'SIEGE_BANNER' in item else 'gear' if any(s in item for s in ('HEAD_', 'ARMOR_', 'SHOES_', 'CAPE_', 'GAUNTLET', 'ARTEFACT', 'VANITY_')) else 'unknown'
        continue
    with Image.open(source) as image:
        pixels = image.convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS)
        digest = hashlib.sha256(pixels.tobytes()).hexdigest()
    if digest not in sources:
        sources[digest] = len(unique)
        unique.append(source)
    mapping[item] = sources[digest]

def build_atlas(index):
    atlas = Image.new('RGBA', (1024, 1024))
    for slot, source in enumerate(unique[index * 64:(index + 1) * 64]):
        with Image.open(source) as image:
            atlas.paste(image.convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS), ((slot % 8) * 128, (slot // 8) * 128))
    data = io.BytesIO()
    atlas.save(data, 'WEBP', lossless=True, method=4, exact=True)
    content = data.getvalue()
    name = hashlib.sha256(content).hexdigest()[:20] + '.webp'
    (OUT / name).write_bytes(content)
    return 'assets/item-icons/' + name, len(content)

count = (len(unique) + 63) // 64
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    packed = list(pool.map(build_atlas, range(count)))
manifest = {'version': 1, 'tile': 128, 'columns': 8, 'files': [p[0] for p in packed], 'items': {item: [slot // 64, slot % 64] for item, slot in mapping.items()}, 'fallbacks': fallbacks}
(ROOT / 'dist/item-icon-manifest.js').write_text('window.ITEM_ICON_ATLAS=' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
report = {'targets': len(targets), 'icons': len(mapping), 'uniqueArt': len(unique), 'atlases': count, 'bytes': sum(p[1] for p in packed), 'fallbacks': fallbacks, 'lossless': True, 'sources': ['https://render.albiononline.com/v1/item/', 'https://albiononline.th.gl/db/materials/questitem_token_dragons', 'https://albiononline.th.gl/db/materials/questitem_token_smuggler']}
(ROOT / 'work/icon-atlas-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({**report, 'fallbacks': len(fallbacks)}, ensure_ascii=False))
