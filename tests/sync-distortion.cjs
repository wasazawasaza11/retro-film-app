const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8087/');
 const result=await p.evaluate(async()=>{
  const {normalizeSync,syncState,syncRowShift,applySyncDistortion}=await import('./js/sync-distortion.js?v=20261101-3');
  const settings=normalizeSync({enabled:true,frequency:.5,wave:.8});let on=0,off=0,longest=0,run=0,time=null;
  for(let i=0;i<600;i++){const t=i/30,s=syncState(42,t,settings);if(s.active){on++;run++;time??=t;}else{off++;longest=Math.max(longest,run);run=0;}}
  longest=Math.max(longest,run);
  const state=syncState(42,time,settings),wave=Array.from({length:240},(_,y)=>syncRowShift(y,240,320,state,settings));
  const rigid=Array.from({length:240},(_,y)=>syncRowShift(y,240,320,state,{...settings,wave:0}));
  const render=(s,t=time)=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');for(let x=0;x<320;x++){ctx.fillStyle=x%20<10?'#111':'#ddd';ctx.fillRect(x,0,1,240);}applySyncDistortion(ctx,320,240,42,t,s);return ctx.getImageData(0,0,320,240).data;};
  const baseline=render({...settings,enabled:false}),zero=render({...settings,shift:0,wave:0,bleed:0}),a=render(settings),same=render(settings);
  let changes=0;for(let i=0;i<a.length;i++)if(a[i]!==baseline[i])changes++;
  const short={...settings,duration:.2},long={...settings,duration:2};
  const maxRun=s=>{let max=0,current=0;for(let i=0;i<3000;i++){if(syncState(42,i/100,{...s,frequency:1}).active)current++;else current=0;max=Math.max(max,current);}return max/100;};
  return {on,off,longest:longest/30,changes,stable:a.every((x,i)=>x===same[i]),zero:zero.every((x,i)=>x===baseline[i]),opaque:a.every((x,i)=>i%4!==3||x===255),wave:new Set(wave).size,rigid:new Set(rigid).size,short:maxRun(short),long:maxRun(long),frequencyZero:!syncState(42,time,{...settings,frequency:0}).active,disabled:!syncState(42,time,{...settings,enabled:false}).active};
 });
 assert.ok(result.on>10&&result.off>10);assert.ok(result.longest<=1.05);assert.ok(result.changes>100);assert.ok(result.stable&&result.zero&&result.opaque&&result.frequencyZero&&result.disabled);assert.ok(result.wave>100);assert.equal(result.rigid,1);assert.ok(result.short<=.21&&result.long>1);
 await p.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/video.mp4'));await p.waitForFunction(()=>!document.getElementById('adjust-button').disabled);await p.locator('#adjust-button').click();assert.ok(await p.locator('#video-sync-controls').isVisible());await p.locator('#sync-enabled').check();for(const [key,value] of [['frequency',100],['wave',80],['thickness',70],['duration',2]])await p.locator('#sync-'+key).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.equal(await p.locator('#sync-duration-value').textContent(),'2.0秒');await p.locator('#adjust-sheet .close-sheet').click();await p.locator('#video-play').click();await p.waitForFunction(()=>document.querySelector('video').currentTime>.5);await p.locator('#video-play').click();await p.screenshot({path:path.join(__dirname,'sync-distortion-preview.png')});
 await p.locator('#export-button').click();await p.waitForFunction(()=>!document.getElementById('video-export-start').disabled);await p.locator('#video-export-start').click();await p.waitForFunction(()=>!document.getElementById('video-export-share').hidden);await p.locator('#video-export-sheet .close-sheet').click();
 await p.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/photo.png'));await p.waitForFunction(()=>document.getElementById('stage').dataset.mediaType==='image'&&!document.getElementById('adjust-button').disabled);await p.locator('#adjust-button').click();assert.ok(await p.locator('#video-sync-controls').isHidden());assert.deepEqual(errors,[]);console.log('PASS: random gated full-frame wave/rigid shake, duration, OFF, stable pause, opaque edges, actual UI/export and photo isolation',result);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
