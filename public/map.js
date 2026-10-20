// Map abstraction: Google Maps JS when GOOGLE_MAPS_API_KEY is set, otherwise Leaflet (self-hosted in /vendor, CDN fallback) + OpenStreetMap tiles.
let CFG;async function cfg(){if(CFG)return CFG;for(let i=0;i<6;i++){try{const r=await fetch('/api/config');if(r.ok)return CFG=await r.json()}catch(e){}await new Promise(o=>setTimeout(o,1500*(i+1)))}return CFG={routes:[],reviews:[],vehicles:[],eur_egp:60,gmapsKey:''}}
function loadScript(src){return new Promise((ok,er)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=er;document.head.appendChild(s)})}
function loadCss(h){const l=document.createElement('link');l.rel='stylesheet';l.href=h;document.head.appendChild(l)}
let leafletP;function leaflet(){return leafletP||(leafletP=(async()=>{if(window.L&&window.L.map)return;
 loadCss('/vendor/leaflet/leaflet.css');try{await loadScript('/vendor/leaflet/leaflet.js')}catch(e){loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')}})())}
const pinIcon=(txt,bg)=>window.L.divIcon({className:'mk',html:`<span style="background:${bg||'#2563eb'}"><i style="font-style:normal">${txt||'📍'}</i></span>`,iconSize:[34,34],iconAnchor:[17,34]});
async function makeMap(el,lat=27.93,lng=34.36,z=12){const c=await cfg();
 if(c.gmapsKey){try{await loadScript('https://maps.googleapis.com/maps/api/js?libraries=places&key='+c.gmapsKey);
  const m=new google.maps.Map(el,{center:{lat,lng},zoom:z,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy'});
  return {g:1,raw:m,marker(la,ln,label){const mk=new google.maps.Marker({position:{lat:la,lng:ln},map:m,title:label||'',label:label?label.slice(0,2):undefined});return {move:(a,b)=>mk.setPosition({lat:a,lng:b}),remove:()=>mk.setMap(null)}},
   center:(a,b,zz)=>{m.setCenter({lat:a,lng:b});zz&&m.setZoom(zz)},fit:pts=>{const b=new google.maps.LatLngBounds();pts.forEach(p=>b.extend({lat:p[0],lng:p[1]}));m.fitBounds(b,60)},
   resize:()=>{},onClick:f=>m.addListener('click',e=>f(e.latLng.lat(),e.latLng.lng()))}}catch(e){console.warn('Google Maps failed, using OpenStreetMap',e)}}
 await leaflet();
 const m=window.L.map(el,{tap:false}).setView([lat,lng],z);window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
 const resize=()=>m.invalidateSize();setTimeout(resize,100);setTimeout(resize,600);window.addEventListener('resize',resize);
 if(window.ResizeObserver)new ResizeObserver(resize).observe(el);
 return {raw:m,resize,marker(la,ln,label,bg){const mk=window.L.marker([la,ln],{icon:pinIcon(label&&[...label][0],bg)}).addTo(m);label&&mk.bindTooltip(label);return {move:(a,b)=>mk.setLatLng([a,b]),remove:()=>mk.remove()}},
  center:(a,b,zz)=>m.setView([a,b],zz||m.getZoom()),fit:pts=>pts.length>1?m.fitBounds(pts,{padding:[40,40],maxZoom:15}):m.setView(pts[0],15),
  onClick:f=>m.on('click',e=>f(e.latlng.lat,e.latlng.lng))}}
