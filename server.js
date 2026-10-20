// Gad Sharm Transfers booking platform
const fs=require('fs'),path=require('path'),crypto=require('crypto'),express=require('express');
(fs.existsSync(path.join(__dirname,'.env'))?fs.readFileSync(path.join(__dirname,'.env'),'utf8'):'').split('\n').forEach(l=>{const m=l.match(/^(\w+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2]});
const DBF=path.join(__dirname,'data.sqlite');let db;
const save=()=>fs.writeFileSync(DBF,Buffer.from(db.export()));
function all(q,p=[]){const s=db.prepare(q);s.bind(p);const r=[];while(s.step())r.push(s.getAsObject());s.free();return r}
const get=(q,p)=>all(q,p)[0];
function run(q,p=[]){db.run(q,p);const id=get('select last_insert_rowid() id').id;save();return id}
const now=()=>Date.now();
const rnd=(n,a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')=>Array.from(crypto.randomBytes(n),b=>a[b%a.length]).join('');
const pin=()=>String(crypto.randomInt(0,10000)).padStart(4,'0');
const hash=(pw,salt=crypto.randomBytes(8).toString('hex'))=>salt+':'+crypto.scryptSync(pw,salt,32).toString('hex');
const hav=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,x=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
const S=k=>get('select v from settings where k=?',[k])?.v;

// Service area: Sharm El Sheikh ONLY. Zones with coordinates; "fare" key links to the fixed airport fare route.
const POINTS=[['SSH Airport',27.9773,34.3950,null],['Naama Bay',27.9136,34.3290,'naama'],['Nabq Bay',28.0400,34.4300,'nabq'],['Hadaba',27.8560,34.3030,'hadaba'],
 ['Ras Um Sid',27.8480,34.3110,'hadaba'],['Sharks Bay',27.9620,34.4110,'sharks'],['SOHO Square',27.9720,34.4120,'sharks'],['Old Market (Sharm El Maya)',27.8650,34.2900,'oldmarket'],
 ['Montazah',27.9430,34.3740,'naama'],['Ras Nasrani',27.9850,34.4280,'sharks'],['Om El Seid Cliff',27.8530,34.3070,'hadaba'],['Ras Mohammed National Park',27.7350,34.2530,null]];
// Vehicle classes (types, not specific cars). m = price multiplier vs. sedan base fare; editable in admin settings (veh_<k>).
const VEH=[{k:'sedan',m:1,pax:3,bags:3},{k:'suv',m:1.2,pax:4,bags:4},{k:'minivan',m:1.4,pax:7,bags:6},{k:'van',m:1.8,pax:14,bags:12},{k:'luxury',m:2,pax:3,bags:3}];
const vehOf=k=>VEH.find(v=>v.k===k)||VEH[0];const vmul=k=>{const v=+S('veh_'+vehOf(k).k);return v>0?v:vehOf(k).m};
async function init(){
  const SQL=await require('sql.js')();
  db=fs.existsSync(DBF)?new SQL.Database(fs.readFileSync(DBF)):new SQL.Database();
  db.run(`create table if not exists settings(k text primary key,v text);
  create table if not exists drivers(id integer primary key,name text,phone text,priority integer,active integer default 1,token text,lat real,lng real,loc_at integer);
  create table if not exists cars(id integer primary key,driver_id integer,model text,color text,plate text,seats integer,bags integer,photo text);
  create table if not exists routes(id integer primary key,k text,name text,eur real,egp real,long integer);
  create table if not exists customers(id integer primary key,name text,phone text unique,pw text,token text,balance real default 0);
  create table if not exists wallet_tx(id integer primary key,customer_id integer,amount real,kind text,note text,booking_ref text,at integer);
  create table if not exists bookings(id integer primary key,ref text unique,token text,pin text,pin_at integer,customer_id integer,name text,phone text,email text,lang text,
    route_id integer,pickup text,dropoff text,service text,km real,date text,time text,pax integer,bags integer,flight text,notes text,
    price real,night real,wallet_used real default 0,due real,quote integer,status text,driver_id integer,offer_driver_id integer,offer_at integer,declined text default '[]',
    picked_at integer,done_at integer,created integer);
  create table if not exists events(id integer primary key,booking_id integer,msg text,at integer);
  create table if not exists locations(id integer primary key,name text,name_alt text,cat text,lat real,lng real);
  create table if not exists reviews(id integer primary key,booking_id integer unique,rating integer,text text,name text,at integer);`);
  // migrations (safe to re-run)
  for(const sql of ['alter table drivers add column pin_hash text','alter table bookings add column vehicle text'])try{db.run(sql)}catch(e){}
  if(!get('select 1 x from settings')){
    [['offer_timeout_min','10'],['city_per_km_eur','0.60'],['city_min_eur','7'],['eur_egp','60']].forEach(s=>db.run('insert into settings values(?,?)',s));
    db.run('insert into drivers(name,phone,priority,token) values(?,?,?,?)',['Gad','+201097844728',1,process.env.GAD_DRIVER_TOKEN||require('crypto').randomBytes(16).toString('hex')]);
    db.run('insert into cars(driver_id,model,color,plate,seats,bags,photo) values(1,?,?,?,3,3,?)',['Mitsubishi Lancer 2014 (A/C)','Red','','']);
    [['naama','Airport ↔ Naama Bay / Montazah',13,780,0],['nabq','Airport ↔ Nabq Bay',13,780,0],['hadaba','Airport ↔ Hadaba / Ras Um Sid',13,780,0],['sharks','Airport ↔ Sharks Bay / SOHO / Ras Nasrani',11,660,0],
     ['oldmarket','Airport ↔ Old Market',14,840,0],['hourly','Hourly inside Sharm (per hour, min 2 h)',8,480,0]]
     .forEach(r=>db.run('insert into routes(k,name,eur,egp,long) values(?,?,?,?,?)',r));
  }
  // Ras Mohammed trip product removed; Gad's own car photos removed
  db.run("delete from routes where k='rasmo'");db.run("update cars set photo='' where photo like '/img/p%'");
  VEH.forEach(v=>{if(S('veh_'+v.k)===undefined)db.run('insert into settings values(?,?)',['veh_'+v.k,String(v.m)])});
  if(process.env.GAD_DRIVER_PIN&&!get('select pin_hash from drivers where id=1')?.pin_hash)db.run('update drivers set pin_hash=? where id=1',[hash(process.env.GAD_DRIVER_PIN)]);
  if(!get('select 1 x from locations')){
    POINTS.forEach(p=>db.run('insert into locations(name,name_alt,cat,lat,lng) values(?,?,?,?,?)',[p[0],'','area',p[1],p[2]]));
    const f=path.join(__dirname,'locations.json');
    if(fs.existsSync(f))JSON.parse(fs.readFileSync(f)).forEach(l=>db.run('insert into locations(name,name_alt,cat,lat,lng) values(?,?,?,?,?)',[l.name,l.alt||'',l.cat,l.lat,l.lng]));
  }
  save();
}
const ev=(bid,msg)=>run('insert into events(booking_id,msg,at) values(?,?,?)',[bid,msg,now()]);
const drv=id=>get('select * from drivers where id=?',[id]);

// ---- assignment: Gad (priority 1) is always offered first ----
function offerNext(b){
  const declined=JSON.parse(b.declined||'[]');
  const d=get(`select * from drivers where active=1 and id not in (${declined.map(Number).join(',')||0})
    and id not in (select driver_id from bookings where status in ('accepted','picked_up') and driver_id is not null and date=? and time=? and id<>?)
    order by priority, id limit 1`,[b.date,b.time,b.id]);
  if(!d){run("update bookings set status='unassigned',offer_driver_id=null where id=?",[b.id]);ev(b.id,'No driver available right now — the office will contact you on WhatsApp.');return}
  run("update bookings set status='offered',offer_driver_id=?,offer_at=? where id=?",[d.id,now(),b.id]);
  ev(b.id,`Booking offered to driver ${d.name}.`);
}
function declineBy(b,reason){
  const dec=JSON.parse(b.declined||'[]');const did=b.offer_driver_id||b.driver_id;if(did)dec.push(did);
  run("update bookings set declined=?,driver_id=null where id=?",[JSON.stringify(dec),b.id]);
  ev(b.id,`Driver ${drv(did)?.name||''} ${reason}. Reassigning to the next available driver.`);
  offerNext(get('select * from bookings where id=?',[b.id]));
}
setInterval(()=>{const lim=now()-Number(S('offer_timeout_min'))*60000;
  all("select * from bookings where status='offered' and offer_at<?",[lim]).forEach(b=>declineBy(b,'did not respond in time'))},15000);

// Fixed prices: airport <-> zone uses the kit's fare table; zone <-> zone inside Sharm = distance x city rate (min fare), shown before booking.
const inSharm=(la,ln)=>la>=27.70&&la<=28.10&&ln>=34.20&&ln<=34.48;
const zoneOf=(la,ln)=>POINTS.filter(p=>p[3]).map(p=>[p,hav(la,ln,p[1],p[2])]).sort((a,b)=>a[1]-b[1])[0][0];
const isAirport=(la,ln)=>hav(la,ln,27.9773,34.3950)<2.5;
function priceFor(body){const p=basePrice(body);if(!p)return null;const v=vehOf(body.vehicle),m=vmul(v.k);
  if(m!==1){p.price=Math.round(p.price*m);p.total=p.price+p.night}p.vehicle=v.k;p.mult=m;return p}
function basePrice(body){
  const h=parseInt((body.time||'12').split(':')[0]);const n=(h>=0&&h<5)?2:0;
  const pl=+body.pickup_lat,pg=+body.pickup_lng,dl=+body.dropoff_lat,dg=+body.dropoff_lng;
  if(!inSharm(pl,pg))return null;
  if(body.service==='hourly'){const r=get('select * from routes where k=?',[body.service]);
    const p=r.eur*(r.k==='hourly'?Math.max(2,+body.hours||2):1);return {price:p,night:n,total:p+n,route_id:r.id,label:r.name}}
  if(!inSharm(dl,dg))return null;
  const ap=isAirport(pl,pg),ad=isAirport(dl,dg);
  if(ap!==ad){const z=ap?zoneOf(dl,dg):zoneOf(pl,pg);const r=get('select * from routes where k=?',[z[3]]);return {price:r.eur,night:n,total:r.eur+n,route_id:r.id,label:r.name}}
  const km=Math.round(hav(pl,pg,dl,dg)*1.3*10)/10;
  const p=Math.max(+S('city_min_eur'),Math.round(km*+S('city_per_km_eur')));
  return {price:p,night:n,total:p+n,km,label:'City ride ('+km+' km)'}
}

const app=express();app.set('trust proxy',1);app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const cust=req=>{const t=req.get('x-customer');return t?get('select * from customers where token=?',[t]):null};
app.get('/api/config',(q,r)=>r.json({routes:all('select * from routes'),points:POINTS.map(p=>({name:p[0],lat:p[1],lng:p[2]})),
  gmapsKey:process.env.GOOGLE_MAPS_API_KEY||'',onlinePayment:!!process.env.PAYMENT_PROVIDER,whatsapp:'201097844728',
  eur_egp:+S('eur_egp'),vehicles:VEH.map(v=>({k:v.k,pax:v.pax,bags:v.bags,mult:vmul(v.k)})),
  reviews:all('select r.rating,r.text,r.name,r.at from reviews r order by at desc limit 20'),
  fleet:all('select c.model,c.color,c.seats,c.bags,c.photo,d.name driver from cars c join drivers d on d.id=c.driver_id where d.active=1')}));
app.post('/api/quote',(q,r)=>{const p=priceFor(q.body);p?r.json(p):r.status(400).json({error:'invalid route'})});
// Place search: in-memory, accent/Arabic-normalised, multi-word, with common Arabic/Egyptian spellings of the main areas.
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g,'')
  .replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/^ال|\sال/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const ALIAS={'Naama Bay':'نعمه نعمة نعامة نعمه باي naama neama nama','Nabq Bay':'نبق خليج نبق nabq nabk','Hadaba':'الهضبه هضبه hadaba','Ras Um Sid':'راس ام السيد ام السيد',
 'Sharks Bay':'خليج القرش شاركس باي sharks','SOHO Square':'سوهو سوهو سكوير soho','Old Market (Sharm El Maya)':'السوق القديم سوق قديم شرم الميا الميه old sharm','SSH Airport':'المطار مطار شرم الشيخ airport',
 'Montazah':'المنتزه منتزه','Ras Nasrani':'راس نصراني','Om El Seid Cliff':'ام السيد'};
let IDX=null;function index(){return IDX||(IDX=all('select name,name_alt alt,cat,lat,lng from locations').map(l=>({...l,cat:l.cat==='area'?'area':l.cat.split(':').pop().replace(/_/g,' '),
  key:' '+norm(l.name+' '+l.alt+' '+(ALIAS[l.name]||''))+' '})))}
app.get('/api/places',(q,r)=>{const qs=norm(q.query.q);if(!qs)return r.json([]);const toks=qs.split(' ');
  const res=[];for(const l of index()){let sc=0;for(const t of toks){const i=l.key.indexOf(t);if(i<0){sc=-1;break}sc+=l.key[i-1]===' '?2:1}
    if(sc>0){if(l.key.startsWith(' '+qs))sc+=5;if(l.cat==='area')sc+=6;res.push([sc,l])}}
  res.sort((a,b)=>b[0]-a[0]||a[1].name.length-b[1].name.length);const seen=new Set();
  r.json(res.filter(([,l])=>{const n=norm(l.name);if(seen.has(n))return false;seen.add(n);return true}).slice(0,20).map(([,l])=>({name:l.name,alt:l.alt,cat:l.cat,lat:l.lat,lng:l.lng})))});
app.get('/api/nearest',(q,r)=>{const la=+q.query.lat,ln=+q.query.lng;const s=POINTS.map(p=>({name:p[0],lat:p[1],lng:p[2],km:+hav(la,ln,p[1],p[2]).toFixed(1)})).sort((a,b)=>a.km-b.km);r.json(s[0])});

// customer accounts + wallet
app.post('/api/register',(q,r)=>{const{name,phone,password}=q.body;if(!phone||!password||password.length<6)return r.status(400).json({error:'phone and password (6+) required'});
  if(get('select 1 x from customers where phone=?',[phone]))return r.status(409).json({error:'account exists'});
  const t=rnd(32,'abcdef0123456789');run('insert into customers(name,phone,pw,token) values(?,?,?,?)',[name||'',phone,hash(password),t]);r.json({token:t})});
app.post('/api/login',(q,r)=>{const c=get('select * from customers where phone=?',[q.body.phone]);if(!c)return r.status(401).json({error:'wrong login'});
  const[salt]=c.pw.split(':');if(hash(q.body.password||'',salt)!==c.pw)return r.status(401).json({error:'wrong login'});r.json({token:c.token})});
app.get('/api/wallet',(q,r)=>{const c=cust(q);if(!c)return r.status(401).end();
  r.json({name:c.name,phone:c.phone,balance:c.balance,tx:all('select * from wallet_tx where customer_id=? order by at desc',[c.id]),
    bookings:all('select ref,token,date,time,status,pickup,dropoff from bookings where customer_id=? order by date desc,time desc',[c.id]),onlinePayment:!!process.env.PAYMENT_PROVIDER})});
// Pluggable online payment hook (disabled until PAYMENT_PROVIDER + keys set)
const payments=require('./payments');
app.post('/api/wallet/topup',async(q,r)=>{const c=cust(q);if(!c)return r.status(401).end();
  if(!payments.enabled())return r.status(503).json({error:'Online payment is not enabled yet. Top up in cash with the driver/office.'});
  r.json(await payments.createCheckout({customer:c,amount:+q.body.amount}))});
app.post('/api/payments/webhook',(q,r)=>{const ok=payments.verifyWebhook(q);if(!ok)return r.status(400).end();
  const c=get('select * from customers where id=?',[ok.customer_id]);run('update customers set balance=balance+? where id=?',[ok.amount,c.id]);
  run('insert into wallet_tx(customer_id,amount,kind,note,at) values(?,?,?,?,?)',[c.id,ok.amount,'topup_online',ok.ref,now()]);r.json({ok:1})});

app.post('/api/book',(q,r)=>{const b=q.body;const p=priceFor(b);const V=vehOf(b.vehicle);
  if(!p)return r.status(400).json({error:'Pickup and drop-off must be inside Sharm El Sheikh'});
  if(!b.name||!b.phone||!b.date||!b.time||!b.pickup)return r.status(400).json({error:'Please fill name, phone, date, time, pickup and route'});
  if((+b.pax||1)>V.pax)return r.status(400).json({error:`Too many passengers for this vehicle (max ${V.pax})`});
  const when=new Date(b.date+'T'+b.time+':00+03:00');if(isNaN(when)||when<now()-5*60000)return r.status(400).json({error:'Pickup time must be in the future'});
  const c=cust(q);let used=0;
  if(c&&b.use_wallet&&c.balance>0){used=Math.min(c.balance,p.total)}
  let ref;do ref='GST-'+rnd(6);while(get('select 1 x from bookings where ref=?',[ref]));
  const tok=rnd(24,'abcdefghijkmnpqrstuvwxyz23456789');
  const id=run(`insert into bookings(vehicle,ref,token,pin,pin_at,customer_id,name,phone,email,lang,route_id,pickup,dropoff,service,km,date,time,pax,bags,flight,notes,price,night,wallet_used,due,quote,status,created)
   values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[V.k,ref,tok,pin(),now(),c?.id||null,b.name,b.phone,b.email||'',b.lang||'en',p.route_id||null,b.pickup,b.dropoff||'',b.service||'transfer',p.km||null,
   b.date,b.time,+b.pax||1,+b.bags||0,b.flight||'',b.notes||'',p.price,p.night,used,p.total-used,0,'new',now()]);
  if(used){run('update customers set balance=balance-? where id=?',[used,c.id]);run('insert into wallet_tx(customer_id,amount,kind,note,booking_ref,at) values(?,?,?,?,?,?)',[c.id,-used,'booking','Applied to booking',ref,now()])}
  ev(id,`Booking ${ref} created.`);offerNext(get('select * from bookings where id=?',[id]));
  const msg=`New booking ${ref}\n${b.name} ${b.phone}\n${p.label} · ${V.k}\nPickup: ${b.pickup}${b.dropoff?' → '+b.dropoff:''}\n${b.date} ${b.time}, ${b.pax} pax, ${b.bags||0} bags${b.flight?', flight '+b.flight:''}\nPrice: €${p.total}${used?` (wallet €${used}, cash due €${p.total-used})`:''}`;
  r.json({ref,token:tok,url:`/booking.html?ref=${ref}&k=${tok}`,whatsapp:'https://wa.me/201097844728?text='+encodeURIComponent(msg)})});

function pub(b){const d=drv(b.driver_id);const car=d&&get('select * from cars where driver_id=?',[d.id]);
  const showPin=['accepted','offered','new','unassigned'].includes(b.status);
  return {vehicle:b.vehicle||'sedan',ref:b.ref,pin:showPin?b.pin:null,status:b.status,name:b.name,pickup:b.pickup,dropoff:b.dropoff,service:b.service,label:b.route_id?null:null,date:b.date,time:b.time,pax:b.pax,bags:b.bags,flight:b.flight,
   price:b.price,night:b.night,wallet_used:b.wallet_used,due:b.due,quote:b.quote,km:b.km,route:b.route_id?get('select name from routes where id=?',[b.route_id])?.name||null:null,
   driver:d&&b.status!=='offered'?{name:d.name,phone:d.phone,lat:d.lat,lng:d.lng,loc_at:d.loc_at,car:car&&{model:car.model,color:car.color,plate:car.plate||'—',photo:car.photo}}:
     {name:'Gad (main driver)',phone:'+201097844728',pending:true},
   events:all('select msg,at from events where booking_id=? order by at',[b.id]),review:get('select rating,text from reviews where booking_id=?',[b.id])||null}}
const bk=q=>get('select * from bookings where ref=? and token=?',[q.params.ref,q.query.k||q.body?.k]);
app.get('/api/booking/:ref',(q,r)=>{const b=bk(q);b?r.json(pub(b)):r.status(404).end()});
app.post('/api/booking/:ref/pin',(q,r)=>{const b=bk(q);if(!b||['picked_up','completed','cancelled'].includes(b.status))return r.status(400).end();
  run('update bookings set pin=?,pin_at=? where id=?',[pin(),now(),b.id]);ev(b.id,'Pickup PIN regenerated by customer.');r.json({ok:1})});
app.post('/api/booking/:ref/review',(q,r)=>{const b=bk(q);if(!b||b.status!=='completed')return r.status(403).json({error:'Reviews are only possible after a completed trip'});
  const rt=Math.round(+q.body.rating);if(!(rt>=1&&rt<=5))return r.status(400).end();
  try{run('insert into reviews(booking_id,rating,text,name,at) values(?,?,?,?,?)',[b.id,rt,String(q.body.text||'').slice(0,1000),b.name.split(' ')[0],now()]);r.json({ok:1})}catch(e){r.status(409).json({error:'Already reviewed'})}});

// driver login (phone + PIN/password, scrypt-hashed). Admin sets credentials.
const digits=p=>{let d=String(p||'').replace(/\D/g,'');d=d.replace(/^00/,'');if(d.startsWith('20'))d=d.slice(2);return d.replace(/^0+/,'')};
const tries={};
app.post('/api/driver/login',(q,r)=>{const ip=q.ip,t=tries[ip]=(tries[ip]||[]).filter(x=>x>now()-15*60000);if(t.length>=10)return r.status(429).json({error:'Too many attempts, try again in 15 minutes'});
  const ph=digits(q.body.phone),d=ph&&all('select * from drivers where active=1 and pin_hash is not null').find(x=>digits(x.phone)===ph);
  if(!d||hash(String(q.body.pin||''),d.pin_hash.split(':')[0])!==d.pin_hash){t.push(now());return r.status(401).json({error:'Wrong phone or PIN'})}
  r.json({token:d.token,name:d.name})});
// driver panel API
const dauth=q=>get('select * from drivers where token=? and active=1',[q.get('x-driver')]);
app.get('/api/driver/me',(q,r)=>{const d=dauth(q);if(!d)return r.status(401).end();
  r.json({driver:{name:d.name,id:d.id},timeout:+S('offer_timeout_min'),
   offers:all("select ref,vehicle,pickup,dropoff,date,time,pax,bags,flight,price+night total,offer_at from bookings where status='offered' and offer_driver_id=?",[d.id]),
   rides:all("select ref,vehicle,name,phone,pickup,dropoff,date,time,pax,bags,flight,notes,price+night total,due,status from bookings where driver_id=? and status in('accepted','picked_up') order by date,time",[d.id])})});
app.post('/api/driver/:ref/:act',(q,r)=>{const d=dauth(q);if(!d)return r.status(401).end();const b=get('select * from bookings where ref=?',[q.params.ref]);if(!b)return r.status(404).end();
  const a=q.params.act;
  if(a==='accept'&&b.status==='offered'&&b.offer_driver_id===d.id){run("update bookings set status='accepted',driver_id=?,offer_driver_id=null where id=?",[d.id,b.id]);ev(b.id,`Driver ${d.name} accepted your booking.`);return r.json({ok:1})}
  if(a==='decline'&&b.status==='offered'&&b.offer_driver_id===d.id){declineBy(b,'declined');return r.json({ok:1})}
  if(b.driver_id!==d.id)return r.status(403).end();
  if(a==='problem'&&['accepted'].includes(b.status)){declineBy(b,'reported a problem ('+(q.body.reason||'n/a')+')');return r.json({ok:1})}
  if(a==='pin'&&b.status==='accepted'){if(String(q.body.pin)!==b.pin)return r.status(400).json({error:'Wrong PIN'});
    run("update bookings set status='picked_up',picked_at=? where id=?",[now(),b.id]);ev(b.id,'PIN verified — you are on board. Have a nice trip!');return r.json({ok:1})}
  if(a==='complete'&&b.status==='picked_up'){run("update bookings set status='completed',done_at=? where id=?",[now(),b.id]);ev(b.id,'Trip completed. Thank you! You can now leave a review.');return r.json({ok:1})}
  r.status(400).json({error:'Action not allowed in status '+b.status})});
app.post('/api/driver/location',(q,r)=>{const d=dauth(q);if(!d)return r.status(401).end();run('update drivers set lat=?,lng=?,loc_at=? where id=?',[+q.body.lat,+q.body.lng,now(),d.id]);r.json({ok:1})});

// admin
const aauth=(q,r,n)=>{const p=q.get('x-admin')||'';const a=Buffer.from(p),b=Buffer.from(process.env.ADMIN_PASSWORD||'');
  if(b.length&&a.length===b.length&&crypto.timingSafeEqual(a,b))return n();r.status(401).json({error:'unauthorized'})};
app.use('/api/admin',aauth);
app.get('/api/admin/all',(q,r)=>r.json({settings:Object.fromEntries(all('select * from settings').map(s=>[s.k,s.v])),
  drivers:all('select d.id,d.name,d.phone,d.priority,d.active,d.lat,d.lng,d.loc_at,(d.pin_hash is not null) has_pin,c.model,c.plate,c.color from drivers d left join cars c on c.driver_id=d.id order by priority'),routes:all('select * from routes'),
  bookings:all("select b.*,d.name driver,o.name offered_to from bookings b left join drivers d on d.id=b.driver_id left join drivers o on o.id=b.offer_driver_id order by date,time"),
  customers:all('select id,name,phone,balance from customers'),reviews:all('select * from reviews order by at desc')}));
app.post('/api/admin/driver',(q,r)=>{const b=q.body;const t=rnd(32,'abcdef0123456789');
  const id=run('insert into drivers(name,phone,priority,token) values(?,?,?,?)',[b.name,b.phone,Math.max(2,+b.priority||10),t]);
  run('insert into cars(driver_id,model,color,plate,seats,bags,photo) values(?,?,?,?,?,?,?)',[id,b.model||'',b.color||'',b.plate||'',+b.seats||3,+b.bags||3,b.photo||'']);
  r.json({id,driver_link:'/driver.html#'+t})});
app.post('/api/admin/driver/:id',(q,r)=>{const b=q.body,id=+q.params.id;
  if('active' in b)run('update drivers set active=? where id=?',[b.active?1:0,id]);
  if('plate' in b)run('update cars set plate=? where driver_id=?',[b.plate,id]);
  if('priority' in b&&id!==1)run('update drivers set priority=? where id=?',[Math.max(2,+b.priority),id]);r.json({ok:1})});
app.get('/api/admin/driver/:id/link',(q,r)=>r.json({link:'/driver.html#'+drv(+q.params.id).token}));
app.post('/api/admin/driver/:id/pin',(q,r)=>{const p=String(q.body.pin||'');if(p.length<4)return r.status(400).json({error:'PIN/password must be 4+ characters'});
  run('update drivers set pin_hash=? where id=?',[hash(p),+q.params.id]);r.json({ok:1})});
app.post('/api/admin/settings',(q,r)=>{for(const[k,v]of Object.entries(q.body))if(S(k)!==undefined)run('update settings set v=? where k=?',[String(v),k]);r.json({ok:1})});
app.post('/api/admin/route/:id',(q,r)=>{run('update routes set eur=?,egp=? where id=?',[+q.body.eur,+q.body.egp,+q.params.id]);r.json({ok:1})});
app.post('/api/admin/wallet/:id',(q,r)=>{const a=+q.body.amount;if(!a)return r.status(400).end();
  run('update customers set balance=balance+? where id=?',[a,+q.params.id]);run('insert into wallet_tx(customer_id,amount,kind,note,at) values(?,?,?,?,?)',[+q.params.id,a,'topup_cash',q.body.note||'Cash top-up (admin)',now()]);r.json({ok:1})});
app.post('/api/admin/booking/:ref/reassign',(q,r)=>{const b=get('select * from bookings where ref=?',[q.params.ref]);declineBy(b,'was removed by the office');r.json({ok:1})});

init().then(()=>app.listen(+process.env.PORT||8080,()=>console.log('Gad Sharm Transfers on :'+(process.env.PORT||8080))));
