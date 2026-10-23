import {Input,BlobSource,ALL_FORMATS,Output,Mp4OutputFormat,BufferTarget,Conversion,Quality} from '../vendor/mediabunny/mediabunny.min.mjs';
import {processFrame} from './effects.js?v=20261018-1';
import {capabilityReport,exportDimensions} from './video-capabilities.js?v=20261019-2';

const aborted=signal=>{if(signal?.aborted)throw new DOMException('書き出しをキャンセルしました。','AbortError');};
export async function inspectVideoExport(file,resolution='1080'){
  const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
  try{
    const video=await input.getPrimaryVideoTrack();if(!video)throw new Error('映像トラックがありません。');
    const width=await video.getDisplayWidth(),height=await video.getDisplayHeight();
    let fps=30;try{const rate=(await video.computePacketStats(120)).averagePacketRate;if(Number.isFinite(rate)&&rate>0)fps=Math.min(60,rate);}catch{}
    const dimensions=exportDimensions(width,height,resolution),audio=await input.getPrimaryAudioTrack();
    const report=await capabilityReport(dimensions.width,dimensions.height,fps);
    return {...report,input:{width,height,codec:await video.getCodec(),canDecode:await video.canDecode(),duration:await input.computeDuration(),frameRate:fps,audioCodec:audio?await audio.getCodec():null,hasAudio:!!audio},output:{...dimensions,frameRate:fps,format:'video/mp4'}};
  }finally{input.dispose();}
}

export async function exportVideo({file,parameters,intensity,seed,resolution='1080',quality='standard',signal,onProgress=()=>{},onReport=()=>{}}){
  aborted(signal);const report=await inspectVideoExport(file,resolution);onReport(report);aborted(signal);
  if(!report.VideoEncoder||!report.VideoDecoder||!report.h264Encoder||!report.input.canDecode){
    const e=new Error('この環境では、この動画のデコードまたはH.264 MP4書き出しに必要なWebCodecsを利用できません。能力レポートを確認してください。WebMへの自動変更は行いません。');e.report=report;throw e;
  }
  const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
  const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target});
  const snapshot=Object.freeze({...parameters}),{width,height,frameRate}=report.output;
  let conversion=null,processed=null,cancelTask=null,frames=0,completed=false;
  const scratch=document.createElement('canvas');scratch.width=width;scratch.height=height;
  const context=scratch.getContext('2d');if(!context){input.dispose();throw new Error('動画書き出し用Canvasを作成できません。');}
  const cancel=()=>{if(conversion)cancelTask=conversion.cancel().catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const videoTrack=await input.getPrimaryVideoTrack(),audioTrack=await input.getPrimaryAudioTrack();
    // AAC packets are copied where possible. Other audio must encode to AAC;
    // never accept a silently discarded source audio track.
    conversion=await Conversion.init({input,output,tracks:'primary',tags:{},
      video:{codec:'avc',width,height,fit:'fill',frameRate,allowTransformationMetadata:false,forceTranscode:true,quality:new Quality(quality==='high'?'high':'medium'),keyFrameInterval:2,
        process:async sample=>{
          aborted(signal);
          if(processed){processed.width=processed.height=0;processed=null;}
          context.clearRect(0,0,width,height);sample.draw(context,0,0,width,height);
          // Preview currently uses this fixed seed at every media timestamp.
          // Keep the same deterministic policy rather than wall-clock randomness.
          processed=processFrame(scratch,width,height,snapshot,seed,intensity);
          frames++;await new Promise(resolve=>setTimeout(resolve,0));
          aborted(signal);return processed;
        }},
      audio:{codec:'aac'},
    });
    aborted(signal);
    const lost=conversion.discardedTracks.filter(t=>t.track.id===videoTrack.id||audioTrack&&t.track.id===audioTrack.id);
    if(!conversion.isValid||lost.length)throw new Error(`音声・映像を保持したMP4を生成できません。${lost.map(t=>t.reason).join(', ')}`);
    onReport({...report,path:'WebCodecs → shared processFrame → H.264/AAC MP4',audioMode:audioTrack?(report.input.audioCodec==='aac'?'AAC packet copy preferred':'AAC transcode'):'no source audio'});
    onProgress(0,0,report.input.duration);
    conversion.onProgress=value=>{if(!signal?.aborted)onProgress(Math.min(.99,value),value*report.input.duration,report.input.duration);};
    await conversion.execute();aborted(signal);
    if(!target.buffer?.byteLength)throw new Error('MP4出力が空です。');
    const blob=new Blob([target.buffer],{type:'video/mp4'}),name=(file.name.replace(/\.[^.]+$/,'')||'video')+'_retro.mp4';
    const result={file:new File([blob],name,{type:'video/mp4'}),report,frames};completed=true;onProgress(1,report.input.duration,report.input.duration);return result;
  }catch(error){if(signal?.aborted)throw new DOMException('書き出しをキャンセルしました。','AbortError');throw error;}
  finally{
    signal?.removeEventListener('abort',cancel);if(cancelTask)await cancelTask;
    if(conversion&&!completed)await conversion.cancel().catch(()=>{});
    if(processed)processed.width=processed.height=0;scratch.width=scratch.height=0;
    input.dispose();target.buffer=null;
  }
}
