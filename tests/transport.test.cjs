const assert=require('node:assert/strict');
const T=require('../dist/transport-engine.js');
const item={weight:2},c={quantity:100,buyPrice:1000,sellPrice:1500,buyMode:'instant',sellMode:'sell',tax:4,setup:2.5,capacity:150,tripCost:1000,extra:500};
const r=T.calculate(c,item);
assert.equal(r.trips,2);assert.equal(r.weight,200);assert.equal(r.purchase,100000);assert.equal(r.tax,6000);assert.equal(r.sellFee,3750);assert.equal(r.transport,2500);assert.equal(r.profit,37750);assert.equal(r.valid,true);
const order=T.calculate({...c,buyMode:'order'},item);assert.equal(order.buyFee,2500);assert.equal(order.profit,35250);
const instant=T.calculate({...c,sellMode:'buy'},item);assert.equal(instant.sellFee,0);assert.equal(instant.profit,41500);
assert.equal(T.calculate({...c,sellPrice:r.breakEven},item).profit.toFixed(6),'0.000000');
assert.equal(T.calculate({...c,capacity:0},item).valid,false);assert.equal(T.calculate({...c,quantity:0},item).valid,false);assert.equal(T.calculate({...c,buyPrice:0},item).valid,false);assert.equal(T.calculate({...c,sellPrice:0},item).valid,false);assert.equal(T.calculate({...c,tax:98,setup:3},item).valid,false);
global.window={};require('../dist/luxury-data.js');const A=window.LUXURY_DATA;
assert.equal(new Set(A.map(x=>x.id)).size,A.length);assert.equal(new Set(A.map(x=>x.key)).size,7);assert.equal(A.length,21);assert.ok(A.every(x=>x.weight>0&&x.tier>=4&&x.tier<=8&&x.name));
console.log('PASS: transport fees, tax, trip rounding, break-even, missing data, luxury catalog');

const npc=T.calculate({...c,sellMode:'npc',sellPrice:1000},item);assert.equal(npc.sellFee,0);assert.equal(npc.tax,4000);assert.equal(npc.profit,-6500);assert.equal(A.find(x=>x.id==='TREASURE_KNOWLEDGE_RARITY3').npcPrice,25000);assert.equal(A.find(x=>x.id==='TREASURE_AVALON_RARITY3').npcPrice,250000);

const full=T.calculate({...c,quantityMode:'capacity',capacity:501,quantity:9999},{weight:2.5});
assert.equal(full.quantity,200);assert.equal(full.weight,500);assert.equal(full.trips,1);
assert.equal(T.calculate({...c,quantityMode:'capacity',capacity:501},{weight:5}).quantity,100);
assert.equal(T.calculate({...c,quantityMode:'capacity',capacity:501},{weight:6.25}).quantity,80);
const small=T.calculate({...c,quantityMode:'capacity',capacity:2},{weight:2.5});assert.equal(small.quantity,0);assert.equal(small.trips,0);assert.equal(small.valid,false);
assert.equal(T.calculate({...c,quantityMode:'capacity',capacity:0},{weight:2.5}).quantity,0);
assert.equal(T.calculate({...c,quantityMode:'manual',quantity:250,capacity:500},{weight:2.5}).trips,2);
for(const item of A){const r=T.calculate({...c,quantityMode:'capacity',capacity:501},item);assert.ok(r.weight<=501);assert.ok((r.quantity+1)*item.weight>501);assert.equal(r.trips,1)}
console.log('PASS: automatic quantity, floor rounding, tier weight, insufficient capacity, manual mode, all luxury goods');
