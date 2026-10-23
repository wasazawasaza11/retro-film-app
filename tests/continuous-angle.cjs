const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});await page.goto('http://127.0.0.1:8087/?debug=1');
 const chooser=page.waitForEvent('filechooser');await page.locator('.open-photo').tap();await(await chooser).setFiles(path.join(__dirname,'fixtures','photo.png'));await page.waitForFunction(()=>!document.getElementById('adjust-button').disabled);
 await page.locator('#debug-panel').evaluate(e=>e.open=false);await page.locator('#adjust-button').tap();
 const sheet=await page.locator('#adjust-sheet').boundingBox();assert.ok(sheet.height/844>=.25&&sheet.height/844<=.35);
 const scroll=await page.locator('#adjust-sheet .sheet-scroll').evaluate(e=>{e.scrollTop=100;return {top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight};});assert.ok(scroll.top>0&&scroll.content>scroll.height);assert.equal((await page.locator('#adjust-sheet').boundingBox()).height,sheet.height);await page.locator('#adjust-sheet .close-sheet').tap();await page.locator('#crop-button').tap();
 await page.evaluate(async()=>{const {Renderer}=await import('/js/renderer.js?v=20261024-3');const original=Renderer.prototype.schedule;window.drawCounts={};Renderer.prototype.schedule=function(...args){const options=args[4]||{},done=options.onComplete;options.onComplete=()=>{const key=Math.round(performance.now()/16.666);window.drawCounts[key]=(window.drawCounts[key]||0)+1;done?.();};args[4]=options;return original.apply(this,args);};});
 let previousScale=0,anchor;
 for(const angle of [0,1,2,5,10,5,0,-1,-2,-5,-10]){
  await page.locator('#crop-angle').evaluate((e,a)=>{for(let i=0;i<10;i++){e.value=a;e.dispatchEvent(new Event('input',{bubbles:true}));}},angle);await page.waitForTimeout(60);
  const line=await page.locator('#debug-log').evaluate(e=>e.textContent.split('\n').filter(s=>s.startsWith('angle=')).at(-1));const values=Object.fromEntries(line.split(' ').map(s=>{const [k,v]=s.split('=');return [k,Number(v)];}));anchor??=values;for(const key of ['panX','panY','zoom','cropCenterX','cropCenterY'])assert.equal(values[key],anchor[key]);assert.ok(values.effectiveScale>=previousScale);previousScale=values.effectiveScale;
 }
 assert.ok(Object.values(await page.evaluate(()=>window.drawCounts)).every(n=>n<=1));await page.locator('#crop-angle').evaluate(e=>e.dispatchEvent(new Event('change',{bubbles:true})));
 const frames=await page.locator('#debug-log').evaluate(e=>e.textContent.split('\n').filter(s=>s.startsWith('ANGLE FRAME ')).map(s=>JSON.parse(s.slice(12))));assert.ok(frames.length>1);
 for(const f of frames)for(const key of ['panX','panY','zoom','cropCenterX','cropCenterY','cropRect','canvas','canvasCSS','wrapper','transform','transformOrigin','devicePixelRatio','displayX','displayY','drawX','drawY','scroll','viewport'])assert.deepEqual(f[key],frames[0][key],key);
 console.log('ANGLE measured: only angle/minScale/effectiveScale and counters varied; state anchors, DOM rect/transform/canvas, viewport and draw anchor stable');
 console.log('PASS: 32% fixed sheet/internal scroll; continuous input anchored pan/zoom/center; nondecreasing scale; coalesced rendering');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

