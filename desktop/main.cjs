'use strict';
const { app, BrowserWindow, Menu, ipcMain, protocol, net, session, shell, dialog } = require('electron');
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
app.setName('Albion Craft Lab');
app.setAppUserModelId('com.albioncraftlab.desktop');
protocol.registerSchemesAsPrivileged([{ scheme: 'albion', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let window;
let updates;
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://render.albiononline.com; connect-src 'self' https://europe.albion-online-data.com https://west.albion-online-data.com https://east.albion-online-data.com https://api.albionfreemarket.com; object-src 'none'; base-uri 'none'; frame-src 'none'";
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
    title: 'Albion Craft Lab', backgroundColor: '#171d1c', show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (url !== `${ORIGIN}/index.html`) { event.preventDefault(); external(url); } });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('closed', () => { window = null; });
  window.once('ready-to-show', () => { if (!diagnosticFolder) window.show(); });
  window.loadURL(`${ORIGIN}/index.html`);
  if (diagnosticFolder) require('./diagnostics.cjs').run(window, updates, diagnosticFolder).then(() => app.exit(0)).catch(async error => { console.error(error);try{fs.writeFileSync(path.resolve(diagnosticFolder,'failure.png'),(await window.webContents.capturePage()).toPNG());fs.writeFileSync(path.resolve(diagnosticFolder,'failure-state.json'),JSON.stringify(await window.webContents.executeJavaScript("({workspace:window.Workspace?.snapshot(),notice:document.getElementById('workspace-status')?.textContent,mode:document.querySelector('button.nav.active')?.dataset.mode})"),null,2));}catch{}app.exit(1); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(() => {
    const root = path.resolve(__dirname, '..', 'dist');
    protocol.handle('albion', async request => {
      try {
        const url = new URL(request.url);
        const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (url.hostname !== 'app' || !filename.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
        const response = await net.fetch(pathToFileURL(filename).href);
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', csp);
        return new Response(response.body, { status: response.status, headers });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    autoUpdater.logger = { info() {}, warn() {}, debug() {}, error(error) { console.error('Update error:', error.message || String(error)); } };
    updates = createUpdates(autoUpdater, { version: app.getVersion(), packaged: app.isPackaged, notify: state => { if (window && !window.isDestroyed()) window.webContents.send('updates:changed', state); }, log: error => console.error(error.message || String(error)) });
    ipcMain.handle('updates:state', event => { if (!senderAllowed(event)) throw new Error('Forbidden'); return updates.snapshot(); });
    ipcMain.handle('updates:action', event => { if (!senderAllowed(event)) throw new Error('Forbidden'); return updates.action(); });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Программа', submenu: [{ label: 'Выйти', role: 'quit' }] },
      { label: 'Правка', submenu: [{ label: 'Отменить', role: 'undo' }, { label: 'Повторить', role: 'redo' }, { type: 'separator' }, { label: 'Вырезать', role: 'cut' }, { label: 'Копировать', role: 'copy' }, { label: 'Вставить', role: 'paste' }, { label: 'Выделить всё', role: 'selectAll' }] },
      { label: 'Вид', submenu: [{ label: 'Увеличить', role: 'zoomIn' }, { label: 'Уменьшить', role: 'zoomOut' }, { label: 'Исходный масштаб', role: 'resetZoom' }, { label: 'На весь экран', role: 'togglefullscreen' }] }
    ]));
    createWindow();
  }).catch(error => { console.error(error); if (!diagnosticFolder) dialog.showErrorBox('Albion Craft Lab', 'Не удалось запустить приложение: ' + error.message); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}
