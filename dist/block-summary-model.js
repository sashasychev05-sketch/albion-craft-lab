(function(root){'use strict';
const fmt=value=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:2}),positive=value=>Number.isFinite(Number(value))&&Number(value)>0;
const result=(parts,warning='',focusId='')=>({text:parts.filter(Boolean).join(' · '),warning,focusId,ready:!warning});
const quality=['Обычное','Хорошее','Выдающееся','Отличное','Шедевр'],saleNames={sell:'Ордер продажи',buy:'Мгновенная продажа',discord:'Прямая сделка'};
function craft(kind,snapshot){
 const {recipe:r,config:c,result:calculation}=snapshot;
 if(kind==='item')return r?.id?result([r.name,'T'+r.tier+'.'+r.ench,r.quality?quality[Number(c.quality)-1]:null]):result([],'Выберите предмет','product');
 if(kind==='production'){
  const place=c.craftPlace==='hideout'?'Убежище гильдии':c.craftCity+(c.craftPlace==='island'?' · остров':'');
  let warning='',focusId='';
  if(!snapshot.placeReady){warning='Нужен возврат в убежище';focusId='hideout-return';}
  else if(!positive(calculation.amount)){warning='Нужен объём партии';focusId=c.focus&&c.volumeMode==='focus'?'focus-budget':'quantity';}
  else if(calculation.planErrors?.length){warning='Проверьте цепочку производства';}
  const parts=[positive(calculation.amount)?fmt(calculation.amount)+' шт.':'Объём не задан',place,c.focus?'С фокусом':'Без фокуса'];
  if(c.focus&&c.volumeMode==='focus')parts.push('Бюджет '+fmt(c.focusBudget));
  if(snapshot.placeReady&&Number.isFinite(Number(c.rrr)))parts.push('Возврат '+fmt(c.rrr)+'%');
  return result(parts,warning,focusId);
 }
 if(kind==='sale'&&calculation.sales)return result([calculation.sales.demand?'По объёму продаж':'По городам',fmt(calculation.sales.assigned)+' из '+fmt(calculation.amount)+' шт.',...calculation.sales.rows.filter(r=>r.quantity>0).map(r=>r.city)],calculation.saleReady?'':'Проверьте распределение продажи','city-sale-mode');
 if(kind==='sale')return result([c.sellCity,saleNames[c.saleMode]||c.saleMode,positive(c.salePrice)?fmt(c.salePrice)+' / шт.':'Цена не задана',positive(c.salePrice)?c.manualSale?'Вручную':'Рынок':null],positive(c.salePrice)?'':'Нужна цена продажи','sale-price');
}
function luxury(kind,{item,config:c,quantity}){
 if(kind==='item')return item?.id?result([item.name,'T'+item.tier,fmt(item.weight)+' кг / шт.']):result([],'Выберите предмет','art-product');
 if(kind==='cargo'){const warning=!positive(c.capacity)?'Нужна грузоподъёмность':!positive(quantity)?'Нет груза':'',focusId=!positive(c.capacity)||c.quantityMode==='capacity'?'art-capacity':'art-quantity';return result([fmt(quantity)+' шт.',fmt(c.capacity)+' кг свободно',c.quantityMode==='capacity'?'По грузоподъёмности':'Количество вручную'],warning,focusId);}
 if(kind==='route'){const buy=positive(c.buyPrice),sell=positive(c.sellPrice);return result([c.buyCity+' → '+c.sellCity,'Покупка '+(buy?fmt(c.buyPrice):'не задана'),'Продажа '+(sell?fmt(c.sellPrice):'не задана')],!buy&&!sell?'Нужны цены покупки и продажи':!buy?'Нужна цена покупки':!sell?'Нужна цена продажи':'',!buy?'art-buy-price':'art-sell-price');}
}
function generic(fields){
 const useful=fields.filter(f=>f.label&&f.type!=='search');if(!useful.length)return null;
 const missing=useful.find(f=>f.invalid||f.value===''&&f.type!=='checkbox'||f.needsPositive&&!positive(f.value));
 const parts=useful.slice(0,4).map(f=>f.label+': '+(f.type==='checkbox'?f.checked?'да':'нет':f.value===''?'не указано':f.type==='number'?fmt(f.value):f.value));
 if(useful.length>4)parts.push('Ещё '+(useful.length-4));
 return result(parts,missing?'Уточните: '+missing.label:'',missing?.id||'');
}
const api={craft,luxury,generic};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BlockSummaryModel=api;
})(typeof window!=='undefined'?window:globalThis);
