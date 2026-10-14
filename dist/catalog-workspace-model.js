(function(root){'use strict';
const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').trim();
function createCatalog({catalog,recipes,economy,route,masteryNodes,masteryMatches,math,gear}){
 const byId=new Map(catalog.map(r=>[r.id,{...r}]));
 for(const r of recipes)byId.set(r.id,{...byId.get(r.id),...r});
 for(const r of economy.mounts)byId.set(r.id,{...byId.get(r.id),...r});
 const full=[...byId.values()].filter(math.publicItem),recipeById=new Map(recipes.map(r=>[r.id,r])),publicIds=new Set(full.map(r=>r.id)),cache=new Map(),idSets=new Map(),baseMatches=new Map(),mountIds=new Set(economy.mounts.map(r=>r.id));
 function list(mode){if(cache.has(mode))return cache.get(mode);let result;
  if(['food','potions','refine'].includes(mode))result=full.filter(r=>recipeById.get(r.id)?.kind===mode);
  else if(mode==='gear')result=full.filter(r=>['gear','bags'].includes(recipeById.get(r.id)?.kind));
  else if(mode==='enchant')result=full.filter(r=>recipeById.has(r.id)&&route(r.id,r.id.split('@')[0]+'@3',economy));
  else if(mode==='salvage')result=full.filter(r=>recipeById.has(r.id)&&economy.salvage[r.id]);
  else if(mode==='quality')result=full.filter(r=>recipeById.get(r.id)?.quality);
  else if(mode==='mounts'){const allowed=new Set(economy.mounts.map(r=>r.id));result=full.filter(r=>allowed.has(r.id));}
  else if(mode==='training'||mode==='character'){const patterns=Object.values(masteryNodes).flatMap(n=>n.patterns);result=full.filter(r=>{if(!recipeById.has(r.id))return false;const base=r.id.split('@')[0];if(!baseMatches.has(base))baseMatches.set(base,masteryMatches(base,patterns));return baseMatches.get(base);});}
  else if(mode==='prices'){const ids=new Set(catalog.map(r=>r.id));result=full.filter(r=>ids.has(r.id));}
  else result=[];
  cache.set(mode,result);idSets.set(mode,new Set(result.map(r=>r.id)));return result;
 }
 function accepts(mode,id){list(mode);return idSets.get(mode).has(id);}
 function target(id,mode){if(!publicIds.has(id))return null;const r=recipeById.get(id);mode=mode||(r?(r.kind==='bags'?'gear':r.kind):mountIds.has(id)?'mounts':'prices');return accepts(mode,id)?{type:'item',id,mode}:null;}
 function category(r){const c=math.category(r),translated=gear.categories.find(g=>g.id===c.sub)?.name;let label=translated||c.subLabel;
  const labels={artifact:'Артефакты',artifacts:'Артефакты',artefacts:'Артефакты',rune:'Руны',runes:'Руны',souls:'Души',soul:'Души',relic:'Реликвии',relics:'Реликвии',tokens:'Жетоны',shapeshifterstaff:'Посохи оборотня'};
  label=labels[c.sub]||label;if(!label||/^[a-z0-9_ -]+$/i.test(label)){c.sub='other';label='Прочее';}
  return {...c,subLabel:label};
 }
 return {full,byId,recipeById,list,accepts,target,category};
}
function createIndex(records,math){
 const collator=new Intl.Collator('ru'),entries=records.map((r,i)=>({...r,index:i,nameOrder:0})),words=new Map(),tiers=new Map(),enchants=new Map(),cache=new Map();
 const add=(map,key,i)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(i);};
 [...entries].sort((a,b)=>collator.compare(a.label,b.label)||a.index-b.index).forEach((r,i)=>r.nameOrder=i);
 for(const e of entries){const d=math.wordsFor(e.searchable);e.data=d;for(const w of new Set(d.words))add(words,w,e.index);if(d.tier!==null)add(tiers,Number(d.tier),e.index);if(d.ench!==null)add(enchants,Number(d.ench),e.index);}
 function search(text){const normalized=normalize(text);if(cache.has(normalized))return cache.get(normalized);const q=math.parseSearch(text);if(q.invalid)return [];
  let candidates=null;const intersect=set=>{candidates=candidates===null?new Set(set):new Set([...candidates].filter(i=>set.has(i)));};
  if(q.tier!==null)intersect(tiers.get(q.tier)||new Set());if(q.ench!==null)intersect(enchants.get(q.ench)||new Set());
  if(!q.idFragment)for(const token of q.tokens){const matches=new Set();for(const [word,indices]of words)if(math.wordMatch(word,token))for(const i of indices)matches.add(i);intersect(matches);if(!candidates.size)break;}
  const source=candidates===null?entries:[...candidates].map(i=>entries[i]),results=[];
  for(const e of source){if(!math.searchMatch(e.searchable,q))continue;const exactId=normalize(e.searchable.id)===normalized,exactName=normalize(e.searchable.name)===normalized,exactWords=q.tokens.length&&q.tokens.every(t=>e.data.words.includes(t)),prefix=q.tokens.every(t=>e.data.words.some(w=>w.startsWith(t)));const score=exactId?0:exactName?1:exactWords?2:prefix?3:4;results.push({...e,score});}
  results.sort((a,b)=>a.score-b.score||(a.recentRank??99)-(b.recentRank??99)||a.nameOrder-b.nameOrder);if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(normalized,results);return results;
 }
 return {search,size:entries.length};
}
const PANEL_KEY='albion-catalog-panels-v1',SEARCH_KEY='albion-command-search-v1',clone=x=>JSON.parse(JSON.stringify(x));
function panelDefaults(){return {search:'',main:'',sub:'',tier:'',ench:'',recipeCategory:'',page:0,scroll:0,widthRatio:.35,hidden:true,pinned:false};}
function readPanels(storage){const raw=storage.getItem(PANEL_KEY);if(!raw)return {version:1,modes:{}};const d=JSON.parse(raw);if(d.version!==1||!d.modes||typeof d.modes!=='object'||Array.isArray(d.modes))throw Error('Настройки каталога повреждены. Исходные данные сохранены.');for(const [mode,value]of Object.entries(d.modes)){if(['__proto__','constructor','prototype'].includes(mode)||!value||typeof value!=='object'||typeof value.search!=='string'||typeof value.hidden!=='boolean'||value.pinned!==undefined&&typeof value.pinned!=='boolean'||!Number.isFinite(value.widthRatio)||!Number.isFinite(value.page)||!Number.isFinite(value.scroll))throw Error('Настройки каталога повреждены.');for(const key of ['main','sub','tier','ench','recipeCategory'])if(value[key]!==undefined&&typeof value[key]!=='string')throw Error('Фильтр каталога повреждён.');d.modes[mode]={...panelDefaults(),...value,pinned:value.pinned===true,hidden:value.pinned===true?value.hidden:true,widthRatio:Math.max(.1,Math.min(.45,value.widthRatio)),page:Math.max(0,Math.floor(value.page)),scroll:Math.max(0,value.scroll)};}return d;}
function readRecent(storage,validateTarget){const raw=storage.getItem(SEARCH_KEY);if(!raw)return {version:1,items:[]};const d=JSON.parse(raw);if(d.version!==1||!Array.isArray(d.items)||d.items.length>10)throw Error('История переходов повреждена. Исходные данные сохранены.');for(const x of d.items){validateTarget(x.target);if(typeof x.label!=='string'||x.label.length>200||x.favoriteId!==undefined&&typeof x.favoriteId!=='string')throw Error('История переходов повреждена.');if(x.context&&(!['europe','west','east'].includes(x.context.server)||typeof x.context.characterId!=='string'))throw Error('Контекст перехода повреждён.');}return d;}
function remember(data,item,targetKey){const key=targetKey(item.target)+'|'+(item.favoriteId||'')+'|'+JSON.stringify(item.context||null);return {version:1,items:[clone(item),...data.items.filter(x=>targetKey(x.target)+'|'+(x.favoriteId||'')+'|'+JSON.stringify(x.context||null)!==key)].slice(0,10)};}
function panelWidth(area,ratio){return Math.max(260,Math.min(area*.45,area-504,area*ratio));}
const api={normalize,createCatalog,createIndex,PANEL_KEY,SEARCH_KEY,panelDefaults,readPanels,readRecent,remember,panelWidth};root.CatalogWorkspaceMath=api;if(typeof module!=='undefined')module.exports=api;
if(root.PRICE_CATALOG&&root.ALBION_DATA)root.CatalogContract=createCatalog({catalog:root.PRICE_CATALOG,recipes:root.ALBION_DATA.recipes,economy:root.ECONOMY_DATA,route:root.EconomyMath.route,masteryNodes:root.MASTERY_DATA.nodes,masteryMatches:root.MasteryMath.matches,math:root.CatalogMath,gear:root.GEAR_META});
})(typeof window!=='undefined'?window:globalThis);
