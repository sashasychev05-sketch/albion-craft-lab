'use strict';
// Build-time only. The application never contacts the render service for item art.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),cache=path.join(root,'work','icon-downloads');fs.mkdirSync(cache,{recursive:true});
const window={},context={window};
for(const file of ['data.js','food-focus-data.js','gear-data.js','fish-sauce-data.js','food-ingredients-data.js','extras-data.js','accessory-data.js','economy-data.js','island-data.js','luxury-data.js','price-catalog.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context);
const ids=new Set(window.PRICE_CATALOG.map(r=>r.id)),pattern=/^(?:T\d+_|UNIQUE_|TREASURE_|QUESTITEM_|SKIN_)[A-Z0-9_@-]+$/;
function scan(value){if(typeof value==='string'&&pattern.test(value))ids.add(value);else if(Array.isArray(value))value.forEach(scan);else if(value&&typeof value==='object')for(const [key,x]of Object.entries(value)){if(pattern.test(key))ids.add(key);scan(x);}}
for(const value of Object.values(window))scan(value);
const targets=[...ids].sort(),report={source:'https://render.albiononline.com/v1/item/',size:128,quality:1,total:targets.length,downloaded:0,cached:0,missing:[],failed:[],started:new Date().toISOString()};
fs.writeFileSync(path.join(root,'work','icon-targets.json'),JSON.stringify(targets));
const png=data=>data.length>100&&data.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&data.readUInt32BE(16)===128&&data.readUInt32BE(20)===128;
let next=0,done=0,bytes=0;const wait=ms=>new Promise(r=>setTimeout(r,ms));
function save(){fs.writeFileSync(path.join(root,'work','icon-download-report.json'),JSON.stringify({...report,done,bytes},null,2));}
async function worker(){while(next<targets.length){const id=targets[next++],file=path.join(cache,encodeURIComponent(id)+'.png');if(fs.existsSync(file)&&png(fs.readFileSync(file))){report.cached++;done++;continue;}let error='';for(let attempt=0;attempt<4;attempt++)try{
 const response=await fetch(report.source+encodeURIComponent(id)+'.png?quality=1&size=128',{signal:AbortSignal.timeout(60000)});
 if(response.status===404){report.missing.push(id);error='';break;}
 if(response.status===429){await wait(Math.max(2000,Math.min(30000,Number(response.headers.get('retry-after'))*1000||5000)));throw Error('HTTP 429');}
 if(!response.ok)throw Error('HTTP '+response.status);
 const data=Buffer.from(await response.arrayBuffer());if(!png(data))throw Error('Invalid PNG response');fs.writeFileSync(file+'.partial',data);fs.renameSync(file+'.partial',file);report.downloaded++;bytes+=data.length;error='';break;
 }catch(e){error=e.message;await wait(1000*2**attempt);}
 if(error)report.failed.push({id,error});done++;if(done%100===0){save();console.log(JSON.stringify({done,total:targets.length,downloaded:report.downloaded,cached:report.cached,missing:report.missing.length,failed:report.failed.length,megabytes:Math.round(bytes/1e6)}));}await wait(80);
}}
Promise.all(Array.from({length:20},worker)).then(()=>{report.finished=new Date().toISOString();save();console.log(JSON.stringify({done,total:targets.length,downloaded:report.downloaded,cached:report.cached,missing:report.missing.length,failed:report.failed.length}));if(report.failed.length)process.exitCode=1;}).catch(error=>{save();console.error(error.message);process.exitCode=1;});
