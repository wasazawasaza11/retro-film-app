const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});await p.goto('http://127.0.0.1:8087/');
 const gaps=[];
 for(const orientation of ['portrait','landscape']){
  const bytes=await p.evaluate(async orientation=>{
   const c=document.createElement('canvas');c.width=orientation==='portrait'?160:320;c.height=orientation==='portrait'?240:180;
   const ctx=c.getContext('2d'),stream=c.captureStream(12),recorder=new MediaRecorder(stream,{mimeType:'video/mp4'}),chunks=[];
   return new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]);};recorder.start();const start=performance.now();function frame(){const t=performance.now()-start;ctx.fillStyle='#448899';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#dd7733';ctx.fillRect((t/20)%(c.width-50),70,50,50);if(t<12000)requestAnimationFrame(frame);else recorder.stop();}frame();});
  },orientation);
  const chooser=p.waitForEvent('filechooser');await p.locator('.open-photo').tap();await(await chooser).setFiles({name:orientation+'.mp4',mimeType:'video/mp4',buffer:Buffer.from(bytes)});await p.waitForFunction(()=>document.getElementById('stage').dataset.mediaType==='video'&&!document.getElementById('adjust-button').disabled);
  assert.ok(await p.locator('video').evaluate(v=>v.duration>11));if(orientation==='portrait'){await p.locator('#stage').focus();await p.keyboard.press('ArrowUp');await p.waitForTimeout(260);await p.keyboard.press('ArrowUp');await p.waitForTimeout(260);}
  const show=async()=>{await p.locator('#stage').focus();await p.keyboard.press('ArrowUp');await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.waitForTimeout(260);await p.waitForFunction(()=>document.getElementById('preset-toast').classList.contains('visible')&&!document.getElementById('lens').classList.contains('visible'));};
  const measure=async state=>{const result=await p.evaluate(()=>{const t=document.getElementById('preset-toast').getBoundingClientRect(),c=document.getElementById('video-controls').getBoundingClientRect();return {gap:c.top-t.bottom,toast:{top:t.top,bottom:t.bottom},controlsTop:c.top};});assert.ok(result.gap>=16,JSON.stringify(result));gaps.push({orientation,state,...result});};
  await p.locator('#video-play').tap();await p.waitForFunction(()=>!document.querySelector('video').paused);await show();await measure('playing');
  if(orientation==='portrait')await p.screenshot({path:path.join(__dirname,'video-toast.png')});
  await p.locator('#video-play').tap();assert.equal(await p.locator('video').evaluate(v=>v.paused),true);await show();await measure('paused');
  await p.locator('#video-seek').evaluate(e=>{e.value=6;e.dispatchEvent(new Event('input'));});await p.waitForFunction(()=>!document.querySelector('video').seeking&&Math.abs(document.querySelector('video').currentTime-6)<.03);await measure('seeked');
  const box=await p.locator('#video-seek').boundingBox();await p.mouse.move(box.x+box.width*.2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width*.6,box.y+box.height/2,{steps:8});await measure('seeking-pointer-held');await p.mouse.up();
  await show();await p.locator('#video-controls').evaluate(e=>{e.style.bottom='70px';e.style.padding='16px';});await p.waitForTimeout(60);await measure('controls-moved-and-grown');await p.locator('#video-controls').evaluate(e=>e.removeAttribute('style'));
  await p.waitForTimeout(1400);assert.equal(await p.locator('#preset-toast').evaluate(e=>e.classList.contains('visible')),false);
 }
 const chooser=p.waitForEvent('filechooser');await p.locator('.open-photo').tap();await(await chooser).setFiles(path.join(__dirname,'fixtures/photo.png'));await p.waitForFunction(()=>!document.getElementById('export-button').disabled);assert.equal(await p.locator('#preset-toast').evaluate(e=>getComputedStyle(e).bottom),'26px');assert.equal(await p.locator('#video-controls').isVisible(),false);
 console.log('PASS: 390x844, 12s portrait/landscape, play/pause/seeking, moved controls, fade, photo position');console.log(JSON.stringify(gaps));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
