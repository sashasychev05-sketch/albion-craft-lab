'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DesktopApp', {
  avalon: {
    library: () => ipcRenderer.invoke('avalon:library'),
    importFolder: () => ipcRenderer.invoke('avalon:import'),
    scan: () => ipcRenderer.invoke('avalon:scan'),
    hotkey: enabled => ipcRenderer.invoke('avalon:hotkey', enabled),
    overlay: id => ipcRenderer.invoke('avalon:overlay', id),
    onScan: callback => { const listener = (_event, result) => callback(result); ipcRenderer.on('avalon:scan-result', listener); return () => ipcRenderer.removeListener('avalon:scan-result', listener); }
  },
  shopping: {
    open: server => ipcRenderer.invoke('shopping:open', { server }),
    onRequest: callback => { const listener = (_event, request) => callback(request); ipcRenderer.on('shopping:request', listener); return () => ipcRenderer.removeListener('shopping:request', listener); },
    respond: response => ipcRenderer.send('shopping:response', response),
    changed: state => ipcRenderer.send('shopping:changed', state)
  },
  updates: () => ipcRenderer.invoke('updates:state'),
  update: () => ipcRenderer.invoke('updates:action'),
  onUpdate: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:changed', listener);
    return () => ipcRenderer.removeListener('updates:changed', listener);
  }
});
