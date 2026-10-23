import {randomFromSeed} from './effects.js?v=20261024-3';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const noise=(seed,slot)=>randomFromSeed((seed^Math.imul(slot+1,1640531527))>>>0)();
function drift(seed,time){const i=Math.floor(time),u=time-i,s=u*u*(3-2*u);return noise(seed,i)*(1-s)+noise(seed,i+1)*s;}

// Small, bounded scene probe. Brightness compensation keeps a light change
// from being mistaken for camera translation. No frames accumulate here.
export class VideoEffectAnalyzer{
  constructor(){this.canvas=document.createElement('canvas');this.canvas.width=32;this.canvas.height=24;this.context=this.canvas.getContext('2d',{willReadFrequently:true});this.reset();}
  reset(){this.previous=null;this.time=null;this.metrics={brightness:.5,brightnessChange:0,motion:0,motionX:0,motionY:0};}
  analyze(source,time){
    if(time===this.time)return this.metrics;
    const ctx=this.context;ctx.drawImage(source,0,0,32,24);const rgba=ctx.getImageData(0,0,32,24).data,luma=new Float32Array(768);let mean=0;
    for(let i=0;i<768;i++){luma[i]=(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])/255;mean+=luma[i]/768;}
    const dt=time-this.time;let mx=0,my=0,motion=0,change=0;
    if(this.previous&&dt>0&&dt<=.6){
      const delta=mean-this.metrics.brightness;change=clamp(delta/dt,-1,1);
      let best=Infinity,bestX=0,bestY=0;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        let error=0;
        for(let y=3;y<21;y+=2)for(let x=3;x<29;x+=2)error+=Math.abs(luma[y*32+x]-this.previous[(y-dy)*32+x-dx]-delta)/117;
        error+=(Math.abs(dx)+Math.abs(dy))*.0002;
        if(error<best){best=error;bestX=dx;bestY=dy;}
      }
      mx=clamp(bestX/32/dt,-2,2);my=clamp(bestY/24/dt,-2,2);
      motion=clamp(Math.hypot(mx,my)*.25+best*1.5,0,1);
    }
    this.previous=luma;this.time=time;return this.metrics={brightness:mean,brightnessChange:change,motion,motionX:mx,motionY:my};
  }
  dispose(){this.reset();this.canvas.width=this.canvas.height=0;this.context=null;}
}

// Independent media-time clocks avoid full-frame random flicker. Scratches
// change about 3x/sec; dust persists ~1.1sec; reflections drift over seconds.
export function videoEffectState(seed,time,scene){
  const t=Math.max(0,Number.isFinite(time)?time:0),motion=scene.motion||0;
  const scratchSlot=Math.floor(t*3),dustSlot=Math.floor(t/1.1);
  return {
    tapeSeed:(seed^Math.imul(Math.floor(t*30)+1,2246822519))>>>0,
    grainSeed:(seed^Math.imul(Math.floor(t*12)+1,374761393))>>>0,
    scratchSeed:(seed^Math.imul(scratchSlot+1,668265263))>>>0,
    dustSeed:(seed^Math.imul(dustSlot+1,1274126177))>>>0,
    grainGain:.88+.12*drift(seed^23,t*2)+.1*motion,
    scratchGain:noise(seed^43,scratchSlot)>.25?.45+.5*noise(seed^61,scratchSlot):0,
    dustGain:.6+.3*noise(seed^59,dustSlot),
    offsetX:.003*Math.sin(t*1.4)+scene.motionX*.0015,
    offsetY:.002*Math.sin(t*.8)+scene.motionY*.001,
    leakX:noise(seed^183,0)<.5?-.04+.1*drift(seed^19,t/3):.94+.1*drift(seed^19,t/3),
    leakY:.2+.6*drift(seed^71,t/4)+scene.motionY*.002,
    leakGain:.75+.2*drift(seed^79,t/2)+.08*(scene.brightness||0)+.08*motion,
    exposureDelta:.012*(drift(seed^83,t*1.5)-.5)+.008*(scene.brightnessChange||0),
    rgbGain:1+.08*(drift(seed^89,t*3)-.5)+.06*motion,
    scene,
  };
}
