const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // A rejected decode must not block the established onload first-display path.
 await page.addInitScript(()=>{HTMLImageElement.prototype.decode=()=>Promise.reject(new Error('test: decode unavailable'));window.createImageBitmap=()=>{throw new Error('test: bitmap unavailable');};});
 await page.goto('http://127.0.0.1:8087/?debug=1');
 await page.waitForFunction(()=>document.querySelector('#debug-log').textContent.includes('app initialized'));
 const dom=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return {duplicates:ids.filter((id,i)=>ids.indexOf(id)!==i),photoCount:document.querySelectorAll('#photo').length,type:document.getElementById('photo').type,accept:document.getElementById('photo').accept,labelTarget:document.querySelector('.open-photo').htmlFor,oldWheel:document.querySelector('#wheel,#selected')!==null};});
 assert.deepEqual(dom,{duplicates:[],photoCount:1,type:'file',accept:'image/*',labelTarget:'photo',oldWheel:false});
 for(const ext of ['jpg','png','webp']){
  // Real label click opens the current input. No direct renderer/test helper call.
  const chooser=page.waitForEvent('filechooser');await page.locator('label.open-photo').tap();
  await(await chooser).setFiles(path.join(__dirname,'fixtures','photo.'+ext));
  await page.waitForFunction(()=>document.querySelector('#debug-state').textContent==='render complete (pipeline)');
  const log=await page.locator('#debug-log').textContent(),stages=['input change','file received','objectURL created','image load start','image.onload','natural size取得','preview canvas resize','drawImage start','drawImage success','render complete','empty state hidden','toolbar enabled'];
  let offset=-1;for(const stage of stages){const next=log.indexOf(stage,offset+1);assert.ok(next>offset,stage+' missing/out of order\n'+log);offset=next;}
  assert.ok(log.includes('event.target.files: FileList; length: 1'));assert.ok(log.includes('event.target.files[0]: File'));
  const visible=await page.locator('#preview').evaluate(c=>{const s=getComputedStyle(c),empty=document.getElementById('empty'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight,display:s.display,visibility:s.visibility,opacity:s.opacity,emptyDisplay:getComputedStyle(empty).display,nonempty:d.some((v,i)=>i%4===3&&v>0)};});
  assert.ok(visible.width&&visible.height&&visible.clientWidth&&visible.clientHeight&&visible.nonempty);assert.equal(visible.emptyDisplay,'none');assert.equal(visible.display,'block');assert.equal(visible.visibility,'visible');assert.equal(visible.opacity,'1');assert.equal(await page.locator('#export-button').isDisabled(),false);
 }
 await page.screenshot({path:path.join(__dirname,'image-loading-debug.png')});
 await page.goto('http://127.0.0.1:8087/');
 assert.equal(await page.locator('#debug-panel').isVisible(),false);
 const normalChooser=page.waitForEvent('filechooser');await page.locator('label.open-photo').tap();await(await normalChooser).setFiles(path.join(__dirname,'fixtures','photo.png'));
 await page.waitForFunction(()=>document.getElementById('empty').hidden&&!document.getElementById('export-button').disabled);
 assert.equal(await page.locator('#preview').isVisible(),true);
 // Use a fresh page for the legacy comparison: the fault injection above is
 // deliberately incompatible with the old decode-required implementation.
 const comparison=await context.newPage();
 await comparison.goto('http://127.0.0.1:8087/tests/image-loader-only.html');
 for(const route of ['legacy','current']){await comparison.locator('#route').selectOption(route);const chooser=comparison.waitForEvent('filechooser');await comparison.locator('label[for=photo]').tap();await(await chooser).setFiles(path.join(__dirname,'fixtures','photo.png'));await comparison.waitForFunction(()=>document.querySelector('#log').textContent.endsWith('render complete'));assert.equal(await comparison.locator('#preview').evaluate(c=>c.width),400);}
 await comparison.evaluate(()=>{HTMLImageElement.prototype.decode=()=>Promise.reject(new Error('test: decode unavailable'));});
 for(const route of ['legacy','current']){
  await comparison.locator('#route').selectOption(route);const chooser=comparison.waitForEvent('filechooser');await comparison.locator('label[for=photo]').tap();await(await chooser).setFiles(path.join(__dirname,'fixtures','photo.png'));
  await comparison.waitForFunction(route=>{const log=document.querySelector('#log').textContent;return route==='legacy'?log.includes('ERROR: loader / drawImage\ntest: decode unavailable'):log.endsWith('render complete');},route);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: actual new photo-label tap -> picker -> change -> loader -> renderer -> visible pixels -> empty hidden -> toolbar; JPEG/PNG/WebP; no duplicate/obsolete DOM; legacy/current loader-only comparison');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
