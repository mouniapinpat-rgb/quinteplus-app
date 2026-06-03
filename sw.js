const V='qplus3-v1',S=['./index.html','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(S)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/api/pmu')){e.respondWith(fetch(e.request).catch(()=>new Response('{"offline":true}',{headers:{'Content-Type':'application/json'}})));return;}
  e.respondWith(caches.match(e.request).then(c=>{const n=fetch(e.request).then(r=>{if(r&&r.status===200)caches.open(V).then(ch=>ch.put(e.request,r.clone()));return r;}).catch(()=>c);return c||n;}));
});
