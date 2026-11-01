const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8087/');
 const result=await page.evaluate(async()=>{
  const {tapeNoiseMarks,drawTapeNoise,normalizeTapeNoise,tapeDistortionRows}=await import('./js/tape-noise.js?v=20261101-2');
  const p={enabled:true,top:.25,bottom:.65,amount:.8,size:.8,frequency:.5};
  let bounds=true,off=0,on=0;const sizes=new Set(),alphas=new Set(),positions=new Set();
  for(let frame=0;frame<200;frame++){
    const marks=tapeNoiseMarks(42,frame/8,p);if(marks.length)on++;else off++;
    for(const m of marks){bounds&&=m.y>=p.top&&m.y+m.h<=p.bottom+1e-10&&m.opacity<=p.amount;sizes.add(m.h);alphas.add(m.opacity);positions.add(Math.floor(m.y*100));}
  }
  let synced=true,active=0,missing=0;
  for(let frame=0;frame<100;frame++){
    const marks=tapeNoiseMarks(42,frame/8,p),rows=tapeDistortionRows(320,240,42,frame/8,p);
    if(!marks.length){missing++;synced&&=rows.every(x=>x===0);}else if(rows.some(x=>x!==0))active++;
    synced&&=rows.every((x,y)=>!x||(y>=60&&y<156));
  }
  const zeroRows=tapeDistortionRows(320,240,42,1,{...p,distortion:0});
  const render=distortion=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');for(let x=0;x<320;x++){ctx.fillStyle=x%20<10?'#111':'#ddd';ctx.fillRect(x,0,1,240);}drawTapeNoise(ctx,320,240,42,1,{...p,frequency:1,distortion});return ctx.getImageData(0,0,320,240).data;};
  const plain=render(0),distorted=render(1),repeat=render(1);let warpedPixels=0,warpOutside=0;for(let i=0;i<plain.length;i+=4)if(plain[i]!==distorted[i]){warpedPixels++;const y=Math.floor(i/4/320);if(y<60||y>=156)warpOutside++;}
  const a=tapeNoiseMarks(42,1,p),b=tapeNoiseMarks(42,1,p);
  const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');ctx.fillStyle='#222';ctx.fillRect(0,0,320,240);drawTapeNoise(ctx,320,240,42,1,{...p,frequency:1});const bytes=ctx.getImageData(0,0,320,240).data;let changed=0,outside=0;
  for(let y=0;y<240;y++)for(let x=0;x<320;x++){const i=(y*320+x)*4;if(bytes[i]!==34||bytes[i+1]!==34||bytes[i+2]!==34){changed++;if(y<60||y>=156)outside++;}}
  return {synced,active,missing,zeroRows:zeroRows.every(x=>x===0),warpedPixels,warpOutside,warpStable:distorted.every((x,i)=>x===repeat[i]),bounds,off,on,sizes:sizes.size,alphas:alphas.size,positions:positions.size,same:JSON.stringify(a)===JSON.stringify(b),disabled:tapeNoiseMarks(42,1,{...p,enabled:false}).length,zero:tapeNoiseMarks(42,1,{...p,amount:0}).length,empty:tapeNoiseMarks(42,1,{...p,bottom:.25}).length,changed,outside,normalized:normalizeTapeNoise({top:.8,bottom:.2}).top};
 });
 assert.ok(result.synced&&result.active>10&&result.missing>10&&result.zeroRows&&result.warpStable);assert.ok(result.warpedPixels>50);assert.equal(result.warpOutside,0);
 assert.ok(result.bounds);assert.ok(result.off>20&&result.on>20);assert.ok(result.sizes>100&&result.alphas>100&&result.positions>20);assert.ok(result.same);assert.equal(result.disabled,0);assert.equal(result.zero,0);assert.equal(result.empty,0);assert.ok(result.changed>20);assert.equal(result.outside,0);assert.equal(result.normalized,.2);
 await page.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/video.mp4'));await page.waitForFunction(()=>!document.getElementById('adjust-button').disabled);await page.locator('#adjust-button').click();assert.ok(await page.locator('#video-tape-controls').isVisible());await page.locator('#tape-enabled').check();for(const [key,value] of [['top',20],['bottom',80],['amount',85],['size',75],['frequency',100],['distortion',85]])await page.locator('#tape-'+key).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
 assert.equal(await page.locator('#tape-top-value').textContent(),'20%');await page.screenshot({path:path.join(__dirname,'tape-noise-settings.png')});await page.locator('#adjust-sheet .close-sheet').click();await page.locator('#video-play').click();await page.waitForFunction(()=>document.querySelector('video').currentTime>.3);await page.locator('#video-play').click();await page.screenshot({path:path.join(__dirname,'tape-noise-preview.png')});
 await page.locator('#export-button').click();await page.waitForFunction(()=>!document.getElementById('video-export-start').disabled);await page.locator('#video-export-start').click();await page.waitForFunction(()=>!document.getElementById('video-export-share').hidden);await page.locator('#video-export-sheet .close-sheet').click();
 await page.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/photo.png'));await page.waitForFunction(()=>document.getElementById('stage').dataset.mediaType==='image'&&!document.getElementById('adjust-button').disabled);await page.locator('#adjust-button').click();assert.ok(await page.locator('#video-tape-controls').isHidden());assert.deepEqual(errors,[]);console.log('PASS: seeded random marks, adjustable bounds/size/opacity/frequency/OFF, real video UI and MP4 export, photo isolation',result);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
