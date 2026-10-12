(function(root){'use strict';
const KEY='albion-character-profiles-v1',LEVELS='albion-character-mastery-v1',clone=x=>JSON.parse(JSON.stringify(x));
function create(storage,normalize){
 let data;const raw=storage.getItem(KEY);
 if(raw){data=JSON.parse(raw);const ids=new Set();if(data.version!==1||!Array.isArray(data.profiles)||!data.profiles.length||data.profiles.length>20)throw Error('Не удалось прочитать профили персонажей.');for(const p of data.profiles){if(typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!p.levels||typeof p.levels!=='object'||Array.isArray(p.levels))throw Error('Профили персонажей повреждены.');ids.add(p.id);p.levels=normalize(p.levels)}if(!ids.has(data.active))throw Error('Активный персонаж не найден.');}
 else{let levels={};try{levels=normalize(JSON.parse(storage.getItem(LEVELS)||'{}'))}catch{}data={version:1,active:'primary',profiles:[{id:'primary',name:'Основной персонаж',levels}]};}
 function persist(next){
  const oldProfiles=storage.getItem(KEY),oldLevels=storage.getItem(LEVELS);
  try{storage.setItem(KEY,JSON.stringify(next));storage.setItem(LEVELS,JSON.stringify(next.profiles.find(p=>p.id===next.active).levels));}
  catch(error){try{if(oldProfiles===null)storage.removeItem(KEY);else storage.setItem(KEY,oldProfiles);if(oldLevels===null)storage.removeItem(LEVELS);else storage.setItem(LEVELS,oldLevels);}catch{}throw error;}
  data=next;return clone(data);
 }
 // A previous desktop version may have edited the legacy active profile.
 if(raw&&storage.getItem(LEVELS)!==null){try{data.profiles.find(p=>p.id===data.active).levels=normalize(JSON.parse(storage.getItem(LEVELS)))}catch{}}
 persist(data);
 const active=()=>data.profiles.find(p=>p.id===data.active);
 function name(value,id){value=String(value).trim();if(!value||value.length>40)throw Error('Введите имя до 40 символов.');if(data.profiles.some(p=>p.id!==id&&p.name.toLocaleLowerCase('ru-RU')===value.toLocaleLowerCase('ru-RU')))throw Error('Персонаж с таким именем уже существует.');return value;}
 return {snapshot:()=>clone(data),levels:()=>clone(active().levels),
  update(values){const next=clone(data);next.profiles.find(p=>p.id===next.active).levels=normalize(values);return persist(next)},
  select(id){if(!data.profiles.some(p=>p.id===id))throw Error('Персонаж не найден.');return persist({...clone(data),active:id})},
  add(value,copy=false){if(data.profiles.length>=20)throw Error('Можно добавить не больше 20 персонажей.');const label=name(value),id=root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);return persist({...clone(data),active:id,profiles:[...clone(data.profiles),{id,name:label,levels:copy?clone(active().levels):{},focusObservations:copy?clone(active().focusObservations||{}):{}}]})},
  observeFocus(recipe,cost,eff){const next=clone(data),p=next.profiles.find(p=>p.id===next.active);p.focusObservations||={};if(cost===null)delete p.focusObservations[recipe];else{cost=Number(cost);eff=Number(eff);if(!Number.isFinite(cost)||cost<=0||cost>1000000||!Number.isFinite(eff)||eff<0)throw Error('Введите положительный расход за одну операцию.');p.focusObservations[recipe]={cost:Math.ceil(cost),eff};}return persist(next)},
  rename(value){const label=name(value,data.active),next=clone(data);next.profiles.find(p=>p.id===next.active).name=label;return persist(next)},
  remove(id){if(data.profiles.length===1)throw Error('Оставьте хотя бы одного персонажа.');if(!data.profiles.some(p=>p.id===id))throw Error('Персонаж не найден.');const profiles=clone(data.profiles).filter(p=>p.id!==id);return persist({...data,profiles,active:data.active===id?profiles[0].id:data.active})}
 };
}
root.CharacterProfileMath={KEY,LEVELS,create};if(typeof module!=='undefined')module.exports=root.CharacterProfileMath;
if(root.MasteryProfile&&root.MASTERY_DATA){try{root.CharacterProfiles=create(root.localStorage,v=>root.MasteryProfile.normalize(v,root.MASTERY_DATA))}catch(error){root.CharacterProfilesError=error.message}}
})(typeof window!=='undefined'?window:globalThis);
