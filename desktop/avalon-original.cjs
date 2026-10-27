'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const EXE='AlbionAvalonChecker.exe';
async function validate(file){
 if(typeof file!=='string'||path.basename(file).toLowerCase()!==EXE.toLowerCase())throw Error('Выберите AlbionAvalonChecker.exe из полной папки программы.');
 const real=await fs.realpath(file),root=path.dirname(real),info=await fs.stat(real);if(!info.isFile()||info.size<1000)throw Error('Файл Checker повреждён.');
 const handle=await fs.open(real,'r');try{const bytes=Buffer.alloc(2);await handle.read(bytes,0,2,0);if(bytes.toString()!=='MZ')throw Error('Нужна Windows-программа AlbionAvalonChecker.exe.');}finally{await handle.close();}
 for(const relative of ['_internal/python312.dll','_internal/data/avalon_zones.json','_internal/data/timer_ctc.onnx','_internal/data/timer_templates.npz']){const item=await fs.stat(path.join(root,relative)).catch(()=>null);if(!item?.isFile())throw Error('Нужна полная папка Checker с _internal и моделями таймеров.');}
 return real;
}
function createOriginal({userData,downloads,probe,focus,spawnProcess=spawn,onChanged=()=>{}}){
 const preferences=path.join(userData,'avalon-original.json');let executable='',child=null,busy=false,lastError='',probeCache=null;
 async function locate(){if(executable)return executable;let saved;try{saved=JSON.parse(await fs.readFile(preferences,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Не удалось прочитать путь оригинального Checker. Выберите программу повторно.');}
  if(saved?.version===1&&typeof saved.executable==='string'){executable=await validate(saved.executable);return executable;}
  for(const file of [path.join(downloads,'AlbionAvalonChecker','AlbionAvalonChecker',EXE),path.join(downloads,'AlbionAvalonChecker',EXE)])try{executable=await validate(file);return executable;}catch{}return '';
 }
 async function connect(file){if(child)throw Error('Сначала завершите Checker, запущенный из Craft Lab.');const real=await validate(file);await fs.mkdir(userData,{recursive:true});const temp=preferences+'.tmp';await fs.writeFile(temp,JSON.stringify({version:1,executable:real}));await fs.rename(temp,preferences);executable=real;probeCache=null;lastError='';return status(true);}
 async function status(force=false){
  let file;try{file=await locate();if(file)file=await validate(file);}catch(e){return {available:false,running:!!child,owned:!!child,busy,error:e.message};}
  if(!file)return {available:false,running:false,owned:false,busy,error:lastError};
  if(child)return {available:true,running:true,owned:true,busy,pid:child.pid,executable:file,error:lastError};
  try{if(force||!probeCache||Date.now()-probeCache.at>10000)probeCache={at:Date.now(),processes:await probe(file)};const current=probeCache.processes[0];return {available:true,running:!!current,owned:false,busy,pid:current?.pid,executable:file,error:lastError};}
  catch{return {available:true,running:false,owned:false,busy,executable:file,error:'Не удалось проверить запущенный Checker. Повторите проверку.',uncertain:true};}
 }
 async function start(){if(busy)throw Error('Дождитесь завершения действия.');busy=true;try{const state=await status(true);if(state.uncertain)throw Error(state.error);if(!state.available)throw Error(state.error||'Не найден полный Checker. Выберите AlbionAvalonChecker.exe.');if(state.running){await focus(state.pid,state.executable);return state;}
   const process=spawnProcess(state.executable,[],{cwd:path.dirname(state.executable),shell:false,windowsHide:true,detached:true,stdio:'ignore'});child=process;lastError='';
   process.once('exit',(code,signal)=>{if(child!==process)return;child=null;probeCache=null;if(code!==0&&!signal)lastError='Checker завершился с ошибкой. Откройте его журнал из исходной папки.';onChanged();});
   process.once('error',()=>{if(child!==process)return;child=null;probeCache=null;lastError='Не удалось запустить оригинальный Checker. Проверьте полноту папки.';onChanged();});
   await new Promise((resolve,reject)=>{process.once('spawn',resolve);process.once('error',()=>reject(Error(lastError||'Не удалось запустить Checker.')));});process.unref?.();onChanged();return status();
  }finally{busy=false;}
 }
 async function show(){const state=await status(true);if(!state.running)throw Error('Checker ещё не запущен.');await focus(state.pid,state.executable);return state;}
 async function stop(){if(busy)throw Error('Дождитесь завершения действия.');if(!child)throw Error('Этот экземпляр запущен отдельно. Завершите его кнопкой «Выход» в Checker.');busy=true;const process=child;try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(Error('Checker ещё завершает работу. Повторите проверку.'));},5000);function cleanup(){clearTimeout(timeout);process.removeListener('exit',done);}function done(){cleanup();resolve();}process.once('exit',done);try{if(!process.kill()){cleanup();reject(Error('Не удалось завершить запущенный Checker.'));}}catch(e){cleanup();reject(e);}});return status(true);}finally{busy=false;}}
 return {connect,status,start,show,stop,validate};
}
module.exports={createOriginal,validate};
