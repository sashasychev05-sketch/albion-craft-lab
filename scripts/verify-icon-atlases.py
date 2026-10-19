"""Verify that each packed sprite exactly matches its original downloaded art."""
import json
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote
from PIL import Image

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'dist/item-icon-manifest.js').read_text(encoding='utf-8').removeprefix('window.ITEM_ICON_ATLAS=').rstrip(';\n'))
groups = defaultdict(list)
for item, (file_index, slot) in manifest['items'].items():
    groups[file_index].append((item, slot))
verified = 0
for file_index, entries in groups.items():
    with Image.open(root / 'dist' / manifest['files'][file_index]) as opened:
        atlas = opened.convert('RGBA')
        for item, slot in entries:
            source = root / 'work/icon-downloads' / (quote(item, safe="~()*!.'-") + '.png')
            if not source.exists():
                source = root / 'work/icon-extras' / (item + '.webp')
            with Image.open(source) as original:
                pixels = original.convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS)
                left, top = slot % 8 * 128, slot // 8 * 128
                assert pixels.tobytes() == atlas.crop((left, top, left + 128, top + 128)).tobytes(), item
            verified += 1
report = {'verified': verified, 'atlases': len(groups), 'pixelExact': True}
(root / 'work/icon-pixel-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
