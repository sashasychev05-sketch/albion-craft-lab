(function(root){'use strict';
 const num=x=>Number.isFinite(Number(x))?Number(x):0;
 function production(sauce,demand,fish,buffer=0){
  const count=Math.max(0,Math.ceil(num(demand)/sauce.output-1e-10))*sauce.output;
  const chops=count/sauce.output*sauce.chops,seaweed=count/sauce.output*sauce.seaweed;
  const fishNeeded=Math.ceil(chops/fish.chops),factor=1+Math.max(0,num(buffer))/100;
  return {sauceId:sauce.id,sauceCount:count,chops,fishId:fish.id,fishNeeded,seaweedNeeded:seaweed,fishBuy:Math.ceil(fishNeeded*factor),seaweedBuy:Math.ceil(seaweed*factor),fees:count/sauce.output*sauce.fee};
 }
 function priceGuide(plan,target,fishPrice,seaweedPrice){
  if(!plan.sauceCount||!plan.fishBuy)return {maxFish:null,cost:null,reason:'Нет объёма соуса'};
  if(!(num(seaweedPrice)>0))return {maxFish:null,cost:null,reason:'Нужна цена водорослей'};
  const other=plan.seaweedBuy*num(seaweedPrice)+plan.fees;
  const budget=num(target)*plan.sauceCount-other;
  const maxFish=num(target)>0&&budget>=0?Math.floor((budget/plan.fishBuy+1e-10)*100)/100:null;
  const cost=num(fishPrice)>0?(plan.fishBuy*num(fishPrice)+other)/plan.sauceCount:null;
  return {maxFish,cost,reason:!(num(target)>0)?'Укажите желаемую себестоимость':budget<0?'Водоросли уже дороже цели':'',within:maxFish!==null&&cost!==null&&cost<=num(target)+1e-9};
 }
 const api={production,priceGuide};if(typeof module!=='undefined')module.exports=api;root.FishSauceMath=api;
})(typeof window!=='undefined'?window:globalThis);
