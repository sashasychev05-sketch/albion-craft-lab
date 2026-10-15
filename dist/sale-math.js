(function(root){'use strict';
const number=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function retained(tax=0,setup=0){return 1-Math.max(0,number(tax))/100-Math.max(0,number(setup))/100;}
function breakEven(cost,quantity,tax=0,setup=0,otherIncome=0){const n=number(quantity),keep=retained(tax,setup);return n>0&&keep>0?Math.max(0,(number(cost)-number(otherIncome))/(n*keep)):null;}
function deal(c){
 const qty=number(c.quantity),discount=number(c.discount,5),average=number(c.average),unitCost=number(c.unitCost),fixed=c.fixedPrice!==null&&c.fixedPrice!==undefined&&c.fixedPrice!=='',price=fixed?number(c.fixedPrice):average*(1-discount/100),tax=number(c.tax),setup=number(c.setup),fixedFees=number(c.fixedFees),transport=number(c.transport),keep=retained(tax,setup),cost=qty*unitCost+transport,gross=qty*price,fees=gross*(1-keep)+fixedFees,net=gross-fees,profit=net-cost;
 const expense=v=>v==null||Number.isFinite(Number(v))&&Number(v)>=0;
 let reason='';
 if(!Number.isSafeInteger(Number(c.quantity))||qty<1||qty>1e9)reason='Укажите целое количество от 1 до 1 000 000 000.';
 else if(c.unitCost==null||c.unitCost===''||!expense(c.unitCost))reason='Укажите неотрицательную себестоимость.';
 else if(![c.tax,c.setup,c.fixedFees,c.transport].every(expense))reason='Налоги, комиссии и доставка должны быть неотрицательными числами.';
 else if(!Number.isFinite(Number(c.discount??5))||discount< -100||discount>99)reason='Укажите скидку от −100 до 99%.';
 else if(keep<=0||tax>100||setup>100)reason='Налог и комиссия вместе должны быть меньше 100%.';
 else if(!(price>0)||!Number.isFinite(Number(fixed?c.fixedPrice:c.average)))reason='Укажите положительную цену сделки или среднюю цену.';
 else if(![cost,gross,fees,net,profit].every(Number.isFinite))reason='Сумма слишком велика. Проверьте количество и цены.';
 return {valid:!reason,reason,quantity:qty,average,discount,price,unitCost,cost,gross,fees,net,profit:reason?null:profit,roi:!reason&&cost?profit/cost*100:null,breakEven:reason?null:breakEven(cost+fixedFees,qty,tax,setup),margin:!reason&&net?profit/net*100:null};
}
const timestamp=v=>Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(String(v))?v:String(v)+'Z');
function daily(points,now=Date.now()){const end=Math.floor(now/3600000)*3600000,start=end-24*3600000,rows=(points||[]).filter(p=>timestamp(p.timestamp)>=start&&timestamp(p.timestamp)<end&&number(p.item_count)>0&&number(p.avg_price)>0),volume=rows.reduce((s,p)=>s+number(p.item_count),0),average=volume?rows.reduce((s,p)=>s+number(p.item_count)*number(p.avg_price),0)/volume:0;return {average,volume,hours:new Set(rows.map(p=>p.timestamp)).size,from:new Date(start).toISOString(),to:new Date(end).toISOString(),valid:volume>0};}
function transmutation(plan,c,salePrice,comparisonPrice){const quantity=Math.max(0,Math.floor(number(c.quantity))),cost=number(plan?.cost),productionReady=!!plan?.valid&&quantity>0&&cost>=0,forSale=c.forSale===true,tax=forSale?Math.max(0,number(c.tax,4)):0,setup=forSale&&c.saleMode!=='instant'?Math.max(0,number(c.setup,2.5)):0,keep=retained(tax,setup),price=Math.max(0,number(salePrice)),comparison=Math.max(0,number(comparisonPrice)),gross=forSale?quantity*price:0,taxAmount=gross*tax/100,setupAmount=gross*setup/100,fees=taxAmount+setupAmount,net=gross-fees,ready=productionReady&&(forSale?price>0&&keep>0:comparison>0);return {forSale,quantity,productionReady,ready,cost,tax,setup,taxAmount,setupAmount,fees,price,gross,net,totalCost:cost+fees,profit:forSale&&ready?net-cost:null,saving:!forSale&&ready?quantity*comparison-cost:null,breakEven:forSale&&productionReady?breakEven(cost,quantity,tax,setup):null,reason:!productionReady?'Нужна цена сырья':forSale&&keep<=0?'Налог и комиссия вместе должны быть меньше 100%.':forSale&&price<=0?'Нужна цена продажи':!forSale&&comparison<=0?'Нужна цена готового ресурса для сравнения':''};}
const api={retained,breakEven,deal,daily,transmutation};root.SaleMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
