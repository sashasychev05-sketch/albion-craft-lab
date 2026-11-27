(function(root){
 function create(storage,server){
  const key='albion-lab-pinned-route-'+server;
  function read(){
   try{const r=JSON.parse(storage.getItem(key));if(Array.isArray(r?.nodes)&&r.nodes.length>=2&&r.nodes.every(n=>typeof n==='string'&&n.length>0)&&Number.isInteger(r.index)&&r.index>=0&&r.index<r.nodes.length)return r;}catch{}
   return null;
  }
  function save(nodes,index){storage.setItem(key,JSON.stringify({nodes,index}));}
  return {read,pin:nodes=>save(nodes,0),clear:()=>storage.removeItem(key),advance(request,expires,now){
   const r=read();
   if(!r||!(expires>now)||r.index>=r.nodes.length-1||r.index!==request.index||r.nodes[r.index]!==request.from||r.nodes[r.index+1]!==request.to)return false;
   save(r.nodes,r.index+1);return true;
  }};
 }
 if(typeof module==='object')module.exports={create};else root.PinnedRoute={create};
})(globalThis);
