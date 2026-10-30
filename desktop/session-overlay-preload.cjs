const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('SessionOverlay',{command:action=>ipcRenderer.invoke('session-overlay:command',action),onState:callback=>{const handler=(_event,state)=>callback(state);ipcRenderer.on('session-overlay:state',handler);return()=>ipcRenderer.removeListener('session-overlay:state',handler);}});
