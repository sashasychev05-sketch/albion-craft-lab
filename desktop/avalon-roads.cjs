'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto'),{StringDecoder}=require('node:string_decoder');
const R=require('../dist/avalon-roads.js');
function createRoads({userData,library,now=Date.now,onChanged=()=>{}}){
 const file=path.join(userData,'avalon-roads.json');let data,loading,queue=Promise.resolve(),session=null,timer=null,polling=false,lastError='',starting=false,epoch=0;
 const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
 async function load(){if(data)return;if(loading)return loading;loading=readData();try{await loading;}finally{loading=null;}}
 async function readData(){try{const parsed=JSON.parse(await fs.readFile(file,'utf8'));if(parsed.version!==1||!Array.isArray(parsed.edges)||parsed.edges.length>5000||!parsed.marks||Array.isArray(parsed.marks)||typeof parsed.marks!=='object')throw Error();
  for(const e of parsed.edges)if(!e||!R.servers.includes(e.server)||![e.id,e.from,e.to].every(s=>typeof s==='string'&&s.length>0&&s.length<=100)||e.from===e.to||!Number.isSafeInteger(e.captured)||e.captured<0||e.captured>8640000000000000||e.expires!==null&&(!Number.isSafeInteger(e.expires)||e.expires<0||e.expires>8640000000000000))throw Error();
  for(const [k,v]of Object.entries(parsed.marks))if(!R.servers.some(s=>k.startsWith(s+':'))||k.length>110||typeof v!=='string'||v.length>100)throw Error();data=parsed;
 }catch(e){if(e.code==='ENOENT')data={version:1,edges:[],marks:{}};else throw Error('Не удалось прочитать граф. Сохранённый файл оставлен без изменений.');}}
 async function save(next){await fs.mkdir(userData,{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(tmp,JSON.stringify(next));await fs.rename(tmp,file);data=next;}finally{await fs.unlink(tmp).catch(()=>{});}}
 async function state(){await queue;await load();return {edges:data.edges.map(e=>({...e})),marks:{...data.marks},session:session?{server:session.server,started:session.started,count:session.count}:null,error:lastError};}
 async function accept(records,server){return serial(async()=>{await load();const catalog=await library.read(),names=new Map(catalog.zones.map(z=>[z.name,z.id]));let next={...data,edges:[...data.edges]},added=0;
  for(const r of records){const from=names.get(r.fromName),to=names.get(r.toName);if(!from||!to||from===to){lastError='Название одной из зон не найдено в справочнике. Проверьте распознавание в Checker.';continue;}
   const previous=next.edges.find(e=>e.server===server&&R.key(e.from,e.to)===R.key(from,to));if(previous&&previous.captured>=r.captured)continue;
   next.edges=next.edges.filter(e=>!(e.server===server&&R.key(e.from,e.to)===R.key(from,to)));next.edges.push({id:randomUUID(),server,from,to,captured:r.captured,observed:now(),expires:r.expires,source:r.source==='engine'?'engine':'checker'});added++;
  }if(!added)return 0;
  // Keep current records first; old expired observations are expendable at the cap.
  next.edges.sort((a,b)=>b.captured-a.captured);next.edges=next.edges.slice(0,5000);await save(next);return added;
 });}
 async function poll(){if(!session||polling)return;polling=true;const current=session;try{const handle=await fs.open(current.log,'r');try{const st=await handle.stat();if(session!==current)return;
   const identity=String(st.ino)+':'+String(st.birthtimeMs);if(current.identity===null)current.identity=identity;if(identity!==current.identity||st.size<current.offset){current.offset=st.size;current.identity=identity;current.decoder=new StringDecoder('utf8');current.pending='';lastError='Журнал Checker обновлён. Записываются только новые сканирования.';onChanged();return;}
   if(st.size===current.offset)return;if(st.size-current.offset>2*1024*1024){current.offset=st.size;current.pending='';current.decoder=new StringDecoder('utf8');lastError='Пропущен слишком большой фрагмент журнала. Повторите сканирование порталов.';onChanged();return;}
   const buffer=Buffer.alloc(Math.min(256*1024,st.size-current.offset)),read=await handle.read(buffer,0,buffer.length,current.offset);current.offset+=read.bytesRead;current.pending+=current.decoder.write(buffer.subarray(0,read.bytesRead));const lines=current.pending.split('\n');current.pending=lines.pop();if(current.pending.length>16000)current.pending='';const received=now(),records=lines.map(l=>R.parse(l.replace(/\r$/,''),received)).filter(r=>r&&r.captured>=current.started-1000);if(records.length){current.count+=await accept(records,current.server);onChanged();}
  }finally{await handle.close();}}
  catch(e){lastError=e.code==='ENOENT'?'Журнал Checker пока не появился. Запустите Checker и считайте портал.':e.message;onChanged();}finally{polling=false;}}
 async function start(server,executable){if(!R.servers.includes(server))throw Error('Неизвестный сервер.');if(session||starting)throw Error('Сначала остановите текущую запись.');starting=true;const token=++epoch;try{await load();const log=path.join(path.dirname(executable),'_internal','albion_checker.log');let st;try{st=await fs.stat(log);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(token!==epoch)throw Error('Начало записи отменено.');session={server,log,started:now(),count:0,offset:st?.size||0,identity:st?String(st.ino)+':'+String(st.birthtimeMs):null,pending:'',decoder:new StringDecoder('utf8')};lastError='';timer=setInterval(poll,1000);timer.unref?.();onChanged();return state();}finally{starting=false;}}
 function stop(){epoch++;if(timer)clearInterval(timer);timer=null;session=null;onChanged();}
 async function remove(id){return serial(async()=>{await load();await save({...data,edges:data.edges.filter(e=>e.id!==id)});});}
 async function mark(server,id,city){if(!R.servers.includes(server)||typeof id!=='string'||typeof city!=='string')throw Error('Проверьте зону и город.');const zones=(await library.read()).zones;if(!zones.some(z=>z.id===id)||city&&!zones.some(z=>z.id===city&&R.classify(z)==='portal'))throw Error('Выберите зону и предпортальный город из справочника.');return serial(async()=>{await load();const marks={...data.marks},key=server+':'+id;if(city)marks[key]=city;else delete marks[key];await save({...data,marks});});}
 async function observe({server,from,to,captured,seconds}){if(!R.servers.includes(server)||![from,to].every(s=>typeof s==='string'&&s.length>0&&s.length<=100)||from===to||!Number.isSafeInteger(captured)||captured<0||captured>now()+5000||seconds!==null&&(!Number.isInteger(seconds)||seconds<0||seconds>86400))throw Error('Проверьте распознанные зоны и время портала.');const added=await accept([{fromName:from,toName:to,captured,expires:seconds===null?null:captured+seconds*1000,source:'engine'}],server);onChanged();return added;}
 return {state,start,stop,poll,remove,mark,observe};
}
module.exports={createRoads};
