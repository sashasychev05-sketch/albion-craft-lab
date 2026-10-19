'use strict';
const path=require('node:path'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {normalize,corner,bounds}=require('./shopping-window-state.cjs');
function createShoppingWindow({BrowserWindow,ipcMain,screen,app,getMain,origin,diagnostic=false}){
 let mini=null,viewServer='europe',compact=false,normalBounds,quitting=false,hiddenMain=false,timer,settings,adjusting=false;
 const pending=new Map(),file=path.join(app.getPath('userData'),'shopping-window.json'),servers=['europe','west','east'];
 const areas=()=>{const primary=screen.getPrimaryDisplay();return [primary,...screen.getAllDisplays().filter(d=>d.id!==primary.id)].map(d=>d.workArea);},alive=w=>w&&!w.isDestroyed();
 function trusted(event,w,pathname){try{const u=new URL(event.senderFrame.url);return alive(w)&&event.sender===w.webContents&&event.senderFrame===w.webContents.mainFrame&&u.origin===new URL(origin).origin&&u.protocol==='albion:'&&u.host==='app'&&u.pathname===pathname;}catch{return false;}}
 const mainSender=event=>trusted(event,getMain(),'/index.html'),miniSender=event=>trusted(event,mini,'/shopping-mini.html');
 function read(){let raw;try{raw=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}return normalize(raw,areas());}
 function save(){if(!settings)return;try{fs.writeFileSync(file,JSON.stringify({...settings,bounds:normalBounds||settings.bounds}));}catch{/* Window placement never blocks saving purchases. */}}
 // Windows DPI/non-client rounding can make setBounds(getBounds()) grow the window.
 function place(target){
  adjusting=true;const requested={...target};
  try{for(let i=0;i<3;i++){mini.setBounds(requested);const actual=mini.getBounds();if(['x','y','width','height'].every(k=>actual[k]===target[k]))break;for(const key of ['x','y','width','height'])requested[key]-=actual[key]-target[key];}return mini.getBounds();}finally{adjusting=false;}
 }
 function windowState(){return {compact,pinned:mini?.isAlwaysOnTop()??true,opacity:mini?.getOpacity()??1};}
 function emit(value,switchServer=false){if(alive(mini)&&value?.server===viewServer)mini.webContents.send('shopping:state',{...value,switchServer,window:windowState()});}
 function ask(action,payload={}){
  const main=getMain();if(!alive(main)||main.webContents.isLoadingMainFrame())return Promise.reject(Error('Основное приложение загружается. Повторите через несколько секунд.'));if(pending.size>=16)return Promise.reject(Error('Дождитесь завершения предыдущего действия.'));
  return new Promise((resolve,reject)=>{const id=randomUUID(),timeout=setTimeout(()=>{pending.delete(id);reject(Error('Основное приложение не ответило. Повторите действие.'));},10000);pending.set(id,{resolve,reject,timeout});main.webContents.send('shopping:request',{id,action,payload});});
 }
 function rejectPending(){for(const entry of pending.values()){clearTimeout(entry.timeout);entry.reject(Error('Основное приложение перезагружается. Повторите действие.'));}pending.clear();}
 function showMain(){const main=getMain();if(alive(main)){if(main.isMinimized())main.restore();if(!diagnostic){main.show();main.focus();}hiddenMain=false;}}
 async function open(server){
  if(!servers.includes(server))throw Error('Неизвестный сервер.');viewServer=server;
  if(alive(mini)){if(!diagnostic){mini.show();mini.focus();}emit(await ask('state',{server:viewServer}),true);return windowState();}
  settings=read();compact=false;normalBounds={...settings.bounds};
  mini=new BrowserWindow({...settings.bounds,minWidth:300,minHeight:400,maxWidth:Math.max(...areas().map(a=>a.width)),maxHeight:Math.max(...areas().map(a=>a.height)),frame:false,thickFrame:false,show:false,alwaysOnTop:settings.pinned,skipTaskbar:false,minimizable:false,maximizable:false,fullscreenable:false,title:'Закупки · Albion Craft Lab',backgroundColor:'#18211f',icon:path.join(__dirname,'assets','icon.ico'),webPreferences:{preload:path.join(__dirname,'shopping-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}});
  mini.setMenu(null);mini.setAlwaysOnTop(settings.pinned,'screen-saver');mini.setOpacity(settings.opacity);normalBounds=place(settings.bounds);
  mini.webContents.setWindowOpenHandler(()=>({action:'deny'}));mini.webContents.on('will-navigate',(event,url)=>{if(url!==origin+'/shopping-mini.html')event.preventDefault();});mini.webContents.on('will-attach-webview',event=>event.preventDefault());
  const changed=()=>{if(!alive(mini)||adjusting)return;if(!compact)normalBounds=mini.getBounds();else{const rect=mini.getBounds();normalBounds={...normalBounds,x:rect.x,y:rect.y,width:rect.width};}clearTimeout(timer);timer=setTimeout(save,250);};
  mini.on('move',changed);mini.on('resize',changed);mini.on('close',()=>{changed();clearTimeout(timer);save();});
  mini.on('closed',()=>{mini=null;if(hiddenMain&&!quitting)showMain();});
  mini.once('ready-to-show',()=>{if(!diagnostic&&alive(mini))mini.show();});
  await mini.loadURL(origin+'/shopping-mini.html');return windowState();
 }
 ipcMain.handle('shopping:open',(event,payload)=>{if(!mainSender(event))throw Error('Forbidden');return open(payload?.server);});
 ipcMain.on('shopping:response',(event,response)=>{if(!mainSender(event)||typeof response?.id!=='string')return;const entry=pending.get(response.id);if(!entry)return;clearTimeout(entry.timeout);pending.delete(response.id);response.ok?entry.resolve(response.value):entry.reject(Error(typeof response.error==='string'?response.error.slice(0,500):'Не удалось изменить закупки.'));});
 ipcMain.on('shopping:changed',(event,payload)=>{if(!mainSender(event)||!alive(mini))return;if(payload?.server===viewServer)emit(payload);});
 ipcMain.handle('shopping:command',async(event,payload)=>{
  if(!miniSender(event))throw Error('Forbidden');
  if(!payload||typeof payload!=='object'||JSON.stringify(payload).length>16000||!['state','purchase','order','undo'].includes(payload.action)||!servers.includes(payload.server))throw Error('Некорректное действие.');
  if(payload.action==='state')viewServer=payload.server;else if(payload.server!==viewServer)throw Error('Сервер изменился. Проверьте список.');
  const result=await ask(payload.action,payload);if(payload.server===viewServer)emit(result);return {...result,window:windowState()};
 });
 ipcMain.handle('shopping:window',async(event,payload)=>{
  if(!miniSender(event))throw Error('Forbidden');
  const action=payload?.action;
  if(action==='close'){mini.close();return {closed:true};}
  if(action==='main'){showMain();return windowState();}
  if(action==='state')return {server:viewServer,...windowState()};
  if(action==='pin'){if(typeof payload.value!=='boolean')throw Error('Некорректное закрепление.');mini.setAlwaysOnTop(payload.value,'screen-saver');settings.pinned=payload.value;}
  else if(action==='opacity'){if(typeof payload.value!=='number'||!Number.isFinite(payload.value)||payload.value<.55||payload.value>1)throw Error('Прозрачность должна быть от 55 до 100%.');mini.setOpacity(payload.value);settings.opacity=payload.value;}
  else if(action==='corner'){const rect=mini.getBounds(),area=screen.getDisplayMatching(rect).workArea;const placed=place(corner(rect,area,payload.value));normalBounds=compact?{...normalBounds,x:placed.x,y:placed.y,width:placed.width}:placed;}
  else if(action==='compact'){
   compact=!compact;
   if(compact){normalBounds=mini.getBounds();mini.setMinimumSize(300,64);mini.setMaximumSize(Math.max(...areas().map(a=>a.width)),64);const placed=place({...normalBounds,height:64});normalBounds={...normalBounds,x:placed.x,y:placed.y,width:placed.width};}
   else{const restore=bounds(normalBounds,areas());adjusting=true;mini.setMaximumSize(Math.max(...areas().map(a=>a.width)),Math.max(...areas().map(a=>a.height)));mini.setMinimumSize(300,400);adjusting=false;normalBounds=place(restore);}
  }else throw Error('Неизвестное действие окна.');
  save();return windowState();
 });
 function attach(main){
  main.on('close',event=>{if(alive(mini)&&!quitting){event.preventDefault();hiddenMain=true;main.hide();}});
  main.on('closed',()=>{rejectPending();if(alive(mini))mini.destroy();});
  main.webContents.on('did-start-loading',rejectPending);
  main.webContents.on('did-finish-load',()=>{if(alive(mini))ask('state',{server:viewServer}).then(emit).catch(()=>{});});
 }
 app.on('before-quit',()=>{quitting=true;clearTimeout(timer);save();rejectPending();});
 return {attach,getWindow:()=>mini,open,server:()=>viewServer};
}
module.exports={createShoppingWindow};
