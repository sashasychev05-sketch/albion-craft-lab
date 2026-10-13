(function(root){'use strict';
const KEY='albion-ingredient-tree-v1',clone=x=>JSON.parse(JSON.stringify(x));
function control(id,recipe,data){
 if(recipe.kind==='food'&&data.fishSauce?.sauces[id])return {type:'sauce'};
 if(recipe.kind==='food'&&data.foodIngredients?.[id])return {type:'foodStep'};
 const child=data.recipes.find(r=>r.id===id&&r.kind==='refine');
 if(child&&recipe.kind==='bags')return {type:'refineStep',tier:child.tier};
 if(child&&['gear','refine'].includes(recipe.kind))return {type:'chain',tier:child.tier,global:true};
 return null;
}
function create(recipe,cfg,result,data){
 if(!result.productionTree)throw Error('Расчёт не предоставил план производства.');
 const bill=new Map(result.bill.map(m=>[m.id,m])),byKey=new Map(),occurrences=new Map(),seen=new Set();
 function visit(raw,parent=null,depth=0){
  if(!raw||typeof raw.key!=='string'||seen.has(raw)||depth>64||byKey.size>=10000)throw Error('Некорректная структура дерева производства.');seen.add(raw);
  const aggregate=bill.get(raw.id),node={...raw,parent,depth,children:[],name:raw.id===recipe.id&&!parent?recipe.name:data.names[raw.id]||raw.id,quality:!parent||aggregate?.preserveQuality?Number(cfg.quality||1):1,control:parent?control(raw.id,recipe,data):null,aggregate:aggregate?{...aggregate}:null};
  if(byKey.has(node.key))throw Error('Повторяется адрес узла дерева.');byKey.set(node.key,node);
  node.children=(raw.children||[]).map(child=>visit(child,node.key,depth+1));
  if(node.kind==='buy'){
   if(!occurrences.has(node.id))occurrences.set(node.id,[]);occurrences.get(node.id).push(node.key);
   node.share=aggregate?.net>0?node.demand/aggregate.net:0;node.includedCost=aggregate?aggregate.cost*node.share:0;node.purchase=aggregate?.buy??null;node.price=aggregate?.price??0;node.missing=!(aggregate?.price>0);node.source='purchase';
  }else{node.includedCost=node.children.reduce((sum,n)=>sum+n.includedCost,0)+(node.ownFees||0);node.price=node.amount>0?node.includedCost/node.amount:0;node.missing=node.kind==='error'||node.children.some(n=>n.missing);node.source='included';}
  if(!parent){node.includedCost=result.cost;node.price=result.amount?result.cost/result.amount:0;node.missing=result.missing;}
  return node;
 }
 const tree=visit(result.productionTree);
 return {tree,byKey,occurrences,totals:{cost:result.cost,materialCost:result.materialCost,fees:result.fees,focus:result.focus,amount:result.amount,missing:result.missing,journals:result.journals,transport:Number(cfg.transport||0),premium:result.premium},errors:result.planErrors||[]};
}
function visible(plan,expanded){const open=new Set(expanded),out=[];function walk(n){out.push(n);if(open.has(n.key))for(const child of n.children)walk(child);}walk(plan.tree);return out;}
function path(plan,key){const out=[];for(let n=plan.byKey.get(key);n;n=plan.byKey.get(n.parent))out.unshift(n.key);return out;}
function read(storage){const raw=storage.getItem(KEY);if(!raw)return {version:1,view:'table',zoom:100,entries:{},views:{}};let d;try{d=JSON.parse(raw);}catch{throw Error('Настройки дерева повреждены. Исходные данные сохранены.');}if(d.version!==1||!['table','tree'].includes(d.view)||!Number.isFinite(d.zoom)||d.zoom<50||d.zoom>150||!d.entries||typeof d.entries!=='object'||Array.isArray(d.entries)||Object.keys(d.entries).length>2000)throw Error('Настройки дерева повреждены. Исходные данные сохранены.');
 for(const [key,value]of Object.entries(d.entries)){if(['__proto__','constructor','prototype'].includes(key)||!value||!Array.isArray(value.expanded)||value.expanded.length>10000||value.expanded.some(s=>typeof s!=='string'||s.length>4096)||value.selected!==null&&typeof value.selected!=='string')throw Error('Настройки узлов дерева повреждены.');}
 if(d.views===undefined)d.views={};if(!d.views||typeof d.views!=='object'||Array.isArray(d.views)||Object.keys(d.views).length>2000||Object.entries(d.views).some(([key,value])=>['__proto__','constructor','prototype'].includes(key)||!['table','tree'].includes(value)))throw Error('Настройки вида ингредиентов повреждены.');return d;
}
function prune(entry,plan){const expanded=[...new Set(entry.expanded)].filter(key=>plan.byKey.get(key)?.children.length);return {expanded,selected:plan.byKey.has(entry.selected)?entry.selected:plan.tree.key};}
const api={KEY,create,control,visible,path,read,prune,clone};root.IngredientTreeMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
