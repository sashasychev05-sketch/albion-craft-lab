(() => {
 'use strict';
 const A=window.CraftApp,S=window.ScenarioMath;
 // The calculations below use cloned settings and never replace the open draft.
 A.saveVariant=()=>({recipeId:A.snapshot().recipe.id,server:state.server,config:S.clone(cfg),overrides:S.clone(state.overrides)});
 A.restoreVariant=record=>{
  record=S.validate(record);const r=D.recipes.find(x=>x.id===record.recipeId);if(!r)throw Error('Предмет больше не найден в каталоге.');
  if(state.server!==record.server){state.server=record.server;state.quotes={};state.histories={};state.drafts={};state.lastUpdate=null;$('server').value=record.server;}
  switchMode(r.kind);chooseRecipe(r.id);cfg={...defaults(r),...S.clone(record.config)};
  state.drafts[state.mode+'|'+r.id]=cfg;state.overrides=S.clone(record.overrides);
  if(!cfg.manualReturn)automaticReturn();rememberStation();syncRecipePicker();
  for(const [id,key]of Object.entries(fields))if($(id).type==='checkbox')$(id).checked=cfg[key];else $(id).value=cfg[key]??'';
  render();persist();scheduleMarketRefresh();document.dispatchEvent(new Event('change'));
 };
 A.evaluateVariant=(record,market)=>{
  record=S.validate(record);const r=D.recipes.find(x=>x.id===record.recipeId);
  if(!r||record.server!==state.server)return {valid:false,costReady:false,reason:!r?'Предмет не найден':'Выберите сервер '+record.server,recipe:r,result:{},config:record.config};
  const c={...defaults(r),...S.clone(record.config)};window.MasteryUI.prepare(r,c);
  const row=(id,city,q)=>market?market.row(record.server,id,city,q):quoteRow(id,city,q);
  const hist=(id,city,q)=>market?market.history(record.server,id,city,q):history(id,city,q);
  function price(id,city,q=1,mode='sell',useBook=true){
   const p=row(id,city,q),h=hist(id,city,q),field=mode==='buy'?'buy_price_max':'sell_price_min';
   const peers=cities.filter(x=>x!==city).map(x=>row(id,x,q)).filter(x=>M.age(x?.[field+'_date'])<=24).map(x=>Number(x[field]));
   const assessed={...M.assess({price:mode==='discord'?h?.avg:p?.[field],timestamp:p?.[field+'_date'],history:h,peers,historical:mode==='discord'}),city};return useBook&&window.PriceBook?window.PriceBook.resolve(record.server,id,city,q,'buy',assessed,p?.[field+'_date']):assessed;
  }
  if(!c.manualSale){const quality=Number(c.quality||1),sale=price(r.id,c.sellCity,quality,c.saleMode,false),h=hist(r.id,c.sellCity,quality);let assessed={...sale,price:sale.price&&h?.days>=3&&h.daily>=1&&M.age(h.to+'T23:59:59Z')<=72?sale.price:0};if(c.saleMode!=='discord'&&window.PriceBook)assessed=window.PriceBook.resolve(record.server,r.id,c.sellCity,quality,c.saleMode==='buy'?'bid':'sell',assessed,row(r.id,c.sellCity,quality)?.[(c.saleMode==='buy'?'buy_price_max':'sell_price_min')+'_date']);c.salePrice=assessed.price;}
  const quote=(id,material)=>{
   material=material||r.alternatives?.[Number(c.recipeIndex||0)]?.mats.find(x=>x.id===id)||r.mats.find(x=>x.id===id);
   if(material?.cityOverride)return price(id,material.cityOverride,material.preserveQuality?Number(c.quality||1):1);
   if(material?.purpose==='journal-sale'){const city=material.city||(c.sellCity==='Black Market'?c.craftCity:c.sellCity),quality=1,sale=price(id,city,quality,c.saleMode,false),h=hist(id,city,quality);let assessed={...sale,price:sale.price&&h?.days>=3&&h.daily>=1&&M.age(h.to+'T23:59:59Z')<=72?sale.price:0};return window.PriceBook?window.PriceBook.resolve(record.server,id,city,1,c.saleMode==='buy'?'bid':'sell',assessed,row(id,city,1)?.[(c.saleMode==='buy'?'buy_price_max':'sell_price_min')+'_date']):assessed;}if(material?.purpose==='journal-buy'&&material.city)return price(id,material.city,1);
   const q=material?.preserveQuality?Number(c.quality||1):1,override=record.overrides[id+(q>1?'|q'+q:'')];
   if(override&&override.price!==null)return {city:override.city,price:Number(override.price),age:null,manual:true};
   return override?price(id,override.city,q):cities.map(city=>price(id,city,q)).filter(x=>x.price>0).sort((a,b)=>a.price-b.price)[0]||{price:0,city:'Lymhurst',age:Infinity};
  };
  const saleForCity=city=>{const quality=Number(c.quality||1),q=price(r.id,city,quality,c.saleMode,false),h=hist(r.id,city,quality),historyValid=!!h&&h.days>=3&&h.daily>=1&&M.age(h.to+'T23:59:59Z')<=72;let assessed={...q,price:historyValid?q.price:0};if(c.saleMode!=='discord'&&window.PriceBook)assessed=window.PriceBook.resolve(record.server,r.id,city,quality,c.saleMode==='buy'?'bid':'sell',assessed,row(r.id,city,quality)?.[(c.saleMode==='buy'?'buy_price_max':'sell_price_min')+'_date']);return {...assessed,daily:h?.daily||0,historyValid};};
  const result=E.calculate(r,c,D,quote,saleForCity);if(result.sales)c.salePrice=result.saleReady?result.sales.average:0;const place=c.craftPlace!=='hideout'||Number.isFinite(Number(c.hideoutBaseReturn))&&c.hideoutBaseReturn!==null&&c.hideoutBaseReturn!=='';
  const costReady=!result.missing&&place&&result.amount>0,valid=costReady&&c.salePrice>0;
  return {recipe:r,config:c,result,costReady,valid,reason:!place?'Укажите возврат в убежище':!result.amount?'Недостаточный объём':result.missing?'Проверьте закупки и цены':result.sales&&!result.saleReady?result.sales.errors.join(' '):!c.salePrice?'Нужна цена продажи':''};
 };
})();
