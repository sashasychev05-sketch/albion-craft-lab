(function(root){'use strict';
 const number=(v,d=0)=>v===null||v===undefined||v===''?d:Number.isFinite(Number(v))?Number(v):d;
 function settings(r,cfg){
  const s=cfg.foodIngredientSettings?.[r.id]||{},city=s.city||cfg.craftCity||'Caerleon',place=s.place||(cfg.craftPlace==='island'?'island':'city');
  const auto=root.CraftEngine.returnRate(r.category==='food'?'food':'ingredient',city,false,r.category,place);
  return {city,place,rrr:r.noReturn?0:Math.min(95,Math.max(0,number(s.rrr,auto))),station:Math.max(0,number(s.station,300)),fee300:r.noReturn?0:Math.max(0,number(s.fee300,r.fee300))};
 }
 function recipe(id,cfg,data){const r=data.foodIngredients?.[id];if(id!=='T1_FISHCHOPS'||!r)return r;const fish=data.fishSauce.fish.find(f=>f.id===(cfg.foodChopFish||'T4_FISH_FRESHWATER_ALL_COMMON'))||data.fishSauce.fish[0];return {...r,output:fish.chops,mats:[{id:fish.id,n:1,returns:false}]};}
 function production(r,demand,cfg){
  const s=settings(r,cfg),rate=s.rrr/100;
  const ops=Math.max(0,Math.ceil(number(demand)/(r.output*(r.productReturn?1+rate:1))-1e-10));
  const base=ops*r.output,amount=base*(r.productReturn?1+rate:1);
  return {id:r.id,amount,ops,fees:base*s.fee300*s.station/300,settings:s,mats:r.mats.map(m=>({...m,n:ops*m.n*(m.returns&&!r.productReturn?1-rate:1)}))};
 }
 const api={recipe,settings,production};root.FoodIngredientMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
