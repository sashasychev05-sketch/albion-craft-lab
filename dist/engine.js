(function(root){'use strict';
const number=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
function bufferEligible(material){return !material.preserveQuality&&!/(?:_ARTE?FACT_|_ARTIFACT_|_CREST_|_SKILLBOOK_|_JOURNAL_|_MOUNT_|_BAG(?:_|$)|_CAPE(?:_|$)|_(?:MAIN|2H|OFF|HEAD|ARMOR|SHOES)_)/.test(material.id);}
function returnRate(kind,city,focus,category,place='city',dailyBonus=0){let bonus=.18;
 if(root.GEAR_META?.cityBonuses[city]){const b=root.GEAR_META.cityBonuses[city];bonus=(place==='island'?b.island:b.base)+(b.categories[kind==='food'?'food':kind==='bags'?'bag':category]||0)}
 else {if(kind==='food'&&city==='Caerleon')bonus=.33;if(kind==='bags'&&city==='Brecilien')bonus=.33;if(kind==='refine'&&city===({fiber:'Lymhurst',hide:'Martlock',wood:'Fort Sterling',ore:'Thetford',rock:'Bridgewatch'}[category]))bonus=.58;if(place==='island')bonus=Math.max(0,bonus-.18)}
 return 100*(1-1/(1+bonus+(focus?.59:0)+Math.max(0,number(dailyBonus))/100));}
function hideoutReturn(base,focus){if(base===null||base===undefined||base==='')return null;const r=Math.min(95,Math.max(0,number(base)))/100;return 100*(1-1/(1/(1-r)+(focus?.59:0)));}
function calculate(recipe,cfg,data,quote){
 const alternative=recipe.alternatives?.[Math.max(0,Math.floor(number(cfg.recipeIndex)))];if(alternative)recipe={...recipe,mats:alternative.mats};
 const equipment=recipe.kind==='bags'||recipe.kind==='gear';
 const progressive=recipe.kind==='bags'&&cfg.refineSteps&&typeof cfg.refineSteps==='object';
 const q=1-Math.min(.95,Math.max(0,number(cfg.rrr)/100));const efficiency=r=>cfg.focusSource==='levels'&&root.MasteryMath&&root.MASTERY_DATA?root.MasteryMath.efficiency(r,cfg.masteryLevels||{},root.MASTERY_DATA):number(cfg.eff);const eff=efficiency(recipe);const operationFocus=r=>cfg.focusSource==='levels'&&number(cfg.focusOverrides?.[r.id])>0?Math.ceil(number(cfg.focusOverrides[r.id])):Math.ceil(r.basefocus*r.output*2**(-efficiency(r)/10000)-1e-9);const perOp=operationFocus(recipe);
 const ops=(recipe.kind==='food'||recipe.kind==='potions'||recipe.kind==='gear'||recipe.kind==='bags')&&cfg.focus&&cfg.volumeMode==='focus'&&perOp>0?Math.floor(number(cfg.focusBudget)/Math.max(1,perOp)):Math.floor(number(cfg.quantity)/recipe.output);
 const amount=Math.max(0,ops)*recipe.output;const mats=new Map(),stages=[],saucePlans=[],refiningPlans=[];let fees=0,focus=0,rootMats=recipe.mats;
 function add(i,n,returns,meta){const x=mats.get(i)||{id:i,net:0,preserveQuality:!!meta?.preserveQuality};x.net+=n;mats.set(i,x);}
 function ingredient(id,n){
  const child=root.FoodIngredientMath?.recipe(id,cfg,data);
  if(!child||cfg.foodIngredientSteps?.[id]!==true){add(id,n,false);return;}
  const p=root.FoodIngredientMath.production(child,n,cfg);fees+=p.fees;stages.push({id,amount:p.amount});
  for(const m of p.mats)ingredient(m.id,m.n);
 }
 function expand(r,out,rrq,recursive){
  const refining=root.RefiningMath?.refining(r,out,rrq,cfg,data,quote);if(refining){refiningPlans.push(refining);r={...r,mats:refining.mats};if(r.id===recipe.id)rootMats=r.mats;}
  fees+=out*(r.id===recipe.id?number(cfg.unitFee):number(r.fee300))*number(r.id===recipe.id?cfg.station:cfg.chainStation??cfg.station)/300;
  if(cfg.focus&&(!equipment||r.id===recipe.id))focus+=Math.ceil(out/r.output)*operationFocus(r);
  stages.push({id:r.id,amount:out});
  for(const m of r.mats){const n=out/r.output*m.n*(m.returns?rrq:1);const sauce=recipe.kind==='food'&&cfg.makeSauce&&data.fishSauce?.sauces[m.id];if(sauce){const fish=data.fishSauce.fish.find(f=>f.id===cfg.sauceFish)||data.fishSauce.fish[0];const plan=root.FishSauceMath.production(sauce,n,fish,cfg.buffer);saucePlans.push(plan);add(fish.id,plan.fishNeeded,false);add('T1_SEAWEED',plan.seaweedNeeded,false);fees+=plan.fees;stages.push({id:sauce.id,amount:plan.sauceCount},{id:'T1_FISHCHOPS',amount:plan.chops});continue;}if(recipe.kind==='food'&&data.foodIngredients?.[m.id]&&cfg.foodIngredientSteps?.[m.id]===true){ingredient(m.id,n);continue;}const child=data.recipes.find(x=>x.kind==='refine'&&x.id===m.id);if(child&&(progressive?cfg.refineSteps[child.id]===true:recursive&&child.tier>=number(cfg.startTier)))expand(child,n,equipment?1-number(cfg.chainRrr)/100:rrq,true);else add(m.id,n,m.returns,m);}
 }
 expand(recipe,amount,q,(progressive||cfg.chain)&&recipe.kind!=='food');
 let materialCost=0,missing=false,stale=false;const bill=[...mats.values()].map(m=>{const p=quote(m.id,m),bufferApplied=bufferEligible(m)?number(cfg.buffer):0;const buy=Math.ceil(m.net*(1+bufferApplied/100));const cost=buy*p.price;materialCost+=cost;missing ||=!(p.price>0);stale ||=p.age>24;return {...m,...p,buy,cost,bufferApplied};});
 let gross=amount*number(cfg.salePrice)*(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1);const tax=cfg.saleMode==='discord'?0:gross*number(cfg.tax)/100;const setup=cfg.saleMode==='sell'?gross*number(cfg.setup)/100:0;
 const premium=number(cfg.premiumCost)*number(cfg.characters)*number(cfg.cycleDays)/30;let cost=materialCost+fees+number(cfg.transport)+premium;const productionCost=cost;const journals=root.CraftJournalMath?.calculate(recipe,amount,cfg,root.ECONOMY_DATA,root.MASTERY_DATA?.fame,quote)||null;if(journals?.supported){missing ||= journals.missing;cost+=journals.emptyCost;}const journalProfit=journals?.profit||0;const profit=gross-tax-setup-productionCost+journalProfit;const stress=gross*.95-tax*.95-setup*.95-materialCost*1.05-fees-number(cfg.transport)-premium;
 return {journals,productionCost,netProductionCost:productionCost-journalProfit,unitCost:amount?(productionCost-journalProfit)/amount:0,unitProfit:amount?profit/amount:0,amount,ops,perOp,focus,bill,fees,materialCost,goodsGross:gross,gross:gross+(journals?.gross||0),tax:tax+(journals?.tax||0),setup:setup+(journals?.setup||0),premium,cost,profit,stress:stress+journalProfit,roi:cost?profit/cost*100:0,missing,stale,stages,saucePlans,refiningPlans,recipeMats:rootMats,breakEven:amount&&(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1)>0&&1-(cfg.saleMode==='discord'?0:number(cfg.tax)+(cfg.saleMode==='sell'?number(cfg.setup):0))/100>0?Math.max(0,productionCost-journalProfit)/(amount*(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1)*(1-(cfg.saleMode==='discord'?0:number(cfg.tax)+(cfg.saleMode==='sell'?number(cfg.setup):0))/100)):null};
}
const api={calculate,returnRate,hideoutReturn,number,bufferEligible};if(typeof module!=='undefined')module.exports=api;root.CraftEngine=api;
})(typeof window!=='undefined'?window:globalThis);
