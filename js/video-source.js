import {createSeed} from './image-loader.js?v=20261024-2';

// One local media element and one pending callback; never retain decoded frames.
export async function loadVideo(file,debug){
  const element=document.createElement('video'),url=URL.createObjectURL(file);
  element.playsInline=true;element.preload='auto';element.setAttribute('playsinline','');
  // Keep the decoder attached (including on iOS), without a second visible preview.
  element.className='video-decoder';element.setAttribute('aria-hidden','true');
  document.body.append(element);
  let released=false,metadata=false;
  const release=()=>{if(released)return;released=true;element.pause();element.removeAttribute('src');element.load();element.remove();URL.revokeObjectURL(url);};
  try{
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>finish(new Error('動画の読込がタイムアウトしました。')),30000);
      const finish=error=>{clearTimeout(timeout);element.removeEventListener('loadedmetadata',onMetadata);element.removeEventListener('canplay',onReady);element.removeEventListener('error',onError);error?reject(error):resolve();};
      const onMetadata=()=>{metadata=true;debug?.info(`video loadedmetadata: ${element.videoWidth}x${element.videoHeight}; duration=${element.duration}`);if(!element.videoWidth||!element.videoHeight||!Number.isFinite(element.duration)||element.duration<=0)finish(new Error('動画のサイズ・長さを取得できませんでした。'));};
      const onReady=()=>{if(metadata){debug?.info('video canplay');finish();}};
      const onError=()=>finish(new Error(`この動画を再生できません。形式・コーデックを確認してください。（${element.error?.code??'unknown'}）`));
      element.addEventListener('loadedmetadata',onMetadata);element.addEventListener('canplay',onReady);element.addEventListener('error',onError);
      debug?.info('video objectURL created; load start');element.src=url;element.load();
    });
    return {file,source:element,width:element.videoWidth,height:element.videoHeight,duration:element.duration,seed:createSeed(),release};
  }catch(error){release();throw error;}
}

export class VideoPlayback{
  constructor(media,onFrame,onTime,onError){
    this.media=media;this.element=media.source;this.onFrame=onFrame;this.onTime=onTime;this.onError=onError;this.callback=null;this.running=false;this.disposed=false;
    this.method=typeof this.element.requestVideoFrameCallback==='function'?'video-frame':'animation-frame';
    this.update=()=>{if(!this.disposed)this.onTime(this.element);};
    this.seeked=()=>{if(!this.disposed){this.onFrame();this.update();}};
    this.started=()=>{this.running=true;this.queue();this.update();};
    this.stopped=()=>{this.running=false;this.cancel();this.update();};
    this.failed=()=>{this.stopped();this.onError(new Error('動画の再生中にエラーが発生しました。'));};
    for(const [name,handler] of this.events())this.element.addEventListener(name,handler);
  }
  events(){return [['playing',this.started],['pause',this.stopped],['ended',this.stopped],['timeupdate',this.update],['seeked',this.seeked],['error',this.failed]];}
  queue(){
    if(this.callback!==null||!this.running||this.disposed)return;
    const tick=()=>{this.callback=null;if(!this.running||this.disposed)return;if(!this.element.seeking&&this.element.readyState>=2&&(this.method==='video-frame'||this.lastTime!==this.element.currentTime)){this.lastTime=this.element.currentTime;this.onFrame();}this.update();this.queue();};
    this.callback=this.method==='video-frame'?this.element.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
  }
  cancel(){if(this.callback===null)return;if(this.method==='video-frame')this.element.cancelVideoFrameCallback(this.callback);else cancelAnimationFrame(this.callback);this.callback=null;}
  async play(){try{await this.element.play();}catch(error){if(!this.disposed)this.onError(error);}}
  pause(){this.element.pause();this.stopped();}
  seek(time){if(!this.disposed)this.element.currentTime=Math.max(0,Math.min(this.media.duration,time));}
  dispose(){this.disposed=true;this.running=false;this.cancel();for(const [name,handler] of this.events())this.element.removeEventListener(name,handler);this.element.pause();}
}

