const $=id=>document.getElementById(id);const sel={pickup:null,dropoff:null};let svc='transfer',veh='sedan',C={routes:[],vehicles:[],reviews:[],eur_egp:60};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const VIMG=k=>`/img/vehicles/${k}.svg`;
langSelect($('lang'));applyI18n();
function opts(el,n,def){const v=+el.value||def;el.innerHTML=Array.from({length:n+1},(_,i)=>i).filter(i=>el.id!=='pax'||i>0).map(i=>`<option ${i===Math.min(v,n)?'selected':''}>${i}</option>`).join('')}
function renderStatic(){
 $('plist').innerHTML=C.routes.map(r=>`<div class="price"><span>${esc(r.name)}</span><b>€${r.eur} <small class="muted">/ ${r.egp} EGP</small></b></div>`).join('')+`<p class="muted">00:00–05:00 +€2</p>`;
 $('vehs').innerHTML=C.vehicles.map(v=>`<div class="veh"><img src="${VIMG(v.k)}" alt="${esc(t('veh_'+v.k))}" loading="lazy"><b>${esc(t('veh_'+v.k))}</b><small>👤 ${v.pax} · 🧳 ${v.bags}${v.mult!==1?` · ×${v.mult}`:''}</small></div>`).join('');
 $('vsel').innerHTML=C.vehicles.map(v=>`<button type="button" data-v="${v.k}" class="${v.k===veh?'on':''}"><img src="${VIMG(v.k)}" alt=""><br><b>${esc(t('veh_'+v.k))}</b><br><small>👤 ${v.pax}</small></button>`).join('');
 $('vsel').querySelectorAll('button').forEach(b=>b.onclick=()=>{veh=b.dataset.v;renderStatic();quote()});
 const V=C.vehicles.find(v=>v.k===veh)||{pax:3,bags:3};opts($('pax'),V.pax,2);opts($('bags'),V.bags,2);
 $('rev').innerHTML=C.reviews.length?C.reviews.map(r=>`<p>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)} <b>${esc(r.name)}</b><br>${esc(r.text)}</p>`).join(''):`<p class="muted">${t('noReviews')}</p>`;
 $('pinFor').textContent=t(active==='pickup'?'from':'to')}
let active='pickup';opts($('pax'),3,2);opts($('bags'),3,2);
(async()=>{C=await cfg();renderStatic();
 const d=new Date(Date.now()+3*3600e3);$('date').value=d.toISOString().slice(0,10);$('date').min=new Date().toISOString().slice(0,10);$('time').value=d.toTimeString().slice(0,5);
 const tok=localStorage.ctok;if(tok){const w=await fetch('/api/wallet',{headers:{'x-customer':tok}});if(w.ok){const j=await w.json();if(j.balance>0){$('wl').hidden=false;$('wbal').textContent='€'+j.balance}}}
})();
document.querySelectorAll('#svc button').forEach(b=>b.onclick=()=>{svc=b.dataset.s;document.querySelectorAll('#svc button').forEach(x=>x.classList.toggle('on',x===b));
 $('toBox').hidden=svc!=='transfer';$('hoursBox').hidden=svc!=='hourly';if(svc!=='transfer')active='pickup';drawSel();quote()});
// ---- map: always visible, shows chosen points, tap to set the active field ----
let pm,mks={};const mapReady=makeMap($('pinMap'),27.93,34.36,11).then(m=>{pm=m;m.onClick((la,ln)=>setLoc(active,{name:`📍 ${la.toFixed(5)}, ${ln.toFixed(5)}`,lat:la,lng:ln},true));drawSel();return m})
 .catch(e=>{$('pinMap').innerHTML='<p class="err" style="padding:12px">Map could not load — check your connection. Search still works.</p>';console.error(e)});
function drawSel(){if(!pm)return;const pts=[];for(const k of ['pickup','dropoff']){const l=sel[k];if(mks[k]){mks[k].remove();mks[k]=null}
  if(l&&(k==='pickup'||svc==='transfer')){mks[k]=pm.marker(l.lat,l.lng,k==='pickup'?'🟢 '+l.name:'🏁 '+l.name,k==='pickup'?'#16a34a':'#dc2626');pts.push([l.lat,l.lng])}}
 if(pts.length)pm.fit(pts);$('pinFor').textContent=t(active==='pickup'?'from':'to')}
