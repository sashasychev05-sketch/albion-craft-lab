const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createGameSession}=require('../desktop/game-session.cjs');
const {createSessionIcons}=require('../desktop/session-icons.cjs');
function folder(){return fs.mkdtempSync(path.join(os.tmpdir(),'lab-session-integration-'));}
function clean(root){assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});}
test('real worker imports journals and module archives, persists cursors and resumes without duplicates',async()=>{
 const root=folder(),app={getPath:()=>root,isPackaged:false};let service;
 try{
  const profile=path.join(root,'statistics-analysis'),journal=path.join(profile,'AlbionLab','events-test.jsonl'),archive=path.join(profile,'UserData-EUROPE','Data','gathering-history.json');
  fs.mkdirSync(path.dirname(journal),{recursive:true});fs.mkdirSync(path.dirname(archive),{recursive:true});fs.writeFileSync(archive,JSON.stringify([{item:'T4_WOOD',quantity:3}]));
  const now=new Date().toISOString(),records=[{id:'session:s1',kind:'session',sessionId:'s1',time:now,data:{id:'s1',characterName:'Игрок',serverLocation:'Europe',startedAtUtc:now}},{id:'stat:one',kind:'stat',sessionId:'s1',time:now,data:{entry:{valueType:'Fame',value:250}}},{id:'context:test',kind:'context',sessionId:'s1',time:now,data:{character:'Игрок',tracking:true,inGame:true}}];
  fs.writeFileSync(journal,records.map(JSON.stringify).join('\n')+'\n');
  service=createGameSession({app});let result;
  for(let i=0;i<40;i++){result=await service.request('query',{sessionId:'current'});if(result.metrics.Fame===250)break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(result.metrics.Fame,250);assert.equal(result.context.character,'Игрок');assert.equal(result.modules.find(m=>m.module==='gathering').files,1);
  const docs=await service.request('documents',{module:'gathering'});assert.equal(docs.length,1);assert.deepEqual(await service.request('document',{path:docs[0].path}),[{item:'T4_WOOD',quantity:3}]);
  service.configure({initialized:true,enabled:true,overlay:true});await service.close();service=createGameSession({app});
  assert.equal(service.settings().enabled,true);assert.equal(service.settings().overlay,true);await service.request('refresh');assert.equal((await service.request('query',{})).metrics.Fame,250);
  fs.appendFileSync(journal,JSON.stringify({...records[1],id:'stat:two',data:{entry:{valueType:'Fame',value:50}}})+'\n');await service.request('refresh');assert.equal((await service.request('query',{})).metrics.Fame,300);
 }finally{if(service)await service.close();clean(root);}
});
test('item icons use original cached quality images, reject paths and support offline mode',async()=>{
 const root=folder();try{
  const images=path.join(root,'statistics-analysis','ImageResources');fs.mkdirSync(images,{recursive:true});const png=Buffer.from([137,80,78,71,13,10,26,10,0]);fs.writeFileSync(path.join(images,'T6_BAG@2_quality_4'),png);
  let fetches=0;const icons=createSessionIcons({app:{getPath:()=>root},net:{fetch(){fetches++;throw Error('No network expected');}},offline:true});
  const response=await icons.image({url:'albion://app/session-item/T6_BAG%402?quality=4'});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  assert.equal((await icons.image({url:'albion://app/session-item/x%2Fsecret'})).status,403);assert.equal((await icons.image({url:'albion://app/session-item/T8_MISSING'})).status,404);assert.equal(fetches,0);
 }finally{clean(root);}
});
