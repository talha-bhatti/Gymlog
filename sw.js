const CACHE = 'gymlog-v3';
const ASSETS = ['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// ── Reminder scheduling ──────────────────────────────────────
let _reminders = [];
let _sessions  = [];
let _lang      = 'en';
const _timers  = {};

const QUOTES = {
  en:["The only bad workout is the one that didn't happen.","Push yourself because no one else is going to do it for you.","Your body can stand almost anything. It's your mind you have to convince.","Sweat now, shine later.","Success starts with self-discipline.","Be stronger than your excuses.","Don't stop when it hurts — stop when you're done.","Every champion was once a beginner.","Your only competition is who you were yesterday.","Consistency is what transforms average into excellence."],
  de:["Das einzige schlechte Training ist das, das nicht stattgefunden hat.","Dränge dich selbst, denn niemand anderes wird es für dich tun.","Dein Körper kann fast alles ertragen. Es ist dein Geist, den du überzeugen musst.","Jetzt schwitzen, später glänzen.","Erfolg beginnt mit Selbstdisziplin.","Sei stärker als deine Ausreden.","Hör nicht auf, wenn es wehtut — hör auf, wenn du fertig bist.","Jeder Champion war einmal ein Anfänger.","Dein einziger Wettkampf bist du von gestern.","Konsequenz verwandelt Durchschnittliches in Exzellenz."]
};

function toDateStr(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function buildBody(){
  let streak=0; const today=new Date();
  for(let i=0;i<365;i++){ const d=new Date(today); d.setDate(d.getDate()-i); if(_sessions.find(s=>s.date===toDateStr(d))) streak++; else if(i>0) break; }
  const q=QUOTES[_lang]||QUOTES.en; const quote=q[Math.floor(Math.random()*q.length)];
  const streakTxt=streak>0?(_lang==='de'?`🔥 ${streak} Tage Serie · `:`🔥 ${streak} day streak · `):'';
  return streakTxt+quote;
}

function nextFire(r){
  const now=new Date(); const [h,m]=r.time.split(':').map(Number);
  if(r.repeat==='once'){ const t=new Date(r.date+'T'+r.time+':00'); return t-now; }
  if(r.repeat==='daily'){ const c=new Date(now); c.setHours(h,m,0,0); if(c<=now) c.setDate(c.getDate()+1); return c-now; }
  if(r.repeat==='weekly'){
    const days=r.days||[];
    for(let i=0;i<8;i++){ const c=new Date(now); c.setDate(c.getDate()+i); c.setHours(h,m,0,0); if(days.includes(c.getDay())&&c>now) return c-now; }
  }
  return -1;
}

function scheduleOne(r){
  if(_timers[r.id]) clearTimeout(_timers[r.id]);
  const ms=nextFire(r); if(ms<0) return;
  _timers[r.id]=setTimeout(()=>{
    const title=r.label||(_lang==='de'?'Zeit fürs Training! 💪':'Time to train! 💪');
    self.registration.showNotification(title,{ body:buildBody(), icon:'./icon-192.png', badge:'./icon-192.png', tag:'gymlog-'+r.id, data:{url:'./'} });
    if(r.repeat==='daily') _timers[r.id]=setTimeout(()=>scheduleOne(r),100);
    else if(r.repeat==='weekly') _timers[r.id]=setTimeout(()=>scheduleOne(r),100);
  }, ms);
}

self.addEventListener('message', e => {
  if(e.data && e.data.type==='SCHEDULE_REMINDERS'){
    _reminders=e.data.reminders||[];
    _sessions=e.data.sessions||[];
    _lang=e.data.lang||'en';
    Object.values(_timers).forEach(clearTimeout);
    _reminders.forEach(scheduleOne);
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(list=>{
    for(const c of list){ if(c.url&&'focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
