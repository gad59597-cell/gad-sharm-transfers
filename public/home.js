const $=id=>document.getElementById(id);const sel={pickup:null,dropoff:null};let svc='transfer',C;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
langSelect($('lang'));applyI18n();
(async()=>{C=await cfg();
 $('plist').innerHTML=C.routes.map(r=>`<div class="price"><span>${esc(r.name)}</span><b>€${r.eur} <small class="muted">/ ${r.egp} EGP</small></b></div>`).join('')+`<p class="muted">00:00–05:00 +€2</p>`;
 $('rev').innerHTML=C.reviews.length?C.reviews.map(r=>`<p>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)} <b>${esc(r.name)}</b><br>${esc(r.text)}</p>`).join(''):`<p class="muted" data-t="noReviews">${t('noReviews')}</p>`;
 const d=new Date(Date.now()+3*3600e3);$('date').value=d.toISOString().slice(0,10);$('date').min=new Date().toISOString().slice(0,10);$('time').value=d.toTimeString().slice(0,5);
 const tok=localStorage.ctok;if(tok){const w=await fetch('/api/wallet',{headers:{'x-customer':tok}});if(w.ok){const j=await w.json();if(j.balance>0){$('wl').hidden=false;$('wbal').textContent='€'+j.balance}}}
})();
document.querySelectorAll('#svc button').forEach(b=>b.onclick=()=>{svc=b.dataset.s;document.querySelectorAll('#svc button').forEach(x=>x.classList.toggle('on',x===b));
 $('toBox').hidden=svc!=='transfer';$('hoursBox').hidden=svc!=='hourly';quote()});
function setLoc(k,l){sel[k]=l;$(k).value=l.name;$(k+'L').hidden=true;quote()}
['pickup','dropoff'].forEach(k=>{let tm;$(k).oninput=()=>{sel[k]=null;clearTimeout(tm);tm=setTimeout(async()=>{const q=$(k).value.trim();if(q.length<2){$(k+'L').hidden=true;return}
 const list=await (await fetch('/api/places?q='+encodeURIComponent(q))).json();
 if(C.gmapsKey&&window.google?.maps?.places){/* Google Places autocomplete (bounded to Sharm) */
  const svc=new google.maps.places.AutocompleteService();await new Promise(ok=>svc.getPlacePredictions({input:q,bounds:new google.maps.LatLngBounds({lat:27.70,lng:34.20},{lat:28.10,lng:34.48}),strictBounds:true},(p)=>{(p||[]).forEach(x=>list.push({name:x.description,cat:'google',place_id:x.place_id}));ok()}))}
 const ul=$(k+'L');ul.innerHTML=list.length?list.map((l,i)=>`<li data-i="${i}">${esc(l.name)}<small>${esc(l.cat)}</small></li>`).join(''):'<li class="muted">— use 🗺 '+t('pin')+'</li>';ul.hidden=false;
 ul.querySelectorAll('li[data-i]').forEach(li=>li.onclick=async()=>{const l=list[li.dataset.i];
  if(l.place_id){const ps=new google.maps.places.PlacesService(document.createElement('div'));ps.getDetails({placeId:l.place_id,fields:['geometry']},r=>setLoc(k,{name:l.name,lat:r.geometry.location.lat(),lng:r.geometry.location.lng()}))}else setLoc(k,l)})},200)}});
let pm,pmk;document.querySelectorAll('[data-pin]').forEach(b=>b.onclick=async()=>{const k=b.dataset.pin;$('pinMap').hidden=false;
 if(!pm){pm=await makeMap($('pinMap'),27.93,34.36,12)}pm.raw.invalidateSize&&pm.raw.invalidateSize();
 pm.onClick((la,ln)=>{pmk?pmk.move(la,ln):pmk=pm.marker(la,ln);setLoc(pm.k,{name:`📍 Pin ${la.toFixed(5)}, ${ln.toFixed(5)}`,lat:la,lng:ln})});pm.k=k});
$('myloc').onclick=()=>navigator.geolocation.getCurrentPosition(async p=>{const n=await (await fetch(`/api/nearest?lat=${p.coords.latitude}&lng=${p.coords.longitude}`)).json();
 setLoc('pickup',{name:`📍 My location (near ${n.name}, ${n.km} km)`,lat:p.coords.latitude,lng:p.coords.longitude})},e=>$('err').textContent=e.message);
function body(){return {service:svc,pickup:sel.pickup?.name,pickup_lat:sel.pickup?.lat,pickup_lng:sel.pickup?.lng,dropoff:svc==='transfer'?sel.dropoff?.name:'',dropoff_lat:sel.dropoff?.lat,dropoff_lng:sel.dropoff?.lng,
 hours:$('hours').value,date:$('date').value,time:$('time').value,pax:$('pax').value,bags:$('bags').value,flight:$('flight').value,name:$('name').value,phone:$('phone').value,email:$('email').value,notes:$('notes').value,lang:LG,use_wallet:$('usew').checked}}
async function quote(){if(!sel.pickup||(svc==='transfer'&&!sel.dropoff)){$('sum').hidden=true;return}
 const r=await fetch('/api/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body())});if(!r.ok){$('sum').hidden=true;$('err').textContent='Outside Sharm El Sheikh service area';return}
 const p=await r.json();$('err').textContent='';$('sum').hidden=false;$('slabel').textContent=p.label;$('sp').textContent='€'+p.price;$('snr').hidden=!p.night;$('sn').textContent='€'+p.night;$('st').textContent='€'+p.total+' ≈ '+Math.round(p.total*C.eur_egp/10)*10+' EGP'}
['time','hours'].forEach(i=>$(i).onchange=quote);
$('f').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/book',{method:'POST',headers:{'content-type':'application/json','x-customer':localStorage.ctok||''},body:JSON.stringify(body())});
 const j=await r.json();if(!r.ok){$('err').textContent=j.error;return}sessionStorage.wa=j.whatsapp;location.href=j.url+'&new=1'};
window.onLang=()=>quote();
