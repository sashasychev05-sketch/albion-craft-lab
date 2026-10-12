"""Generate public recipe metadata; usage: python scripts/build-economy-data.py items.json names.json.

craftingfocus is a cost per produced item, not per recipe execution.
No player spreadsheet or account data is included in the generated catalog.
"""
import json, sys, re
from pathlib import Path

def arr(value):
    return value if isinstance(value, list) else [value] if isinstance(value, dict) else []

raw = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['items']
names = {x['UniqueName']: (x.get('LocalizedNames') or {}).get('RU-RU') or (x.get('LocalizedNames') or {}).get('EN-US') or x['UniqueName']
         for x in json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
         if (x.get('LocalizedNames') or {}).get('RU-RU') or (x.get('LocalizedNames') or {}).get('EN-US')}
items = {x['@uniquename']: x for group in raw.values() for x in arr(group) if '@uniquename' in x}
needed = set()
def public_item(x):
    id_ = x.get('@uniquename', '')
    return x.get('@showinmarketplace') != 'false' and x.get('@shopsubcategory1') != 'questitems' and not re.search(r'(?:_TEST(?:_|$)|_DEBUG|_EXP_TOKEN_)', id_) and (names.get(iid(x)) or names.get(id_, id_)) != id_

def iid(x):
    return x['@uniquename'] + ('@' + x['@enchantmentlevel'] if int(x.get('@enchantmentlevel', 0)) else '')
def mats(req, key='craftresource'):
    out = [{'id': iid(m), 'n': float(m['@count'])} for m in arr(req.get(key))]
    needed.update(m['id'] for m in out)
    return out

focus, upgrades, salvage, mounts, breeders, journals = {}, {}, {}, [], [], {}
for x in items.values():
    base = x['@uniquename']
    reqs = arr(x.get('craftingrequirements'))
    variants = [(0, reqs[0])] if reqs else []
    variants += [(int(e['@enchantmentlevel']), arr(e['craftingrequirements'])[0])
                 for e in arr(x.get('enchantments', {}).get('enchantment')) if e.get('craftingrequirements')]
    if x.get('@craftingcategory') in ['food', 'potion'] or base.startswith(('T1_MEAL_', 'T2_MEAL_', 'T3_MEAL_', 'T4_MEAL_', 'T5_MEAL_', 'T6_MEAL_', 'T7_MEAL_', 'T8_MEAL_')):
        for e, req in variants:
            id_ = base + ('@' + str(e) if e else '')
            focus[id_] = {'basefocus': float(req.get('@craftingfocus', 0)), 'output': float(req.get('@amountcrafted', 1))}
    if x.get('@slottype') and x.get('@slottype') != 'mount':
        for e in arr(x.get('enchantments', {}).get('enchantment')):
            if e.get('upgraderequirements'):
                level = int(e['@enchantmentlevel'])
                target = base + '@' + str(level)
                upgrades[target] = {'from': base + ('@' + str(level - 1) if level > 1 else ''),
                                    'to': target, 'mats': mats(e['upgraderequirements'], 'upgraderesource')}
                needed.add(target)
        if x.get('@salvageable', 'true') != 'false':
            for e, req in variants:
                id_ = base + ('@' + str(e) if e else '')
                # Components without a confirmed deterministic return start at zero.
                components = [m for m in mats(req) if re.fullmatch(r'T[2-8]_(?:METALBAR|PLANKS|CLOTH|LEATHER)(?:_LEVEL[1-4])?(?:@[1-4])?', m['id'])]
                if components:
                    salvage[id_] = components
    if x.get('@slottype') == 'mount' and public_item(x) and reqs and reqs[0].get('craftresource'):
        ms = mats(reqs[0]); grown = next((m['id'] for m in ms if m['id'].endswith('_GROWN')), None)
        if ms:
            mount_id = iid(x)
            mounts.append({'id': mount_id, 'name': names.get(mount_id, names.get(base, base)), 'grown': grown,
                           'tier': int(x['@tier']), 'category': x.get('@shopsubcategory1', ''), 'subCategory': x.get('@shopsubcategory2', ''), 'mountCategory': x.get('@mountcategory', ''), 'quality': int(x.get('@maxqualitylevel', 1)) > 1, 'mats': ms, 'nutrition': float(x.get('@nutrition', 0)),
                           'silver': float(reqs[0].get('@silver', 0))})
            needed.add(mount_id)
    if x.get('grownitem') and any(m['grown'] == x['grownitem']['@uniquename'] for m in mounts):
        pass  # Complete after all mount recipes have been read.
    if x.get('@maxfame') and x.get('famefillingmissions'):
        mission = x['famefillingmissions'].get('craftitemfame', {})
        journals[base] = {'maxFame': float(x['@maxfame']), 'validItems': [i['@id'] for i in arr(mission.get('validitem'))]}
