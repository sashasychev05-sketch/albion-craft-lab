(function(root){'use strict';
const level=(x,max=100)=>Math.min(max,Math.max(0,Math.floor(Number(x)||0))),base=r=>r.id.split('@')[0];
function matches(id,patterns){return patterns.some(p=>new RegExp('^'+p.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\?/g,'.').replace(/\*/g,'.*')+'$').test(id))}
function applicable(r,data){return Object.values(data.nodes).map(n=>({...n,coefficient:n.bonuses.filter(b=>r.tier>=b.minTier&&r.tier<=b.maxTier&&matches(base(r),b.patterns)).reduce((s,b)=>s+b.coefficient,0),own:matches(base(r),n.patterns)})).filter(n=>n.coefficient>0).sort((a,b)=>Number(b.kind==='mastery')-Number(a.kind==='mastery')||Number(b.own)-Number(a.own)||a.name.localeCompare(b.name,'ru'))}
function efficiency(r,levels,data){return applicable(r,data).reduce((s,n)=>s+level(levels[n.id],n.maxLevel)*n.coefficient,0)}
function cost(r,eff){return Math.ceil(r.basefocus*r.output*2**(-(Number(eff)||0)/10000)-1e-9)}
function train(r,node,config,data){const table=data.templates[node.template],from=level(config.from,node.maxLevel),to=level(config.to,node.maxLevel);if(to<=from)return {valid:false,reason:'Целевой уровень должен быть выше начального.',rows:[]};if(!matches(base(r),node.patterns))return {valid:false,reason:'Этот предмет не прокачивает выбранный узел.',rows:[]};
 const steps=table.slice(from,to);if(steps.some(x=>r.tier<x.minTier||r.tier>x.maxTier))return {valid:false,reason:'Этот тир не подходит для всех выбранных уровней узла.',rows:[]};
 const baseFame=config.fameOverride===null||config.fameOverride===undefined?Number(data.fame[r.id]||0):Math.max(0,Number(config.fameOverride)||0),perItem=baseFame*(config.premium?1.5:1)*(1+Math.max(0,Number(config.bonus)||0)/100),perOperation=perItem*r.output;if(!perOperation)return {valid:false,reason:'Этот рецепт не даёт славы либо нужно указать её вручную.',rows:[]};
 const progress=Math.min(100,Math.max(0,Number(config.progress)||0))/100;let required=0,remaining=0,operations=0;const rows=[];
 steps.forEach((step,i)=>{const fame=step.fame*node.fameMultiplier*(i===0?1-progress:1);required+=fame;const extra=Math.max(0,Math.ceil((fame-remaining)/perOperation-1e-9));operations+=extra;remaining+=extra*perOperation-fame;rows.push({level:from+i+1,required:fame,operations,quantity:operations*r.output})});
 return {valid:true,from,to,required,perItem,perOperation,operations,quantity:operations*r.output,extraFame:remaining,rows};
}
const api={matches,applicable,efficiency,cost,train,level};root.MasteryMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
