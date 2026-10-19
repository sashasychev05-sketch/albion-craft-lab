'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../dist/batch-card-model.js'),O=require('../dist/batch-operations-model.js'),S=require('../dist/shopping-list-model.js'),W=require('../desktop/shopping-window-state.cjs');
function setup(){const data=new Map(),storage={fail:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.fail)throw Error('full');data.set(k,v);}},store=B.create(storage);return {store,storage,session:S.session(store)};}
function add(store,overrides={}){return store.add({kind:'purchase',server:'europe',item:'T4_FIBER',name:'Пенька',quantity:100,buys:[{city:'Lymhurst',quantity:100,price:10}],...overrides});}
test('Mini shopping list retains fully bought groups, pending costs and server/quality separation',()=>{
 const {store}=setup(),a=add(store),b=add(store);store.update(a.uid,c=>c.buys[0].bought=100);store.update(b.uid,c=>c.buys[0].bought=20);add(store,{server:'west'});add(store,{quality:2});const hidden=add(store);store.update(hidden.uid,c=>c.archived=true);
 const rows=S.groups(store.snapshot().cards,'europe');assert.equal(rows.length,2);const row=rows.find(r=>r.quality===1);assert.deepEqual([row.total,row.bought,row.remaining,row.parties,row.cost],[200,120,80,2,800]);store.update(b.uid,c=>c.buys[0].bought=100);assert.equal(S.groups(store.snapshot().cards,'europe').find(r=>r.quality===1).remaining,0);
});
test('Tokens survive unchanged views but stale input cannot be applied after an edit or reload',()=>{
 const {store,session}=setup(),a=add(store),first=session.snapshot('europe').groups[0];assert.equal(session.snapshot('europe').groups[0].token,first.token);store.update(a.uid,c=>c.buys[0].bought=1);assert.throws(()=>session.purchase({server:'europe',key:first.key,token:first.token,quantity:10}),/изменился/);
 const current=session.snapshot('europe').groups[0];assert.notEqual(current.token,first.token);assert.throws(()=>S.session(store).purchase({server:'europe',key:current.key,token:current.token,quantity:10}),/изменился/);
});
test('Overlay partial buys share atomic operations, preserve retrieval and support common undo',()=>{
 const {store,session}=setup();add(store,{created:'2020-01-01T00:00:00Z'});add(store,{created:'2020-02-01T00:00:00Z'});const before=store.snapshot(),g=session.snapshot('europe').groups[0],receipt=session.purchase({server:'europe',key:g.key,token:g.token,quantity:130});assert.deepEqual(store.snapshot().cards.map(c=>c.buys[0].bought),[100,30]);assert.deepEqual(store.snapshot().cards.map(c=>c.buys[0].picked),[0,0]);assert.throws(()=>session.purchase({server:'europe',key:g.key,token:g.token,quantity:130}),/изменился/);O.undo(store,receipt,'europe');assert.deepEqual(store.snapshot(),before);
});
test('Wrong servers, quantities, missing tokens and failed storage cannot change mini-list purchases',()=>{
 const {store,storage,session}=setup();add(store);const g=session.snapshot('europe').groups[0],before=store.snapshot();for(const quantity of [0,-1,NaN,1.2,101,'3'])assert.throws(()=>session.purchase({server:'europe',key:g.key,token:g.token,quantity}));assert.throws(()=>session.purchase({server:'west',key:g.key,token:g.token,quantity:1}));assert.throws(()=>session.purchase({server:'europe',key:g.key,quantity:1}));storage.fail=true;assert.throws(()=>session.purchase({server:'europe',key:g.key,token:g.token,quantity:1}),/сохранить/);assert.deepEqual(store.snapshot(),before);
});
test('Unknown purchase prices are unknown until the entire group has been bought',()=>{
 const {store}=setup(),card=add(store,{buys:[{city:'Lymhurst',quantity:100,price:null}]});assert.equal(S.groups(store.snapshot().cards,'europe')[0].cost,null);store.update(card.uid,c=>c.buys[0].bought=100);assert.equal(S.groups(store.snapshot().cards,'europe')[0].cost,0);
});
test('Archiving or changing manufacturing/sales invalidates a visible mini-list token',()=>{
 const {store,session}=setup(),card=add(store,{kind:'craft',sales:[{city:'Martlock',quantity:100,price:20}]});let g=session.snapshot('europe').groups[0];store.update(card.uid,c=>c.made=1);assert.throws(()=>session.purchase({server:'europe',key:g.key,token:g.token,quantity:1}),/изменился/);g=session.snapshot('europe').groups[0];store.update(card.uid,c=>c.archived=true);assert.throws(()=>session.purchase({server:'europe',key:g.key,token:g.token,quantity:1}),/изменился/);
});
test('Window placement returns removed/offscreen monitors to the visible work area',()=>{
 const area={x:0,y:0,width:1920,height:1040},saved={version:1,bounds:{x:4000,y:-2000,width:370,height:560},opacity:.8,pinned:true},state=W.normalize(saved,[area]);assert.deepEqual(state.bounds,{x:1550,y:0,width:370,height:560});assert.equal(state.opacity,.8);
 const left={x:-1280,y:0,width:1280,height:1024};assert.equal(W.bounds({x:-1000,y:40,width:400,height:500},[area,left]).x,-1000);assert.equal(W.normalize({version:1,bounds:{x:NaN,y:3,width:0,height:100000},opacity:NaN},[area]).opacity,1);
});
test('Window corners and small work areas keep the draggable header accessible',()=>{
 const area={x:-1280,y:50,width:1280,height:900},rect={x:0,y:0,width:370,height:560};assert.deepEqual(W.corner(rect,area,'bottom-right'),{width:370,height:560,x:-382,y:378});assert.deepEqual(W.corner(rect,area,'top-left'),{width:370,height:560,x:-1268,y:62});assert.throws(()=>W.corner(rect,area,'elsewhere'));
 const tiny={x:0,y:0,width:320,height:400},small=W.normalize(null,[tiny]).bounds;assert.ok(small.x>=0&&small.y>=0&&small.x+small.width<=320&&small.y+small.height<=400);
});
test('Window preferences clamp opacity and reject unsupported persisted layouts',()=>{
 const areas=[{x:0,y:0,width:1600,height:900}];assert.equal(W.normalize({version:1,opacity:2,pinned:false},areas).opacity,1);assert.equal(W.normalize({version:1,opacity:0,pinned:false},areas).opacity,.55);assert.equal(W.normalize({version:1,pinned:false},areas).pinned,false);assert.equal(W.normalize({version:5,bounds:{x:1,y:1,width:300,height:300}},areas).bounds.width,370);
});
test('Placed buy orders are separate from purchases and are consumed when fills are recorded',()=>{
 const {store,session}=setup();const a=add(store,{created:'2020-01-01T00:00:00Z'});add(store,{created:'2020-02-01T00:00:00Z'});let group=session.snapshot('europe').groups[0];const before=store.snapshot(),receipt=session.order({server:'europe',key:group.key,token:group.token,quantity:150});assert.deepEqual(store.snapshot().cards.map(c=>c.buys[0].ordered),[100,50]);group=session.snapshot('europe').groups[0];assert.deepEqual([group.bought,group.ordered,group.toOrder],[0,150,50]);assert.throws(()=>session.order({server:'europe',key:group.key,token:group.token,quantity:51}));O.undo(store,receipt,'europe');assert.deepEqual(store.snapshot(),before);
 group=session.snapshot('europe').groups[0];session.order({server:'europe',key:group.key,token:group.token,quantity:80});group=session.snapshot('europe').groups[0];const fill=session.purchase({server:'europe',key:group.key,token:group.token,quantity:30});assert.deepEqual([store.snapshot().cards[0].buys[0].bought,store.snapshot().cards[0].buys[0].ordered],[30,50]);O.undo(store,fill,'europe');assert.deepEqual([store.snapshot().cards[0].buys[0].bought,store.snapshot().cards[0].buys[0].ordered],[0,80]);store.update(a.uid,c=>c.buys[0].bought=20);assert.equal(store.snapshot().cards[0].buys[0].ordered,60);
});
test('Pending order bounds, storage failure, legacy records and duplicates stay consistent',()=>{
 const {store,session,storage}=setup(),a=add(store);let group=session.snapshot('europe').groups[0];const before=store.snapshot();storage.fail=true;assert.throws(()=>session.order({server:'europe',key:group.key,token:group.token,quantity:40}),/сохранить/);assert.deepEqual(store.snapshot(),before);storage.fail=false;assert.throws(()=>store.update(a.uid,c=>c.buys[0].ordered=101));store.update(a.uid,c=>c.buys[0].ordered=40);const duplicate=store.duplicate(a.uid);assert.equal(duplicate.buys[0].ordered,0);store.update(a.uid,c=>delete c.buys[0].ordered);group=session.snapshot('europe').groups[0];const old=store.snapshot(),receipt=session.order({server:'europe',key:group.key,token:group.token,quantity:10});O.undo(store,receipt,'europe');assert.deepEqual(store.snapshot(),old);
});
