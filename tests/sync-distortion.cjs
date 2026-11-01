const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8087/');
 const result=await p.evaluate(async()=>{
  const {normalizeSync,syncState,syncRowShift,applySyncDistortion,normalizeBleed,applyVideoBleed}=await import('./js/sync-distortion.js?v=20261101-7');
  const {processFrame}=await import('./js/effects.js?v=20261101-7'),{presets}=await import('./js/presets.js?v=20261101-7'),{videoEffectState}=await import('./js/video-effects.js?v=20261101-7');
  const source=document.createElement('canvas');source.width=160;source.height=240;const context=source.getContext('2d');context.fillStyle='#111';context.fillRect(0,0,160,240);context.fillStyle='#eee';context.fillRect(60,0,20,240);
  const temporal=videoEffectState(42,.5,{brightness:.5,brightnessChange:0,motion:0,motionX:0,motionY:0}),effect={enabled:true,wave:.8,shift:.3,frequency:1,duration:2};
  const expected=processFrame(source,160,240,presets[0].values,42,.7,temporal);applySyncDistortion(expected.getContext('2d'),160,240,42,.5,{...effect,wave:.8*.7,shift:.3*.7,colorNoise:.45*.7,monochrome:0});
  const actual=processFrame(source,160,240,{...presets[0].values,syncDistortion:effect},42,.7,temporal),expectedBytes=expected.getContext('2d').getImageData(0,0,160,240).data,actualBytes=actual.getContext('2d').getImageData(0,0,160,240).data;
  const noUnwarpedGhost=actualBytes.every((v,i)=>v===expectedBytes[i]);
  const rangeSettings={enabled:true,frequency:1,duration:2,top:.2,bottom:.8};const centers=[];
  for(let i=0;i<600;i++){const s=syncState(42,i/60,rangeSettings);if(s.active)centers.push(s.center);}
  const within=centers.every(y=>y>=.2&&y<=.8),moving=Math.max(...centers)-Math.min(...centers)>.1;
  const fixed=[];for(let i=0;i<100;i++){const s=syncState(42,i/60,{...rangeSettings,top:.4,bottom:.4});if(s.active)fixed.push(s.center);}
  const noiseFrame=(colorNoise,monochrome=0)=>{const c=document.createElement('canvas');c.width=160;c.height=240;const ctx=c.getContext('2d');for(let x=0;x<160;x++){ctx.fillStyle=monochrome?(x%12<6?'#333':'#ddd'):(x%12<6?'#ce5928':'#2895ce');ctx.fillRect(x,0,1,240);}applySyncDistortion(ctx,160,240,42,.5,{...rangeSettings,colorNoise,monochrome,wave:1,shift:0});return ctx.getImageData(0,0,160,240).data;};
  const quiet=noiseFrame(0),noisy=noiseFrame(1),bw=noiseFrame(1,1),boundary=syncState(42,.5,rangeSettings).center;let colorChanges=0,noiseOutside=0;
  for(let y=0;y<240;y++)for(let x=0;x<160;x++){const i=(y*160+x)*4;if(noisy[i]!==quiet[i]||noisy[i+1]!==quiet[i+1]||noisy[i+2]!==quiet[i+2]){if(noisy[i]!==noisy[i+2])colorChanges++;if(Math.abs((y/240-boundary)*480)>45)noiseOutside++;}}
  const flat=document.createElement('canvas');flat.width=160;flat.height=240;const flatCtx=flat.getContext('2d');flatCtx.fillStyle='#777';flatCtx.fillRect(0,0,160,240);applySyncDistortion(flatCtx,160,240,42,.5,{...rangeSettings,colorNoise:1,wave:1,shift:0});const flatBytes=flatCtx.getImageData(0,0,160,240).data;const noOverlay=flatBytes.every((v,i)=>v===(i%4===3?255:119));
  const settings=normalizeSync({enabled:true,frequency:.5,wave:.8});let on=0,off=0,longest=0,run=0,time=null;
  for(let i=0;i<600;i++){const t=i/30,s=syncState(42,t,settings);if(s.active){on++;run++;time??=t;}else{off++;longest=Math.max(longest,run);run=0;}}
  longest=Math.max(longest,run);
  const state=syncState(42,time,settings),wave=Array.from({length:240},(_,y)=>syncRowShift(y,240,320,state,settings));
  const rigid=Array.from({length:240},(_,y)=>syncRowShift(y,240,320,state,{...settings,wave:0}));
  const render=(s,t=time)=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');for(let x=0;x<320;x++){ctx.fillStyle=x%20<10?'#111':'#ddd';ctx.fillRect(x,0,1,240);}applySyncDistortion(ctx,320,240,42,t,s);return ctx.getImageData(0,0,320,240).data;};
  const large=Array.from({length:240},(_,y)=>syncRowShift(y,240,320,{active:true,gain:1,shift:0,phase:0,span:.25,center:.5,direction:1},{wave:1,shift:0}));
  const start=120,peakIndex=large.indexOf(Math.max(...large)),beforeStep=large.slice(0,start).every(x=>x===0);
  const monotonicRecovery=large.slice(peakIndex+1).every((x,i)=>x<=large[peakIndex+i]+1e-7);
  const abrupt=peakIndex-start<=2&&large[peakIndex]>100;
  const renderBleed=enabled=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');for(let x=0;x<320;x++){ctx.fillStyle=x%20<10?'#111':'#ddd';ctx.fillRect(x,0,1,240);}applyVideoBleed(ctx,320,240,42,.5,{enabled,amount:1,width:1,frequency:1,duration:2});return ctx.getImageData(0,0,320,240).data;};
  const noBleed=renderBleed(false),bleed=renderBleed(true),bleedRepeat=renderBleed(true);
  const baseline=render({...settings,enabled:false}),zero=render({...settings,shift:0,wave:0,bleed:0}),a=render(settings),same=render(settings);
  let changes=0;for(let i=0;i<a.length;i++)if(a[i]!==baseline[i])changes++;
  const short={...settings,duration:.2},long={...settings,duration:2};
  const maxRun=s=>{let max=0,current=0;for(let i=0;i<3000;i++){if(syncState(42,i/100,{...s,frequency:1}).active)current++;else current=0;max=Math.max(max,current);}return max/100;};
  return {noOverlay,within,moving,fixed:fixed.every(x=>x===.4),colorChanges,noiseOutside,bw:bw.every((v,i)=>i%4!==0||v===bw[i+1]&&v===bw[i+2]),beforeStep,monotonicRecovery,abrupt,noUnwarpedGhost,peak:Math.max(...large.map(Math.abs)),upper:Math.abs(large[0]),bleedIndependent:bleed.some((v,i)=>v!==noBleed[i]),bleedStable:bleed.every((v,i)=>v===bleedRepeat[i]),on,off,longest:longest/30,changes,stable:a.every((x,i)=>x===same[i]),zero:zero.every((x,i)=>x===baseline[i]),opaque:a.every((x,i)=>i%4!==3||x===255),wave:new Set(wave).size,rigid:new Set(rigid).size,short:maxRun(short),long:maxRun(long),frequencyZero:!syncState(42,time,{...settings,frequency:0}).active,disabled:!syncState(42,time,{...settings,enabled:false}).active};
 });
 assert.ok(result.noOverlay&&result.within&&result.moving&&result.fixed&&result.colorChanges>10&&result.bw);assert.equal(result.noiseOutside,0);
 assert.ok(result.noUnwarpedGhost&&result.beforeStep&&result.monotonicRecovery&&result.abrupt);
 assert.ok(result.peak>80&&result.upper<.1&&result.bleedIndependent&&result.bleedStable);
 assert.ok(result.on>10&&result.off>10);assert.ok(result.longest<=1.05);assert.ok(result.changes>100);assert.ok(result.stable&&result.zero&&result.opaque&&result.frequencyZero&&result.disabled);assert.ok(result.wave>20);assert.equal(result.rigid,1);assert.ok(result.short<=.21&&result.long>1);
 await p.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/video.mp4'));await p.waitForFunction(()=>!document.getElementById('adjust-button').disabled);await p.locator('#adjust-button').click();assert.ok(await p.locator('#video-sync-controls').isVisible());assert.ok(await p.locator('#video-bleed-controls').isVisible());await p.locator('#sync-enabled').check();for(const [key,value] of [['frequency',100],['wave',80],['thickness',70],['duration',2],['top',20],['bottom',80],['colorNoise',85]])await p.locator('#sync-'+key).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.equal(await p.locator('#sync-duration-value').textContent(),'2.0秒');await p.locator('#adjust-sheet .close-sheet').click();await p.locator('#video-play').click();await p.waitForFunction(()=>document.querySelector('video').currentTime>.5);await p.locator('#video-play').click();await p.screenshot({path:path.join(__dirname,'sync-distortion-preview.png')});
 await p.locator('#adjust-button').click();await p.locator('#bleed-enabled').check();for(const [key,value] of [['frequency',100],['duration',2]])await p.locator('#bleed-'+key).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);await p.locator('#adjust-sheet .close-sheet').click();
 await p.locator('#export-button').click();await p.waitForFunction(()=>!document.getElementById('video-export-start').disabled);await p.locator('#video-export-start').click();await p.waitForFunction(()=>!document.getElementById('video-export-share').hidden);await p.locator('#video-export-sheet .close-sheet').click();
 await p.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/photo.png'));await p.waitForFunction(()=>document.getElementById('stage').dataset.mediaType==='image'&&!document.getElementById('adjust-button').disabled);await p.locator('#adjust-button').click();assert.ok(await p.locator('#video-sync-controls').isHidden());assert.ok(await p.locator('#video-bleed-controls').isHidden());assert.deepEqual(errors,[]);console.log('PASS: random gated full-frame wave/rigid shake, duration, OFF, stable pause, opaque edges, actual UI/export and photo isolation',result);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
