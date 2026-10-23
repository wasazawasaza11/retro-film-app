const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8087/');
 const result=await p.evaluate(async()=>{
  const {handheldPose,drawHandheld}=await import('./js/handheld.js?v=20261024-5');
  let uncovered=0,maxStep=0,maxAngle=0;
  for(const [w,h] of [[390,844],[844,390],[320,240]]){let prev=null;for(let f=0;f<600;f++){
    const pose=handheldPose(32,f/60,1,w,h),c=Math.cos(pose.angle),s=Math.sin(pose.angle);
    for(const x of [-w/2,w/2])for(const y of [-h/2,h/2]){const xx=(c*(x-pose.x)+s*(y-pose.y))/pose.scale,yy=(-s*(x-pose.x)+c*(y-pose.y))/pose.scale;if(Math.abs(xx)>w/2||Math.abs(yy)>h/2)uncovered++;}
    if(prev)maxStep=Math.max(maxStep,Math.abs(pose.angle-prev.angle));prev=pose;maxAngle=Math.max(maxAngle,Math.abs(pose.angle));
  }}
  const source=document.createElement('canvas');source.width=120;source.height=240;const a=source.getContext('2d');a.fillStyle='white';a.fillRect(0,0,120,240);a.fillStyle='red';a.fillRect(30,50,20,30);
  const target=document.createElement('canvas');target.width=120;target.height=240;const ctx=target.getContext('2d');const frames=[];
  for(const time of [1,1,2]){ctx.clearRect(0,0,120,240);drawHandheld(ctx,source,120,240,32,time,1);frames.push(ctx.getImageData(0,0,120,240).data);}
  return {uncovered,maxStep,maxAngle,zero:handheldPose(32,1,0,120,240),same:frames[0].every((x,i)=>x===frames[1][i]),changed:frames[0].some((x,i)=>x!==frames[2][i]),opaque:frames.every(d=>d.every((x,i)=>i%4!==3||x===255))};
 });
 assert.equal(result.uncovered,0);assert.ok(result.maxStep<.003);assert.ok(result.maxAngle<.026);assert.deepEqual(result.zero,{angle:0,x:0,y:0,scale:1});assert.ok(result.same);assert.ok(result.changed);assert.ok(result.opaque);
 await p.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/video.mp4'));await p.waitForFunction(()=>!document.getElementById('adjust-button').disabled);await p.locator('#adjust-button').click();assert.ok(await p.locator('#video-motion-control').isVisible());await p.locator('#video-handheld').evaluate(e=>{e.value=60;e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await p.locator('#video-handheld-value').textContent(),'60%');await p.locator('#adjust-sheet .close-sheet').click();await p.locator('#video-play').click();await p.waitForFunction(()=>document.querySelector('video').currentTime>.3);await p.locator('#video-play').click();
 await p.locator('#photo').setInputFiles(path.join(__dirname,'fixtures/photo.png'));await p.waitForFunction(()=>document.getElementById('stage').dataset.mediaType==='image'&&!document.getElementById('adjust-button').disabled);await p.locator('#adjust-button').click();assert.ok(await p.locator('#video-motion-control').isHidden());assert.deepEqual(errors,[]);console.log('PASS: smooth seeded rotation/pan, identical pause, covered corners portrait/landscape, OFF identity, actual video UI and photo isolation',result);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
