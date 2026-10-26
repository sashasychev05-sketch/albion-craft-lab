'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const M=require('../dist/avalon-model.js');
function createLibrary({userData,downloads}){
 const root=path.join(userData,'avalon-library');let current=null;
 async function read(){try{const manifest=JSON.parse(await fs.readFile(path.join(root,'current.json'),'utf8'));if(!/^[a-f0-9]{32}$/.test(manifest.folder))throw Error();const folder=path.join(root,manifest.folder),file=await fs.readFile(path.join(folder,'zones.json'),'utf8'),zones=M.catalog(JSON.parse(file));current={folder,zones};return {ready:true,zones,count:zones.length,maps:zones.filter(z=>z.image).length};}catch(error){current=null;return {ready:false,error:error.code==='ENOENT'?'':'Не удалось прочитать подключённый справочник. Подключите папку повторно.',zones:[]};}}
 async function locate(folder){const candidates=[folder,path.join(folder,'data'),path.join(folder,'_internal','data'),path.join(folder,'AlbionAvalonChecker','_internal','data'),path.join(folder,'AlbionAvalonChecker','AlbionAvalonChecker','_internal','data')];for(const dir of candidates)try{if((await fs.stat(path.join(dir,'avalon_zones.json'))).isFile())return dir;}catch{}throw Error('В выбранной папке не найден data/avalon_zones.json. Выберите папку AlbionAvalonChecker.');}
 async function importFolder(folder){
  const source=await locate(folder),stat=await fs.stat(path.join(source,'avalon_zones.json'));if(stat.size>5000000)throw Error('Слишком большой справочник.');const text=await fs.readFile(path.join(source,'avalon_zones.json'),'utf8'),zones=M.catalog(JSON.parse(text)),id=crypto.randomBytes(16).toString('hex'),destination=path.join(root,id);await fs.mkdir(destination,{recursive:true});
  try{await fs.writeFile(path.join(destination,'zones.json'),text);let bytes=0;for(const image of new Set(zones.map(z=>z.image).filter(Boolean))){const file=path.join(source,'images',image),info=await fs.stat(file);if(!info.isFile()||info.size>15000000||bytes+info.size>150000000)throw Error('Слишком большой набор карт.');const data=await fs.readFile(file);if(!((data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')||data.subarray(0,8).toString('hex')==='89504e470d0a1a0a'))throw Error('Повреждено изображение карты.');await fs.writeFile(path.join(destination,image),data);bytes+=data.length;}
   const temp=path.join(root,'current-'+id+'.json');await fs.writeFile(temp,JSON.stringify({version:1,folder:id}));await fs.rename(temp,path.join(root,'current.json'));return await read();
  }catch(e){if(path.dirname(destination)!==root)throw Error('Недопустимый путь временного справочника.');await fs.rm(destination,{recursive:true,force:true});throw e;}
 }
 async function autoImport(){const existing=await read();if(existing.ready)return existing;try{return await importFolder(path.join(downloads,'AlbionAvalonChecker'));}catch{return existing;}}
 function imageFile(name){return current&&current.zones.some(z=>z.image===name)&&/^[a-z0-9_-]+\.(webp|png)$/i.test(name)?path.join(current.folder,name):null;}
 return {read,autoImport,importFolder,imageFile};
}
module.exports={createLibrary};
