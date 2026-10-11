(function(root){'use strict';
 const categories=[['food','Еда'],['potions','Зелья'],['armor','Броня'],['weapons','Оружие'],['refine','Ресурсы'],['accessories','Сумки и плащи'],['tools','Инструменты']];
 function normalize(values,data){const result={};if(!values||typeof values!=='object'||Array.isArray(values))return result;for(const [id,n]of Object.entries(data.nodes)){const v=Number(values[id]);if(Number.isFinite(v)&&v>0)result[id]=Math.min(n.maxLevel,Math.max(0,Math.floor(v)))}return result}
 function catalog(data,recipes,gear,math){
  const masters=Object.values(data.nodes).filter(n=>n.kind==='mastery').map(n=>n.id).sort((a,b)=>b.length-a.length),groups=new Map();
  const representatives=recipes.filter(r=>!r.ench).sort((a,b)=>Math.abs(a.tier-4)-Math.abs(b.tier-4));
  for(const n of Object.values(data.nodes)){
   let category,group;
   if(n.id.startsWith('FARM_COOK')){category='food';group='FARM_COOK'}
   else if(n.id.startsWith('FARM_ALCHEMIST')){category='potions';group='FARM_ALCHEMIST'}
   else if(n.id.startsWith('CRAFT_REFINE_')){category='refine';group=n.id.replace(/_T\d+$/,'')}
   else{group=masters.find(id=>n.id===id||n.id.startsWith(id+'_'))||n.id;category=/CRAFT_(CLOTH|LEATHER|PLATE)_/.test(n.id)?'armor':/^CRAFT_(BAG|CAPE)/.test(n.id)?'accessories':/^CRAFT_TOOL_/.test(n.id)?'tools':'weapons'}
   const representative=representatives.find(r=>math.matches(r.id,n.patterns));
   if(!groups.has(group))groups.set(group,{id:group,category,nodes:[],name:''});
   groups.get(group).nodes.push({...n,icon:representative?.id,recipe:representative?.id});
  }
  const names={FARM_COOK:'Повар',FARM_ALCHEMIST:'Алхимик',CRAFT_BAG:'Сумки',CRAFT_CAPE:'Плащи',CRAFT_BOOKS:'Магические книги',CRAFT_SHIELDS:'Щиты',CRAFT_TORCHES:'Факелы',CRAFT_REFINE_FIBER:'Ткань',CRAFT_REFINE_HIDE:'Кожа',CRAFT_REFINE_ORE:'Слитки',CRAFT_REFINE_ROCK:'Каменные блоки',CRAFT_REFINE_WOOD:'Брусья',CRAFT_TOOL_AXE:'Дровосек',CRAFT_TOOL_FISHINGROD:'Рыбак',CRAFT_TOOL_HAMMER:'Каменолом',CRAFT_TOOL_KNIFE:'Свежеватель',CRAFT_TOOL_PICK:'Шахтёр',CRAFT_TOOL_SICKLE:'Жнец',CRAFT_TOOL_SIEGEHAMMER:'Осадные инструменты',CRAFT_TOOL_TRACKING:'Следопыт'};
  const foodNames={FARM_COOK_STEW:'Жаркое',FARM_COOK_SOUP:'Супы',FARM_COOK_SALAD:'Салаты',FARM_COOK_PIE:'Пироги',FARM_COOK_OMELETTE:'Омлеты',FARM_COOK_SANDWICH:'Сэндвичи',FARM_COOK_ROAST:'Жареное мясо',FARM_COOK_MEAT:'Разделка мяса',FARM_COOK_PRODUCTS:'Хлеб, мука и масло'};
  return [...groups.values()].map(g=>{
   const master=g.nodes.find(n=>n.kind==='mastery'),r=recipes.find(r=>r.id===master?.recipe),cat=gear.categories.find(c=>c.id===r?.category);
   g.name=names[g.id]||cat?.name||master?.name.replace(/^Мастерство:?\s*/,'')||g.nodes[0].name;
   g.nodes.sort((a,b)=>Number(b.kind==='mastery')-Number(a.kind==='mastery')||a.name.localeCompare(b.name,'ru'));
   for(const n of g.nodes)n.label=n.kind==='mastery'?'Общее мастерство':foodNames[n.id]||n.name;
   return g;
  }).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 }
 function prepare(recipe,config,levels,data,math){config.masteryLevels=levels;if(config.focusSource!=='manual'||!config.explicitManualFocus){config.focusSource='levels';config.eff=math.efficiency(recipe,levels,data)}return config}
 const api={categories,normalize,catalog,prepare};root.MasteryProfile=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
