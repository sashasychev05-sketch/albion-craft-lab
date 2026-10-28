"""Albion Lab adapter for a user-imported Checker runtime. No original GUI is run."""
import sys
import os
import marshal
import zlib
import _frozen_importlib as bootstrap

RUNTIME = os.environ['ACL_AVALON_RUNTIME']
ARCHIVE = os.environ['ACL_AVALON_ARCHIVE']
PROFILE = os.environ['ACL_AVALON_PROFILE']
sys.dont_write_bytecode = True
sys.frozen = True
sys._MEIPASS = RUNTIME
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
sys.stderr.reconfigure(encoding='utf-8')

# Read only the embedded module archive. Original bytecode is not distributed
# with Albion Lab or translated into source files.
with open(ARCHIVE, 'rb') as source:
    frozen = source.read()
cookie = frozen.rfind(b'MEI\x0c\x0b\x0a\x0b\x0e')
if cookie < 0 or cookie + 88 > len(frozen):
    raise RuntimeError('Unsupported Checker archive')
number = lambda offset: int.from_bytes(frozen[offset:offset + 4], 'big')
package = cookie + 88 - number(cookie + 8)
offset, end = package + number(cookie + 12), package + number(cookie + 12) + number(cookie + 16)
pyz = None
outer_modules = {}
while offset < end:
    size, position, length = number(offset), number(offset + 4), number(offset + 8)
    if size < 18 or offset + size > end:
        raise RuntimeError('Invalid Checker module table')
    name = frozen[offset + 18:offset + size].split(b'\0', 1)[0].decode('utf-8')
    if frozen[offset + 17:offset + 18] in {b'm', b'M'}:
        payload = frozen[package + position:package + position + length]
        outer_modules[name] = (frozen[offset + 17:offset + 18] == b'M', zlib.decompress(payload) if frozen[offset + 16] else payload)
    if name == 'PYZ.pyz':
        pyz = frozen[package + position:package + position + length]
        if frozen[offset + 16]:
            pyz = zlib.decompress(pyz)
    offset += size
if not pyz or pyz[:4] != b'PYZ\0':
    raise RuntimeError('Checker modules are missing')
entries = dict(marshal.loads(pyz[int.from_bytes(pyz[8:12], 'big'):]))
del frozen

class FrozenModules:
    def find_spec(self, fullname, path=None, target=None):
        entry = entries.get(fullname) or outer_modules.get(fullname)
        if entry is None:
            return None
        if fullname in {'gui', 'main', 'overlay', 'telemetry', 'scan_samples'}:
            raise ImportError('Original UI and telemetry are disabled in Albion Lab')
        return bootstrap.ModuleSpec(fullname, self, is_package=entry[0] == 1)

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        if module.__name__ in outer_modules:
            kind, code = outer_modules[module.__name__]
        else:
            kind, offset, size = entries[module.__name__]
            code = zlib.decompress(pyz[offset:offset + size])
        location = os.path.join(RUNTIME, *module.__name__.split('.'))
        module.__file__ = os.path.join(location, '__init__.py') if kind == 1 else location + '.py'
        if kind == 1:
            module.__path__ = [location]
        exec(marshal.loads(code), module.__dict__)

sys.meta_path.insert(0, FrozenModules())
import json
import types
import logging
import time
import traceback
import threading

def no_network(event, args):
    if event in {'socket.connect', 'socket.getaddrinfo', 'urllib.Request', 'subprocess.Popen'}:
        raise PermissionError('Network and child programs are disabled in the scan engine')

sys.addaudithook(no_network)
handles = [os.add_dll_directory(RUNTIME)]
for folder, dirs, files in os.walk(RUNTIME):
    if folder != RUNTIME and any(name.lower().endswith('.dll') for name in files):
        handles.append(os.add_dll_directory(folder))

# The recognisers only need read-only configuration and a logger. Never load
# the original config module: its migration writes to the downloaded program.
settings = {'min_match_score': 78, 'roads_current_zone_ttl_s': 0}
configuration = types.ModuleType('config')
configuration.load = lambda: dict(settings)
sys.modules['config'] = configuration
logger = types.ModuleType('log_setup')
logger.get = logging.getLogger
sys.modules['log_setup'] = logger

import capture
import matcher
import roads
import timer_net
from PIL import Image, ImageOps

def short_path(file):
    if file.isascii():
        return file
    import ctypes
    buffer = ctypes.create_unicode_buffer(32768)
    if ctypes.windll.kernel32.GetShortPathNameW(file, buffer, len(buffer)) and buffer.value.isascii():
        return buffer.value
    raise RuntimeError('Tesseract needs an ASCII-compatible runtime path')

capture._resolve_tessdata = lambda: short_path(os.path.join(RUNTIME, 'tessdata'))
capture._init_tesseract()
if capture._tess_api is None:
    raise RuntimeError('Tesseract failed to initialise')
if not timer_net.available():
    raise RuntimeError('Portal timer model failed to initialise')

