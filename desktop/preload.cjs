'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DesktopApp', {
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
