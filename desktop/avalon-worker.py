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
from PIL import Image

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
    with Image.open(message['portal']) as image:
        result = roads.read_portal(image.convert('RGB'), min_score=message.get('score', 78))
    current = message.get('currentName')
    if current:
        current = matcher.get_zone_by_name(current)
    elif message.get('current'):
        choices = []
        debug_candidates = []
        with Image.open(message['current']) as image:
            image = image.convert('RGB')
            for preprocess in (capture._prep_contrast, capture._prep_hsv, lambda value: value):
                candidates, _ = capture.ocr_single(image, preprocess)
                debug_candidates.append(candidates)
                match = matcher.find_zone(candidates, min_score=78, worlds=None, verbose=False) if candidates else None
                if match and match.get('zone'):
                    choices.append(match)
        choices.sort(key=lambda match: match.get('score', 0), reverse=True)
        current = choices[0]['zone'] if choices else None
        if current and any(match['zone']['name'] != current['name'] and match.get('score', 0) >= choices[0].get('score', 0) - 5 for match in choices[1:]):
            current = None
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
