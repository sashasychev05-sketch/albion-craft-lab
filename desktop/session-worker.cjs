'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path');
const {SessionDatabase,serverName}=require('./session-database.cjs');
const store=new SessionDatabase(workerData.database),journalSizes=new Map(),documentTimes=new Map();
let timer,lastError='',lastVersion=-1,journals=[],journalIndex=0,documents=[],documentIndex=0,nextDiscovery=0,nextJournals=0,nextPrune=0;
const moduleName=name=>/statistics-/i.test(name)?'statistics':/damage|combat/i.test(name)?'combat':/gather|resource/i.test(name)?'gathering':/dungeon/i.test(name)?'dungeons':/trade|market|mail/i.test(name)?'trade':/vault|storage|bank/i.test(name)?'storage':/craft|journal/i.test(name)?'crafting':/cluster|map/i.test(name)?'locations':/loot|chest/i.test(name)?'loot':/guild/i.test(name)?'guild':/party/i.test(name)?'party':/user|player|character/i.test(name)?'character':'other';
function report(error){const message=String(error.message||error);if(message!==lastError){lastError=message;parentPort.postMessage({type:'error',message});}}
function discoverJournals(){
 const folder=path.join(workerData.profile,'AlbionLab');
 journals=fs.existsSync(folder)?fs.readdirSync(folder).filter(name=>/^events-[\w-]+\.jsonl$/.test(name)).sort().reverse().map(name=>path.join(folder,name)):[];
 nextJournals=Date.now()+1000;
}
function discover(){
 discoverJournals();
 const found=[];
 function visit(directory,server){if(!fs.existsSync(directory))return;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const file=path.join(directory,entry.name);if(entry.isDirectory())visit(file,server);else if(entry.isFile()&&entry.name.endsWith('.json'))found.push({file,server});}}
 for(const [directory,server]of [['UserData-AMERICA','west'],['UserData-ASIA','east'],['UserData-EUROPE','europe']])visit(path.join(workerData.profile,directory),server);
 documents=found;nextDiscovery=Date.now()+5000;
}
function readJournal(filename,drain){
 try{
  const stat=fs.lstatSync(filename);if(stat.isSymbolicLink()||journalSizes.get(filename)===stat.size)return;
  let consumed=store.importJournal(filename);
  if(drain)while(consumed)consumed=store.importJournal(filename);
  if(!consumed)journalSizes.set(filename,stat.size);
 }catch(error){if(error.code!=='ENOENT')report(error);}
}
function readDocument({file,server}){
 try{
  const stat=fs.statSync(file),mark=stat.mtimeMs+':'+stat.size;if(documentTimes.get(file)===mark)return;
  if(stat.size>64*1024*1024){report(Error('Один из архивов SAT слишком велик для автоматического просмотра; он доступен в инструментах SAT.'));return;}
  const data=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''),relative=path.relative(workerData.profile,file);JSON.parse(data);
  store.document(relative,server,moduleName(relative.split(path.sep).slice(1).join(path.sep)),stat.mtimeMs,data);documentTimes.set(file,mark);
 }catch(error){if(!['ENOENT','EPERM','EACCES'].includes(error.code))report(error);}
}
function pump(drain=false){
 try{
  if(drain||Date.now()>=nextDiscovery)discover();
  else if(Date.now()>=nextJournals)discoverJournals();
  if(Date.now()>=nextPrune){store.pruneRates();nextPrune=Date.now()+60000;}
  const deadline=Date.now()+40;
  if(journals[0])readJournal(journals[0],drain);
  for(let n=0;n<journals.length&&(drain||Date.now()<deadline);n++){journalIndex=(journalIndex+1)%journals.length;readJournal(journals[journalIndex],drain);}
  for(let n=0;n<documents.length&&(drain||Date.now()<deadline);n++){documentIndex=(documentIndex+1)%documents.length;readDocument(documents[documentIndex]);}
  if(store.version!==lastVersion){lastVersion=store.version;parentPort.postMessage({type:'changed',version:lastVersion});}
 }catch(error){report(error);}
}
function filter(value={}){
 const result={};for(const key of ['sessionId','server','character'])if(typeof value?.[key]==='string')result[key]=value[key].slice(0,200);
 if(result.sessionId==='current'){const id=store.context()?.sessionId;result.sessionId=id&&!/^0{8}-/.test(id)?id:'none';}
 if(result.server)result.server=serverName(result.server);return result;
}
parentPort.on('message',message=>{
 if(message.action==='wake'){nextJournals=0;pump();return;}
 try{
  let result;
  if(message.action==='query')result=store.summary(filter(message.args));
  else if(message.action==='refresh'){journalSizes.clear();nextDiscovery=0;pump();result=true;}
  else if(message.action==='documents')result=store.documents(message.args?.module,message.args?.server||'');
  else if(message.action==='document')result=store.readDocument(message.args?.path);
  else if(message.action==='close'){clearInterval(timer);pump(true);store.close();parentPort.postMessage({id:message.id,result:true});parentPort.close();return;}
  else throw Error('Неизвестная операция статистики');
  parentPort.postMessage({id:message.id,result});
 }catch(error){parentPort.postMessage({id:message.id,error:String(error.message||error)});}
});
pump();timer=setInterval(pump,500);parentPort.postMessage({type:'ready'});
