const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8087/');
 const result=await page.evaluate(async()=>{
  const M=await import('./vendor/mediabunny/mediabunny.min.mjs');const E=await import('./js/video-export.js?v=20261024-5');const {processFrame}=await import('./js/effects.js?v=20261024-5');const {presets}=await import('./js/presets.js?v=20261024-5');
  const active=new Set();for(const name of ['VideoEncoder','VideoDecoder','AudioEncoder','AudioDecoder']){const proto=globalThis[name].prototype,configure=proto.configure,close=proto.close;proto.configure=function(...args){const v=configure.apply(this,args);active.add(this);return v;};proto.close=function(...args){try{return close.apply(this,args);}finally{active.delete(this);}};}
  async function fixture(audio,rotation=0,codec='aac',width=160,height=240){
   const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');const out=new M.Output({format:new M.Mp4OutputFormat(),target:new M.BufferTarget()});
   const video=new M.CanvasSource(c,{codec:'avc',quality:new M.Quality({bitrate:300000})});out.addVideoTrack(video,{rotation});
   const a=audio?new M.AudioBufferSource({codec,quality:new M.Quality({bitrate:128000})}):null;if(a)out.addAudioTrack(a);
   const fps=width>160?5:12;
   await out.start();await Promise.all([(async()=>{for(let i=0;i<fps*6;i++){ctx.fillStyle='#448899';ctx.fillRect(0,0,width,height);ctx.fillStyle='#dd7733';ctx.fillRect(20,30,50,50);ctx.fillStyle='#fff';ctx.fillRect(100,190,30,25);await video.add(i/fps,1/fps);}video.close();})(),(async()=>{if(a){const buffer=new AudioBuffer({length:48000*6,sampleRate:48000,numberOfChannels:1}),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.sin(i/48000*440*2*Math.PI)*.2;await a.add(buffer);a.close();}})()]);await out.finalize();c.width=c.height=0;return new File([out.target.buffer],audio?'sound.mov':'silent.mp4',{type:'video/mp4'});
  }
  async function metadata(file,predict=false){const input=new M.Input({source:new M.BlobSource(file),formats:M.ALL_FORMATS});try{const v=await input.getPrimaryVideoTrack(),a=await input.getPrimaryAudioTrack();const canvas=await new M.CanvasSink(v).getCanvas(1);const ctx=canvas.canvas.getContext('2d'),pixel=Array.from(ctx.getImageData(80,100,1,1).data);let expected=null;if(predict){const effected=processFrame(canvas.canvas,canvas.canvas.width,canvas.canvas.height,presets[7].values,123,1);expected=Array.from(effected.getContext('2d').getImageData(80,100,1,1).data);effected.width=effected.height=0;}const marker=Array.from(ctx.getImageData(185,45,1,1).data);const first=a?await new M.EncodedPacketSink(a).getFirstPacket():null;let rms=null;if(a){const sample=await new M.AudioSampleSink(a).getSample(1);const data=sample.toAudioBuffer().getChannelData(0);rms=Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);sample.close();}return {w:await v.getDisplayWidth(),h:await v.getDisplayHeight(),rotation:await v.getRotation(),vcodec:await v.getCodec(),acodec:a?await a.getCodec():null,duration:await input.computeDuration(),pixel,expected,marker,videoStart:await v.getFirstTimestamp(),audioStart:a?await a.getFirstTimestamp():null,audioPacket:first?[...first.data]:null,rms,sampleRate:a?await a.getSampleRate():null,channels:a?await a.getNumberOfChannels():null};}finally{input.dispose();}}
  const tests=[];
  for(const audio of [false,true]){
   const file=await fixture(audio),progress=[];const options={file,parameters:{...presets[7].values},intensity:1,seed:123,resolution:'720',quality:'high',onProgress:p=>progress.push(p)};
   const output=await E.exportVideo(options),meta=await metadata(output.file),original=await metadata(file,true);
   tests.push({audio,bytes:output.file.size,name:output.file.name,type:output.file.type,meta,original,progress,frames:output.frames});
   if(audio)globalThis.exportFixture=file;
  }
  const rotationFile=await fixture(false,90),rotated=await E.exportVideo({file:rotationFile,parameters:presets[0].values,intensity:0,seed:1});const rotation=await metadata(rotated.file);
  const controller=new AbortController();let cancelled=false;
  try{await E.exportVideo({file:exportFixture,parameters:presets[4].values,intensity:1,seed:123,signal:controller.signal,onProgress:p=>{if(p>.05)controller.abort();}});}catch(error){cancelled=error.name==='AbortError';}
  const retried=await E.exportVideo({file:exportFixture,parameters:{...presets[4].values,exposure:.6,handheld:.7},intensity:.8,seed:123});
  const retry=await metadata(retried.file);
  const opus=await fixture(true,0,'opus'),transcoded=await E.exportVideo({file:opus,parameters:presets[0].values,intensity:.7,seed:123});const transcode=await metadata(transcoded.file);
  await new Promise(r=>setTimeout(r,100));
  const {exportDimensions}=await import('./js/video-capabilities.js?v=20261024-5');
  const dimensions=[exportDimensions(3840,2160,'1080'),exportDimensions(2160,3840,'720'),exportDimensions(400,600,'720')];
  const full=await fixture(false,0,'aac',1080,1920),highResolution=[];
  for(const resolution of ['1080','720']){const encoded=await E.exportVideo({file:full,parameters:presets[4].values,intensity:.7,seed:321,resolution});const info=await metadata(encoded.file);highResolution.push({width:info.w,height:info.h,duration:info.duration});}
  const retroAudio=[];for(const audioMode of ['cassette','vhs','radio']){const encoded=await E.exportVideo({file:exportFixture,parameters:presets[0].values,intensity:.7,seed:123,audioMode});retroAudio.push({mode:audioMode,meta:await metadata(encoded.file)});}
  const silentRetro=await E.exportVideo({file:await fixture(false),parameters:presets[0].values,intensity:1,seed:1,audioMode:'radio'});const silentMeta=await metadata(silentRetro.file);
  const nativeEncoder=globalThis.VideoEncoder;let unsupported=false;try{globalThis.VideoEncoder=undefined;await E.exportVideo({file:exportFixture,parameters:presets[0].values,intensity:1,seed:1});}catch(error){unsupported=error.message.includes('WebCodecs')&&!error.report.h264Encoder;}finally{globalThis.VideoEncoder=nativeEncoder;}
  await new Promise(r=>setTimeout(r,100));return {retroAudio,silentMeta,tests,rotation,cancelled,retry,transcode,dimensions,highResolution,unsupported,activeCodecs:active.size,capability:await E.inspectVideoExport(exportFixture)};
 });
 assert.equal(result.silentMeta.acodec,null);for(const [i,t] of result.retroAudio.entries()){assert.equal(t.meta.acodec,'aac');assert.ok([[32000,24000,16000][i],48000].includes(t.meta.sampleRate));assert.equal(t.meta.channels,1);assert.ok(t.meta.rms>.02);assert.ok(Math.abs(t.meta.duration-6)<.2);assert.ok(Math.abs(t.meta.audioStart-t.meta.videoStart)<.08);}
 for(const t of result.tests){assert.equal(t.type,'video/mp4');assert.ok(t.name.endsWith('_retro.mp4'));assert.ok(t.bytes>1000);assert.equal(t.meta.vcodec,'avc');assert.equal(t.meta.w,160);assert.equal(t.meta.h,240);assert.ok(Math.abs(t.meta.duration-6)<.2);assert.ok(t.progress.some(v=>v>0&&v<1));assert.equal(t.progress.at(-1),1);assert.ok(t.meta.pixel.slice(0,3).every(v=>Math.abs(v-t.meta.pixel[0])<5));assert.ok(t.meta.pixel.slice(0,3).every((v,i)=>Math.abs(v-t.original.expected[i])<15));assert.ok(Math.abs(t.meta.videoStart-t.original.videoStart)<.05);if(t.audio){assert.ok(Math.abs(t.meta.audioStart-t.original.audioStart)<.05);assert.equal(t.meta.acodec,'aac');assert.ok(t.meta.rms>.05);assert.deepEqual(t.meta.audioPacket,t.original.audioPacket);}else assert.equal(t.meta.acodec,null);}
 assert.equal(result.rotation.w,240);assert.equal(result.rotation.h,160);assert.equal(result.rotation.rotation,0);assert.ok(result.rotation.marker[0]>170&&result.rotation.marker[1]<160);assert.ok(result.cancelled);assert.equal(result.retry.acodec,'aac');assert.equal(result.transcode.acodec,'aac');assert.ok(result.transcode.rms>.05);assert.equal(result.activeCodecs,0);assert.deepEqual(errors,[]);
 assert.deepEqual(result.dimensions,[{width:1920,height:1080},{width:720,height:1280},{width:400,height:600}]);assert.ok(result.unsupported);
 assert.deepEqual(result.highResolution.map(r=>[r.width,r.height]),[[1080,1920],[720,1280]]);assert.ok(result.highResolution.every(r=>Math.abs(r.duration-6)<.2));
 console.log('PASS: 6s silent/audio MP4, H264/AAC, exact AAC first-packet copy and audible output, progress, B&W/VHS/adjustments, rotation baked, cancel/retry, all codecs closed');console.log(JSON.stringify({capability:result.capability,rotation:result.rotation,activeCodecs:result.activeCodecs}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
