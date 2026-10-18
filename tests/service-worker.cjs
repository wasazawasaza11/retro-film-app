const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),currentSW=fs.readFileSync(path.join(root,'sw.js'),'utf8');
let phase='old',online=true,htmlVersion='fresh-one',assetVersion='first',requests=[];
const oldHTML='<html><head><title>OLD UI</title></head><body>Old cached HTML</body></html>';
const oldSW=`const C='retro-film-v4';self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(C);await c.put('./',new Response(${JSON.stringify(oldHTML)},{headers:{'Content-Type':'text/html'}}));await c.put('./index.html',new Response(${JSON.stringify(oldHTML)},{headers:{'Content-Type':'text/html'}}));await self.skipWaiting();})()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(caches.open(C).then(c=>c.match('./')));});`;
const server=http.createServer((req,res)=>{
 requests.push({url:req.url,cache:req.headers['cache-control']});
 if(!online){req.socket.destroy();return;}
 const url=new URL(req.url,'http://127.0.0.1:8089');
 if(url.pathname==='/sw.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'public,max-age=86400'});res.end(phase==='old'?oldSW:currentSW);return;}
 if(url.pathname==='/'||url.pathname==='/index.html'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'public,max-age=86400'});res.end(`<html><head><title>${htmlVersion}</title></head><body>${htmlVersion}</body></html>`);return;}
 if(url.pathname==='/css/style.css'){res.writeHead(200,{'Content-Type':'text/css','Cache-Control':'public,max-age=86400'});res.end(`/* ${assetVersion} */`);return;}
 if(url.pathname==='/js/app.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'public,max-age=86400'});res.end(`// ${assetVersion}`);return;}
 const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const ext=path.extname(file),mime={'.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[ext]||'text/plain';
 res.writeHead(200,{'Content-Type':mime,'Cache-Control':'public,max-age=86400'});res.end(fs.readFileSync(file));
});
(async()=>{await new Promise(resolve=>server.listen(8089,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext(),page=await context.newPage();
  await page.goto('http://127.0.0.1:8089/');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.reload();assert.equal(await page.title(),'OLD UI');
  await page.evaluate(async()=>{await caches.open('retro-film-cache-v3');await caches.open('unrelated-application');});
  phase='new';
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
  await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('retro-film-cache-v9')&&!keys.includes('retro-film-v4')&&!keys.includes('retro-film-cache-v3');});
  const keys=await page.evaluate(()=>caches.keys());assert.ok(keys.includes('unrelated-application'));
  const cached=await page.evaluate(async()=>{const c=await caches.open('retro-film-cache-v9');return {count:(await c.keys()).length,html:await(await c.match('/')).text(),css:await(await c.match('/css/style.css')).text(),js:await(await c.match('/js/app.js')).text()};});
  assert.equal(cached.count,19);assert.ok(cached.html.includes('fresh-one'));assert.ok(cached.css.includes('first'));assert.ok(cached.js.includes('first'));
  // Activation alone must not reload an open editing page.
  assert.equal(await page.title(),'OLD UI');await page.reload();assert.equal(await page.title(),'fresh-one');
  htmlVersion='fresh-two';assetVersion='second';await page.reload();assert.equal(await page.title(),'fresh-two');
  const fresh=await page.evaluate(async()=>({css:await(await fetch('./css/style.css')).text(),js:await(await fetch('./js/app.js')).text()}));assert.ok(fresh.css.includes('second'));assert.ok(fresh.js.includes('second'));
  const networkRequests=requests.filter(r=>['/','/index.html','/css/style.css','/js/app.js'].includes(r.url));assert.ok(networkRequests.some(r=>r.cache?.includes('no-cache')||r.cache?.includes('no-store')));
  // sw.js must itself bypass the HTTP cache, and must never enter Cache Storage.
  phase='old';const worker=await page.evaluate(async()=>await(await fetch('./sw.js')).text());assert.ok(worker.includes('retro-film-v4'));
  const swCached=await page.evaluate(async()=>!!await(await caches.open('retro-film-cache-v9')).match('./sw.js'));assert.equal(swCached,false);phase='new';
  await context.setOffline(true);await page.reload();assert.equal(await page.title(),'fresh-two');
  const offline=await page.evaluate(async()=>({css:await(await fetch('./css/style.css')).text(),js:await(await fetch('./js/app.js')).text()}));assert.ok(offline.css.includes('second'));assert.ok(offline.js.includes('second'));
  console.log('PASS: open old-v4 page upgrades without closing; legacy caches removed; unrelated cache preserved; all 19 files refreshed; HTML/CSS/JS network-first bypass HTTP cache; no forced reload; sw.js uncached; offline uses latest version');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});


