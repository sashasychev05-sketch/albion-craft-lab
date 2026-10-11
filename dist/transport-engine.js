(function(root){
 'use strict';
 function calculate(c,item){
  const n=k=>Number.isFinite(Number(c[k]))?Math.max(0,Number(c[k])):0,capacity=n('capacity'),unitWeight=Number(item.weight);
  const quantity=c.quantityMode==='capacity'?(unitWeight>0&&Number.isFinite(unitWeight)?Math.floor(capacity/unitWeight):0):Math.floor(n('quantity')),buy=n('buyPrice'),sell=n('sellPrice');
  const weight=quantity*(unitWeight>0&&Number.isFinite(unitWeight)?unitWeight:0),trips=capacity>0?Math.ceil(weight/capacity):0;
  const purchase=buy*quantity,buyFee=c.buyMode==='order'?purchase*Math.min(100,n('setup'))/100:0;
  const gross=sell*quantity,tax=gross*Math.min(100,n('tax'))/100,sellFee=c.sellMode==='sell'?gross*Math.min(100,n('setup'))/100:0;
  const transport=trips*n('tripCost')+n('extra'),cost=purchase+buyFee+transport,net=gross-tax-sellFee,profit=net-cost;
  const retained=1-Math.min(100,n('tax'))/100-(c.sellMode==='sell'?Math.min(100,n('setup'))/100:0);
  return {quantity,weight,trips,purchase,buyFee,gross,tax,sellFee,transport,cost,net,profit,roi:cost?profit/cost*100:0,breakEven:quantity&&retained>0?cost/quantity/retained:null,valid:quantity>0&&buy>0&&sell>0&&capacity>0&&retained>0};
 }
 const api={calculate};if(typeof module!=='undefined')module.exports=api;else root.TransportEngine=api;
})(typeof window==='undefined'?globalThis:window);
