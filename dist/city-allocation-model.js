(function(root){'use strict';
const cities=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'];
const key=(id,material,quality=1)=>id+(material?.preserveQuality&&Number(quality)>1?'|q'+Number(quality):'');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function resolve(rows,required,allowed,quote){
 const errors=[],seen=new Set();let assigned=0,total=0,stale=false;
 if(!Array.isArray(rows)||rows.length>8)return {rows:[],required,assigned:0,total:0,average:0,valid:false,errors:['Некорректное распределение городов.']};
 const resolved=rows.map(row=>{
  const validCity=allowed.includes(row?.city)&&!seen.has(row.city);if(!validCity)errors.push('Выберите разные доступные города.');seen.add(row?.city);
  const quantity=finite(row?.quantity)&&Number.isSafeInteger(row.quantity)&&row.quantity>=0?row.quantity:0;
  if(quantity!==row?.quantity)errors.push('Количество должно быть целым и неотрицательным.');
  const manual=row?.price!==null&&row?.price!==undefined;
  const q=validCity?quote(row.city)||{}:{};
  const price=manual?(finite(row.price)&&row.price>=0?row.price:0):Number(q.price)||0;
  if(quantity>0&&!(price>0))errors.push('Нужна цена: '+row.city+'.');
  const cost=quantity*price;assigned+=quantity;total+=cost;stale ||=quantity>0&&!manual&&q.age>24;
  return {city:row?.city||'',quantity,price,cost,manual,age:manual?null:q.age,reason:q.reason||'',daily:q.daily||0,historyValid:!!q.historyValid};
 });
 if(assigned!==required)errors.push(assigned<required?'Распределите ещё '+(required-assigned)+' шт.':'Распределено лишних '+(assigned-required)+' шт.');
 if(!Number.isFinite(total))errors.push('Слишком большая сумма.');
 return {rows:resolved,required,assigned,total,average:required>0?total/required:0,stale,valid:errors.length===0,errors:[...new Set(errors)]};
}
function demand(required,settings,allowed,quote,manualRows=[]){
 const days=Number(settings?.days),share=Number(settings?.share),selected=settings?.cities;
 if(!(Number.isInteger(days)&&days>=1&&days<=365&&share>0&&share<=100)||!Array.isArray(selected)||!selected.length||selected.length>8||new Set(selected).size!==selected.length||selected.some(c=>!allowed.includes(c)))return {rows:[],required,assigned:0,total:0,average:0,valid:false,errors:['Выберите города, срок 1–365 дней и долю рынка больше 0 и до 100%.'],demand:true};
 const candidates=selected.map(city=>{const q=quote(city)||{},manual=manualRows.find(x=>x.city===city)?.price;const price=finite(manual)?manual:Number(q.price)||0;const capacity=q.historyValid&&Number.isFinite(q.daily)&&q.daily>0&&Number.isFinite(price)&&price>0?Math.min(Number.MAX_SAFE_INTEGER,Math.floor(q.daily*days*share/100)):0;return {city,price,capacity,daily:q.daily||0,historyValid:!!q.historyValid,manual:finite(manual)};}).sort((a,b)=>b.price-a.price||a.city.localeCompare(b.city));
 let remaining=required;const rows=candidates.map(c=>{const quantity=Math.min(remaining,c.capacity);remaining-=quantity;return {city:c.city,quantity,price:c.manual?c.price:null};});
 const result=resolve(rows,required,allowed,quote);result.rows.forEach(r=>Object.assign(r,{capacity:candidates.find(c=>c.city===r.city).capacity}));
 return {...result,demand:true,days,share,unassigned:remaining};
}
const api={cities,key,resolve,demand};root.CityAllocationMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
