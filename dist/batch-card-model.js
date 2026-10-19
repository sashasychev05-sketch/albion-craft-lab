(function(root){'use strict';
const KEY='albion-operation-batches-v1',MAX=100000000,cities=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien','Black Market'],clone=x=>JSON.parse(JSON.stringify(x));
const integer=(x,max=MAX)=>Number.isSafeInteger(x)&&x>=0&&x<=max,finite=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e15,money=x=>finite(x)&&x>=0,text=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max,object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const uuid=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
function setup(quantity,price,rate){return Math.max(0,Math.ceil(quantity*price*rate/100-1e-9));}
function reprice(row){
 if(!integer(row.quantity)||row.quantity<1||row.price!==null&&!money(row.price)||!money(row.rate)||row.rate>100||typeof row.order!=='boolean'||!Array.isArray(row.updates)||row.updates.length>50)throw Error('Проверьте количество, цену и комиссию ордера.');
 if(!row.order&&row.updates.length)throw Error('Обновления доступны только для рыночного ордера.');
 let remaining=row.quantity,price=row.price,value=0,fees=0;
 for(const change of row.updates){
  if(!object(change)||!integer(change.remaining,remaining)||change.remaining<1||!money(change.price)||change.price<=0||!integer(change.count,1000)||change.count<1||change.exactFee!==null&&(!money(change.exactFee)))throw Error('Обновление: укажите положительный остаток не больше предыдущего, цену, число обновлений и неотрицательную комиссию.');
  if(price!==null)value+=(remaining-change.remaining)*price;
  const fee=change.exactFee===null?setup(change.remaining,change.price,row.rate):change.exactFee;
  fees+=fee*change.count;remaining=change.remaining;price=change.price;
 }
 value+=remaining*(price??0);
 if(!finite(value)||!money(fees))throw Error('Слишком большая сумма ордера.');
 const known=row.price!==null;
 return {known,value:known?value:null,baseValue:known?row.quantity*row.price:null,initial:row.order&&known?setup(row.quantity,row.price,row.rate):0,fees,remaining,price};
}
function validate(card){
 if(!object(card)||!text(card.uid,100)||!['craft','purchase','luxury'].includes(card.kind)||!['europe','west','east'].includes(card.server)||!text(card.item,160)||!text(card.name,160)||!integer(card.quantity)||card.quantity<1||!Number.isInteger(card.quality)||card.quality<1||card.quality>5||!Number.isFinite(Date.parse(card.created))||typeof card.archived!=='boolean'||!integer(card.made,card.kind==='craft'?card.quantity:0)||!text(card.note||' ',500)||!['',...cities].includes(card.destination)||card.otherCost!==null&&!finite(card.otherCost)||!Array.isArray(card.buys)||!Array.isArray(card.sales)||card.buys.length>400||card.sales.length>8)throw Error('Проверьте параметры карточки партии.');
 const ids=new Set();
 for(const [side,rows] of [['buy',card.buys],['sale',card.sales]])for(const row of rows){
  if(!object(row)||!text(row.uid,100)||ids.has(row.uid)||!text(row.item,160)||!text(row.name,160)||!['',...cities].includes(row.city))throw Error('Проверьте товар и город в карточке.');
  ids.add(row.uid);reprice(row);
  if(side==='buy'&&(!integer(row.bought,row.quantity)||!integer(row.picked,row.bought)||!integer(row.delivered,row.picked)))throw Error('Доставлено ≤ забрано ≤ куплено ≤ запланировано.');
  if(side==='sale'&&(!integer(row.sold,row.quantity)||!money(row.tax)||row.tax>100))throw Error('Проверьте проданное количество и налог продажи.');
 }
 if(card.kind==='purchase'&&(card.sales.length||card.buys.reduce((s,r)=>s+r.quantity,0)!==card.quantity)||card.kind==='luxury'&&card.buys.reduce((s,r)=>s+r.quantity,0)!==card.quantity||card.kind!=='purchase'&&card.sales.reduce((s,r)=>s+r.quantity,0)!==card.quantity)throw Error('Количество в городах не совпадает с размером партии.');
 const available=card.kind==='craft'?card.made:card.buys.reduce((s,r)=>s+r.delivered,0);
 if(card.sales.reduce((s,r)=>s+r.sold,0)>available)throw Error(card.kind==='craft'?'Нельзя отметить продажу больше изготовленного.':'Нельзя отметить продажу больше доставленного.');
 return card;
}
function summary(card){
 validate(card);
 const buys=card.buys.map(reprice),sales=card.sales.map(reprice),sum=fn=>card.buys.reduce((s,r)=>s+fn(r),0);
 const quantity=sum(r=>r.quantity),bought=sum(r=>r.bought),picked=sum(r=>r.picked),delivered=sum(r=>r.delivered),sold=card.sales.reduce((s,r)=>s+r.sold,0);
 const buyKnown=buys.every(r=>r.known),saleKnown=sales.every(r=>r.known),buyFees=buys.reduce((s,r)=>s+r.fees,0),saleFees=sales.reduce((s,r)=>s+r.fees,0);
 const purchase=buyKnown?buys.reduce((s,r)=>s+r.value+r.initial+r.fees,0):null;
 const cost=buyKnown&&card.otherCost!==null?purchase+card.otherCost:null;
 const net=card.sales.length&&saleKnown?sales.reduce((s,r,i)=>s+r.value*(1-card.sales[i].tax/100)-r.initial-r.fees,0):null;
 const profit=cost!==null&&net!==null?net-cost:null;
 const baseCost=buyKnown&&card.otherCost!==null?card.otherCost+buys.reduce((s,r)=>s+r.baseValue+r.initial,0):null;
 const baseNet=card.sales.length&&saleKnown?sales.reduce((s,r,i)=>s+r.baseValue*(1-card.sales[i].tax/100)-r.initial,0):null;
 if([purchase,cost,net,profit,baseCost,baseNet,buyFees,saleFees].some(value=>value!==null&&!finite(value)))throw Error('Слишком большая сумма карточки.');
 const readyRows=card.buys.filter(r=>card.destination?r.delivered===r.quantity:r.picked===r.quantity).length;
 const complete=card.kind==='purchase'?(card.destination?delivered===quantity:picked===quantity):card.kind==='craft'?card.made===card.quantity&&sold===card.quantity:sold===card.quantity;
 let status=complete?'Завершена':sold?'Продаётся':card.kind==='craft'&&card.made?'Изготовлена частично':delivered>0?'Доставляется':picked>0?'К перевозке':bought>0?'Закупается':'Запланирована';
 if(card.kind==='craft'&&card.made===card.quantity&&sold<card.quantity)status='Готова к продаже';
 else if(card.kind==='luxury'&&delivered===card.quantity&&!sold)status='Готова к продаже';
 const tasks=card.buys.flatMap(row=>[{uid:row.uid,field:'picked',city:row.city,item:row.name,quantity:row.bought-row.picked,action:'Забрать'},...(card.destination?[{uid:row.uid,field:'delivered',city:row.city,destination:card.destination,item:row.name,quantity:row.picked-row.delivered,action:'Доставить'}]:[])]).filter(r=>r.quantity>0);
 return {quantity,bought,picked,delivered,sold,readyRows,complete,status,tasks,purchase,cost,net,profit,baseProfit:baseCost!==null&&baseNet!==null?baseNet-baseCost:null,buyFees,saleFees,fees:buyFees+saleFees};
}
function matches(card,{server,kind='all',stage='all',query='',archive=false}={}){
 if(card.server!==server||!archive&&card.archived||kind!=='all'&&card.kind!==kind)return false;
 const normalize=value=>String(value??'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
 const aliases={'Lymhurst':'Лимхёрст','Martlock':'Мартлок','Thetford':'Тетфорд','Bridgewatch':'Бриджвотч','Fort Sterling':'Форт Стерлинг','Caerleon':'Карлион','Brecilien':'Бресилиен','Black Market':'Чёрный рынок'};
 const haystack=normalize([card.name,card.item,card.note,card.destination,aliases[card.destination],...card.buys.flatMap(r=>[r.name,r.item,r.city,aliases[r.city]]),...card.sales.flatMap(r=>[r.name,r.item,r.city,aliases[r.city]])].join(' '));
 if(!normalize(query).trim().split(/\s+/).every(word=>haystack.includes(word)))return false;
 if(stage==='all')return true;
 const s=summary(card);
 const stages={purchase:card.buys.some(r=>r.bought<r.quantity),pickup:card.buys.some(r=>r.bought>r.picked),delivery:!!card.destination&&card.buys.some(r=>r.picked>r.delivered),production:card.kind==='craft'&&card.made<card.quantity&&s.readyRows===card.buys.length,sale:card.sales.length>0&&(card.kind==='craft'?card.made:s.delivered)>s.sold,complete:s.complete};
 return stages[stage]===true;
}
function preview(card,side,uid,change){
 try{
  if(!['buy','sale'].includes(side))throw Error('Неизвестная сторона ордера.');
  const before=summary(card),next=clone(card),row=(side==='buy'?next.buys:next.sales).find(r=>r.uid===uid);
  if(!row)throw Error('Ордер не найден.');
  row.updates.push({...change});const after=summary(next),fee=change.exactFee===null?setup(change.remaining,change.price,row.rate):change.exactFee;
  const firstProfit=after.profit===null?null:after.profit+fee*(change.count-1),unlimited=firstProfit!==null&&firstProfit>=0&&fee===0;
  const ratio=firstProfit/fee,tolerance=Number.EPSILON*Math.max(1,Math.abs(ratio))*8;
  const maxRepeats=firstProfit===null?null:firstProfit<0?0:unlimited?null:Math.max(0,Math.min(1000,1+Math.floor(ratio+tolerance)));
  return {valid:true,fee:fee*change.count,profit:after.profit,delta:before.profit===null||after.profit===null?null:after.profit-before.profit,maxRepeats,unlimited,loss:after.profit!==null&&after.profit<0};
 }catch(error){return {valid:false,error:error.message};}
}
function normalize(seed){
 const row=(r,sale)=>({uid:uuid(),item:seed.item,name:seed.name,city:'',quantity:seed.quantity,price:null,order:false,rate:2.5,updates:[],...(sale?{sold:0,tax:4}:{bought:0,picked:0,delivered:0}),...clone(r),uid:uuid(),updates:clone(r.updates||[])});
 return validate({uid:uuid(),kind:seed.kind,server:seed.server,item:seed.item,name:seed.name,quantity:seed.quantity,quality:seed.quality||1,created:new Date().toISOString(),archived:false,note:'',destination:'',otherCost:0,made:0,...clone(seed),uid:uuid(),buys:(seed.buys||[]).map(r=>row(r,false)),sales:(seed.sales||[]).map(r=>row(r,true))});
}
function create(storage){
 let data={version:1,cards:[]};const raw=storage.getItem(KEY);
 if(raw)try{data=JSON.parse(raw);if(!object(data)||data.version!==1||!Array.isArray(data.cards)||data.cards.length>500)throw Error();const ids=new Set();for(const card of data.cards){validate(card);if(ids.has(card.uid))throw Error();ids.add(card.uid);}}catch{throw Error('Карточки партий повреждены. Исходные данные сохранены; изменение карточек недоступно.');}
 function commit(next){if(next.cards.reduce((s,c)=>s+c.buys.length+c.sales.length,0)>5000)throw Error('Достигнут лимит строк карточек.');try{storage.setItem(KEY,JSON.stringify(next));}catch{throw Error('Не удалось сохранить карточки. Проверьте свободное место; прежние данные не изменены.');}data=next;}
 function add(seed){if(data.cards.length>=500)throw Error('Можно хранить до 500 карточек.');const card=normalize(seed);summary(card);const next=clone(data);next.cards.push(card);commit(next);return clone(card);}
 function update(uid,edit){const next=clone(data),card=next.cards.find(c=>c.uid===uid);if(!card)throw Error('Карточка не найдена.');edit(card);validate(card);summary(card);commit(next);return clone(card);}
 return {snapshot:()=>clone(data),add,update,duplicate(uid){const seed=clone(data.cards.find(c=>c.uid===uid));if(!seed)throw Error('Карточка не найдена.');seed.made=0;seed.archived=false;for(const r of seed.buys){r.bought=r.picked=r.delivered=0;r.updates=[];}for(const r of seed.sales){r.sold=0;r.updates=[];}return add(seed);}};
}
const api={KEY,cities,setup,reprice,validate,summary,matches,preview,normalize,create};root.BatchCardMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
