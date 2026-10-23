const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 for(const fallback of [false,true]){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await context.newPage(),errors=[],uploads=[];
  if(fallback)await p.addInitScript(()=>{HTMLVideoElement.prototype.requestVideoFrameCallback=undefined;HTMLVideoElement.prototype.cancelVideoFrameCallback=undefined;});
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET'||r.postData())uploads.push(r.url());});
  await p.goto('http://127.0.0.1:8087/?debug=1');
  const choose=async file=>{const chooser=p.waitForEvent('filechooser');await p.locator('.open-photo').tap();await(await chooser).setFiles(file);};
  for(const filename of ['video.mp4','video.mov']){
   await choose(path.join(__dirname,'fixtures',filename));await p.waitForFunction(()=>document.getElementById('stage').dataset.mediaType==='video'&&!document.getElementById('adjust-button').disabled);
   await p.locator('#debug-panel').evaluate(e=>e.open=false);
   assert.equal(await p.locator('#crop-button').isDisabled(),true);assert.equal(await p.locator('#export-button').isDisabled(),false);
   assert.equal(await p.locator('#preview').evaluate(c=>c.width),160);assert.equal(await p.locator('.video-decoder').count(),1);
   await p.locator('#video-play').tap();await p.waitForFunction(()=>document.querySelector('video').currentTime>.2);
   await p.locator('#adjust-button').tap();const playingTime=await p.locator('video').evaluate(v=>v.currentTime);
   await p.locator('#intensity').evaluate(e=>{e.value=0;e.dispatchEvent(new Event('input'));});await p.waitForTimeout(80);
   await p.locator('#intensity').evaluate(e=>{e.value=100;e.dispatchEvent(new Event('input'));});await p.locator('#adjust-grain').evaluate(e=>{e.value=.5;e.dispatchEvent(new Event('input'));});
   await p.locator('#save-favorite').tap();await p.locator('[data-favorite="0"]').tap();await p.locator('#adjust-sheet .close-sheet').tap();
   assert.ok(await p.locator('video').evaluate((v,t)=>v.currentTime>=t,playingTime));
   await p.locator('#video-play').tap();const stopped=await p.locator('video').evaluate(v=>v.currentTime);await p.waitForTimeout(100);assert.equal(await p.locator('video').evaluate(v=>v.currentTime),stopped);
   await p.locator('#video-seek').evaluate(e=>{e.value=1;e.dispatchEvent(new Event('input'));});await p.waitForFunction(()=>Math.abs(document.querySelector('video').currentTime-1)<.02&&!document.querySelector('video').seeking);
   await p.locator('#stage').focus();await p.keyboard.press('ArrowUp');await p.waitForTimeout(300);
   assert.equal(await p.locator('#preset-toast').textContent(),'B&W');await p.waitForTimeout(50);
   const mono=await p.locator('#preview').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.every((v,i)=>i%4!==0||Math.abs(v-d[i+1])<=1&&Math.abs(v-d[i+2])<=1);});assert.ok(mono);
   await p.keyboard.press('ArrowDown');await p.waitForTimeout(250);
   const stage=await p.locator('#stage').boundingBox(),cdp=await context.newCDPSession(p),x=195,y=stage.y+150;
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y}))});
   await p.locator('#video-play').tap();await touch('touchStart',[[1,x,y]]);await touch('touchMove',[[1,x,y+75]]);await p.waitForTimeout(100);assert.equal(await p.locator('#lens').evaluate(e=>e.classList.contains('visible')),true);assert.equal(await p.locator('video').evaluate(v=>v.paused),false);await touch('touchEnd',[]);await p.waitForTimeout(300);
   await touch('touchStart',[[1,150,y],[2,240,y]]);await touch('touchMove',[[1,120,y],[2,280,y]]);await touch('touchEnd',[]);assert.ok(Number(await p.locator('#stage').getAttribute('data-zoom'))>1);
   await p.screenshot({path:path.join(__dirname,`video-${fallback?'fallback':'rvfc'}.png`)});
   await choose({name:'broken.mp4',mimeType:'video/mp4',buffer:Buffer.from('invalid video')});await p.waitForFunction(()=>document.getElementById('status').textContent.includes('この動画を再生できません'));
   assert.equal(await p.locator('.video-decoder').count(),1);assert.equal(await p.locator('#adjust-button').isDisabled(),false);
   await choose(path.join(__dirname,'fixtures','photo.png'));await p.waitForFunction(()=>document.getElementById('stage').dataset.mediaType==='image'&&!document.getElementById('export-button').disabled);assert.equal(await p.locator('.video-decoder').count(),0);assert.equal(await p.locator('#video-controls').isVisible(),false);assert.equal(await p.locator('#crop-button').isDisabled(),false);
   await p.locator('#stage').focus();await p.keyboard.press('ArrowUp');await p.waitForTimeout(250);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(uploads,[]);await context.close();console.log('PHASE 2 PASS',fallback?'rAF fallback':'requestVideoFrameCallback','MP4/MOV actual picker, Canvas, playback, pause/seek, adjustment/favorite/B&W, swipe/lens while playing, pinch, photo return/resource release; local-only');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
