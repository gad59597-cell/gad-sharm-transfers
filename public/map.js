// Map abstraction: Google Maps JS when GOOGLE_MAPS_API_KEY is set, otherwise Leaflet + OpenStreetMap.
let CFG;async function cfg(){return CFG||(CFG=await (await fetch('/api/config')).json())}
function loadScript(src){return new Promise((ok,er)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=er;document.head.appendChild(s)})}
function loadCss(h){const l=document.createElement('link');l.rel='stylesheet';l.href=h;document.head.appendChild(l)}
async function makeMap(el,lat=27.93,lng=34.36,z=12){const c=await cfg();
 if(c.gmapsKey){await loadScript('https://maps.googleapis.com/maps/api/js?libraries=places&key='+c.gmapsKey);
  const m=new google.maps.Map(el,{center:{lat,lng},zoom:z,disableDefaultUI:true,zoomControl:true});
  return {g:1,raw:m,marker(la,ln,label){const mk=new google.maps.Marker({position:{lat:la,lng:ln},map:m,title:label||''});return {move:(a,b)=>mk.setPosition({lat:a,lng:b})}},
   center:(a,b,zz)=>{m.setCenter({lat:a,lng:b});zz&&m.setZoom(zz)},onClick:f=>m.addListener('click',e=>f(e.latLng.lat(),e.latLng.lng()))}}
 if(!window.L||!window.L.map){loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')}
 const m=window.L.map(el).setView([lat,lng],z);window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(m);
 return {raw:m,marker(la,ln,label){const mk=window.L.marker([la,ln]).addTo(m);label&&mk.bindTooltip(label);return {move:(a,b)=>mk.setLatLng([a,b])}},
  center:(a,b,zz)=>m.setView([a,b],zz||m.getZoom()),onClick:f=>m.on('click',e=>f(e.latlng.lat,e.latlng.lng))}}
