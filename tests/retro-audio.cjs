const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8087/');
 const result=await page.evaluate(async()=>{
  const {RetroAudioProcessor}=await import('./js/retro-audio.js?v=20261024-3');
  const rate=32000,length=rate;
  const signal=frequency=>{const b=new AudioBuffer({length,sampleRate:rate,numberOfChannels:1});const d=b.getChannelData(0);for(let i=0;i<length;i++)d[i]=.3*Math.sin(i/rate*frequency*2*Math.PI);return b;};
  const rms=b=>Math.sqrt(b.getChannelData(0).slice(4000).reduce((s,x)=>s+x*x,0)/(length-4000));
  const low=rms(new RetroAudioProcessor('cassette',7).process(signal(440),0));
  const high=rms(new RetroAudioProcessor('cassette',7).process(signal(10000),0));
  const source=signal(440),whole=new RetroAudioProcessor('vhs',5).process(source,0).getChannelData(0),processor=new RetroAudioProcessor('vhs',5),split=[];
  for(let offset=0;offset<length;offset+=4000){const b=new AudioBuffer({length:4000,sampleRate:rate,numberOfChannels:1});b.copyToChannel(source.getChannelData(0).slice(offset,offset+4000),0);split.push(...processor.process(b,offset/rate).getChannelData(0));}
  const repeated=new RetroAudioProcessor('vhs',5).process(source,0).getChannelData(0);
  return {low,high,continuous:whole.every((x,i)=>x===split[i]),repeat:whole.every((x,i)=>x===repeated[i]),length:whole.length,peak:Math.max(...whole)};
 });
 assert.ok(result.low>.1);assert.ok(result.high<result.low*.35);assert.ok(result.continuous);assert.ok(result.repeat);assert.equal(result.length,32000);assert.ok(result.peak<.95);
 console.log('PASS: retro band limitation, bounded level, identical duration, deterministic noise, continuous chunk processing',result);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

