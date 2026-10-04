const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8087/');await page.waitForTimeout(200);
 const layout=await page.evaluate(()=>Object.fromEntries(['stage','photo-view','empty'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return [id,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,position:s.position,transform:s.transform,translate:s.translate,display:s.display,flex:s.flex,minWidth:s.minWidth,maxWidth:s.maxWidth,overflow:s.overflow}];})));
 assert.ok(Math.abs(layout.empty.x+layout.empty.width/2-(layout.stage.x+layout.stage.width/2))<1);assert.equal(layout.empty.width,layout.stage.width);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#empty').evaluate(e=>getComputedStyle(e).writingMode),'horizontal-tb');
 await page.screenshot({path:path.join(__dirname,'ui-empty.png')});
 const audit=await page.evaluate(async()=>{const {createCrop,setCropAngle,constrainCrop}=await import('/js/crop.js');const old=createCrop(400,600);old.width=200;old.height=300;old.cx=100;old.cy=300;old.angle=5;constrainCrop(old,400,600);const crop=createCrop(400,600);crop.width=200;crop.height=300;crop.cx=100;crop.cy=300;const positions=[];for(const a of [0,1,2,5,10,5,0,-10,0,10]){setCropAngle(crop,a,400,600);positions.push({angle:a,cx:crop.cx,cy:crop.cy,scale:crop.scale});}return {old,positions};});
 assert.ok(audit.old.cx!==100);for(const p of audit.positions){assert.equal(p.cx,100);assert.equal(p.cy,300);}
 const chooser=page.waitForEvent('filechooser');await page.locator('.open-photo').tap();await(await chooser).setFiles(path.join(__dirname,'fixtures','photo.png'));await page.waitForFunction(()=>!document.getElementById('crop-button').disabled);await page.locator('#crop-button').tap();
 await page.evaluate(()=>{window.gestureEvents=0;document.getElementById('stage').addEventListener('pointerdown',()=>window.gestureEvents++);});
 let initial;
 for(const angle of [0,1,2,5,10,5,0,-10,0,10,0,5,-5]){
  await page.locator('#crop-angle').evaluate((e,a)=>{e.value=a;e.dispatchEvent(new Event('input',{bubbles:true}));},angle);await page.waitForTimeout(80);
  const r=await page.locator('#photo-view').boundingBox();const center={x:r.x+r.width/2,y:r.y+r.height/2};initial??=center;assert.ok(Math.hypot(center.x-initial.x,center.y-initial.y)<1);
  if([0,5,-5].includes(angle))await page.screenshot({path:path.join(__dirname,`ui-angle-${angle}.png`)});
 }
 await page.locator('#crop-angle').tap();assert.equal(await page.evaluate(()=>window.gestureEvents),0);assert.deepEqual(errors,[]);
 console.log('PASS: empty centered/no overflow; old constraint moves off-center anchor, angle-only constraint retains anchor; angle sequences retain display center; slider outside gesture stage');console.log(JSON.stringify({layout,audit}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
