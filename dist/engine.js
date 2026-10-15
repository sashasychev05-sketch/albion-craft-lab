(function(root){'use strict';
const number=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
function bufferEligible(material){return !material.preserveQuality&&!/(?:_ARTE?FACT_|_ARTIFACT_|_CREST_|_SKILLBOOK_|_JOURNAL_|_MOUNT_|_BAG(?:_|$)|_CAPE(?:_|$)|_(?:MAIN|2H|OFF|HEAD|ARMOR|SHOES)_)/.test(material.id);}
function returnRate(kind,city,focus,category,place='city',dailyBonus=0){let bonus=.18;
 if(root.GEAR_META?.cityBonuses[city]){const b=root.GEAR_META.cityBonuses[city];bonus=(place==='island'?b.island:b.base)+(b.categories[kind==='food'?'food':kind==='bags'?'bag':category]||0)}
 else {if(kind==='food'&&city==='Caerleon')bonus=.33;if(kind==='bags'&&city==='Brecilien')bonus=.33;if(kind==='refine'&&city===({fiber:'Lymhurst',hide:'Martlock',wood:'Fort Sterling',ore:'Thetford',rock:'Bridgewatch'}[category]))bonus=.58;if(place==='island')bonus=Math.max(0,bonus-.18)}
 return 100*(1-1/(1+bonus+(focus?.59:0)+Math.max(0,number(dailyBonus))/100));}
function hideoutReturn(base,focus){if(base===null||base===undefined||base==='')return null;const r=Math.min(95,Math.max(0,number(base)))/100;return 100*(1-1/(1/(1-r)+(focus?.59:0)));}
function calculate(recipe,cfg,data,quote,saleQuote=()=>({price:0})){
 const allocation=root.CityAllocationMath||(typeof require==='function'?require('./city-allocation-model.js'):null);
 const alternative=recipe.alternatives?.[Math.max(0,Math.floor(number(cfg.recipeIndex)))];if(alternative)recipe={...recipe,mats:alternative.mats};
 const equipment=recipe.kind==='bags'||recipe.kind==='gear';
 const allowed=recipe.kind==='bags'||recipe.kind==='gear'&&recipe.blackMarket?[...allocation.cities,'Black Market']:allocation.cities;
 const marketVolume=cfg.saleAllocationMode==='demand'&&cfg.saleDemand?.volume==='market'?allocation.demand(100000000,cfg.saleDemand,allowed,saleQuote):null,plannedQuantity=marketVolume?marketVolume.assigned:number(cfg.quantity);
 const progressive=recipe.kind==='bags'&&cfg.refineSteps&&typeof cfg.refineSteps==='object';
 const q=1-Math.min(.95,Math.max(0,number(cfg.rrr)/100));const efficiency=r=>cfg.focusSource==='levels'&&root.MasteryMath&&root.MASTERY_DATA?root.MasteryMath.efficiency(r,cfg.masteryLevels||{},root.MASTERY_DATA):number(cfg.eff);const eff=efficiency(recipe);const operationFocus=r=>cfg.focusSource==='levels'&&number(cfg.focusOverrides?.[r.id])>0?Math.ceil(number(cfg.focusOverrides[r.id])):Math.ceil(r.basefocus*r.output*2**(-efficiency(r)/10000)-1e-9);const perOp=operationFocus(recipe);
 const ops=Number.isFinite(recipe.output)&&recipe.output>0?((recipe.kind==='food'||recipe.kind==='potions'||recipe.kind==='gear'||recipe.kind==='bags')&&cfg.focus&&cfg.volumeMode==='focus'&&!marketVolume&&perOp>0?Math.floor(number(cfg.focusBudget)/Math.max(1,perOp)):Math.floor(plannedQuantity/recipe.output)):0;
 const amount=Math.max(0,ops)*recipe.output;const mats=new Map(),stages=[],saucePlans=[],refiningPlans=[];let fees=0,focus=0,rootMats=recipe.mats;
 // Trace unrounded demands; only the aggregated bill rounds and adds reserve.
 const productionTree={key:'root/'+encodeURIComponent(recipe.id),id:recipe.id,kind:'produce',method:'craft',demand:amount,perOperation:null,children:[]},planErrors=[];let nodeCount=1;
 function fail(node,message){node.kind='error';node.error=message;planErrors.push({key:node.key,id:node.id,message});}
 function branch(parent,m,index,demand){const node={key:parent.key+'/'+index+':'+encodeURIComponent(m.id||'invalid'),id:m.id||'invalid',kind:'buy',demand,perOperation:m.n,returns:!!m.returns,preserveQuality:!!m.preserveQuality,children:[]};parent.children.push(node);nodeCount++;return node;}
 function valid(node,r,demand,seen){if(seen.has(r.id))return fail(node,'Цикл производства: '+r.id),false;if(seen.size>=64||nodeCount>=10000)return fail(node,'Цепочка производства слишком велика.'),false;if(!Number.isFinite(r.output)||r.output<=0||!Array.isArray(r.mats)||r.mats.some(m=>!m||typeof m.id!=='string'||!m.id||!Number.isFinite(m.n)||m.n<0)||!Number.isFinite(demand)||demand<0)return fail(node,'Некорректный рецепт производства: '+r.id),false;return true;}
 function add(i,n,returns,meta){const x=mats.get(i)||{id:i,net:0,preserveQuality:!!meta?.preserveQuality};x.net+=n;mats.set(i,x);}
 function ingredient(id,n,node,seen){
  const child=root.FoodIngredientMath?.recipe(id,cfg,data);
  if(!child||cfg.foodIngredientSteps?.[id]!==true){add(id,n,false);return;}
  if(!valid(node,child,n,seen))return;const next=new Set(seen);next.add(id);
  const p=root.FoodIngredientMath.production(child,n,cfg);fees+=p.fees;stages.push({id,amount:p.amount});
  Object.assign(node,{kind:'produce',method:'ingredient',amount:p.amount,operations:p.ops,output:child.output,ownFees:p.fees,settings:p.settings,productReturn:!!child.productReturn,noReturn:!!child.noReturn});
  for(const [index,m]of p.mats.entries()){if(nodeCount>=10000){fail(node,'Цепочка производства слишком велика.');break;}const traced=branch(node,child.mats[index],index,m.n);if(!Number.isFinite(m.n)||m.n<0){fail(traced,'Некорректное количество материала.');continue;}ingredient(m.id,m.n,traced,next);}
 }
 function expand(r,out,rrq,recursive,node,seen=new Set()){
  if(!valid(node,r,out,seen))return;const next=new Set(seen);next.add(r.id);
  const refining=root.RefiningMath?.refining(r,out,rrq,cfg,data,quote);if(refining){refiningPlans.push(refining);r={...r,mats:refining.mats};if(r.id===recipe.id)rootMats=r.mats;}
  const stageFee=out*(r.id===recipe.id?number(cfg.unitFee):number(r.fee300))*number(r.id===recipe.id?cfg.station:cfg.chainStation??cfg.station)/300;fees+=stageFee;
  Object.assign(node,{kind:'produce',method:r.kind==='refine'?'refine':'craft',amount:out,operations:out/r.output,output:r.output,ownFees:stageFee,returnRate:(1-rrq)*100,refiningMethod:refining?.method||null});
  if(cfg.focus&&(!equipment||r.id===recipe.id))focus+=Math.ceil(out/r.output)*operationFocus(r);
  stages.push({id:r.id,amount:out});
  for(const [index,m]of r.mats.entries()){
   if(nodeCount>=10000){fail(node,'Цепочка производства слишком велика.');break;}
   const n=out/r.output*m.n*(m.returns?rrq:1),traced=branch(node,m,index,n);
   if(typeof m.id!=='string'||!m.id||!Number.isFinite(m.n)||m.n<0||!Number.isFinite(n)){fail(traced,'Некорректный материал в рецепте.');continue;}
   const sauce=recipe.kind==='food'&&cfg.makeSauce&&data.fishSauce?.sauces[m.id];
   if(sauce){const fish=data.fishSauce.fish.find(f=>f.id===cfg.sauceFish)||data.fishSauce.fish[0];if(!fish||!(fish.chops>0)||!(sauce.output>0)){fail(traced,'Некорректный рецепт рыбного соуса.');continue;}const plan=root.FishSauceMath.production(sauce,n,fish,cfg.buffer);saucePlans.push(plan);add(fish.id,plan.fishNeeded,false);add('T1_SEAWEED',plan.seaweedNeeded,false);fees+=plan.fees;stages.push({id:sauce.id,amount:plan.sauceCount},{id:'T1_FISHCHOPS',amount:plan.chops});Object.assign(traced,{kind:'produce',method:'sauce',amount:plan.sauceCount,operations:plan.sauceCount/sauce.output,output:sauce.output,ownFees:plan.fees});const chops=branch(traced,{id:'T1_FISHCHOPS',n:sauce.chops},0,plan.chops);Object.assign(chops,{kind:'produce',method:'chop',amount:plan.fishNeeded*fish.chops,operations:plan.fishNeeded,output:fish.chops,ownFees:0});branch(chops,{id:fish.id,n:1},0,plan.fishNeeded);branch(traced,{id:'T1_SEAWEED',n:sauce.seaweed},1,plan.seaweedNeeded);continue;}
   if(recipe.kind==='food'&&data.foodIngredients?.[m.id]&&cfg.foodIngredientSteps?.[m.id]===true){ingredient(m.id,n,traced,next);continue;}
   const child=data.recipes.find(x=>x.kind==='refine'&&x.id===m.id);if(child&&(progressive?cfg.refineSteps[child.id]===true:recursive&&child.tier>=number(cfg.startTier)))expand(child,n,equipment?1-number(cfg.chainRrr)/100:rrq,true,traced,next);else add(m.id,n,m.returns,m);
  }
 }
 expand(recipe,amount,q,(progressive||cfg.chain)&&recipe.kind!=='food',productionTree);
 let materialCost=0,missing=planErrors.length>0,stale=false;const bill=[...mats.values()].map(m=>{let p=quote(m.id,m);const bufferApplied=bufferEligible(m)?number(cfg.buffer):0,buy=Math.max(0,Math.ceil(m.net*(1+bufferApplied/100)-1e-9)),rows=cfg.purchaseSplits?.[allocation.key(m.id,m,cfg.quality)];const split=rows===undefined?null:allocation.resolve(rows,buy,allocation.cities,city=>quote(m.id,{...m,cityOverride:city}));if(split)p={...p,price:split.valid?split.average:0,city:split.rows.filter(x=>x.quantity>0).map(x=>x.city).join(' + '),manual:false,age:split.stale?Infinity:0};const cost=split?split.total:buy*p.price;materialCost+=cost;missing ||=!(p.price>0)||!!split&&!split.valid;stale ||=p.age>24;return {...m,...p,buy,cost,bufferApplied,...(split?{allocation:split}:{})};});
 const sales=cfg.saleAllocationMode==='demand'?allocation.demand(amount,cfg.saleDemand,allowed,saleQuote):cfg.saleSplits!==undefined&&cfg.saleSplits!==null?allocation.resolve(cfg.saleSplits,amount,allowed,saleQuote):null;
 if(sales&&amount<=0){sales.valid=false;sales.errors.push('Нет доступного объёма для продажи. Проверьте историю рынка и размер партии.');}
 const saleReady=sales?sales.valid&&amount>0:number(cfg.salePrice)>0;stale ||=!!sales?.stale;
 let gross=(sales?sales.total:amount*number(cfg.salePrice))*(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1);const tax=cfg.saleMode==='discord'?0:gross*number(cfg.tax)/100;const setup=cfg.saleMode==='sell'?gross*number(cfg.setup)/100:0;
 const premium=number(cfg.premiumCost)*number(cfg.characters)*number(cfg.cycleDays)/30;let cost=materialCost+fees+number(cfg.transport)+premium;const productionCost=cost;const journals=root.CraftJournalMath?.calculate(recipe,amount,cfg,root.ECONOMY_DATA,root.MASTERY_DATA?.fame,quote)||null;if(journals?.supported){missing ||= journals.missing;cost+=journals.emptyCost;}const journalProfit=journals?.profit||0;const profit=gross-tax-setup-productionCost+journalProfit;const stress=gross*.95-tax*.95-setup*.95-materialCost*1.05-fees-number(cfg.transport)-premium;
 if(sales)for(const row of sales.rows){row.gross=row.cost*(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1);row.tax=cfg.saleMode==='discord'?0:row.gross*number(cfg.tax)/100;row.setup=cfg.saleMode==='sell'?row.gross*number(cfg.setup)/100:0;row.allocatedCost=amount?(productionCost-journalProfit)*row.quantity/amount:0;row.profit=!missing&&saleReady?row.gross-row.tax-row.setup-row.allocatedCost:null;}
 return {marketVolume:!!marketVolume,sales,saleReady,productionTree,planErrors,journals,productionCost,netProductionCost:productionCost-journalProfit,unitCost:amount?(productionCost-journalProfit)/amount:0,unitProfit:amount?profit/amount:0,amount,ops,perOp,focus,bill,fees,materialCost,goodsGross:gross,gross:gross+(journals?.gross||0),tax:tax+(journals?.tax||0),setup:setup+(journals?.setup||0),premium,cost,profit,stress:stress+journalProfit,roi:cost?profit/cost*100:0,missing,stale,stages,saucePlans,refiningPlans,recipeMats:rootMats,breakEven:amount&&(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1)>0&&1-(cfg.saleMode==='discord'?0:number(cfg.tax)+(cfg.saleMode==='sell'?number(cfg.setup):0))/100>0?Math.max(0,productionCost-journalProfit)/(amount*(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1)*(1-(cfg.saleMode==='discord'?0:number(cfg.tax)+(cfg.saleMode==='sell'?number(cfg.setup):0))/100)):null};
}
const api={calculate,returnRate,hideoutReturn,number,bufferEligible};if(typeof module!=='undefined')module.exports=api;root.CraftEngine=api;
})(typeof window!=='undefined'?window:globalThis);
