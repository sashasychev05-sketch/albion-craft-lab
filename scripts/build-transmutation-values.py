"""Item Values used by raw-resource transmutation station fees.
Usage: python scripts/build-transmutation-values.py public-items.json
"""
import json,sys
from pathlib import Path
data=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['items']
items={x['@uniquename']:x for group in data.values() for x in (group if isinstance(group,list) else [group]) if isinstance(x,dict) and '@uniquename' in x}
source=Path('dist/extras-data.js').read_text(encoding='utf-8')
extras=json.JSONDecoder().raw_decode(source.split('window.CRAFT_EXTRAS=',1)[1])[0]
values={}
for id_ in extras['resources']:
    item=items[id_.split('@')[0]]
    value=float(item['@itemvalue'])
    assert value>=0,id_
    values[id_]=value
for edge in extras['transmutations']:
    item=items[edge['to'].split('@')[0]]
    req=item.get('craftingrequirements')
    reqs=req if isinstance(req,list) else [req]
    assert any(r and float(r.get('@silver',0))==edge['silver'] for r in reqs),edge
Path('dist/transmutation-values.js').write_text('/* Item Values from public game recipes; not market prices. */\nconst transmutationItemValues='+json.dumps(values,separators=(',',':'))+';\nfor(const [id,value]of Object.entries(transmutationItemValues))window.CRAFT_EXTRAS.resources[id].itemValue=value;\n',encoding='utf-8')
print({'resources':len(values),'verifiedEdges':len(extras['transmutations'])})
