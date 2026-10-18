const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8087/');
 // Locally generated synthetic H.264 fixture: no download or user media.
 const bytes=await page.evaluate(async()=>{
   const type=['video/mp4;codecs=avc1.42E01E','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('MP4 test fixture encoder unavailable');
   const c=document.createElement('canvas');c.width=160;c.height=240;const ctx=c.getContext('2d'),stream=c.captureStream(12),recorder=new MediaRecorder(stream,{mimeType:type}),chunks=[];
   return new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]);};recorder.start();const start=performance.now();function frame(){const t=performance.now()-start;ctx.fillStyle='#448899';ctx.fillRect(0,0,160,240);ctx.fillStyle='#dd7733';ctx.fillRect((t/15)%100,90,45,45);if(t<2200)requestAnimationFrame(frame);else recorder.stop();}frame();});
 });
 fs.writeFileSync(path.join(__dirname,'fixtures','video.mp4'),Buffer.from(bytes));
 // ISO-BMFF synthetic QuickTime-brand MOV; real iPhone HEVC/MOV is a separate device test.
 const mov=Buffer.from(bytes);assert.equal(mov.toString('ascii',4,8),'ftyp');mov.write('qt  ',8,4,'ascii');fs.writeFileSync(path.join(__dirname,'fixtures','video.mov'),mov);
 for(const [name,type] of [['video.mp4','video/mp4'],['video.mov','video/quicktime']]){
  const input=fs.readFileSync(path.join(__dirname,'fixtures',name));
  const result=await page.evaluate(async({bytes,type})=>{
    const {loadVideo,VideoPlayback}=await import('./js/video-source.js?v=20261018-1');const media=await loadVideo(new File([new Uint8Array(bytes)],'test',{type}));const events=[];let frames=0;
    const playback=new VideoPlayback(media,()=>frames++,()=>{},e=>events.push(e.message));await playback.play();await new Promise(r=>setTimeout(r,350));playback.pause();const time=media.source.currentTime;playback.seek(1);await new Promise(r=>media.source.addEventListener('seeked',r,{once:true}));const result={w:media.width,h:media.height,duration:media.duration,time,seek:media.source.currentTime,frames,events,method:playback.method};playback.dispose();media.release();result.removed=!document.querySelector('.video-decoder');return result;
  },{bytes:[...input],type});assert.equal(result.w,160);assert.equal(result.h,240);assert.ok(result.duration>1&&result.time>0&&result.frames>0);assert.equal(result.seek,1);assert.deepEqual(result.events,[]);assert.ok(result.removed);console.log('PHASE 1 PASS',name,result);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

