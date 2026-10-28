const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {createScanner}=require('../desktop/market-scanner.cjs');
test('client routes only locally, orders persist and quote survives restart',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'market-scanner-'));let endpoint,args;
 const options={app:{getPath:()=>folder},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[process.execPath]})},notify(){},spawnProcess(_exe,a){args=a;endpoint=a[1];const child=new EventEmitter();child.kill=()=>{};return child;}};
 const scanner=createScanner(options);await scanner.select();await scanner.start('europe');
 try{assert.equal(args[0],'-i');assert.equal(new URL(endpoint).hostname,'127.0.0.1');assert.equal(args[2],'-p');assert.equal(args[3],'');const response=await fetch(endpoint+'/marketorders.ingest',{method:'POST',body:JSON.stringify({Orders:[{Id:1,ItemTypeId:'T4_BAG',LocationId:'3005',QualityLevel:1,UnitPriceSilver:2500000,Amount:3,AuctionType:'offer'}]})});assert.equal(response.status,200);assert.equal(scanner.state().quotes[0].ask,250);await scanner.stop();assert.equal(createScanner(options).state().quotes[0].ask,250);}finally{await scanner.stop();fs.rmSync(folder,{recursive:true,force:true});}
});
