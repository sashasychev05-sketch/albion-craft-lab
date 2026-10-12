const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../dist/sale-math.js'),T=require('../dist/extras-engine.js');
test('Transmutation for personal use ignores sale taxes and compares purchase costs',()=>{
 const r=S.transmutation({valid:true,cost:10000},{quantity:100,forSale:false,tax:100,setup:100},200,150);
 assert.equal(r.ready,true);assert.equal(r.saving,5000);assert.equal(r.fees,0);assert.equal(r.totalCost,10000);assert.equal(r.profit,null);assert.equal(r.breakEven,null);
});
test('Transmutation sale deducts both tax and listing fee and solves break-even',()=>{
 const r=S.transmutation({valid:true,cost:10000},{quantity:100,forSale:true,tax:4,setup:2.5,saleMode:'order'},200,150);
 assert.equal(r.gross,20000);assert.equal(r.taxAmount,800);assert.equal(r.setupAmount,500);assert.equal(r.net,18700);assert.equal(r.profit,8700);assert.equal(r.totalCost,11300);assert.ok(Math.abs(r.breakEven*100*0.935-10000)<1e-8);
 const instant=S.transmutation({valid:true,cost:10000},{quantity:100,forSale:true,tax:4,setup:2.5,saleMode:'instant'},200,150);assert.equal(instant.setupAmount,0);assert.equal(instant.profit,9200);
});
test('Missing sale price, invalid production and excessive taxes do not produce a profit',()=>{
 for(const [p,c,price] of [[{valid:true,cost:100},{quantity:1,forSale:true},0],[{valid:false,cost:0},{quantity:1,forSale:true},200],[{valid:true,cost:100},{quantity:0,forSale:true},200],[{valid:true,cost:100},{quantity:1,forSale:true,tax:99,setup:2},200]]){const r=S.transmutation(p,c,price,200);assert.equal(r.ready,false);assert.equal(r.profit,null);assert.ok(r.reason);}
});
test('Zero quantity leaves comparison routes invalid without throwing',()=>{
 const data={transmutations:[{from:'T4_FIBER',to:'T5_FIBER',amount:1,silver:10}]};
 const routes=T.compare('T5_FIBER',0,data,()=>({price:100}));assert.ok(routes.length);assert.ok(routes.every(r=>!r.valid&&r.cost===0&&r.sourceCount===0));
});
