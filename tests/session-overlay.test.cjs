const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createSessionOverlay}=require('../desktop/session-overlay.cjs');
test('overlay stays above the game without focus, accepts only its own main frame and preserves capture on close',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'session-overlay-'));let handler,visible=[],window,focus=0;
 class Window extends EventEmitter{
  constructor(options){super();window=this;this.options=options;this.dead=false;this.bounds={x:options.x,y:options.y,width:options.width,height:options.height};this.webContents=new EventEmitter();this.webContents.mainFrame={url:'albion://app/session-overlay.html'};this.webContents.setWindowOpenHandler=()=>{};this.webContents.send=()=>{};}
  isDestroyed(){return this.dead;}setAlwaysOnTop(value,level){assert.equal(value,true);assert.equal(level,'screen-saver');}setOpacity(value){this.opacity=value;}setMenuBarVisibility(){}async loadURL(url){assert.equal(url,'albion://app/session-overlay.html');}showInactive(){this.shown=true;}show(){focus++;}focus(){focus++;}getBounds(){return this.bounds;}setSize(width,height){Object.assign(this.bounds,{width,height});}close(){this.dead=true;this.emit('closed');}
 }
 const overlay=createSessionOverlay({app:{getPath:()=>folder},BrowserWindow:Window,ipcMain:{handle(name,callback){assert.equal(name,'session-overlay:command');handler=callback;}},screen:{getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},origin:'albion://app',getState:async()=>({settings:{enabled:true}}),onVisible:value=>visible.push(value)});
 try{
  await overlay.open();assert.equal(window.options.alwaysOnTop,true);assert.equal(window.options.skipTaskbar,true);assert.equal(focus,0);assert.equal(window.options.webPreferences.sandbox,true);
  const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};await assert.rejects(handler({...event,sender:{}},'close'),/Forbidden/);await assert.rejects(handler({...event,senderFrame:{url:event.senderFrame.url}},'state'),/Forbidden/);
  await handler(event,'compact');assert.equal(window.bounds.width,340);await handler(event,'opacity');assert.equal(window.opacity,.85);assert.equal((await handler(event,'state')).settings.enabled,true);
  await handler(event,'close');assert.deepEqual(visible,[true,false]);assert.equal(focus,0);
 }finally{overlay.dispose();assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(folder,{recursive:true,force:true});}
});
