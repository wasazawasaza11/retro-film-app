import {processFrame} from './effects.js?v=20261024-3';
import {cropFrame} from './crop.js?v=20261024-3';
import {incomingLens} from './lens.js?v=20261024-3';
import {VideoEffectAnalyzer,videoEffectState} from './video-effects.js?v=20261024-3';
export class Renderer {
  constructor(canvas,onDraw){if(!(canvas instanceof HTMLCanvasElement))throw new Error('Renderer: preview canvas DOM reference is invalid');this.canvas=canvas;this.onDraw=onDraw;this.request=0;this.pending=null;this.base=null;this.baseKey='';}
  initializePreview(image,debug){
    let operation='preview canvas resize';
    try{
      if(!image?.source||!image.width||!image.height)throw new Error('Source image or native dimensions are missing');
      const scale=Math.min(1,800/Math.max(image.width,image.height));
      this.canvas.width=Math.max(1,Math.round(image.width*scale));this.canvas.height=Math.max(1,Math.round(image.height*scale));
      this.canvas.hidden=false;this.onDraw(this.canvas.width,this.canvas.height);
      debug?.step('preview canvas resize');debug?.canvas(image.source,this.canvas);
      debug?.styles(this.canvas,'preview');debug?.styles(this.canvas.parentElement,'photo-view');
      if(!this.canvas.width||!this.canvas.height||!this.canvas.clientWidth||!this.canvas.clientHeight)throw new Error('Preview canvas has zero backing/display size; inspect photo-view and stage dimensions');
      operation='drawImage';const ctx=this.canvas.getContext('2d');if(!ctx)throw new Error('Preview 2D context is null');
      debug?.step('drawImage start');ctx.drawImage(image.source,0,0,this.canvas.width,this.canvas.height);debug?.step('drawImage success');
    }catch(error){debug?.error(operation,error);throw error;}
  }
  clear(){cancelAnimationFrame(this.request);this.request=0;this.pending=null;if(this.base)this.base.width=this.base.height=0;this.base=null;this.baseKey='';this.videoAnalyzer?.dispose();this.videoAnalyzer=null;}
  schedule(image,parameters,intensity,onError,{crop=null,transition=null,before=false,onComplete=null}={}){
    if(!image?.source||!image.width||!image.height)return;
    this.pending={image,parameters:{...parameters},intensity,onError,crop:crop?{...crop}:null,transition,before,onComplete};if(this.request)return;
    this.request=requestAnimationFrame(()=>{
      this.drawCount=(this.drawCount||0)+1;
      this.request=0;const job=this.pending;this.pending=null;let result,cropped,baseCrop;
      try{
        const video=job.image.source instanceof HTMLVideoElement;
        const scale=Math.min(1,(video?640:800)/Math.max(job.image.width,job.image.height));
        const w=Math.max(1,Math.round(job.image.width*scale)),h=Math.max(1,Math.round(job.image.height*scale));
        let temporal=null;
        if(video){this.videoAnalyzer??=new VideoEffectAnalyzer();const t=job.image.source.currentTime;temporal=videoEffectState(job.image.seed,t,this.videoAnalyzer.analyze(job.image.source,t));}
        result=processFrame(job.image.source,w,h,job.parameters,job.image.seed,job.before?0:job.intensity,temporal);
        cropped=job.crop?cropFrame(result,job.image.width,job.image.height,job.crop,800):null;
        const frame=cropped||result;
        if(this.canvas.width!==frame.width)this.canvas.width=frame.width;
        if(this.canvas.height!==frame.height)this.canvas.height=frame.height;
        const ctx=this.canvas.getContext('2d');ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        if(job.transition&&!job.before){
          const key=JSON.stringify([job.image.seed,w,h,job.transition.outside,job.intensity]);
          if(video||key!==this.baseKey){if(this.base)this.base.width=this.base.height=0;this.base=processFrame(job.image.source,w,h,job.transition.outside,job.image.seed,job.intensity,temporal);this.baseKey=key;}
          baseCrop=job.crop?cropFrame(this.base,job.image.width,job.image.height,job.crop,800):null;
          ctx.drawImage(baseCrop||this.base,0,0);const circle=incomingLens(frame.width,frame.height,job.transition.progress,job.transition.direction);
          ctx.save();ctx.beginPath();ctx.arc(circle.x,circle.y,circle.radius,0,Math.PI*2);ctx.clip();ctx.clearRect(0,0,frame.width,frame.height);ctx.drawImage(frame,0,0);ctx.restore();
        }else ctx.drawImage(frame,0,0);
        this.onDraw(frame.width,frame.height,job.transition);
        job.onComplete?.();
      }catch(error){job.onError(error);}finally{for(const c of [result,cropped,baseCrop])if(c)c.width=c.height=0;}
    });
  }
}