function setLoc(k,l,fromMap){sel[k]=l;$(k).value=l.name;hideList(k);if(!fromMap&&k==='pickup'&&svc==='transfer'&&!sel.dropoff)active='dropoff';drawSel();quote()}
// ---- place search: works with mobile keyboards (input + composition events), debounced, stale responses ignored ----
function hideList(k){$(k+'L').hidden=true}
['pickup','dropoff'].forEach(k=>{const inp=$(k),ul=$(k+'L');let tm,seq=0,list=[];
 const show=html=>{ul.innerHTML=html;ul.hidden=false};
 async function search(){const q=inp.value.trim();if(q.length<2){hideList(k);return}const my=++seq;show(`<li class="muted">${t('searching')}</li>`);
  try{const r=await fetch('/api/places?q='+encodeURIComponent(q));list=r.ok?await r.json():[]}catch(e){list=[]}
  if(C.gmapsKey&&window.google?.maps?.places){try{const s=new google.maps.places.AutocompleteService();await new Promise(ok=>s.getPlacePredictions({input:q,bounds:new google.maps.LatLngBounds({lat:27.70,lng:34.20},{lat:28.10,lng:34.48}),strictBounds:true},p=>{(p||[]).forEach(x=>list.push({name:x.description,cat:'google',place_id:x.place_id}));ok()}))}catch(e){}}
  if(my!==seq)return;
  show(list.length?list.map((l,i)=>`<li data-i="${i}">${esc(l.name)} <small>${esc(l.cat)}</small>${l.alt?`<span class="alt">${esc(l.alt)}</span>`:''}</li>`).join(''):`<li class="muted">${t('noResults')}</li>`)}
 const trigger=()=>{sel[k]=null;active=k;$('pinFor').textContent=t(k==='pickup'?'from':'to');clearTimeout(tm);tm=setTimeout(search,250)};
 ['input','keyup','compositionend'].forEach(e=>inp.addEventListener(e,ev=>{if(ev.type==='keyup'&&['ArrowUp','ArrowDown','Enter','Tab','Escape'].includes(ev.key))return;trigger()}));
 inp.addEventListener('focus',()=>{active=k;$('pinFor').textContent=t(k==='pickup'?'from':'to');if(!sel[k]&&inp.value.trim().length>=2)search()});
 // click (not pointerdown) so scrolling the list on a phone doesn't pick an item; blur hides with a delay so the tap still lands
 ul.addEventListener('mousedown',e=>e.preventDefault());// keep focus while choosing (desktop)
 ul.addEventListener('click',e=>{const li=e.target.closest('li[data-i]');if(!li)return;const l=list[li.dataset.i];
  if(l.place_id){const ps=new google.maps.places.PlacesService(document.createElement('div'));ps.getDetails({placeId:l.place_id,fields:['geometry']},r=>setLoc(k,{name:l.name,lat:r.geometry.location.lat(),lng:r.geometry.location.lng()}))}else setLoc(k,l)});
 inp.addEventListener('blur',()=>setTimeout(()=>hideList(k),350))});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.ac'))['pickup','dropoff'].forEach(hideList)});
document.querySelectorAll('[data-pin]').forEach(b=>b.onclick=async()=>{active=b.dataset.pin;await mapReady;$('pinMap').scrollIntoView({behavior:'smooth',block:'center'});pm&&pm.resize&&pm.resize();drawSel()});
$('myloc').onclick=()=>navigator.geolocation.getCurrentPosition(async p=>{const n=await (await fetch(`/api/nearest?lat=${p.coords.latitude}&lng=${p.coords.longitude}`)).json();
 setLoc('pickup',{name:`📍 My location (near ${n.name}, ${n.km} km)`,lat:p.coords.latitude,lng:p.coords.longitude})},e=>$('err').textContent=e.message,{enableHighAccuracy:true,timeout:15000});
function body(){return {service:svc,vehicle:veh,pickup:sel.pickup?.name,pickup_lat:sel.pickup?.lat,pickup_lng:sel.pickup?.lng,dropoff:svc==='transfer'?sel.dropoff?.name:'',dropoff_lat:sel.dropoff?.lat,dropoff_lng:sel.dropoff?.lng,
 hours:$('hours').value,date:$('date').value,time:$('time').value,pax:$('pax').value,bags:$('bags').value,flight:$('flight').value,name:$('name').value,phone:$('phone').value,email:$('email').value,notes:$('notes').value,lang:LG,use_wallet:$('usew').checked}}
async function quote(){if(!sel.pickup||(svc==='transfer'&&!sel.dropoff)){$('sum').hidden=true;return}
 const r=await fetch('/api/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body())});if(!r.ok){$('sum').hidden=true;$('err').textContent='Outside Sharm El Sheikh service area';return}
 const p=await r.json();$('err').textContent='';$('sum').hidden=false;$('slabel').textContent=p.label+' · '+t('veh_'+p.vehicle);$('sp').textContent='€'+p.price;$('snr').hidden=!p.night;$('sn').textContent='€'+p.night;$('st').textContent='€'+p.total+' ≈ '+Math.round(p.total*C.eur_egp/10)*10+' EGP'}
['time','hours'].forEach(i=>$(i).onchange=quote);
$('f').onsubmit=async e=>{e.preventDefault();if(!sel.pickup){$('err').textContent=t('from')+': '+t('noResults');return}
 const r=await fetch('/api/book',{method:'POST',headers:{'content-type':'application/json','x-customer':localStorage.ctok||''},body:JSON.stringify(body())});
 const j=await r.json();if(!r.ok){$('err').textContent=j.error;return}sessionStorage.wa=j.whatsapp;location.href=j.url+'&new=1'};
window.onLang=()=>{renderStatic();quote()};
