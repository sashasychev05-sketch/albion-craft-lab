'use strict';
const { app, BrowserWindow, BaseWindow, WebContentsView, Menu, ipcMain, protocol, net, session, shell, dialog, screen, desktopCapturer, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');
const { createUpdates } = require('./updates.cjs');
const ORIGIN = 'albion://app';
const diagnosticIndex = process.argv.indexOf('--diagnostics');
const diagnosticFolder = diagnosticIndex >= 0 ? process.argv[diagnosticIndex + 1] : null;
if (diagnosticFolder) {
  fs.mkdirSync(path.resolve(diagnosticFolder, 'profile'), { recursive: true });
  app.setPath('userData', path.resolve(diagnosticFolder, 'profile'));
}
require('./app-identity.cjs').configureIdentity(app);
protocol.registerSchemesAsPrivileged([{ scheme: 'albion', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let window;
let updates;
let shopping;
let avalon;
let marketScanner;
let marketOverlay;
let statistics;
let gameSession;
let sessionOverlay;
let sessionIcons;
let sessionQuitting=false;
async function sessionSnapshot(filter={sessionId:'current'}) {
  return {data:await gameSession.request('query',filter),settings:gameSession.settings(),storage:gameSession.status(),engine:statistics.snapshot(),overlayOpen:!!sessionOverlay?.getWindow()};
}
function sessionChanged() {
  if(window&&!window.isDestroyed())window.webContents.send('session:changed',{engine:statistics?.snapshot(),settings:gameSession?.settings(),storage:gameSession?.status()});
}
const offlineAttempts = [];
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://europe.albion-online-data.com https://west.albion-online-data.com https://east.albion-online-data.com https://api.albionfreemarket.com; object-src 'none'; base-uri 'none'; frame-src 'none'";
function external(url) {
  try {
    const link = new URL(url);
    if (link.protocol === 'https:' && ['github.com', 'www.albion-online-data.com', 'albiononline.com'].includes(link.hostname)) shell.openExternal(link.href).catch(() => {});
  } catch {}
}
function senderAllowed(event) {
  if (event.sender !== window?.webContents) return false;
  try { const url = new URL(event.senderFrame.url); return url.protocol === 'albion:' && url.host === 'app' && url.pathname === '/index.html'; } catch { return false; }
}
function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 760, minHeight: 600,
    title: 'Albion Lab', backgroundColor: '#171d1c', show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (url !== `${ORIGIN}/index.html`) { event.preventDefault(); external(url); } });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  shopping.attach(window);
  window.on('closed', () => { marketOverlay?.close();sessionOverlay?.close();statistics?.stop().catch(()=>{});window = null; });
  window.once('ready-to-show', () => { if (!diagnosticFolder) window.show(); });
  window.loadURL(`${ORIGIN}/index.html`);
  if (diagnosticFolder) require('./diagnostics.cjs').run(window, updates, diagnosticFolder, shopping, offlineAttempts, avalon, {statistics,gameSession,sessionOverlay}).then(() => app.exit(0)).catch(async error => { console.error(error);try{fs.writeFileSync(path.resolve(diagnosticFolder,'failure.png'),(await window.webContents.capturePage()).toPNG());fs.writeFileSync(path.resolve(diagnosticFolder,'failure-state.json'),JSON.stringify(await window.webContents.executeJavaScript("({workspace:window.Workspace?.snapshot(),notice:document.getElementById('workspace-status')?.textContent,mode:document.querySelector('button.nav.active')?.dataset.mode})"),null,2));}catch{}app.exit(1); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(() => {
    const root = path.resolve(__dirname, '..', 'dist');
    protocol.handle('albion', async request => {
      try {
        const url = new URL(request.url);
        if(url.hostname==='app'&&url.pathname.startsWith('/avalon-local/'))return avalon.image(decodeURIComponent(url.pathname.slice('/avalon-local/'.length)));
        if(url.hostname==='app'&&url.pathname.startsWith('/session-item/'))return sessionIcons.image(request);
        const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (url.hostname !== 'app' || !filename.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
        const response = await net.fetch(pathToFileURL(filename).href);
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', csp);
        return new Response(response.body, { status: response.status, headers });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    if (diagnosticFolder && process.argv.includes('--offline-network')) session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://*/*', 'http://*/*'] }, (request, callback) => { offlineAttempts.push(request.url); callback({ cancel: true }); });
    session.defaultSession.setPermissionCheckHandler(() => false);
    autoUpdater.logger = { info() {}, warn() {}, debug() {}, error(error) { console.error('Update error:', error.message || String(error)); } };
    updates = createUpdates(autoUpdater, { version: app.getVersion(), packaged: app.isPackaged, notify: state => { if (window && !window.isDestroyed()) window.webContents.send('updates:changed', state); }, log: error => console.error(error.message || String(error)) });
    ipcMain.handle('updates:state', event => { if (!senderAllowed(event)) throw new Error('Forbidden'); return updates.snapshot(); });
    ipcMain.handle('updates:action', event => { if (!senderAllowed(event)) throw new Error('Forbidden'); return updates.action(); });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Программа', submenu: [{ label:'О программе и лицензии',click:async()=>{const result=await dialog.showMessageBox({type:'info',title:'Albion Lab',message:'Albion Lab · GPL-3.0',detail:'Объединённая программа распространяется под GNU GPL версии 3 без гарантий. Исходники, инструкции сборки и лицензии сторонних компонентов доступны в репозитории проекта. Statistics Analysis Tool — Triky313 и участники проекта, GPL-3.0.',buttons:['Закрыть','Открыть исходники']});if(result.response===1)external('https://github.com/sashasychev05-sketch/albion-craft-lab');}},{ label: 'Выйти', role: 'quit' }] },
      { label: 'Правка', submenu: [{ label: 'Отменить', role: 'undo' }, { label: 'Повторить', role: 'redo' }, { type: 'separator' }, { label: 'Вырезать', role: 'cut' }, { label: 'Копировать', role: 'copy' }, { label: 'Вставить', role: 'paste' }, { label: 'Выделить всё', role: 'selectAll' }] },
      { label: 'Вид', submenu: [{ label: 'Увеличить', role: 'zoomIn' }, { label: 'Уменьшить', role: 'zoomOut' }, { label: 'Исходный масштаб', role: 'resetZoom' }, { label: 'На весь экран', role: 'togglefullscreen' }] }
    ]));
    shopping = require('./shopping-window.cjs').createShoppingWindow({ BrowserWindow, ipcMain, screen, app, getMain: () => window, origin: ORIGIN, diagnostic: !!diagnosticFolder });
    avalon = require('./avalon-controller.cjs').createAvalon({app,ipcMain,dialog,BrowserWindow,screen,desktopCapturer,globalShortcut,net,getMain:()=>window,origin:ORIGIN,diagnostic:!!diagnosticFolder});
    marketScanner=require('./market-scanner.cjs').createScanner({app,dialog,notify:state=>{if(window&&!window.isDestroyed())window.webContents.send('market-scanner:changed',state);marketOverlay?.update(state);}});
    gameSession=require('./game-session.cjs').createGameSession({app,notify:sessionChanged});
    sessionIcons=require('./session-icons.cjs').createSessionIcons({app,net,offline:!!diagnosticFolder&&process.argv.includes('--offline-network')});
    statistics=require('./sat-host.cjs').createSatHost({app,BrowserWindow,BaseWindow,WebContentsView,origin:ORIGIN,onData:()=>gameSession.wake(),notify:state=>{
      if(window&&!window.isDestroyed())window.webContents.send('sat:state',state);
      if(!sessionQuitting&&(state.event==='setup-cancelled'||state.event==='exit'&&!state.expected))gameSession.configure({initialized:true,enabled:false});
      if(!sessionQuitting&&state.event==='capture-state')gameSession.configure({enabled:state.captureRequested});
      sessionChanged();
    }});
    sessionOverlay=require('./session-overlay.cjs').createSessionOverlay({app,BrowserWindow,ipcMain,screen,origin:ORIGIN,getState:()=>sessionSnapshot(),onVisible:visible=>{if(!sessionQuitting)gameSession.configure({overlay:visible});sessionChanged();}});
    ipcMain.handle('session:action',async(event,action,args)=>{
      if(!senderAllowed(event))throw Error('Forbidden');
      if(action==='state')return {settings:gameSession.settings(),engine:statistics.snapshot(),storage:gameSession.status()};
      if(action==='query')return sessionSnapshot(args||{});
      if(action==='start'){gameSession.configure({initialized:true,enabled:true});gameSession.wake();await statistics.start();sessionChanged();return sessionSnapshot();}
      if(action==='stop'){gameSession.configure({initialized:true,enabled:false});await statistics.stop();gameSession.wake();sessionChanged();return sessionSnapshot();}
      if(action==='tools'){await statistics.open(typeof args?.module==='string'?args.module:undefined,gameSession.settings().enabled);return statistics.snapshot();}
      if(action==='overlay'){await sessionOverlay.open();return sessionSnapshot();}
      if(action==='new-session'){statistics.newSession();return sessionSnapshot();}
      if(action==='documents')return gameSession.request('documents',args);
      if(action==='document')return gameSession.request('document',args);
      throw Error('Invalid action');
    });
    ipcMain.handle('statistics:action',async(event,action)=>{if(!senderAllowed(event))throw Error('Forbidden');if(action==='state')return statistics.snapshot();if(action==='open')return statistics.open();if(action==='stop'){await statistics.stop();return statistics.snapshot();}throw Error('Invalid action');});
    marketOverlay=require('./market-overlay.cjs').createMarketOverlay({BrowserWindow,ipcMain,screen,origin:ORIGIN,getState:()=>marketScanner.state()});
    ipcMain.handle('market-scanner:action',async(event,action,arg)=>{if(!senderAllowed(event))throw Error('Forbidden');if(action==='state')return marketScanner.state();if(action==='overlay'){await marketOverlay.open();return marketScanner.state();}if(action==='start'){const state=await marketScanner.start(arg);await marketOverlay.open();return state;}if(action==='stop'){await marketScanner.stop();return marketScanner.state();}throw Error('Invalid action');});
    let marketQuitting=false;app.on('before-quit',event=>{if(marketQuitting)return;event.preventDefault();marketQuitting=true;sessionQuitting=true;sessionOverlay.dispose();Promise.allSettled([marketScanner.stop(),statistics.stop()]).then(()=>gameSession.close()).catch(error=>console.error(error.message)).finally(()=>app.quit());});
    createWindow();
    if(gameSession.settings().enabled){gameSession.wake();statistics.start().catch(error=>{gameSession.configure({enabled:false});console.error(error.message);sessionChanged();});}
    if(gameSession.settings().overlay)sessionOverlay.open().catch(error=>console.error(error.message));
  }).catch(error => { console.error(error); if (!diagnosticFolder) dialog.showErrorBox('Albion Lab', 'Не удалось запустить приложение: ' + error.message); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}