output_lock = threading.Lock()
trigger_key = 0

def send(value):
    with output_lock:
        print(json.dumps(value, ensure_ascii=False), flush=True)

def watch_trigger():
    import ctypes
    pressed = False
    last = 0.0
    while True:
        down = bool(trigger_key and ctypes.windll.user32.GetAsyncKeyState(trigger_key) & 0x8000)
        if down and not pressed and time.monotonic() - last > 0.75:
            last = time.monotonic()
            send({'event': 'trigger'})
        pressed = down
        time.sleep(0.03)

def find_timer_line(file):
    # The game can draw the tooltip at different offsets around the cursor.
    # The timer model needs a tight crop, not the whole tooltip or screen.
    import re
    import numpy as np
    import cv2
    with Image.open(file) as image:
        gray = np.asarray(image.convert('L'))
    found = {}
    for threshold in (180, 205):
        mask = np.where(gray >= threshold, 255, 0).astype('uint8')
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3)))
        _, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
        tested = 0
        for x, y, width, height, area in stats[1:]:
            if not (22 <= width <= 180 and 6 <= height <= 30 and area >= 25):
                continue
            x, y, width, height = map(int, (x, y, width, height))
            core = gray[max(0, y-4):min(gray.shape[0], y+height+4), max(0, x-4):min(gray.shape[1], x+width+4)]
            # Closing time is on the dark tooltip background; a brighter
            # charge bar above it can contain a different countdown.
            if np.median(core) > 75:
                continue
            tested += 1
            if tested > 60:
                break
            for padding in (4, 8):
                patch = gray[max(0, y-padding):min(gray.shape[0], y+height+padding), max(0, x-padding):min(gray.shape[1], x+width+padding)]
                if np.median(patch) > 130:
                    continue
                try:
                    text, confidence = timer_net.infer_crop(cv2.resize(patch, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC))
                except Exception:
                    continue
                match = re.fullmatch(r'(?:(\d{1,2})ч)?(?:(\d{1,2})м)?(?:(\d{1,2})с)?', str(text))
                if not match or sum(value is not None for value in match.groups()) < 2 or confidence < .85:
                    continue
                hours, minutes, seconds = (int(value or 0) for value in match.groups())
                if hours > 24 or minutes > 59 or seconds > 59 or hours * 3600 + minutes * 60 + seconds > 86400:
                    continue
                total = hours * 3600 + minutes * 60 + seconds
                item = found.setdefault(total, {'thresholds': set(), 'confidence': 0, 'text': str(text)})
                item['thresholds'].add(threshold)
                item['confidence'] = max(item['confidence'], float(confidence))
    reliable = [(seconds, item) for seconds, item in found.items() if len(item['thresholds']) == 2]
    if len(reliable) != 1:
        return None
    seconds, item = reliable[0]
    return {'secs': seconds, 'conf': item['confidence'], 'timer_text': item['text']}

def find_destination(files, minimum):
    # Only accept an exact catalogue name when the original detector misses it.
    import re
    normal = lambda text: re.sub(r'[^a-z0-9]', '', str(text).lower())
    found = {}
    for file in files:
        with Image.open(file) as image:
            image = image.convert('RGB')
            for preprocess in (capture._prep_contrast, capture._prep_hsv, lambda value: value):
                tokens, _ = capture.ocr_single(image, preprocess)
                for token in tokens:
                    if len(normal(token)) < 5:
                        continue
                    match = matcher.find_zone([token], min_score=minimum, worlds=None, verbose=False)
                    zone = match.get('zone') if match else None
                    if zone and normal(token) == normal(zone.get('name')):
                        found[zone['name']] = zone
    return next(iter(found.values())) if len(found) == 1 else None

def find_current_in_large_region(image, destination):
    # A selection covering most of the screen can include the portal tooltip.
    # Search for the minimap's pale zone-name strip and a unique catalogue match.
    import re
    import numpy as np
    import cv2
    rgb = np.asarray(image.convert('RGB'))
    red, green, blue = (rgb[:, :, i].astype('int16') for i in range(3))
    mask = ((red-green > 12) & (green-blue > 7) & (red > 90) & (red < 230)).astype('uint8') * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (21, 5)))
    _, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    found = {}
    normal = lambda text: re.sub(r'[^a-z0-9]', '', str(text).lower())
    def near_one(a, b):
        if abs(len(a)-len(b)) > 1:
            return False
        if len(a) == len(b):
            return sum(x != y for x, y in zip(a, b)) <= 1
        short, long = (a, b) if len(a) < len(b) else (b, a)
        i = j = differences = 0
        while i < len(short) and j < len(long):
            if short[i] != long[j]:
                differences += 1
                j += 1
                if differences > 1:
                    return False
            else:
                i += 1
                j += 1
        return True
    tested = 0
    for x, y, width, height, area in stats[1:]:
        if not (100 <= width <= 650 and 10 <= height <= 300 and area / (width * height) > .25):
            continue
        x, y, width, height = map(int, (x, y, width, height))
        height = min(height, 27)
        strip = image.crop((x + int(width * .40), y, x + int(width * .85), y + height))
        strip = ImageOps.autocontrast(strip.convert('L')).resize((strip.width * 3, strip.height * 3), Image.Resampling.LANCZOS).convert('RGB')
        tokens, _ = capture.ocr_single(strip, lambda value: value)
        tested += 1
        if tokens:
            match = matcher.find_zone(tokens, min_score=85, worlds=None, verbose=False)
            zone = match.get('zone') if match else None
            if zone and zone.get('name') != destination and match.get('score', 0) >= 90:
                observed = normal(''.join(tokens))
                nearby = [item for item in matcher._ZONES if near_one(observed, normal(item.get('name')))]
                if len(nearby) == 1 and nearby[0]['name'] == zone['name']:
                    found[zone['name']] = zone
        if tested >= 20:
            break
    return next(iter(found.values())) if len(found) == 1 else None

