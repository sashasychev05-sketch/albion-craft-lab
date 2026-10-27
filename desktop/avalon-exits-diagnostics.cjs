'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
async function run(main,folder,controller){
 const e=code=>main.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms)),catalog=(await controller.library.read()).zones,hub=catalog.find(z=>z.name==='Coues-Exakrom');
 const black=[[5,1],[5,2],[5,6],[8,1],[8,6]].map(([tier,quality])=>catalog.find(z=>z.world==='outlands'&&z.tier===tier&&z.quality===quality)),blue=[catalog.find(z=>z.color==='blue'&&z.tier===3),catalog.find(z=>z.color==='blue'&&z.tier===4)],yellow=catalog.find(z=>z.color==='yellow'&&z.tier===5),red=catalog.find(z=>z.color==='red'&&z.tier===7),exits=[...black,...blue,yellow,red];assert.ok(exits.every(Boolean));
 for(const z of exits)await controller.roads.observe({server:'west',from:hub.name,to:z.name,captured:Date.now(),seconds:3600});
 await e(`Workspace.changeServer('west');AvalonRoadsUI.refresh()`);await e(`document.getElementById('roads-from').value=${JSON.stringify(hub.name)};document.getElementById('roads-target').value='safe';AvalonRoadsUI.render();`);
 const initial=await e(`document.documentElement.dataset.theme`);for(const theme of ['albion','black','light','harbor','forest','caerleon','frost']){await e(`document.getElementById('theme').value=${JSON.stringify(theme)};document.getElementById('theme').dispatchEvent(new Event('change'));`);for(const z of exits){const kind={black:'black',blue:'blue',yellow:'yellow',red:'red'}[z.color],label=String(z.tier)+(z.quality==null?'':'-'+z.quality);assert.equal(await e(`document.querySelector('[data-roads-node="${z.id}"] .roads-exit-badge').dataset.exitColor`),kind);assert.equal(await e(`document.querySelector('[data-roads-node="${z.id}"] .roads-exit-badge text').textContent`),label);}
  for(const [tier,color]of [[3,'rgb(77, 145, 232)'],[5,'rgb(217, 74, 74)'],[7,'rgb(225, 195, 66)'],[8,'rgb(255, 255, 255)']])assert.equal(await e(`getComputedStyle(document.querySelector('[data-roads-tier="${tier}"] .roads-node-frame')).stroke`),color);
 }
 await e(`document.getElementById('theme').value=${JSON.stringify(initial)};document.getElementById('theme').dispatchEvent(new Event('change'));document.getElementById('roads-graph').scrollIntoView({block:'start',behavior:'instant'});`);main.showInactive();await pause(350);await fs.writeFile(path.join(folder,'external-zone-exits.png'),(await main.webContents.capturePage()).toPNG());
 const quality=black[2];await e(`document.querySelector('[data-roads-node="${quality.id}"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));`);assert.equal(await e(`document.getElementById('roads-detail-dialog').textContent.includes('T5-6')`),true);await e(`document.getElementById('roads-detail-close').click()`);
 return {externalConnections:exits.length,blackBlueYellowRedSquares:true,tierQualityLabels:true,qualityInDetails:true,sevenThemes:true,belowTier4Blue:true};
}
module.exports={run};
