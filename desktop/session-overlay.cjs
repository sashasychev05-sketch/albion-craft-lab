'use strict';
const fs=require('node:fs'),path=require('node:path');
function createSessionOverlay({app,BrowserWindow,ipcMain,screen,origin,getState,onVisible=()=>{}}){
  const file=path.join(app.getPath('userData'),'game-sessions','overlay.json');
  let prefs={opacity:1,compact:false},window=null,timer=null,busy=false,saveTimer=null,appClosing=false;
  try{const data=JSON.parse(fs.readFileSync(file,'utf8'));prefs={...prefs,...data,opacity:Math.min(1,Math.max(.55,Number(data.opacity)||1)),compact:data.compact===true};}catch{}
  function save(){if(window&&!window.isDestroyed())prefs={...prefs,...window.getBounds()};clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(prefs));fs.renameSync(temp,file);}catch{}},300);}
  async function emit(){if(!window||window.isDestroyed()||busy)return;busy=true;try{const state=await getState();if(window&&!window.isDestroyed())window.webContents.send('session-overlay:state',{...state,display:{compact:prefs.compact,opacity:prefs.opacity}});}catch(error){if(window&&!window.isDestroyed())window.webContents.send('session-overlay:state',{error:error.message});}finally{busy=false;}}
  async function open(){
    if(window&&!window.isDestroyed()){window.showInactive();await emit();return;}
    appClosing=false;
    const area=screen.getDisplayMatching?.({x:Number(prefs.x)||0,y:Number(prefs.y)||0,width:420,height:460})?.workArea||screen.getPrimaryDisplay().workArea;
    const width=Math.min(area.width,Math.max(300,Number(prefs.width)||420)),height=Math.min(area.height,Math.max(230,Number(prefs.height)||(prefs.compact?270:460)));
    const x=Math.min(area.x+area.width-width,Math.max(area.x,Number.isFinite(prefs.x)?prefs.x:area.x+area.width-width-24)),y=Math.min(area.y+area.height-height,Math.max(area.y,Number.isFinite(prefs.y)?prefs.y:area.y+80));
    window=new BrowserWindow({x,y,width,height,minWidth:300,minHeight:230,frame:false,show:false,alwaysOnTop:true,skipTaskbar:true,backgroundColor:'#142320',webPreferences:{preload:path.join(__dirname,'session-overlay-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    window.setAlwaysOnTop(true,'screen-saver');window.setOpacity(prefs.opacity);window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
    window.on('moved',save);window.on('resize',save);
    window.on('closed',()=>{window=null;clearInterval(timer);timer=null;if(!appClosing)onVisible(false);});
    await window.loadURL(origin+'/session-overlay.html');window.showInactive();onVisible(true);await emit();timer=setInterval(emit,1000);
  }
  ipcMain.handle('session-overlay:command',async(event,action)=>{
    let valid=false;try{const url=new URL(event.senderFrame.url);valid=window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&url.protocol==='albion:'&&url.host==='app'&&url.pathname==='/session-overlay.html';}catch{}
    if(!valid)throw Error('Forbidden');
    if(action==='state')return {...await getState(),display:{compact:prefs.compact,opacity:prefs.opacity}};
    if(action==='close'){window.close();return;}
    if(action==='compact'){prefs.compact=!prefs.compact;window.setSize(prefs.compact?340:420,prefs.compact?270:460);save();await emit();return;}
    if(action==='opacity'){prefs.opacity=prefs.opacity>.95?.85:prefs.opacity>.8?.7:1;window.setOpacity(prefs.opacity);save();await emit();return;}
    throw Error('Invalid action');
  });
  return {open,update:emit,getWindow:()=>window,close(){appClosing=true;clearInterval(timer);timer=null;if(window&&!window.isDestroyed())window.close();},dispose(){clearTimeout(saveTimer);this.close();}};
}
module.exports={createSessionOverlay};
