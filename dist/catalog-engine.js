(function(root){'use strict';
const family=id=>String(id).replace(/^T\d+_/,'').replace(/_LEVEL[1-4]/,'').replace(/@[1-4]$/,''),names={weapons:'Оружие',armor:'Броня',offhand:'Левая рука',accessories:'Сумки и плащи',resources:'Ресурсы',materials:'Материалы',food:'Еда',potions:'Зелья',mounts:'Маунты',farming:'Фермерство',journals:'Журналы',furniture:'Мебель',tools:'Инструменты',other:'Прочее'};
const subs={sword:'Мечи',axe:'Топоры',mace:'Булавы',hammer:'Молоты',spear:'Копья',bow:'Луки',crossbow:'Арбалеты',dagger:'Кинжалы',quarterstaff:'Боевые посохи',knuckles:'Боевые перчатки',firestaff:'Огненные посохи',froststaff:'Ледяные посохи',cursestaff:'Проклятые посохи',holystaff:'Святые посохи',naturestaff:'Природные посохи',arcanestaff:'Магические посохи',plate:'Латы',leather:'Кожа',cloth:'Ткань',horse:'Лошади',ox:'Быки',armored:'Бронированные',battle:'Батлмаунты',faction:'Фракционные',rare:'Редкие',transport:'Грузовые',seasonal:'Сезонные',bag:'Сумки',cape:'Плащи',fiber:'Волокно',hide:'Шкуры',wood:'Древесина',ore:'Руда',rock:'Камень',soup:'Супы',salad:'Салаты',pie:'Пироги',omelette:'Омлеты',stew:'Жаркое',sandwich:'Сэндвичи',roast:'Жареное мясо',crop:'Овощи',herb:'Травы',animal:'Животные',seed:'Семена'};
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
 else if(/_BAG|_CAPE|_BACKPACK/.test(id)){main='accessories';sub=id.includes('BAG')?'bag':'cape';}
 else if(r.kind==='refine'||s==='resources'||s==='refinedresources'||/^T\d+_(?:FIBER|HIDE|WOOD|ORE|ROCK|CLOTH|LEATHER|PLANKS|METALBAR)/.test(id)){main='resources';sub=d||r.category||s;}
 else if(c==='farming'||id.includes('_FARM_')||id.includes('_SEED')){main='farming';sub=/SEED/.test(id)?'seed':/_FARM_/.test(id)?'animal':s;}
 else if(c==='crafting'){main='materials';sub=s;}
 else if(c==='furniture'){main='furniture';sub=s;}
 else if(c==='weapons'||r.kind==='gear'){main='weapons';sub=r.category;}
 return {main,sub,label:names[main],subLabel:subs[sub]||sub||'Прочее'};
}
function matches(r,filter={}){const c=category(r),search=String(filter.search||'').toLocaleLowerCase('ru-RU');return (!filter.main||c.main===filter.main)&&(!filter.sub||c.sub===filter.sub)&&(!filter.tier||r.tier===Number(filter.tier))&&(filter.ench===undefined||filter.ench===''||r.ench===Number(filter.ench))&&(!search||(r.name+' '+r.id+' T'+r.tier+'.'+r.ench+' '+c.label+' '+c.subLabel).toLocaleLowerCase('ru-RU').includes(search));}
const api={family,names,subs,publicItem,category,matches};root.CatalogMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
