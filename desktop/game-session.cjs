'use strict';
const {Worker}=require('node:worker_threads');
const path=require('node:path'),fs=require('node:fs');
function createGameSession({app,notify=()=>{},WorkerClass=Worker}){
  const folder=path.join(app.getPath('userData'),'game-sessions');fs.mkdirSync(folder,{recursive:true});
  const preferences=path.join(folder,'preferences.json');let settings={initialized:false,enabled:false,overlay:false};
  try{const saved=JSON.parse(fs.readFileSync(preferences,'utf8'));settings={...settings,initialized:saved.initialized===true,enabled:saved.enabled===true,overlay:saved.overlay===true};}catch(e){if(e.code!=='ENOENT')settings.warning='Не удалось прочитать настройки сбора данных.';}
  const pending=new Map();let worker=null,next=0,closed=false,status={ready:false,error:null};
  function startWorker(){
    if(worker)return;
    const filename=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked','desktop','session-worker.cjs'):path.join(__dirname,'session-worker.cjs');
    worker=new WorkerClass(filename,{workerData:{database:path.join(folder,'sessions.sqlite3'),profile:path.join(app.getPath('userData'),'statistics-analysis')}});
    worker.on('message',message=>{
    if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(Error(message.error)):request.resolve(message.result);return;}
    if(message.type==='ready')status.ready=true;
    if(message.type==='error')status.error=message.message;
    notify({...status,type:message.type});
    });
    worker.on('error',fail);worker.on('exit',code=>{if(!closed)fail(Error('Хранилище сессий остановлено ('+code+').'));});
  }
  function fail(error){status.error=String(error.message||error);for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(error);}pending.clear();notify({...status,type:'error'});}
  function request(action,args){if(closed)return Promise.reject(Error('Хранилище сессий закрыто'));try{startWorker();}catch(error){fail(error);return Promise.reject(error);}return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Статистика не ответила вовремя'));},30000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,action,args});});}
  function configure(value){settings={initialized:typeof value.initialized==='boolean'?value.initialized:settings.initialized,enabled:typeof value.enabled==='boolean'?value.enabled:settings.enabled,overlay:typeof value.overlay==='boolean'?value.overlay:settings.overlay};try{const temp=preferences+'.tmp';fs.writeFileSync(temp,JSON.stringify(settings));fs.renameSync(temp,preferences);}catch(error){status.error='Не удалось сохранить настройки сбора: '+error.message;notify({...status,type:'error'});}return {...settings};}
  return {request,settings:()=>({...settings}),status:()=>({...status}),configure,wake(){if(closed)return;try{startWorker();worker.postMessage({action:'wake'});}catch(error){fail(error);}},async close(){if(closed)return;if(!worker){closed=true;return;}try{await request('close');}finally{closed=true;await worker.terminate();}}};
}
module.exports={createGameSession};
