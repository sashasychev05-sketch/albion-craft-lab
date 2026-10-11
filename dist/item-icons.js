(function(){
 'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const quality=q=>Math.min(5,Math.max(1,Number(q)||1));
 function image(id,q=1,size=40,eager=false){
  const url='https://render.albiononline.com/v1/item/'+encodeURIComponent(id)+'.png?quality='+quality(q)+'&size=128';
  return '<span class="item-icon item-icon-'+size+'"><img src="'+esc(url)+'" alt="" width="'+size+'" height="'+size+'" loading="'+(eager?'eager':'lazy')+'" decoding="async" referrerpolicy="no-referrer"></span>';
 }
 function mount(el,id,q=1,size=48){
  if(!el||!id)return;
  const key=id+'|'+quality(q)+'|'+size;
  if(el.dataset.iconKey===key&&el.querySelector(':scope > .item-icon'))return;
  const text=el.textContent;el.innerHTML=image(id,q,size,true)+'<span class="item-copy">'+esc(text)+'</span>';el.dataset.iconKey=key;el.classList.add('item-with-icon');
 }
 document.addEventListener('error',e=>{const img=e.target;if(img.tagName!=='IMG'||!img.parentElement?.classList.contains('item-icon'))return;img.parentElement.classList.add('icon-unavailable');img.parentElement.title='Иконка недоступна';img.hidden=true;},true);
 window.ItemIcons={image,mount};
})();
