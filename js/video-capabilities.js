const mimeCandidates=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm'];
export function exportDimensions(width,height,resolution){
  const edge=({original:Infinity,'1080':1920,'720':1280,'480':854,'360':640,'240':426})[resolution]??1280;
  const factor=Math.min(1,edge/Math.max(width,height));
  // H.264 4:2:0 requires even dimensions. Never upscale a smaller input.
  return {width:Math.max(2,Math.floor(width*factor/2)*2),height:Math.max(2,Math.floor(height*factor/2)*2)};
}
export function exportFrameRate(sourceRate,limit='source'){
  const rate=Number.isFinite(sourceRate)&&sourceRate>0?sourceRate:30;
  return Math.min(rate,60,limit==='source'?60:Math.max(1,Number(limit)||30));
}
export async function capabilityReport(width=720,height=1280,frameRate=30){
  const report={secureContext:globalThis.isSecureContext};
  for(const name of ['VideoEncoder','VideoDecoder','AudioEncoder','AudioDecoder','MediaRecorder','MediaStreamTrackProcessor','MediaStreamTrackGenerator'])report[name]=typeof globalThis[name]==='function';
  report['canvas.captureStream']=typeof HTMLCanvasElement.prototype.captureStream==='function';
  report.requestVideoFrameCallback=typeof HTMLVideoElement.prototype.requestVideoFrameCallback==='function';
  report.h264Configs=[];
  for(const codec of ['avc1.420033','avc1.640033']){
    const config={codec,width,height,framerate:frameRate,bitrate:Math.max(500000,Math.round(width*height*frameRate*.12)),avc:{format:'avc'}};
    let supported=false;try{supported=report.VideoEncoder&&(await VideoEncoder.isConfigSupported(config)).supported;}catch{}
    report.h264Configs.push({config,supported});
  }
  report.h264Encoder=report.h264Configs.some(c=>c.supported);
  report.aacEncoder=false;
  try{report.aacEncoder=report.AudioEncoder&&(await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:128000})).supported;}catch{}
  report.mediaRecorderMime=Object.fromEntries(mimeCandidates.map(type=>{let supported=false;try{supported=report.MediaRecorder&&MediaRecorder.isTypeSupported(type);}catch{}return [type,supported];}));
  return report;
}
