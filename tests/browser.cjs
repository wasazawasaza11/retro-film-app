const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
  const page=await context.newPage(),errors=[],badRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET'||r.postData()||!r.url().startsWith('http://127.0.0.1:8087/')&&!r.url().startsWith('blob:'))badRequests.push(r.url());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:8087/');await page.evaluate(()=>navigator.serviceWorker.ready);
  for(const ext of ['jpg','png','webp']){
   await page.locator('#photo').setInputFiles(path.join(__dirname,'fixtures',`photo.${ext}`));
   await page.waitForFunction(()=>!document.querySelector('#export-button').disabled);
   await page.waitForFunction(()=>document.querySelector('#preview').width===400);
   assert.equal(await page.locator('#preview').evaluate(c=>c.height),600);
  }
  await page.locator('#debug-panel').evaluate(e=>e.open=false);
  const stage=await page.locator('#stage').boundingBox();assert.ok(stage.height/844>=.75&&stage.height/844<=.82);
  assert.equal(await page.locator('#wheel,.wheel-item,#selected').count(),0);
  await page.screenshot({path:path.join(__dirname,'01-normal.png')});
  const cdp=await context.newCDPSession(page);
  const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y}))});
  const distance=Math.min(220,stage.height*.3),x=195,y=stage.y+130;
  await touch('touchStart',[[1,x,y]]);
  await touch('touchMove',[[1,x,y+distance*.24]]);await page.waitForTimeout(100);
  await page.screenshot({path:path.join(__dirname,'02-drag.png')});
  await touch('touchMove',[[1,x,y+distance*.5]]);await page.waitForTimeout(120);
  assert.ok(Math.abs(Number(await page.locator('#stage').getAttribute('data-progress'))-.5)<.01);
  await page.screenshot({path:path.join(__dirname,'03-half-lens.png')});
  // Reverse within the same gesture: both blend and lens return with the finger.
  await touch('touchMove',[[1,x,y+distance*.24]]);await page.waitForTimeout(100);
  assert.ok(Math.abs(Number(await page.locator('#stage').getAttribute('data-progress'))-.24)<.01);
  await touch('touchMove',[[1,x,y+distance*.75]]);await page.waitForTimeout(120);
  await touch('touchEnd',[]);await page.waitForFunction(()=>!document.querySelector('#lens').classList.contains('visible'));
  assert.equal(await page.locator('#preset-toast').textContent(),'Disposable');
  await page.waitForTimeout(1400);assert.equal(await page.locator('#preset-toast').evaluate(e=>e.classList.contains('visible')),false);
  // A real velocity-based flick must pass more than one boundary after release.
  await touch('touchStart',[[1,x,y]]);await touch('touchMove',[[1,x,y+10]]);await page.waitForTimeout(12);await touch('touchMove',[[1,x,y+80]]);await page.waitForTimeout(12);await touch('touchMove',[[1,x,y+160]]);await touch('touchEnd',[]);
  const releasePosition=Number(await page.locator('#stage').getAttribute('data-position'));
  await page.waitForFunction(()=>!document.querySelector('#lens').classList.contains('visible'),null,{timeout:8000});
  const afterFlick=Number(await page.locator('#stage').getAttribute('data-position'));assert.ok(Math.abs(afterFlick-Math.round(releasePosition))<=1);
  // Second pointer cancels filter travel and is exclusively preview zoom.
  const name=await page.locator('#preset-toast').textContent();
  await touch('touchStart',[[1,130,290]]);await touch('touchMove',[[1,130,320]]);
  await touch('touchStart',[[1,130,320],[2,250,320]]);await touch('touchMove',[[1,90,320],[2,290,320]]);
  await touch('touchEnd',[[1,90,320]]);await touch('touchMove',[[1,90,400]]);await touch('touchEnd',[]);
  assert.ok(Number(await page.locator('#stage').getAttribute('data-zoom'))>1.4);
  assert.equal(await page.locator('#preset-toast').textContent(),name);assert.equal(await page.locator('#lens').evaluate(e=>e.classList.contains('visible')),false);
  // Double tap returns to Fit.
  await page.touchscreen.tap(195,320);await page.waitForTimeout(50);await page.touchscreen.tap(195,320);
  assert.equal(Number(await page.locator('#stage').getAttribute('data-zoom')),1);
  await page.locator('#adjust-button').click();
  assert.equal(await page.locator('#adjustments input').count(),11);
  await page.screenshot({path:path.join(__dirname,'05-adjustments.png')});
  await page.locator('#intensity').fill('0');await page.locator('#intensity').dispatchEvent('input');await page.waitForTimeout(80);
  const pixels=await page.evaluate(async()=>{const c=document.querySelector('#preview'),blob=await(await fetch('tests/fixtures/photo.webp')).blob(),bitmap=await createImageBitmap(blob),original=document.createElement('canvas');original.width=400;original.height=600;const ctx=original.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();return [Array.from(c.getContext('2d').getImageData(100,100,1,1).data),Array.from(ctx.getImageData(100,100,1,1).data)];});assert.deepEqual(pixels[0],pixels[1]);
  await page.locator('#intensity').fill('100');await page.locator('#intensity').dispatchEvent('input');await page.locator('#adjust-grain').fill('0.65');await page.locator('#adjust-grain').dispatchEvent('input');await page.waitForTimeout(80);
  const stable=await page.locator('#preview').evaluate(c=>c.toDataURL());await page.locator('#adjust-grain').dispatchEvent('input');await page.waitForTimeout(80);assert.equal(await page.locator('#preview').evaluate(c=>c.toDataURL()),stable);
  await page.locator('#adjust-sheet .close-sheet').click();
  const cropCheck=await page.evaluate(async()=>{const {createCrop,constrainCrop}=await import('./js/crop.js');const results=[];for(const angle of [-45,45,90,135,270,315]){const c=createCrop(400,600);c.width=320;c.height=500;c.angle=angle;c.cx=-500;c.cy=1200;constrainCrop(c,400,600);const a=angle*Math.PI/180;for(const x of [-c.width/2,c.width/2])for(const y of [-c.height/2,c.height/2]){const sx=c.cx+(Math.cos(a)*x+Math.sin(a)*y)/c.scale,sy=c.cy+(-Math.sin(a)*x+Math.cos(a)*y)/c.scale;results.push(sx>=-1e-7&&sx<=400+1e-7&&sy>=-1e-7&&sy<=600+1e-7);}}return results;});assert.ok(cropCheck.every(Boolean));
  await page.locator('#crop-button').click();await page.locator('#crop-ratio').selectOption('1');
  await page.locator('#crop-angle').fill('20');await page.locator('#crop-angle').dispatchEvent('input');await page.waitForTimeout(100);
  await touch('touchStart',[[1,195,230]]);await touch('touchMove',[[1,230,260]]);await touch('touchEnd',[]);
  await page.screenshot({path:path.join(__dirname,'04-crop.png')});
  assert.equal(await page.locator('#lens').evaluate(e=>e.classList.contains('visible')),false);
  await page.locator('#rotate-90').click();await page.locator('#crop-apply').click();await page.waitForTimeout(100);
  assert.equal(await page.locator('#preview').evaluate(c=>c.width===c.height),true);
  // Download fallback and raw original-resolution outputs, even with preview zoom.
  await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});});
  await page.locator('#export-button').click();await page.waitForFunction(()=>!document.querySelector('#share-save').disabled);
  for(const type of ['image/jpeg','image/png']){
   await page.locator('#format').selectOption(type);await page.waitForFunction(()=>!document.querySelector('#share-save').disabled);
   assert.equal(await page.locator('#quality-row').isVisible(),type==='image/jpeg');
   const downloadEvent=page.waitForEvent('download');await page.locator('#share-save').click();const download=await downloadEvent;assert.ok(download.suggestedFilename().endsWith(type==='image/png'?'.png':'.jpg'));
   const info=await page.locator('#download').evaluate(async a=>{const b=await(await fetch(a.href)).blob(),im=await createImageBitmap(b),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let minAlpha=255;for(let i=3;i<d.length;i+=4)minAlpha=Math.min(minAlpha,d[i]);im.close();return {type:b.type,w:c.width,h:c.height,minAlpha};});
   assert.deepEqual(info,{type,w:400,h:400,minAlpha:255});
  }
  await page.locator('#export-sheet .close-sheet').click();
  // Mock only the OS share boundary; verify actual generated File and cancellation.
  await page.evaluate(()=>{window.shareCalls=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files[0] instanceof File});Object.defineProperty(navigator,'share',{configurable:true,value:({files})=>{window.shareCalls.push({name:files[0].name,type:files[0].type,active:navigator.userActivation.isActive});return Promise.reject(new DOMException('Cancelled','AbortError'));}});});
  await page.locator('#export-button').click();await page.waitForFunction(()=>!document.querySelector('#share-save').disabled);await page.locator('#share-save').click();await page.waitForFunction(()=>document.querySelector('#export-status').textContent.includes('キャンセル'));
  const calls=await page.evaluate(()=>window.shareCalls);assert.equal(calls.length,1);assert.equal(calls[0].active,true);assert.equal(calls[0].type,'image/png');assert.equal(await page.locator('#download').isVisible(),false);
  await page.locator('#export-sheet .close-sheet').click();
  const bw=await page.evaluate(async()=>{const {presets}=await import('./js/presets.js'),{processFrame}=await import('./js/effects.js');const c=document.createElement('canvas');c.width=c.height=10;c.getContext('2d').fillStyle='#b45524';c.getContext('2d').fillRect(0,0,10,10);const result=processFrame(c,10,10,presets[7].values,42,1);const d=result.getContext('2d').getImageData(0,0,10,10).data;return {count:presets.length,allGray:Array.from({length:100},(_,i)=>d[i*4]===d[i*4+1]&&d[i*4+1]===d[i*4+2]).every(Boolean)};});assert.deepEqual(bw,{count:8,allGray:true});
  const opaque=await page.evaluate(async()=>{const {createCrop,constrainCrop,cropFrame}=await import('./js/crop.js');const source=document.createElement('canvas');source.width=400;source.height=600;source.getContext('2d').fillRect(0,0,400,600);const results=[];for(const angle of [-45,-20,0,20,45,90,135,180,225,270,315]){const crop=createCrop(400,600);crop.width=320;crop.height=500;crop.angle=angle;crop.cx=-500;crop.cy=1200;constrainCrop(crop,400,600);const c=cropFrame(source,400,600,crop),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let min=255;for(let i=3;i<d.length;i+=4)min=Math.min(min,d[i]);results.push({angle,min});c.width=c.height=0;}return results;});assert.ok(opaque.every(r=>r.min===255),JSON.stringify(opaque));
  // Cancel preserves crop and pixel state; each fixed ratio renders correctly.
  const committed=await page.locator('#preview').evaluate(c=>c.toDataURL());
  await page.locator('#crop-button').click();
  for(const [ratio,value] of [[4/3,'1.3333333333333333'],[3/4,'0.75'],[16/9,'1.7777777777777777'],[9/16,'0.5625']]){await page.locator('#crop-ratio').selectOption(value);await page.waitForTimeout(50);const actual=await page.locator('#preview').evaluate(c=>c.width/c.height);assert.ok(Math.abs(actual-ratio)<.01);}
  await page.locator('#crop-ratio').selectOption('free');await page.locator('#crop-width').fill('60');await page.locator('#crop-width').dispatchEvent('input');await page.locator('#crop-height').fill('70');await page.locator('#crop-height').dispatchEvent('input');
  await touch('touchStart',[[1,130,280],[2,250,280]]);await touch('touchMove',[[1,100,280],[2,280,280]]);await touch('touchEnd',[]);
  await page.locator('#crop-cancel').click();await page.waitForTimeout(80);assert.equal(await page.locator('#preview').evaluate(c=>c.toDataURL()),committed);
  await page.locator('#compare-button').click();assert.equal(await page.locator('#compare-button').getAttribute('aria-pressed'),'true');await page.locator('#compare-button').click();
  // Replacing the photo resets geometry; up from the first preset wraps to B&W.
  const retainedStrength=await page.locator('#adjust-contrast').inputValue();
  await page.locator('#photo').setInputFiles(path.join(__dirname,'fixtures','photo.jpg'));await page.waitForFunction(()=>document.querySelector('#preview').height===600&&!document.querySelector('#export-button').disabled);
  assert.equal(await page.locator('#adjust-contrast').inputValue(),retainedStrength);
  assert.equal(Number(await page.locator('#stage').getAttribute('data-zoom')),1);
  await page.reload();
  await page.locator('#photo').setInputFiles(path.join(__dirname,'fixtures','photo.png'));await page.waitForFunction(()=>document.querySelector('#preview').height===600&&!document.querySelector('#export-button').disabled);
  await page.locator('#stage').press('ArrowUp');await page.waitForFunction(()=>document.querySelector('#preset-toast').textContent==='B&W'&&!document.querySelector('#lens').classList.contains('visible'));
  await touch('touchStart',[[1,130,300],[2,250,300]]);await touch('touchMove',[[1,90,300],[2,290,300]]);await touch('touchEnd',[]);assert.ok(Number(await page.locator('#stage').getAttribute('data-zoom'))>1);
  await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});});
  await page.locator('#export-button').click();await page.waitForFunction(()=>!document.querySelector('#share-save').disabled);await page.locator('#share-save').click();
  const native=await page.locator('#download').evaluate(async a=>{const b=await(await fetch(a.href)).blob(),im=await createImageBitmap(b);const size=[im.width,im.height];im.close();return size;});assert.deepEqual(native,[400,600]);
  await page.locator('#export-sheet .close-sheet').click();
  await touch('touchStart',[[1,x,y]]);await touch('touchMove',[[1,x,y+50]]);await touch('touchCancel',[]);await page.waitForTimeout(80);assert.equal(await page.locator('#lens').evaluate(e=>e.classList.contains('visible')),false);
  await context.setOffline(true);await page.reload();assert.equal(await page.title(),'Retro Film');
  assert.deepEqual(errors,[]);assert.deepEqual(badRequests,[]);
  console.log('PASS: image formats, 80% stage, direct drag/reversal, velocity inertia, pinch conflict/Fit, 11 controls, deterministic textures, crop corners/rotation/opaque export, JPEG/PNG download, File share activation/cancel, B&W, offline, console and local-only requests');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