def recognise(message):
    global trigger_key
    if message['action'] == 'configure':
        key = message.get('trigger', 0)
        if key not in (0, 4, 5, 6):
            raise ValueError('Unsupported trigger')
        trigger_key = key
        return {'configured': True}
    if message['action'] == 'match_text':
        result = matcher.find_zone([message['text']], min_score=78, worlds=None, verbose=False)
        return {'zone': result['zone']['name'] if result and result.get('zone') else None}
    if message['action'] != 'scan':
        raise ValueError('Unsupported scan command')
    candidates = message.get('portals') or [message['portal']]
    if not isinstance(candidates, list) or not 1 <= len(candidates) <= 3:
        raise ValueError('Invalid portal images')
    results = []
    for file in candidates:
        with Image.open(file) as image:
            result = roads.read_portal(image.convert('RGB'), min_score=message.get('score', 78))
        results.append(result)
        if result.get('to') and result.get('score', 0) >= message.get('score', 78) and result.get('secs') is not None and result.get('conf', 0) >= .62:
            break
    result = max(results, key=lambda item: (bool(item.get('to')) and item.get('score', 0) >= message.get('score', 78), item.get('secs') is not None and item.get('conf', 0) >= .62, item.get('score', 0), item.get('conf', 0)))
    if not result.get('to') or result.get('score', 0) < message.get('score', 78):
        destination = find_destination(candidates, message.get('score', 78))
        if destination:
            result['to'], result['score'] = destination['name'], 100
    if result.get('to') and (not isinstance(result.get('secs'), int) or not 0 <= result['secs'] <= 86400 or result.get('conf', 0) < .62):
        for file in candidates:
            timer = find_timer_line(file)
            if timer:
                result.update(timer)
                break
    current = message.get('currentName')
    if current:
        current = matcher.get_zone_by_name(current)
    elif message.get('current'):
        choices = []
        debug_candidates = []
        with Image.open(message['current']) as image:
            image = image.convert('RGB')
            variants = [(image, capture._prep_contrast), (image, capture._prep_hsv), (image, lambda value: value)]
            if image.width <= 600 and image.height <= 120:
                enlarged = ImageOps.autocontrast(image.convert('L')).resize((image.width * 4, image.height * 4), Image.Resampling.LANCZOS).convert('RGB')
                variants.append((enlarged, lambda value: value))
            for current_image, preprocess in variants:
                candidates, _ = capture.ocr_single(current_image, preprocess)
                debug_candidates.append(candidates)
                match = matcher.find_zone(candidates, min_score=78, worlds=None, verbose=False) if candidates else None
                if match and match.get('zone'):
                    choices.append(match)
        choices.sort(key=lambda match: match.get('score', 0), reverse=True)
        current = choices[0]['zone'] if choices else None
        if current and any(match['zone']['name'] != current['name'] and match.get('score', 0) >= choices[0].get('score', 0) - 5 for match in choices[1:]):
            current = None
        if image.width > 600 or image.height > 120:
            current = find_current_in_large_region(image, result.get('to'))
        if message.get('diagnostic'):
            result['current_candidates'] = debug_candidates
    return {'diagnostic': result.get('current_candidates') if message.get('diagnostic') else None, 'from': current.get('name') if current else None, 'to': result.get('to'),
            'seconds': result.get('secs'), 'confidence': result.get('conf', 0),
            'score': result.get('score', 0), 'timerText': result.get('timer_text', '')}

send({'event': 'ready', 'zones': len(matcher._ZONES), 'timerModel': True, 'ocr': True, 'originalUiLoaded': any(name in sys.modules for name in ('gui', 'main', 'overlay', 'telemetry')), 'networkDisabled': True})
threading.Thread(target=watch_trigger, daemon=True).start()
for line in sys.stdin:
    if len(line) > 100000:
        continue
    message = None
    try:
        message = json.loads(line)
        response = recognise(message)
        send({'id': message.get('id'), 'result': response})
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        send({'id': message.get('id') if isinstance(message, dict) else None, 'error': str(error)[:500]})
