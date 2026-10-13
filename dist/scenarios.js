(function(root){'use strict';
const KEY='albion-scenarios-v1',servers=['europe','west','east'];
const clone=x=>JSON.parse(JSON.stringify(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function safeTree(value,depth=0){
 if(depth>30)throw Error('Слишком сложные параметры расчёта.');
 if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Повреждённые параметры расчёта.');safeTree(item,depth+1)}
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('Некорректное число в расчёте.');
}
function validate(record){
 if(!object(record)||typeof record.recipeId!=='string'||record.recipeId.length>150||!servers.includes(record.server)||!object(record.config)||!object(record.overrides))throw Error('Сохранённый расчёт повреждён.');
 safeTree(record);
 const c=record.config;
 for(const key of ['quantity','focusBudget','rrr','station','salePrice','eff'])if(c[key]!==undefined&&(!Number.isFinite(Number(c[key]))||Number(c[key])<0))throw Error('Некорректные параметры расчёта.');
 if(c.volumeMode!==undefined&&!['quantity','focus'].includes(c.volumeMode))throw Error('Некорректный режим объёма.');
 if(c.craftPlace!==undefined&&!['city','island','hideout'].includes(c.craftPlace))throw Error('Некорректное место производства.');
 if(c.rrr>95||c.quantity>100000000||c.focusBudget>3000000)throw Error('Параметры превышают допустимый объём.');
 return clone(record);
}
function read(storage){
 const text=storage.getItem(KEY);if(!text)return {version:1,items:[],selected:[]};
 const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.items)||data.items.length>100||!Array.isArray(data.selected))throw Error('Не удалось прочитать сохранённые расчёты.');
 if(data.temporary!==undefined&&(!Array.isArray(data.temporary)||data.temporary.length>4))throw Error('Повреждены временные варианты сравнения.');
 const ids=new Set();for(const item of [...data.items,...(data.temporary||[])]){validate(item);if(typeof item.id!=='string'||ids.has(item.id)||typeof item.name!=='string'||item.name.length>80)throw Error('Сохранённые расчёты повреждены.');ids.add(item.id)}
 return {...data,selected:[...new Set(data.selected)].filter(id=>ids.has(id)).slice(0,4)};
}
function write(storage,data){storage.setItem(KEY,JSON.stringify(data));return data}
function add(storage,data,name,record){
 name=String(name).trim();if(!name||name.length>80)throw Error('Введите название до 80 символов.');
 if(data.items.length>=100)throw Error('Сохранено 100 вариантов. Удалите ненужный перед добавлением нового.');
 const item={...validate(record),id:root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name,createdAt:new Date().toISOString()};
 const selected=data.selected.filter(id=>[...data.items,...(data.temporary||[])].some(x=>x.id===id&&x.server===item.server));
 if(selected.length<4)selected.push(item.id);
 return write(storage,{...data,version:1,items:[...data.items,item],selected});
}
function remove(storage,data,id){const next={...data,items:data.items.filter(x=>x.id!==id),selected:data.selected.filter(x=>x!==id)};if(data.temporary)next.temporary=data.temporary.filter(x=>x.id!==id);return write(storage,next)}
function select(storage,data,ids){
 ids=[...new Set(ids)];if(ids.length>4)throw Error('Можно сравнить не больше четырёх вариантов.');
 return write(storage,{...data,selected:ids.filter(id=>[...data.items,...(data.temporary||[])].some(x=>x.id===id))});
}
function quick(storage,data,name,record,destination){if(!['save','compare','both'].includes(destination))throw Error('Выберите, куда добавить расчёт.');name=String(name).trim();if(!name||name.length>80)throw Error('Введите название до 80 символов.');record=validate(record);const all=[...data.items,...(data.temporary||[])],selected=data.selected.filter(id=>all.some(x=>x.id===id&&x.server===record.server));if(destination!=='save'&&selected.length>=4)throw Error('В сравнении уже четыре варианта. Уберите один перед добавлением.');if(destination!=='compare'&&data.items.length>=100)throw Error('Сохранено 100 вариантов. Удалите ненужный.');const item={...record,id:root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name,createdAt:new Date().toISOString()},next={...data,items:[...data.items],selected:destination==='save'?[...data.selected]:[...selected,item.id]};if(destination==='compare'){next.temporary=(data.temporary||[]).filter(x=>selected.includes(x.id));next.temporary.push(item);}else next.items.push(item);return write(storage,next);}
function volume(recipe,config,action){
 const focus=['food','potions','gear'].includes(recipe.kind)&&config.focus&&config.volumeMode==='focus';
 if(action==='one')return {volumeMode:'quantity',quantity:recipe.output};
 const factor=action==='half'?.5:action==='double'?2:null;if(factor===null)throw Error('Неизвестное изменение объёма.');
 if(focus)return {focusBudget:Math.min(3000000,Math.max(0,Math.floor(Number(config.focusBudget)*factor)))};
 const maximum=Math.floor(100000000/recipe.output)*recipe.output;
 const operations=Math.floor(Number(config.quantity)/recipe.output);
 return {quantity:Math.min(maximum,Math.max(recipe.output,Math.ceil(operations*factor)*recipe.output))};
}
function best(rows,metric){
 const usable=rows.filter(x=>(metric==='unitCost'?x.costReady:x.valid)&&Number.isFinite(x.result[metric]));if(!usable.length)return null;
 return usable.reduce((a,b)=>metric==='unitCost'?(b.result[metric]<a.result[metric]?b:a):(b.result[metric]>a.result[metric]?b:a)).id;
}
function csv(rows){return '\ufeff'+rows.map(row=>row.map(value=>{if(typeof value==='string'&&/^[\s]*[=+@-]/.test(value))value="'"+value;return '"'+String(value??'').replace(/"/g,'""')+'"'}).join(';')).join('\r\n')}
const api={KEY,clone,validate,read,add,quick,remove,select,volume,best,csv};root.ScenarioMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