for x in items.values():
    grown = x.get('grownitem')
    if not grown or not any(m['grown'] == grown['@uniquename'] for m in mounts):
        continue
    food = x.get('consumption', {}).get('food', {})
    grow_seconds = float(grown['@growtime']); seconds_nutrition = float(food.get('@secondspernutrition', 0))
    category = food.get('acceptedfood', {}).get('@foodcategory', 'plants')
    breeders.append({'id': x['@uniquename'], 'grown': grown['@uniquename'], 'name': names.get(x['@uniquename'], x['@uniquename']),
                     'tier': int(x['@tier']), 'hours': grow_seconds / 3600, 'offspring': float(grown.get('offspring', {}).get('@chance', 0)) * float(grown.get('offspring', {}).get('@amount', 1)),
                     'actions': int(x.get('@activefarmmaxcycles', 0)), 'nurtureBonus': float(x.get('@activefarmbonus', 0)),
                     'focus': float(x.get('@activefarmfocuscost', 1000)), 'foodCategory': category,
                     'feedEstimate': grow_seconds / seconds_nutrition / 48 if seconds_nutrition else None})
    needed.update([x['@uniquename'], grown['@uniquename']])
out = {'version': 1, 'date': '2026-10-12', 'upgrades': upgrades, 'salvage': salvage, 'mounts': mounts,
       'breeders': breeders, 'journals': journals,
       'names': {id_: names.get(id_, names.get(id_.split('@')[0], id_)) for id_ in sorted(needed)}}
Path('dist/economy-data.js').write_text('window.ECONOMY_DATA=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\nObject.assign(window.ALBION_DATA.names,window.ECONOMY_DATA.names);\n', encoding='utf-8')
food_focus = {k: v for k, v in focus.items() if '_MEAL_' in k}
Path('dist/food-focus-data.js').write_text('window.FOOD_FOCUS_DATA=' + json.dumps(food_focus, separators=(',', ':')) + ';\nfor(const r of window.ALBION_DATA.recipes){if(r.kind===\'food\'&&window.FOOD_FOCUS_DATA[r.id])Object.assign(r,window.FOOD_FOCUS_DATA[r.id]);}\n', encoding='utf-8')
extras = Path('dist/extras-data.js').read_text(encoding='utf-8').splitlines()
for i, line in enumerate(extras):
    prefix = 'window.ALBION_DATA.recipes.push(...'
    if line.startswith(prefix):
        recipes = json.loads(line[len(prefix):-2])
        for recipe in recipes:
            if recipe['id'] in focus:
                recipe.update(focus[recipe['id']])
        extras[i] = prefix + json.dumps(recipes, ensure_ascii=False, separators=(',', ':')) + ');'
Path('dist/extras-data.js').write_text('\n'.join(extras) + '\n', encoding='utf-8')
print(json.dumps({k: len(v) for k, v in out.items() if isinstance(v, (list, dict))}))

price_catalog = {}
for x in items.values():
    if not public_item(x) or not x.get('@shopcategory'):
        continue
    id_ = iid(x)
    for id_ in [id_] + [x['@uniquename'] + '@' + e['@enchantmentlevel'] for e in arr(x.get('enchantments', {}).get('enchantment'))]:
        price_catalog[id_] = {'id': id_, 'name': names.get(id_, names.get(x['@uniquename'], id_)), 'tier': int(x.get('@tier', 0)), 'ench': int(id_.split('@')[1]) if '@' in id_ else 0, 'quality': int(x.get('@maxqualitylevel', 1)) > 1, 'category': x.get('@shopcategory', ''), 'subCategory': x.get('@shopsubcategory1', ''), 'detailCategory': x.get('@shopsubcategory2', ''), 'mountCategory': x.get('@mountcategory', '')}
Path('dist/price-catalog.js').write_text('window.PRICE_CATALOG=' + json.dumps(list(price_catalog.values()), ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
