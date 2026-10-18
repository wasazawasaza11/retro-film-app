const CACHE='retro-film-cache-v9';
const PREFIX='retro-film-';
const FILES=['./','./index.html','./css/style.css','./js/debug-panel.js','./js/app.js','./js/video-source.js','./js/adjustment-store.js','./js/image-loader.js','./js/renderer.js','./js/effects.js','./js/presets.js','./js/photo-gestures.js','./js/lens.js','./js/crop.js','./js/exporter.js','./manifest.webmanifest','./assets/icons/icon.svg','./assets/icons/icon-192.png','./assets/icons/icon-512.png'];
const APP_URLS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
const WORKER_URL=new URL('./sw.js',self.registration.scope).href;

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  // Bypass the browser HTTP cache as well as the previous worker's Cache Storage.
  // addAll succeeds only when the complete application shell can be fetched.
  await cache.addAll(FILES.map(file=>new Request(new URL(file,self.registration.scope),{cache:'no-store'})));
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));

async function networkFirst(request,key){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),3500);
  try{
    const response=await fetch(new Request(request,{cache:'no-store',signal:controller.signal}));
    if(response.ok){
      // Storage failure must not hide a successful network response.
      try{const cache=await caches.open(CACHE);await cache.put(key,response.clone());}
      catch(error){if(controller.signal.aborted)throw error;}
    }
    return response;
  }catch{
    const cache=await caches.open(CACHE),cached=await cache.match(key);
    return cached||new Response('オフラインです。接続中にアプリを開いて準備してください。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }finally{clearTimeout(timeout);}
}

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  url.search='';url.hash='';
  if(url.href===WORKER_URL){event.respondWith(fetch(new Request(request,{cache:'no-store'})));return;}
  if(!APP_URLS.has(url.href))return;
  // HTML, CSS and ES modules all refresh together on reload; offline uses only
  // this version's cache. Never search unrelated or obsolete caches globally.
  event.respondWith(networkFirst(request,url.href));
});

