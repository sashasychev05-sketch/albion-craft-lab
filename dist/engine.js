(function(root){'use strict';
const number=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
function returnRate(kind,city,focus,category){let bonus=.18;if(kind==='food'&&city==='Caerleon')bonus=.33;if(kind==='bags'&&city==='Brecilien')bonus=.33;if(kind==='refine'&&city===({fiber:'Lymhurst',hide:'Martlock',wood:'Fort Sterling',ore:'Thetford',rock:'Bridgewatch'}[category]))bonus=.58;return 100*(1-1/(1+bonus+(focus?.59:0)));}
function calculate(recipe,cfg,data,quote){
 const q=1-Math.min(.95,Math.max(0,number(cfg.rrr)/100));const eff=number(cfg.eff);const perOp=Math.ceil(recipe.basefocus*recipe.output*2**(-eff/10000));
 const ops=recipe.kind==='food'&&cfg.focus&&cfg.volumeMode==='focus'?Math.floor(number(cfg.focusBudget)/Math.max(1,perOp)):Math.floor(number(cfg.quantity)/recipe.output);
 const amount=Math.max(0,ops)*recipe.output;const mats=new Map(),stages=[];let fees=0,focus=0;
 function add(i,n,returns){const x=mats.get(i)||{id:i,net:0};x.net+=n;mats.set(i,x);}
 function expand(r,out,rrq,recursive){
  fees+=out*(r.id===recipe.id?number(cfg.unitFee):number(r.fee300))*number(cfg.station)/300;
  if(cfg.focus&&(recipe.kind!=='bags'||r.id===recipe.id))focus+=Math.ceil(out/r.output)*Math.ceil(r.basefocus*r.output*2**(-eff/10000));
  stages.push({id:r.id,amount:out});
  for(const m of r.mats){const n=out/r.output*m.n*(m.returns?rrq:1);const child=data.recipes.find(x=>x.kind==='refine'&&x.id===m.id);if(recursive&&child&&child.tier>=number(cfg.startTier))expand(child,n,recipe.kind==='bags'?1-number(cfg.chainRrr)/100:rrq,true);else add(m.id,n,m.returns);}
 }
 expand(recipe,amount,q,cfg.chain&&recipe.kind!=='food');
 let materialCost=0,missing=false,stale=false;const bill=[...mats.values()].map(m=>{const p=quote(m.id);const buy=Math.ceil(m.net*(1+number(cfg.buffer)/100));const cost=buy*p.price;materialCost+=cost;missing ||=!(p.price>0);stale ||=p.age>24;return {...m,...p,buy,cost};});
 const gross=amount*number(cfg.salePrice)*(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1);const tax=cfg.saleMode==='discord'?0:gross*number(cfg.tax)/100;const setup=cfg.saleMode==='sell'?gross*number(cfg.setup)/100:0;
 const premium=number(cfg.premiumCost)*number(cfg.characters)*number(cfg.cycleDays)/30;const cost=materialCost+fees+number(cfg.transport)+premium;const profit=gross-tax-setup-cost;const stress=gross*.95-tax*.95-setup*.95-materialCost*1.05-fees-number(cfg.transport)-premium;
 return {amount,ops,perOp,focus,bill,fees,materialCost,gross,tax,setup,premium,cost,profit,stress,roi:cost?profit/cost*100:0,missing,stale,stages,breakEven:amount?cost/(amount*(cfg.saleMode==='discord'?1-number(cfg.discount)/100:1)*(1-(cfg.saleMode==='discord'?0:number(cfg.tax)+(cfg.saleMode==='sell'?number(cfg.setup):0))/100)):0};
}
const api={calculate,returnRate,number};if(typeof module!=='undefined')module.exports=api;root.CraftEngine=api;
})(typeof window!=='undefined'?window:globalThis);
