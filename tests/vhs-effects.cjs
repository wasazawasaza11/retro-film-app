const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8087/');
 const r=await p.evaluate(async()=>{
  const {processFrame}=await import('./js/effects.js?v=20261024-3');
  const {presets,interpolate}=await import('./js/presets.js?v=20261024-3');
  const {videoEffectState}=await import('./js/video-effects.js?v=20261024-3');
  const {AdjustmentStore,storageKey}=await import('./js/adjustment-store.js?v=20261024-3');
  const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');ctx.fillStyle='#333333';ctx.fillRect(0,0,160,240);ctx.fillStyle='#cccccc';ctx.fillRect(160,0,160,240);
  const scene={brightness:.5,brightnessChange:0,motion:0,motionX:0,motionY:0};
  const t=videoEffectState(17,1,scene),next={...t,tapeSeed:videoEffectState(17,1.05,scene).tapeSeed};
  const bytes=(parameters,temporal,intensity=1)=>{const out=processFrame(c,320,240,parameters,17,intensity,temporal);const data=out.getContext('2d').getImageData(0,0,320,240).data;out.width=out.height=0;return data;};
  const vhs=presets[4].values,a=bytes(vhs,t),same=bytes(vhs,t),different=bytes(vhs,next),without=bytes({...vhs,vhs:0},t);
  const delta=(a,b)=>a.reduce((s,x,i)=>s+Math.abs(x-b[i]),0)/a.length;
  let dark=0,light=0,count=0;for(let y=20;y<200;y++)for(let x=20;x<140;x++){const i=(y*320+x)*4,j=i+160*4;dark+=Math.abs(a[i]-without[i]);light+=Math.abs(a[j]-without[j]);count++;}
  const old={...vhs};delete old.vhs;localStorage.setItem(storageKey,JSON.stringify({overrides:{VHS:old}}));const restored=new AdjustmentStore().values(4);localStorage.removeItem(storageKey);
  return {same:delta(a,same),changed:delta(a,different),noise:delta(a,without),dark:dark/count,light:light/count,opaque:a.every((x,i)=>i%4!==3||x===255),photo:delta(bytes(vhs,null),bytes({...vhs,vhs:0},null)),other:delta(bytes(presets[0].values,t),bytes({...presets[0].values,vhs:0},t)),zero:delta(bytes(vhs,t,0),bytes({...vhs,vhs:0},t,0)),mix:interpolate(presets[3].values,vhs,.5).vhs,restored:restored.vhs};
 });
 assert.equal(r.same,0);assert.ok(r.changed>3);assert.ok(r.noise>3);assert.ok(r.dark>r.light);assert.ok(r.opaque);assert.equal(r.photo,0);assert.equal(r.other,0);assert.equal(r.zero,0);assert.equal(r.mix,.5);assert.equal(r.restored,1);assert.deepEqual(errors,[]);console.log('PASS: VHS temporal/shadow noise, stable pause, opaque edges, photos/other presets/zero strength unchanged, interpolation and old saved values',r);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
