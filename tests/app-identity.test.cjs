'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{configureIdentity,NAME,APP_ID}=require('../desktop/app-identity.cjs');
test('Albion Lab keeps the exact previous profile and Windows upgrade identity',()=>{
 let name='albion-craft-lab',profile=null,id;const app={setName:v=>name=v,getPath:()=>profile||'profiles/'+name,setPath:(key,value)=>{assert.equal(key,'userData');profile=value;},setAppUserModelId:v=>id=v};assert.equal(configureIdentity(app),'profiles/Albion Craft Lab');assert.equal(name,NAME);assert.equal(profile,'profiles/Albion Craft Lab');assert.equal(id,APP_ID);
});
test('Brand rename preserves an explicitly selected diagnostic profile',()=>{
 let name,profile='test-profile';const app={setName:v=>name=v,getPath:()=>profile,setPath:(key,value)=>profile=value,setAppUserModelId(){}};assert.equal(configureIdentity(app),'test-profile');assert.equal(profile,'test-profile');assert.equal(name,'Albion Lab');
});
