(function(){'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const quality=q=>Math.min(5,Math.max(1,Math.floor(Number(q)||1)));
 function source(id){const atlas=window.ITEM_ICON_ATLAS,entry=Object.hasOwn(atlas?.items||{},id)?atlas.items[id]:null;if(entry)return {url:atlas.files[entry[0]],index:entry[1],columns:atlas.columns,placeholder:false};const fallback=Object.hasOwn(atlas?.fallbacks||{},id)?atlas.fallbacks[id]:'unknown',kind=id==='ENERGY'?'energy':['banner','gear','unknown'].includes(fallback)?fallback:'unknown';return {url:'assets/item-icons/'+kind+'.svg',index:0,columns:1,placeholder:id!=='ENERGY'};}
 function image(id,q=1,size=40,eager=false){
  size=Math.max(8,Math.min(128,Math.floor(Number(size)||40)));q=quality(q);const icon=source(id),column=icon.index%icon.columns,row=Math.floor(icon.index/icon.columns),scale=icon.columns*100,x=icon.columns===1?0:column/(icon.columns-1)*100,y=icon.columns===1?0:row/(icon.columns-1)*100;
  return '<span class="item-icon item-icon-'+size+' item-icon-local" data-quality="'+q+'" style="width:'+size+'px;height:'+size+'px;background-image:url('+esc(icon.url)+');background-size:'+scale+'% '+scale+'%;background-position:'+x+'% '+y+'%;" aria-hidden="true"'+(icon.placeholder?' title="Локальный значок: изображение этого предмета отсутствует в источнике"':'')+'></span>';
 }
 function mount(el,id,q=1,size=48){if(!el||!id)return;const key=id+'|'+quality(q)+'|'+size;if(el.dataset.iconKey===key&&el.querySelector(':scope > .item-icon'))return;const text=el.textContent;el.innerHTML=image(id,q,size,true)+'<span class="item-copy">'+esc(text)+'</span>';el.dataset.iconKey=key;el.classList.add('item-with-icon');}
 window.ItemIcons={image,mount,source};
})();
