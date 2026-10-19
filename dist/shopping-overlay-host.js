(function(){'use strict';
const bridge=window.DesktopApp?.shopping;if(!bridge)return;
let watched='europe',session,last='';
function engine(){if(!BatchCards.store)throw Error('Карточки недоступны. Проверьте сообщение в основном окне.');return session||(session=ShoppingListMath.session(BatchCards.store));}
function state(server){return {...engine().snapshot(server),canUndo:BatchOperationsUI.hasUndo(server)};}
function changed(){try{const next=state(watched),text=JSON.stringify(next);if(text!==last){last=text;bridge.changed(next);}}catch(e){bridge.changed({server:watched,groups:[],canUndo:false,error:e.message});}}
bridge.onRequest(request=>{
 try{
  const p=request.payload||{};if(!['europe','west','east'].includes(p.server))throw Error('Неизвестный сервер.');watched=p.server;
  if(request.action==='purchase'||request.action==='order'){const receipt=engine()[request.action](p);BatchOperationsUI.record(receipt,request.action==='order'?'Размещение ордеров из мини-окна сохранено.':'Покупка из мини-окна сохранена в партиях.');}
  else if(request.action==='undo')BatchOperationsUI.undo(p.server);
  else if(request.action!=='state')throw Error('Неизвестное действие.');
  bridge.respond({id:request.id,ok:true,value:state(p.server)});
 }catch(e){bridge.respond({id:request.id,ok:false,error:e.message});changed();}
});
const button=document.createElement('button');button.id='batch-open-mini';button.type='button';button.className='button';button.textContent='Мини-окно поверх игры';
const note=document.createElement('p');note.className='hint';note.setAttribute('role','status');
button.onclick=async()=>{button.disabled=true;try{await bridge.open(ActivityViews.shipping.state.server);note.textContent='Мини-окно открыто. Перетащите за заголовок или выберите угол. Для игры используйте оконный или безрамочный режим.';}catch(e){note.textContent=e.message;}finally{button.disabled=false;}};
document.querySelector('#batch-procurement>summary').after(button,note);
window.BatchOverlayHost={changed};changed();
})();
