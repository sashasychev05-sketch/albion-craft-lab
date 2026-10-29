'use strict';
const path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
function createSatHost({app,BrowserWindow,BaseWindow,WebContentsView,origin,notify=()=>{},spawnProcess=spawn,executablePath}){
 let host=null,child=null,closing=false,ready=false,view=null,message='Статистика игры готова к запуску',timer;
 const executable=()=>executablePath||(app.isPackaged?path.join(process.resourcesPath,'statistics-analysis','StatisticsAnalysisTool.exe'):path.join(__dirname,'..','work','sat-publish','StatisticsAnalysisTool.exe'));
 const snapshot=()=>({running:!!child,ready,message,available:fs.existsSync(executable())});
 function emit(){notify(snapshot());if(host&&!host.isDestroyed())host.webContents.send('sat:state',snapshot());}
 function stop(){if(!child)return Promise.resolve();if(closing)return closing;closing=new Promise(resolve=>{const active=child;active.once('exit',resolve);try{active.stdin.write('close\n');}catch{}timer=setTimeout(()=>{active.kill();resolve();},15000);timer.unref?.();});return closing.finally(()=>{clearTimeout(timer);closing=false;});}
 async function open(){
  if(host&&!host.isDestroyed()){host.show();host.focus();return snapshot();}
  if(!fs.existsSync(executable()))throw Error('Компонент статистики отсутствует. Переустановите Albion Lab.');
  const profile=path.join(app.getPath('userData'),'statistics-analysis');fs.mkdirSync(profile,{recursive:true});
  host=new (BaseWindow||BrowserWindow)({width:1280,height:900,minWidth:900,minHeight:650,title:'Albion Lab — Статистика игры',backgroundColor:'#17211f',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  if(BaseWindow&&WebContentsView){view=new WebContentsView({webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'sat-preload.cjs')}});host.contentView.addChildView(view);host.webContents=view.webContents;const fit=()=>{if(host&&!host.isDestroyed()){const [width,height]=host.getContentSize();view.setBounds({x:0,y:0,width,height:ready?48:height});}};host.on('resize',fit);host.on('sat-ready',fit);fit();}
  host.setMenuBarVisibility(false);host.webContents.setWindowOpenHandler(()=>({action:'deny'}));host.webContents.on('will-navigate',e=>e.preventDefault());
  try{await (view?host.webContents:host).loadURL(origin+'/sat-host.html');}catch(error){if(host&&!host.isDestroyed())host.destroy();throw error;}if(!host||host.isDestroyed())return snapshot();host.show();
  const handle=host.getNativeWindowHandle();const hwnd=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
  message='Подготавливается статистика игры…';
  child=spawnProcess(executable(),[],{cwd:path.dirname(executable()),windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,ALBION_LAB_SAT_PARENT:hwnd,ALBION_LAB_SAT_PROFILE:profile}});
  const active=child;active.stdin.on?.('error',()=>{});let buffer='';child.stdout.on('data',chunk=>{buffer+=chunk.toString();if(buffer.length>65536)buffer='';let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const event=JSON.parse(line);if(event.type==='progress'){message=String(event.task||'Подготовка')+' · '+Math.round(event.progress||0)+'%';emit();}if(event.type==='ready'){ready=true;host?.emit('sat-ready');message='Статистика игры запущена';emit();}}catch{}}});child.stderr.on('data',()=>{});
  child.once('error',()=>{if(child===active)child=null;ready=false;message='Не удалось запустить статистику игры. Проверьте установку компонента.';emit();if(host&&!host.isDestroyed())host.destroy();host=null;});
  child.once('exit',()=>{if(child===active)child=null;message='Статистика игры остановлена';emit();if(host&&!host.isDestroyed())host.destroy();host=null;});
  host.on('close',event=>{if(child){event.preventDefault();stop().catch(()=>{});}});host.on('closed',()=>{view?.webContents.close();view=null;ready=false;host=null;});emit();return snapshot();
 }
 return {open,stop,snapshot};
}
module.exports={createSatHost};
