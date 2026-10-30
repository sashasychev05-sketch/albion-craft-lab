'use strict';
const path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {StringDecoder}=require('node:string_decoder');
function createSatHost({app,BaseWindow,WebContentsView,origin,notify=()=>{},onData=()=>{},spawnProcess=spawn,executablePath}){
  let host=null,view=null,child=null,launch=null,stopping=null;
  let ready=false,setup=false,wantVisible=false,cancelled=false,expectedExit=false,warning=null,lastHeartbeat=null,selectedModule=null,captureWanted=true,captureActive=false;
  let message='Сбор данных выключен';
  const executable=()=>executablePath||(app.isPackaged?path.join(process.resourcesPath,'statistics-analysis','StatisticsAnalysisTool.exe'):path.join(__dirname,'..','work','sat-publish','StatisticsAnalysisTool.exe'));
  const snapshot=()=>({running:!!child,starting:!!launch&&!ready,ready,setup,captureRequested:captureWanted,captureActive,visible:!!host&&!host.isDestroyed()&&host.isVisible(),warning,lastHeartbeat,message,available:fs.existsSync(executable())});
  function emit(event,extra={}){const state={...snapshot(),event,...extra};notify(state);if(host&&!host.isDestroyed())view.webContents.send('sat:state',state);}
  function command(value){try{child?.stdin.write(value+'\n');}catch(error){warning=error.message;emit('error');}}
  function hide(){wantVisible=false;command('hide-ui');if(host&&!host.isDestroyed())host.hide();emit('visibility');}
  function start({capture=true}={}){
    captureWanted=capture;
    if(child){command(capture?'capture-on':'capture-off');return Promise.resolve(snapshot());}
    if(launch)return launch;
    cancelled=false;expectedExit=false;ready=false;setup=false;warning=null;
    launch=boot().finally(()=>{launch=null;});return launch;
  }
  async function boot(){
    if(!fs.existsSync(executable()))throw Error('Компонент сбора данных отсутствует. Переустановите Albion Lab.');
    const profile=path.join(app.getPath('userData'),'statistics-analysis');fs.mkdirSync(profile,{recursive:true});
    const win=new BaseWindow({width:1280,height:900,minWidth:1040,minHeight:650,title:'Albion Lab — инструменты и настройка',backgroundColor:'#17211f',show:false});
    const content=new WebContentsView({webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'sat-preload.cjs')}});
    host=win;view=content;win.contentView.addChildView(content);win.webContents=content.webContents;
    const fit=()=>{if(win.isDestroyed())return;const [width,height]=win.getContentSize();content.setBounds({x:0,y:0,width,height:ready||setup?48:height});};
    win.on('resize',fit);fit();win.setMenuBarVisibility(false);
    content.webContents.setWindowOpenHandler(()=>({action:'deny'}));content.webContents.on('will-navigate',event=>event.preventDefault());
    win.on('close',event=>{if(child){event.preventDefault();if(setup&&!ready)stop().catch(()=>{});else hide();}});
    win.on('closed',()=>{content.webContents.close();if(host===win){host=null;view=null;}});
    try{await content.webContents.loadURL(origin+'/sat-host.html');}catch(error){win.destroy();throw error;}
    if(cancelled||win.isDestroyed()){if(!win.isDestroyed())win.destroy();return snapshot();}
    if(wantVisible)win.show();
    const handle=win.getNativeWindowHandle(),hwnd=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
    message='Подготовка сбора данных…';
    const active=spawnProcess(executable(),[],{cwd:path.dirname(executable()),windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,ALBION_LAB_SAT_PARENT:hwnd,ALBION_LAB_SAT_PROFILE:profile,ALBION_LAB_SAT_BACKGROUND:'1',ALBION_LAB_SAT_CAPTURE:captureWanted?'1':'0'}});
    child=active;active.stdin.on?.('error',()=>{});let buffer='';const decoder=new StringDecoder('utf8');
    active.stdout.on('data',chunk=>{
      buffer+=decoder.write(chunk);if(buffer.length>65536){buffer='';warning='Некорректный ответ сборщика';emit('error');return;}
      let end;
      while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let event;try{event=JSON.parse(line);}catch{continue;}
        if(child!==active)continue;lastHeartbeat=Date.now();
        if(event.type==='progress'&&!ready){message=String(event.task||'Подготовка')+' · '+Math.round(event.progress||0)+'%';emit('progress');}
        if(event.type==='setup-required'){setup=true;message='Первичная настройка сбора данных';fit();win.show();emit('setup');}
        if(event.type==='setup-cancelled'){message='Первичная настройка не завершена';emit('setup-cancelled');}
        if(event.type==='ready'){ready=true;setup=false;fit();message='Сборщик запущен';if(wantVisible){win.show();command('show-ui');if(selectedModule)command('tab:'+selectedModule);}else win.hide();emit('ready');}
        if(event.type==='session-data')onData();
        if(event.type==='capture-state'){captureActive=event.active===true;captureWanted=event.requested===true;emit('capture-state');}
        if(event.type==='capture-error'){warning=String(event.message||'Не удалось включить захват');emit('error');}
        if(event.type==='heartbeat')emit('heartbeat');
        if(event.type==='ui-hidden')hide();
        if(event.type==='session-error'){warning=String(event.message||'Не удалось сохранить данные сессии');emit('data-error');}
      }
    });
    active.stderr.on('data',()=>{});
    function finish(code,error){
      if(child!==active)return;
      child=null;ready=false;setup=false;captureActive=false;
      if(error||code){warning=error?.message||'Сборщик завершился с ошибкой';message='Сбор данных остановлен с ошибкой';}
      else if(message!=='Первичная настройка не завершена')message='Сбор данных выключен';
      if(!win.isDestroyed())win.destroy();onData();emit('exit',{expected:expectedExit});
    }
    active.once('error',error=>finish(null,error));active.once('exit',code=>finish(code));
    emit('starting');return snapshot();
  }
  async function open(module,capture=true){wantVisible=true;selectedModule=module?String(module).replace(/[^a-z]/g,''):null;await start({capture});if(host&&!host.isDestroyed()){host.show();host.focus();command('show-ui');if(selectedModule)command('tab:'+selectedModule);}return snapshot();}
  function stop(){
    cancelled=true;expectedExit=true;
    if(stopping)return stopping;
    stopping=(async()=>{
      if(launch)await launch.catch(()=>{});
      if(!child){if(host&&!host.isDestroyed())host.destroy();return;}
      const active=child;
      await new Promise(resolve=>{
        let timer;const done=()=>{clearTimeout(timer);resolve();};
        active.once('exit',done);active.once('error',done);
        timer=setTimeout(()=>{active.kill();resolve();},15000);timer.unref?.();command('close');
      });
    })().finally(()=>{stopping=null;});return stopping;
  }
  return {start,open,hide,stop,snapshot,newSession(){if(!ready)throw Error('Сборщик ещё не готов');command('new-session');return snapshot();}};
}
module.exports={createSatHost};
