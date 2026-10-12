"""Complete bag recipes and starter capes from public game data.
Usage: python scripts/build-accessory-data.py items.json formatted-items.json
"""
import functools,json,re,sys
from pathlib import Path

def arr(v):
    return v if isinstance(v,list) else [v] if isinstance(v,dict) else []
raw=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['items']
items={x['@uniquename']:x for group in raw.values() for x in arr(group) if '@uniquename' in x}
names={x['UniqueName']:(x.get('LocalizedNames') or {}).get('RU-RU') or (x.get('LocalizedNames') or {}).get('EN-US') or x['UniqueName'] for x in json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))}
def iid(x):
    return x['@uniquename']+('@'+x['@enchantmentlevel'] if int(x.get('@enchantmentlevel',0)) else '')
@functools.lru_cache(None)
def value(id_):
    base=id_.split('@')[0];x=items.get(base,{});ench=int(id_.split('@')[1]) if '@' in id_ else 0
    if '@itemvalue' in x:
        return float(x['@itemvalue'])*(2**ench if not x.get('@enchantmentlevel') else 1)
    reqs=arr(x.get('craftingrequirements'))
    if not reqs:return 0
    req=reqs[0]
    return sum(value(iid(m))*float(m['@count']) for m in arr(req.get('craftresource')))/float(req.get('@amountcrafted',1))*2**ench

rows=[];needed=set()
for base,x in items.items():
    bag=re.fullmatch(r'T[2-8]_BAG(?:_INSIGHT)?',base)
    if not bag and base not in ['T2_CAPE','T3_CAPE']:continue
    versions=[(0,arr(x.get('craftingrequirements')))]+[(int(e['@enchantmentlevel']),arr(e.get('craftingrequirements'))) for e in arr(x.get('enchantments',{}).get('enchantment'))]
    for ench,reqs in versions:
        if not reqs:continue
        req=reqs[0];id_=base+('@'+str(ench) if ench else '');output=float(req.get('@amountcrafted',1));iv=value(id_)
        mats=[{'id':iid(m),'n':float(m['@count']),'returns':m.get('@maxreturnamount')!='0','preserveQuality':m.get('@preservequality')=='true'} for m in arr(req.get('craftresource'))]
        row={'id':id_,'kind':'bags' if bag else 'gear','name':names.get(id_,names.get(base,base)),'label':re.sub(r'\s*\([^()]+\)$','',names.get(base,base)), 'tier':int(x['@tier']),'ench':ench,'category':'bag' if bag else 'cape','station':'Мастерская инструментов','output':output,'basefocus':float(req.get('@craftingfocus',0))/output,'eff':0,'fee300':iv*.1125*3,'itemValue':iv,'quality':int(x.get('@maxqualitylevel',1))>1,'blackMarket':True,'mats':mats}
        rows.append(row);needed.add(id_);needed.update(m['id'] for m in mats)
payload=json.dumps(rows,ensure_ascii=False,separators=(',',':'))
js='/* Public game recipes: ordinary bags, satchels and starter capes. */\nwindow.ACCESSORY_RECIPES='+payload+';\n'
js+="for(const recipe of window.ACCESSORY_RECIPES){const existing=window.ALBION_DATA.recipes.find(r=>r.id===recipe.id);if(existing)Object.assign(existing,recipe);else window.ALBION_DATA.recipes.push(recipe);}\n"
js+='Object.assign(window.GEAR_META.products,'+json.dumps({r['id'].split('@')[0].split('_',1)[1]:r['label'] for r in rows if r['kind']=='bags'},ensure_ascii=False,separators=(',',':'))+');\n'
js+='Object.assign(window.ALBION_DATA.names,'+json.dumps({id_:names.get(id_,names.get(id_.split('@')[0],id_)) for id_ in sorted(needed)},ensure_ascii=False,separators=(',',':'))+');\n'
Path('dist/accessory-data.js').write_text(js,encoding='utf-8')
print({'recipes':len(rows),'bags':sum(r['kind']=='bags' for r in rows)})
