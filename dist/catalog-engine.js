(function(root){'use strict';
const family=id=>String(id).replace(/^T\d+_/,'').replace(/_LEVEL[1-4]/,'').replace(/@[1-4]$/,''),names={weapons:'Оружие',armor:'Броня',offhand:'Левая рука',accessories:'Сумки и плащи',resources:'Ресурсы',materials:'Материалы',food:'Еда',potions:'Зелья',mounts:'Маунты',farming:'Фермерство',journals:'Журналы',furniture:'Мебель',tools:'Инструменты',other:'Прочее'};
const subs={sword:'Мечи',axe:'Топоры',mace:'Булавы',hammer:'Молоты',spear:'Копья',bow:'Луки',crossbow:'Арбалеты',dagger:'Кинжалы',quarterstaff:'Боевые посохи',knuckles:'Боевые перчатки',firestaff:'Огненные посохи',froststaff:'Ледяные посохи',cursestaff:'Проклятые посохи',holystaff:'Святые посохи',naturestaff:'Природные посохи',arcanestaff:'Магические посохи',plate:'Латы',leather:'Кожа',cloth:'Ткань',horse:'Лошади',ox:'Быки',armored:'Бронированные',battle:'Батлмаунты',faction:'Фракционные',rare:'Редкие',transport:'Грузовые',seasonal:'Сезонные',bag:'Сумки',satchel:'Кошели интуиции',cape:'Плащи',fiber:'Волокно',hide:'Шкуры',wood:'Древесина',ore:'Руда',rock:'Камень',soup:'Супы',salad:'Салаты',pie:'Пироги',omelette:'Омлеты',stew:'Жаркое',sandwich:'Сэндвичи',roast:'Жареное мясо',crop:'Овощи',herb:'Травы',animal:'Животные',seed:'Семена'};
function publicItem(r){return !!r?.id&&!/(_TEST(?:_|$)|_DEBUG|_EXP_TOKEN_|^QUESTITEM_CARAVAN)/.test(r.id)&&r.name!==r.id;}
function category(r){const id=r.id||'',c=r.category||'',s=r.subCategory||'',d=r.detailCategory||'';let main='other',sub=s;
 if(id.includes('MOUNT_')||c==='mounts'){main='mounts';sub=c==='battle_mount'||s==='battle_mount'||r.mountCategory==='BATTLE_MOUNTS'?'battle':/ARMORED_HORSE/.test(id)?'armored':/_MOUNT_HORSE$/.test(id)?'horse':/_MOUNT_OX$/.test(id)?'ox':/FACTION/.test(id)||c==='factionmounts'||s==='factionmounts'?'faction':/MAMMOTH|TRANSPORT/.test(id)?'transport':/SEASON|CRYSTAL/.test(id)?'seasonal':'rare';}
 else if(id.includes('JOURNAL_')){main='journals';sub=/WARRIOR/.test(id)?'Кузнец':/HUNTER/.test(id)?'Лучник':/MAGE/.test(id)?'Маг':/TOOLMAKER/.test(id)?'Ремесленник':'Сбор и трофеи';}
 else if(id.includes('_MEAL_')||r.kind==='food'){main='food';sub=(id.match(/_MEAL_(SOUP|SALAD|PIE|OMELETTE|STEW|SANDWICH|ROAST)/)?.[1]||'other').toLowerCase();}
 else if(id.includes('_POTION_')||r.kind==='potions'){main='potions';sub='Все зелья';}
 else if(id.includes('TOOL_')){main='tools';sub='tools';}
 else if(c==='weapons'){main='weapons';sub=s;}
 else if(/^T\d+_(HEAD|ARMOR|SHOES)_/.test(id)){main='armor';sub=id.includes('_PLATE_')?'plate':id.includes('_LEATHER_')?'leather':id.includes('_CLOTH_')?'cloth':'Снаряжение собирателя';}
 else if(/^T\d+_OFF_/.test(id)){main='offhand';sub='Левая рука';}
 else if(/_BAG|_CAPE|_BACKPACK/.test(id)){main='accessories';sub=id.includes('BAG_INSIGHT')?'satchel':id.includes('BAG')?'bag':'cape';}
 else if(r.kind==='refine'||s==='resources'||s==='refinedresources'||/^T\d+_(?:FIBER|HIDE|WOOD|ORE|ROCK|CLOTH|LEATHER|PLANKS|METALBAR)/.test(id)){main='resources';sub=d||r.category||s;}
 else if(c==='farming'||id.includes('_FARM_')||id.includes('_SEED')){main='farming';sub=/SEED/.test(id)?'seed':/_FARM_/.test(id)?'animal':s;}
 else if(c==='crafting'){main='materials';sub=s;}
 else if(c==='furniture'){main='furniture';sub=s;}
 else if(c==='weapons'||r.kind==='gear'){main='weapons';sub=r.category;}
 return {main,sub,label:names[main],subLabel:subs[sub]||sub||'Прочее'};
}
const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е'),queryCache=new Map(),wordCache=new WeakMap(),shortcuts={перчи:'перчат',перч:'перчат',ава:'авалон',авал:'авалон',инту:'интуиц'};
function parseSearch(value){if(value&&typeof value==='object'&&Array.isArray(value.tokens))return value;const original=normalize(value).trim();if(queryCache.has(original))return queryCache.get(original);let text=original;const result={tokens:[],tier:null,ench:null,invalid:false,idFragment:/^[a-z0-9_]+(?:@[0-4])?$/.test(original)&&original.includes('_')?original:null},set=(key,v)=>{if(result[key]!==null&&result[key]!==Number(v))result.invalid=true;result[key]=Number(v);};
 text=text.replace(/(?:^|\s)(?:(?:[tт]|тир)\s*)?([1-8])\s*(?:[.,]\s*|\s+)([0-4])(?=\s|$)/g,(_,tier,ench)=>{set('tier',tier);set('ench',ench);return ' ';});
 text=text.replace(/(?:^|\s)(?:[tт]|тир)\s*([1-8])(?=\s|$)/g,(_,tier)=>{set('tier',tier);return ' ';});
 text=text.replace(/(?:^|\s)[.,+]\s*([0-4])(?=\s|$)/g,(_,ench)=>{set('ench',ench);return ' ';});
 text=text.replace(/(?:^|\s)([1-8])(?=\s|$)/g,(_,tier)=>{set('tier',tier);return ' ';});
 result.tokens=(text.match(/[\p{L}\p{N}]+/gu)||[]).map(t=>shortcuts[t]||t);if(result.tokens.includes('авалон'))result.tokens=result.tokens.map(t=>t==='пе'?'перчат':t);if(queryCache.size>=256)queryCache.delete(queryCache.keys().next().value);queryCache.set(original,result);return result;
}
function wordsFor(value){const r=typeof value==='object'&&value!==null?value:null;if(r&&wordCache.has(r))return wordCache.get(r);const c=r?category(r):{},aliases=r?[/AVALON/i.test(r.id||'')?'авалон авалонские авалонский':'',/KNUCKLES/i.test(r.id||'')?'боевые перчатки':''].join(' '):'',raw=r?[r.name,r.id,r.label,r.searchText,c.label,c.subLabel,aliases].join(' '):String(value??''),text=normalize(raw),words=text.match(/[\p{L}\p{N}]+/gu)||[],variant=text.match(/(?:^|\s)[tт]([1-8])\s*[.,]\s*([0-4])\b/),idTier=String(r?.id||'').match(/^T([1-8])_/i),idEnch=String(r?.id||'').match(/@([0-4])$/),data={text,words,tier:r?.tier??(idTier?Number(idTier[1]):variant?Number(variant[1]):null),ench:r?.ench??(r?.id&&idTier?Number(idEnch?.[1]||0):variant?Number(variant[2]):null)};if(r)wordCache.set(r,data);return data;}
function oneEdit(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a[i]===b[j+1]&&a[i+1]===b[j]){i+=2;j+=2;continue;}if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(i<a.length||j<b.length?1:0)<=1;}
function wordMatch(word,token){if(/^[0-9]+$/.test(token))return word===token;if(word.startsWith(token))return true;return token.length>=4&&word.length>=4&&[-1,0,1].some(delta=>oneEdit(token,word.slice(0,token.length+delta)));}
function searchMatch(value,query){const q=parseSearch(query);if(q.invalid)return false;if(!q.tokens.length&&q.tier===null&&q.ench===null&&!q.idFragment)return true;const data=wordsFor(value);if(q.tier!==null&&(data.tier===null||Number(data.tier)!==q.tier)||q.ench!==null&&(data.ench===null||Number(data.ench)!==q.ench))return false;if(q.idFragment)return data.text.includes(q.idFragment);return q.tokens.every(t=>data.words.some(w=>wordMatch(w,t)));}
function matches(r,filter={}){const c=category(r);return (!filter.main||c.main===filter.main)&&(!filter.sub||c.sub===filter.sub)&&(!filter.tier||r.tier===Number(filter.tier))&&(filter.ench===undefined||filter.ench===''||r.ench===Number(filter.ench))&&searchMatch(r,filter.search);}
const api={family,names,subs,publicItem,category,matches,parseSearch,searchMatch};root.CatalogMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
