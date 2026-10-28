'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {createReceiver,createOrderStore}=require('./market-capture.cjs');
const cities={'7':'Thetford','1002':'Lymhurst','2004':'Bridgewatch','3003':'Black Market','3005':'Caerleon','3008':'Martlock','4002':'Fort Sterling','5003':'Brecilien'};
function quotes(orders){const rows=new Map();for(const o of orders){const city=cities[o.location];if(!city)continue;const k=[o.server,o.item,city,o.quality].join('|');let r=rows.get(k);if(!r){r={server:o.server,item:o.item,city,quality:o.quality};rows.set(k,r);}const side=o.type==='offer'?'ask':'bid',t=side+'Time';if(!r[side]||(side==='ask'?o.price<r[side]:o.price>r[side])||(o.price===r[side]&&o.observedAt>r[t])){r[side]=o.price;r[t]=o.observedAt;}}return [...rows.values()];}
function createScanner({app,notify,spawnProcess=spawn,executablePath}){
 const folder=path.join(app.getPath('userData'),'market-scanner'),file=path.join(folder,'orders.json');fs.mkdirSync(folder,{recursive:true});
 const exe=executablePath||(app.isPackaged?path.join(process.resourcesPath,'aodp','albiondata-client.exe'):path.join(__dirname,'vendor','aodp','albiondata-client.exe'));
 let telemetry={},pending=false,session={added:0,updated:0},priceCache=null,publishTimer=null,writes=Promise.resolve();let store=createOrderStore(),receiver,child,server='',message='',running=false;
 try{if(fs.existsSync(file)){const data=JSON.parse(fs.readFileSync(file,'utf8'));if(data.version!==1)throw Error('Unknown order format');store=createOrderStore(undefined,undefined,data.orders);}}catch(e){message='Не удалось прочитать сохранённые цены: '+e.message;}
 function state(){if(!priceCache||Date.now()-priceCache.time>=1000){const entries=store.list();priceCache={time:Date.now(),quotes:quotes(entries),orders:entries.length};}return {running,server,message,configured:fs.existsSync(exe),telemetry,session:{...session},quotes:priceCache.quotes,orders:priceCache.orders};}
 function publish(){if(!publishTimer){publishTimer=setTimeout(()=>{publishTimer=null;notify(state());},100);publishTimer.unref?.();}}
 async function stop(){pending=true;running=false;const process=child;child=null;if(process)process.kill();await writes;clearTimeout(publishTimer);publishTimer=null;const listener=receiver;receiver=null;if(listener){listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));}pending=false;notify(state());}
 async function start(region){if(running||pending)return state();if(!['europe','west','east'].includes(region))throw Error('Выберите сервер');if(!exe||!fs.existsSync(exe))throw Error('Встроенный движок отсутствует. Переустановите Albion Lab.');if(message.startsWith('Не удалось прочитать'))throw Error(message);server=region;pending=true;telemetry={};session={added:0,updated:0};
 const token=crypto.randomBytes(24).toString('hex');receiver=createReceiver({token,onOrders(batch){
 if(!running)return;
 const task=writes.then(async()=>{
  const detected={1:'west',2:'east',3:'europe'}[telemetry.server];
  if(detected&&detected!==server){message='Выбран другой сервер. Выключите сканер и выберите сервер игры.';publish();return;}
  const existing=store.list(),next=createOrderStore(undefined,undefined,existing),before=new Set(existing.map(o=>o.server+'|'+o.id));
  const accepted=next.ingest(server,batch);if(!accepted)return;
  const entries=next.list(),added=entries.reduce((count,o)=>count+!before.has(o.server+'|'+o.id),0),temporary=file+'.tmp';
  await fs.promises.writeFile(temporary,JSON.stringify({version:1,orders:entries}));
  await fs.promises.rename(temporary,file);
  store=next;priceCache=null;session.added+=added;session.updated+=accepted-added;message='Получены цены из игры';publish();
 });
 writes=task.catch(()=>{message='Не удалось сохранить считанные цены. Проверьте свободное место и доступ к папке профиля.';publish();});return task;
 }});
 try{await new Promise((resolve,reject)=>{receiver.once('error',reject);receiver.listen(0,'127.0.0.1',resolve);});const url=`http://127.0.0.1:${receiver.address().port}/${token}`;running=true;message='Откройте рынок в игре и просматривайте товары';child=spawnProcess(exe,['-i',url,'-p',''],{cwd:folder,windowsHide:true,stdio:['ignore','pipe','pipe']});const active=child;let buffer='';child.stdout?.on('data',chunk=>{buffer+=chunk.toString();if(buffer.length>65536)buffer='';let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const nextTelemetry=JSON.parse(line);if(JSON.stringify(nextTelemetry)===JSON.stringify(telemetry))continue;telemetry=nextTelemetry;if(telemetry.error)message='Захват остановлен. Проверьте Npcap и права доступа.';else if(telemetry.encryption==='encrypted')message='Рынок передал зашифрованные данные — цены недоступны.';else if(telemetry.capture&&message!=='Получены цены из игры')message='Захват включён. Просматривайте товары на рынке.';publish();}catch{}}});child.stderr?.on('data',()=>{});child.once('error',e=>{message='Не удалось запустить клиент: '+e.message;stop().catch(()=>{});});child.once('exit',()=>{if(child!==active)return;message='Клиент завершил работу. Проверьте Npcap и права запуска.';stop().catch(()=>{});});publish();return state();}catch(e){await stop();throw e;}finally{pending=false;}}
 return {state,start,stop};
}
module.exports={createScanner,quotes};
