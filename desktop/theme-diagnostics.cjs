'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){const execute=code=>window.webContents.executeJavaScript(code),rows=[];
 const options=await execute("[...document.getElementById('theme').options].map(o=>o.value)");assert.deepEqual(options,['albion','black','light','harbor','forest','caerleon','frost']);
 await execute("CraftApp.navigate('quality');document.querySelector('.interface-menu').open=false");window.setSize(1440,960);
 for(const theme of options){
  const colors=await execute(`(()=>{const selector=document.getElementById('theme');selector.value='${theme}';selector.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.interface-menu').open=false;const style=getComputedStyle(document.documentElement),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true}),rgb=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)},lum=color=>rgb(color).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0),contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};return {theme:document.documentElement.dataset.theme,saved:JSON.parse(localStorage.getItem('albion-craft-lab-v1')).theme,background:style.getPropertyValue('--bg').trim(),textContrast:contrast(style.getPropertyValue('--ink'),style.getPropertyValue('--panel')),hintContrast:contrast(style.getPropertyValue('--muted'),style.getPropertyValue('--panel')),buttonContrast:contrast(style.getPropertyValue('--bg'),style.getPropertyValue('--green')),sidebarContrast:contrast(getComputedStyle(document.querySelector('.sidebar .nav')).color,style.getPropertyValue('--game-side'))};})()`);
  assert.equal(colors.theme,theme);assert.equal(colors.saved,theme);for(const key of ['textContrast','hintContrast','buttonContrast','sidebarContrast'])assert.ok(colors[key]>=4.5,theme+': '+key+' '+colors[key]);rows.push(colors);
  if(['harbor','forest','caerleon','frost'].includes(theme)){await execute("window.scrollTo({top:0,behavior:'instant'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");await new Promise(r=>setTimeout(r,200));fs.writeFileSync(path.join(folder,'theme-'+theme+'.png'),(await window.webContents.capturePage()).toPNG());}
 }
 assert.equal(new Set(rows.map(r=>r.background)).size,7);
 window.setSize(800,960);for(const theme of options){const size=await execute(`(()=>{const e=document.getElementById('theme');e.value='${theme}';e.dispatchEvent(new Event('change',{bubbles:true}));CraftApp.navigate('prices');return {width:document.documentElement.scrollWidth,viewport:innerWidth};})()`);assert.ok(size.width<=size.viewport+1,theme+': '+JSON.stringify(size));}window.setSize(1440,960);
 await execute("const themeState=JSON.parse(localStorage.getItem('albion-craft-lab-v1'));themeState.theme='graphite';localStorage.setItem('albion-craft-lab-v1',JSON.stringify(themeState));");
 const loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;
 const migration=await execute("({theme:document.documentElement.dataset.theme,saved:JSON.parse(localStorage.getItem('albion-craft-lab-v1')).theme,graphite:[...document.getElementById('theme').options].some(o=>o.value==='graphite')})");assert.deepEqual(migration,{theme:'black',saved:'black',graphite:false});
 await execute("document.getElementById('theme').value='albion';document.getElementById('theme').dispatchEvent(new Event('change',{bubbles:true}));");
 return {options,rows,migration,narrowTables:true};
}
module.exports={run};
