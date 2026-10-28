'use strict';
const path=require('node:path');
function createMarketOverlay({BrowserWindow,ipcMain,screen,origin,getState}){
 let window=null,timer=null,latest=null;
 function emit(){if(window&&!window.isDestroyed())window.webContents.send('market-overlay:state',latest||getState());}
 function update(state){latest=state;if(!timer)timer=setTimeout(()=>{timer=null;emit();},500);}
 async function open(){
  if(window&&!window.isDestroyed()){window.showInactive();return;}
  const area=screen.getPrimaryDisplay().workArea;
  window=new BrowserWindow({x:area.x+area.width-460,y:area.y+60,width:440,height:540,minWidth:340,minHeight:260,frame:false,show:false,alwaysOnTop:true,skipTaskbar:true,backgroundColor:'#17211f',webPreferences:{preload:path.join(__dirname,'market-overlay-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.setAlwaysOnTop(true,'screen-saver');window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
  window.on('closed',()=>{window=null;});
  await window.loadURL(origin+'/market-overlay.html');window.showInactive();emit();
 }
 ipcMain.handle('market-overlay:command',(event,action)=>{
  let valid=false;try{const url=new URL(event.senderFrame.url);valid=window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&url.protocol==='albion:'&&url.host==='app'&&url.pathname==='/market-overlay.html';}catch{}
  if(!valid)throw Error('Forbidden');
  if(action==='state')return getState();if(action==='close'){window.close();return;}throw Error('Invalid action');
 });
 return {open,update,getWindow:()=>window,close(){clearTimeout(timer);timer=null;if(window&&!window.isDestroyed())window.close();}};
}
module.exports={createMarketOverlay};
