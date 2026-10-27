'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto'),{spawn}=require('node:child_process'),{StringDecoder}=require('node:string_decoder');
const SKIP=new Set(['config.json','config.default.json','timer_samples','scan_samples','__pycache__','_tcl_data','_tk_data','tcl8']);
async function validateSource(file){
 if(typeof file!=='string'||path.basename(file).toLowerCase()!=='albionavalonchecker.exe')throw Error('Выберите AlbionAvalonChecker.exe из полной скачанной папки.');
 const real=await fs.realpath(file),root=path.join(path.dirname(real),'_internal'),info=await fs.stat(real);if(!info.isFile()||info.size<1000||info.size>100000000)throw Error('Неверный файл движка.');
 const h=await fs.open(real,'r');try{const b=Buffer.alloc(2);await h.read(b,0,2,0);if(b.toString()!=='MZ')throw Error('Нужна полная Windows-версия Checker.');}finally{await h.close();}
 for(const name of ['python312.dll','base_library.zip','data/avalon_zones.json','data/timer_ctc.onnx','data/timer_templates.npz','tessdata/eng.traineddata'])if(!(await fs.stat(path.join(root,name))).isFile())throw Error('В папке не хватает библиотек распознавания.');
 return {file:real,root};
}
function createWorker({runtime,archive,profile,helper,worker,spawnProcess=spawn,onExit=()=>{},onEvent=()=>{},startupTimeout=60000,requestTimeout=30000}){
 let child=null,ready=null,pending=new Map(),counter=0,stderr='';
 function stop(reason='Сканер остановлен.'){const process=child;child=null;ready=null;for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error(reason));}pending.clear();if(!process)return Promise.resolve();return new Promise(resolve=>{const timer=setTimeout(done,2000);function done(){clearTimeout(timer);process.removeListener('exit',done);resolve();}process.once('exit',done);if(process.exitCode!=null||!process.kill())done();});}
 function start(){if(ready)return ready;const promise=new Promise((resolve,reject)=>{let process=null;
  let settled=false,buffer='',decoder=new StringDecoder('utf8');const timeout=setTimeout(()=>fail('Движок не успел загрузиться. Попробуйте подключить его заново.'),startupTimeout);
  const command=path.join(global.process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  try{child=spawnProcess(command,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Runtime',runtime,'-Worker',worker,'-Archive',archive,'-Profile',profile],{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe'],cwd:profile});}catch{fail('Не удалось запустить встроенный сканер.');return;}
  process=child;
  function fail(message){clearTimeout(timeout);if(!settled){settled=true;reject(Error(message));}if(child===process){stop(message);onExit(message);}}
  process.once('error',()=>fail('Не удалось запустить встроенный сканер.'));process.once('exit',()=>fail('Встроенный сканер завершился. Нажмите «Начать запись», чтобы запустить его снова.'));
  process.stdin.on('error',()=>fail('Связь со сканером прервана.'));process.stderr.on('data',bytes=>{stderr=(stderr+bytes.toString('utf8')).slice(-12000);});
  process.stdout.on('data',bytes=>{buffer+=decoder.write(bytes);if(buffer.length>1000000)return fail('Неверный ответ движка распознавания.');const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){let message;try{message=JSON.parse(line);}catch{continue;}
   if(message.event==='ready'&&!settled){if(message.ocr!==true||message.timerModel!==true)return fail('Не удалось загрузить модели распознавания.');settled=true;clearTimeout(timeout);resolve(message);continue;}
   if(message.event==='trigger'){onEvent(message);continue;}const task=pending.get(message.id);if(!task)continue;clearTimeout(task.timer);pending.delete(message.id);message.error?task.reject(Error('Движок не смог прочитать изображение. Проверьте область считывания.')):task.resolve(message.result);
  }});
 });ready=promise;promise.catch(()=>{if(ready===promise)ready=null;});return promise;}
 async function request(payload){await start();if(!child)throw Error('Сканер не запущен.');const id=String(++counter);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const message='Распознавание заняло слишком много времени. Повторите сканирование.';stop(message);onExit(message);},requestTimeout);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({...payload,id})+'\n',error=>{if(error){const item=pending.get(id);if(item){clearTimeout(item.timer);pending.delete(id);reject(Error('Связь со сканером прервана.'));}}});});}
 return {start,request,stop,debug:()=>stderr};
}
function createEngine({userData,downloads,helper,worker,onChanged=()=>{},onEvent=()=>{},makeWorker=createWorker}){
 const root=path.join(userData,'avalon-engine-runtime'),manifest=path.join(root,'current.json');let current=null,client=null,busy=false,lastError='';
 async function read(){try{const value=JSON.parse(await fs.readFile(manifest,'utf8'));if(value.version!==1||!/^[a-f0-9]{32}$/.test(value.folder))throw Error();const folder=path.join(root,value.folder);for(const f of ['modules.bin','runtime/python312.dll','runtime/base_library.zip','runtime/data/timer_ctc.onnx','runtime/data/timer_templates.npz','runtime/data/avalon_zones.json','runtime/tessdata/eng.traineddata'])if(!(await fs.stat(path.join(folder,f))).isFile())throw Error();current=folder;return folder;}catch(e){current=null;if(e.code!=='ENOENT')lastError='Не удалось прочитать встроенный движок. Подключите папку Checker повторно.';return null;}}
 async function locate(){const candidates=[path.join(downloads,'AlbionAvalonChecker','AlbionAvalonChecker','AlbionAvalonChecker.exe'),path.join(downloads,'AlbionAvalonChecker','AlbionAvalonChecker.exe')];try{const old=JSON.parse(await fs.readFile(path.join(userData,'avalon-original.json'),'utf8'));if(typeof old.executable==='string')candidates.unshift(old.executable);}catch{}for(const file of candidates)try{return await validateSource(file);}catch{}return null;}
 function stop(){const old=client;client=null;const result=old?.stop()||Promise.resolve();onChanged();return result;}
 async function status(){const folder=current||await read();return {available:!!folder,running:!!client,busy,error:lastError,sourceFound:folder?true:!!await locate()};}
 function open(folder){let item;item=makeWorker({runtime:path.join(folder,'runtime'),archive:path.join(folder,'modules.bin'),profile:userData,helper,worker,onEvent,onExit:message=>{if(client===item){client=null;lastError=message;onChanged();}}});return item;}
 async function importRuntime(file){if(busy)throw Error('Дождитесь подключения движка.');if(client)throw Error('Сначала остановите сканер.');busy=true;lastError='';let destination;
  try{const previous=current||await read(),source=file?await validateSource(file):await locate();if(!source)throw Error('Выберите полную папку скачанного Albion Avalon Checker.');const id=randomUUID().replaceAll('-','');destination=path.join(root,id);await fs.mkdir(path.join(destination,'runtime'),{recursive:true});let bytes=0,count=0;
   async function copy(sourceDir,targetDir,relative=''){for(const entry of await fs.readdir(sourceDir,{withFileTypes:true})){const rel=path.join(relative,entry.name);if(SKIP.has(entry.name)||/\.(log|dmp)$/i.test(entry.name)||rel.replaceAll('\\','/').startsWith('data/images')||rel.replaceAll('\\','/').startsWith('data/icons'))continue;if(entry.isSymbolicLink())throw Error('В папке движка обнаружены ссылки. Подключите обычную распакованную копию.');const src=path.join(sourceDir,entry.name),dst=path.join(targetDir,entry.name);if(entry.isDirectory()){await fs.mkdir(dst,{recursive:true});await copy(src,dst,rel);}else if(entry.isFile()){const info=await fs.stat(src);bytes+=info.size;if(++count>6000||bytes>800000000)throw Error('Папка движка слишком большая.');await fs.copyFile(src,dst);}}}
   await copy(source.root,path.join(destination,'runtime'));await fs.copyFile(source.file,path.join(destination,'modules.bin'));await fs.mkdir(userData,{recursive:true});const probe=open(destination);try{await probe.start();const result=await probe.request({action:'match_text',text:'Coues-Exakrom'});if(result.zone!=='Coues-Exakrom')throw Error('Справочник движка не прошёл проверку.');}finally{await probe.stop();}
   const temp=manifest+'.'+id+'.tmp';await fs.writeFile(temp,JSON.stringify({version:1,folder:id}));await fs.rename(temp,manifest);current=destination;if(previous&&previous!==destination&&path.dirname(previous)===root&&/^[a-f0-9]{32}$/.test(path.basename(previous)))await fs.rm(previous,{recursive:true,force:true}).catch(()=>{});return {available:true,files:count,bytes};
  }catch(e){lastError=e.message;if(destination){if(path.dirname(destination)!==root)throw Error('Неверная временная папка движка.');await fs.rm(destination,{recursive:true,force:true}).catch(()=>{});}throw e;}finally{busy=false;onChanged();}
 }
 async function start(){if(busy)throw Error('Дождитесь подключения движка.');const folder=current||await read();if(!folder)throw Error('Сначала подключите движок Checker.');if(!client)client=open(folder);try{const result=await client.start();lastError='';onChanged();return result;}catch(e){client=null;lastError=e.message;throw e;}}
 async function request(payload){await start();const active=client;if(!active)throw Error('Сканер остановлен.');return active.request(payload);}
 return {status,locate,importRuntime,start,request,stop,debug:()=>client?.debug()||''};
}
module.exports={createEngine,createWorker,validateSource};
