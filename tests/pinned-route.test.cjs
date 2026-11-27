const test=require('node:test'),assert=require('node:assert/strict'),{create}=require('../dist/pinned-route.js');
test('route resumes per server and expired, missing or replayed clicks cannot advance it',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const route=create(storage,'europe'),request={index:0,from:'a',to:'b'};route.pin(['a','b','a']);
 assert.equal(create(storage,'west').read(),null);
 for(const expires of [null,99,100])assert.equal(route.advance(request,expires,100),false);
 assert.equal(route.advance(request,101,100),true);assert.equal(route.advance(request,101,100),false);
 const reopened=create(storage,'europe');assert.deepEqual(reopened.read(),{nodes:['a','b','a'],index:1});
 assert.equal(reopened.advance({index:1,from:'b',to:'a'},101,100),true);reopened.clear();assert.equal(route.read(),null);
});
