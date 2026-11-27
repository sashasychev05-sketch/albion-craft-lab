'use strict';
const path=require('node:path');
function createPortalHud({BrowserWindow,screen,origin,getHud=async()=>null,diagnostic=false}){
 let win=null,revision=0,timeout,refresh;
 function clear(){clearTimeout(timeout);clearTimeout(refresh);}
 function show(message,bad=false,portal=null){
  const id=++revision;clear();
  if(!message){const visible=!!win?.isVisible();win?.destroy();win=null;return visible;}
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width=Math.min(405,area.width),height=portal?116:bad?112:72;
  // Lower left leaves the Checker map and the game's minimap on the right.
  const bounds=h=>({x:area.x+12,y:area.y+area.height-h-18,width,height:h});
  if(!win||win.isDestroyed()){
   win=new BrowserWindow({...bounds(height),frame:false,transparent:true,focusable:false,skipTaskbar:true,alwaysOnTop:true,show:false,
    webPreferences:{preload:path.join(__dirname,'portal-hud-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIgnoreMouseEvents(true);win.setAlwaysOnTop(true,'screen-saver');
   const w=win;w.on('closed',()=>{if(w===win){clear();win=null;}});
  }else win.setBounds(bounds(height));
  const w=win;let compact=false,metrics=null;
  const current=()=>revision===id&&w===win&&!w.isDestroyed();
  function paint(){if(current())w.webContents.send('portal-hud:state',{message,bad,portal,compact,metrics});}
  async function tick(){
   try{metrics=await getHud(portal.server);}catch{metrics=null;}
   if(current()){paint();refresh=setTimeout(tick,2000);}
  }
  async function ready(){
   if(!current())return;paint();if(!diagnostic)w.showInactive();
   if(portal){tick();timeout=setTimeout(()=>{if(current()){compact=true;w.setBounds(bounds(40));paint();}},4000);}
   else timeout=setTimeout(()=>{if(current())show('');},bad?8000:4500);
  }
  if(w.webContents.getURL()===origin+'/portal-hud.html'&&!w.webContents.isLoadingMainFrame())ready();
  else w.loadURL(origin+'/portal-hud.html').then(ready).catch(()=>{if(current())show('');});
 }
 return {show,getWindow:()=>win};
}
module.exports={createPortalHud};
