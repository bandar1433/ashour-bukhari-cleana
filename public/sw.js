const CACHE='ashour-offline-v4';
const SHELL=['/','/index.html','/manifest.webmanifest','/resources/logo-halaqat-ashour-bukhari.png'];

async function precache(){
  const cache=await caches.open(CACHE);
  await cache.addAll(SHELL);
  try{
    const response=await fetch('/index.html',{cache:'no-store'});
    const html=await response.clone().text();
    await cache.put('/index.html',response);
    const assets=[...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
      .map(x=>x[1]).filter(x=>x.startsWith('/'));
    if(assets.length)await cache.addAll([...new Set(assets)]);
  }catch{}
}
self.addEventListener('install',event=>{
  event.waitUntil(precache().then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy));return res;
    }).catch(()=>caches.match('/index.html').then(r=>r||caches.match('/'))));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>{
    if(cached)return cached;
    return fetch(req).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
      return res;
    });
  }));
});
