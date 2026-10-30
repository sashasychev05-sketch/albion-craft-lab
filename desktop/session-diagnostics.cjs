'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(window,folder,{statistics,gameSession,sessionOverlay}){
  const id='946d6888-f996-4aa4-883a-d60902661c99',report={};
  window.showInactive();
  await window.webContents.executeJavaScript("document.getElementById('game-session-open').click()");
  let snapshot;
  for(let attempt=0;attempt<120;attempt++){
    await delay(1000);
    snapshot=await window.webContents.executeJavaScript(`DesktopApp.session.action('query',{sessionId:'${id}'})`);
    if(snapshot.engine.warning)console.log('Session source warning: '+snapshot.engine.warning);
    if(snapshot.engine.ready&&snapshot.data.metrics.Fame===12345)break;
    if(!snapshot.engine.running&&attempt>5)throw Error(snapshot.engine.message);
  }
  assert.equal(snapshot.engine.ready,true);assert.equal(snapshot.data.metrics.Fame,12345);assert.equal(snapshot.data.metrics.Silver,6789);assert.equal(snapshot.data.metrics.LootValue,4200);
  assert.equal(statistics.snapshot().visible,false);report.nativeToDatabase=true;report.background=true;
  await window.webContents.executeJavaScript(`(()=>{const select=document.querySelector('.session-dashboard [data-session]');select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  for(let attempt=0;attempt<30;attempt++){await delay(250);const visible=await window.webContents.executeJavaScript("document.querySelector('.session-dashboard [data-metric=Fame]').textContent");if(visible.replace(/\D/g,'')==='12345')break;}
  const dashboard=await window.webContents.executeJavaScript("(()=>{const d=document.querySelector('.session-dashboard');return{open:d.open,fame:d.querySelector('[data-metric=Fame]').textContent,events:d.querySelectorAll('[data-events] tr').length,overflow:document.documentElement.scrollWidth>innerWidth,bridge:typeof DesktopApp.session.action}})()");
  assert.equal(dashboard.open,true);assert.equal(dashboard.fame.replace(/\D/g,''),'12345');assert.ok(dashboard.events>=3);assert.equal(dashboard.bridge,'function');report.dashboard=dashboard;
  fs.writeFileSync(path.join(folder,'session-dashboard.png'),(await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript("DesktopApp.session.action('overlay')");
  const overlay=sessionOverlay.getWindow();assert.ok(overlay);assert.equal(overlay.isAlwaysOnTop(),true);assert.equal(overlay.isFocused(),false);
  const sample={...snapshot,data:{...snapshot.data,context:{...(snapshot.data.context||{}),sessionId:id,inGame:true,tracking:true,character:'Проверка интерфейса',location:'Тестовая сессия'},metrics:{...snapshot.data.metrics,localDamage:12000,localHeal:2400},dps10:1200,hps10:240},settings:{enabled:true},display:{compact:false,opacity:1}};
  overlay.webContents.send('session-overlay:state',sample);await delay(200);
  assert.equal(await overlay.webContents.executeJavaScript("document.getElementById('damage').title"),'12 000');
  fs.writeFileSync(path.join(folder,'session-overlay.png'),(await overlay.webContents.capturePage()).toPNG());
  await overlay.webContents.executeJavaScript("SessionOverlay.command('compact')");await delay(200);assert.equal(await overlay.webContents.executeJavaScript("document.body.classList.contains('compact')"),true);report.overlay={alwaysOnTop:true,noFocusSteal:true,compact:true,displayFixture:true};
  await window.webContents.executeJavaScript("DesktopApp.session.action('stop')");assert.equal(statistics.snapshot().running,false);report.stopped=true;
  await window.webContents.executeJavaScript("DesktopApp.session.action('tools',{module:'items'})");
  for(let attempt=0;attempt<90&&!statistics.snapshot().ready;attempt++)await delay(1000);
  assert.equal(statistics.snapshot().ready,true);assert.equal(statistics.snapshot().captureRequested,false);assert.equal(statistics.snapshot().captureActive,false);report.archiveWithoutCapture=true;
  statistics.hide();await delay(100);assert.equal(statistics.snapshot().visible,false);
  await statistics.stop();gameSession.wake();await delay(1000);
  const after=await gameSession.request('query',{sessionId:id});assert.equal(after.metrics.Fame,12345);assert.equal(after.metrics.Silver,6789);report.reimportWithoutDuplicates=true;
  sessionOverlay.close();await gameSession.close();report.fixtureOnly=true;
  fs.writeFileSync(path.join(folder,'session-diagnostics.json'),JSON.stringify(report,null,2));
  console.log('Game session integration checks passed');return report;
}
module.exports={run};
