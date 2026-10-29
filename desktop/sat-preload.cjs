const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('StatisticsHost',{onState:listener=>{ipcRenderer.on('sat:state',(_event,state)=>listener(state));}});
