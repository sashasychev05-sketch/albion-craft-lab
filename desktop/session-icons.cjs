'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function createSessionIcons({app,net,offline=false}){
 const root=path.join(app.getPath('userData'),'statistics-analysis','ImageResources'),pending=new Map();
 const png=buffer=>buffer.length>8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 async function read(id,quality){
  for(const name of [id+'_quality_'+quality,id])try{const file=path.join(root,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)continue;const data=await fs.readFile(file);if(png(data))return data;}catch{}
  if(offline||pending.size>=8)return null;
  const key=id+'|'+quality;if(pending.has(key))return pending.get(key);
  const operation=(async()=>{
   const response=await net.fetch('https://render.albiononline.com/v1/item/'+encodeURIComponent(id)+'?quality='+quality,{signal:AbortSignal.timeout(8000)});
   if(!response.ok||Number(response.headers.get('content-length'))>2*1024*1024)return null;
   const data=Buffer.from(await response.arrayBuffer());if(data.length>2*1024*1024||!png(data))return null;
   try{await fs.mkdir(root,{recursive:true});const target=path.join(root,id+'_quality_'+quality),temp=target+'.lab-'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,data);try{await fs.rename(temp,target);}catch{await fs.unlink(temp).catch(()=>{});}}catch{}
   return data;
  })().catch(()=>null).finally(()=>pending.delete(key));pending.set(key,operation);return operation;
 }
 return {async image(request){const url=new URL(request.url),id=decodeURIComponent(url.pathname.slice('/session-item/'.length));if(!/^[A-Za-z0-9][A-Za-z0-9_@-]{0,159}$/.test(id))return new Response('Forbidden',{status:403});const quality=Math.min(5,Math.max(1,Math.trunc(Number(url.searchParams.get('quality'))||1))),data=await read(id,quality);return data?new Response(data,{headers:{'Content-Type':'image/png','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600'}}):new Response('Not found',{status:404});}};
}
module.exports={createSessionIcons};
