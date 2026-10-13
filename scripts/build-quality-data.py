"""Crafting quality bonuses from public game achievements.
Usage: python scripts/build-quality-data.py achievements.json
"""
import json,sys
from pathlib import Path
def arr(value):return value if isinstance(value,list) else [value] if isinstance(value,dict) else []
raw=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['achievements']
nodes={}
for node in arr(raw.get('templateachievement'))+arr(raw.get('achievement')):
    bonuses=[]
    for b in arr(node.get('baserewards',{}).get('bonus')):
        if b.get('@type')!='itemcraftquality':continue
        bonuses.append({'coefficient':float(b['@bonus']),'minTier':int(b.get('@mintier',1)),'maxTier':int(b.get('@maxtier',8)),'patterns':[p['@pattern'] for p in arr(b.get('itempattern'))]})
    if bonuses:nodes[node['@id']]=bonuses
data={'nodes':nodes,'craftChances':[.689,.25,.05,.01,.001],'focusBonus':50,'rerollModifiers':[4.4,5.5,6.6,27.5,0],'rerollChances':[[0,.8,.15,.0495,.0005],[0,.3,.6,.09925,.00075],[0,0,.5,.499,.001],[0,0,0,.995,.005],[0,0,0,0,1]]}
Path('dist/quality-data.js').write_text('/* Public achievements and published crafting/reroll chances. */\nwindow.QUALITY_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print({'qualityNodes':len(nodes)})
