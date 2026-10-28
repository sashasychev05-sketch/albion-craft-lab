'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {createReceiver,createOrderStore}=require('./market-capture.cjs');
const cities={'7':'Thetford','1002':'Lymhurst','2004':'Bridgewatch','3003':'Black Market','3005':'Caerleon','3008':'Martlock','4002':'Fort Sterling','5003':'Brecilien'};
function quotes(orders){const rows=new Map();for(const o of orders){const city=cities[o.location];if(!city)continue;const k=[o.server,o.item,city,o.quality].join('|');let r=rows.get(k);if(!r){r={server:o.server,item:o.item,city,quality:o.quality};rows.set(k,r);}const side=o.type==='offer'?'ask':'bid',t=side+'Time';if(!r[side]||(side==='ask'?o.price<r[side]:o.price>r[side])){r[side]=o.price;r[t]=o.observedAt;}}return [...rows.values()];}
function createScanner({app,dialog,notify,spawnProcess=spawn}){
 const folder=path.join(app.getPath('userData'),'market-scanner'),file=path.join(folder,'orders.json'),settings=path.join(folder,'settings.json');fs.mkdirSync(folder,{recursive:true});
 let store=createOrderStore(),exe='',receiver,child,server='',message='',running=false;
 try{if(fs.existsSync(file)){const data=JSON.parse(fs.readFileSync(file,'utf8'));if(data.version!==1)throw Error('Unknown order format');store=createOrderStore(undefined,undefined,data.orders);}if(fs.existsSync(settings))exe=JSON.parse(fs.readFileSync(settings,'utf8')).exe||'';}catch(e){message='Не удалось прочитать сохранённые цены: '+e.message;}
 function state(){return {running,server,message,configured:!!exe,quotes:quotes(store.list()),orders:store.list().length};}
 function publish(){notify(state());}
 async function stop(){running=false;const process=child;child=null;if(process)process.kill();const listener=receiver;receiver=null;if(listener){listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));}publish();}
 async function select(){if(running)throw Error('Сначала выключите сканер');const result=await dialog.showOpenDialog({title:'Выберите официальный albiondata-client.exe',properties:['openFile'],filters:[{name:'Клиент AODP',extensions:['exe']}]});if(!result.canceled){exe=result.filePaths[0];fs.writeFileSync(settings,JSON.stringify({exe}));}return state();}
 async function start(region){if(running)return state();if(!['europe','west','east'].includes(region))throw Error('Выберите сервер');if(!exe||!fs.existsSync(exe))throw Error('Выберите установленный клиент AODP');if(message.startsWith('Не удалось прочитать'))throw Error(message);server=region;
 const token=crypto.randomBytes(24).toString('hex');receiver=createReceiver({token,onOrders(batch){if(!running)return;const next=createOrderStore(undefined,undefined,store.list());next.ingest(server,batch);const temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify({version:1,orders:next.list()}));fs.renameSync(temporary,file);store=next;message='Получены цены из игры';publish();}});
 try{await new Promise((resolve,reject)=>{receiver.once('error',reject);receiver.listen(0,'127.0.0.1',resolve);});const url=`http://127.0.0.1:${receiver.address().port}/${token}`;running=true;message='Откройте рынок в игре и просматривайте товары';child=spawnProcess(exe,['-i',url,'-p',''],{cwd:folder,windowsHide:true,stdio:'ignore'});const active=child;child.once('error',e=>{message='Не удалось запустить клиент: '+e.message;stop().catch(()=>{});});child.once('exit',()=>{if(child!==active)return;message='Клиент завершил работу. Проверьте Npcap и права запуска.';stop().catch(()=>{});});publish();return state();}catch(e){await stop();throw e;}}
 return {state,start,stop,select};
}
module.exports={createScanner,quotes};
