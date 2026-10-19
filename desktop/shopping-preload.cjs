'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('ShoppingWindow',{
 command:payload=>ipcRenderer.invoke('shopping:command',payload),
 window:payload=>ipcRenderer.invoke('shopping:window',payload),
 onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('shopping:state',listener);return()=>ipcRenderer.removeListener('shopping:state',listener);}
});
