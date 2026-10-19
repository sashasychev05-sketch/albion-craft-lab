(function(){'use strict';
const translate=text=>String(text).replace(/\bLymhurst\b/g,'Люмхурст').replace(/Лимх[её]рст/gi,match=>match[0]==='л'?'люмхурст':'Люмхурст');
const excluded=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','CODE','PRE']);
function textNode(node){const parent=node.parentElement;if(!parent||excluded.has(parent.tagName)||parent.closest('script,style,textarea,code,pre'))return;const next=translate(node.nodeValue);if(next===node.nodeValue)return;
 // A visible option label must never change its API/storage value.
 if(parent.tagName==='OPTION'&&!parent.hasAttribute('value'))parent.setAttribute('value',parent.value);
 node.nodeValue=next;
}
function paint(root){
 if(root.nodeType===Node.TEXT_NODE){textNode(root);return;}if(root.nodeType!==Node.ELEMENT_NODE||excluded.has(root.tagName))return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))textNode(node);
 for(const el of [root,...root.querySelectorAll('[title],[aria-label],[placeholder]')])for(const attr of ['title','aria-label','placeholder']){const value=el.getAttribute(attr);if(value&&translate(value)!==value)el.setAttribute(attr,translate(value));}
}
paint(document.body);new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')textNode(record.target);else for(const node of record.addedNodes)paint(node);}}).observe(document.body,{childList:true,characterData:true,subtree:true});
window.CityLabels={translate,paint};
})();
