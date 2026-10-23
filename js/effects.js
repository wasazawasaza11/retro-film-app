import {applyVhs} from './vhs-effects.js?v=20261024-4';
const clamp=v=>Math.max(0,Math.min(255,v));
export function randomFromSeed(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function applyColorAdjustments(data,p){const gain=2**p.exposure;for(let i=0;i<data.length;i+=4){let r=data[i]*gain,g=data[i+1]*gain,b=data[i+2]*gain;const l=.2126*r+.7152*g+.0722*b;r=l+(r-l)*p.saturation+22*p.temperature;g=l+(g-l)*p.saturation+4*p.temperature;b=l+(b-l)*p.saturation-22*p.temperature;data[i]=clamp(((r-128)*p.contrast+128)*(1-p.fade*.35)+p.fade*34);data[i+1]=clamp(((g-128)*p.contrast+128)*(1-p.fade*.35)+p.fade*31);data[i+2]=clamp(((b-128)*p.contrast+128)*(1-p.fade*.35)+p.fade*28);}}
export function applyRgbShift(data,w,h,amount){if(!amount)return;const shift=Math.round(amount*w*.009);if(!shift)return;const copy=new Uint8ClampedArray(data);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;data[i]=copy[(y*w+Math.max(0,x-shift))*4];data[i+2]=copy[(y*w+Math.min(w-1,x+shift))*4+2];}}
export function applyGrain(data,w,h,amount,seed){if(!amount)return;for(let y=0;y<h;y++)for(let x=0;x<w;x++){// Coordinate hash keeps grain stable across repeated frame renders.
  let n=Math.imul(Math.floor(x/w*2400)+1,374761393)^Math.imul(Math.floor(y/h*2400)+1,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);const grain=(((n>>>0)/4294967296)-.5)*amount*65,i=(y*w+x)*4;for(let c=0;c<3;c++)data[i+c]=clamp(data[i+c]+grain);
}}
export function applyVignette(data,w,h,amount){if(!amount)return;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=((x/w-.5)**2+(y/h-.5)**2)*2,m=1-amount*Math.min(1,d)*.85,i=(y*w+x)*4;for(let c=0;c<3;c++)data[i+c]*=m;}}
export function applyLightLeak(ctx,w,h,amount,seed,temporal=null){if(!amount)return;const r=randomFromSeed(seed^183),x=temporal?temporal.leakX*w:(r()<.5?0:w),y=temporal?temporal.leakY*h:r()*h;ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=amount;const g=ctx.createRadialGradient(x,y,0,x,y,w*.85);g.addColorStop(0,'#ffad69');g.addColorStop(.35,'#bd352c88');g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();}
export function applyScratches(ctx,w,h,amount,seed){const r=randomFromSeed(seed^381);ctx.save();ctx.strokeStyle='#eee1c2';ctx.lineWidth=Math.max(.5,w/1600);for(let n=0;n<18;n++){const x=r()*w,y=r()*h,length=(.1+r()*.6)*h;ctx.globalAlpha=amount*(.12+r()*.25);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.003,y+length);ctx.stroke();}ctx.restore();}
export function applyDust(ctx,w,h,amount,seed){const r=randomFromSeed(seed^915);ctx.save();for(let n=0;n<100;n++){const x=r()*w,y=r()*h,size=(.3+r()*1.6)*w/1000;ctx.globalAlpha=amount*(.2+r()*.5);ctx.fillStyle=n%3?'#e7dec7':'#27221c';ctx.beginPath();ctx.arc(x,y,Math.max(.3,size),0,Math.PI*2);ctx.fill();}ctx.restore();}
// Accepts any drawable frame, independent of files and UI. A video adapter can
// provide its own frame source and explicit seed without changing this pipeline.
export function processFrame(source,w,h,parameters,seed,intensity=1,temporal=null){
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvasを作成できませんでした。');
  ctx.drawImage(source,0,0,w,h);if(intensity<=0)return canvas;
  const p=temporal?{...parameters,exposure:parameters.exposure+temporal.exposureDelta,rgbShift:Math.min(1,parameters.rgbShift*temporal.rgbGain)}:parameters;
  const image=ctx.getImageData(0,0,w,h),original=intensity<1?new Uint8ClampedArray(image.data):null;applyColorAdjustments(image.data,p);applyRgbShift(image.data,w,h,p.rgbShift);applyGrain(image.data,w,h,p.grain*(temporal?.grainGain??1),temporal?.grainSeed??seed);applyVignette(image.data,w,h,p.vignette);if(temporal&&p.vhs)applyVhs(image.data,w,h,p.vhs,temporal.tapeSeed);ctx.putImageData(image,0,0);
  applyLightLeak(ctx,w,h,p.lightLeak*(temporal?.leakGain??1),seed,temporal);
  if(temporal){ctx.save();ctx.translate(temporal.offsetX*w,temporal.offsetY*h);}
  applyScratches(ctx,w,h,p.scratches*(temporal?.scratchGain??1),temporal?.scratchSeed??seed);applyDust(ctx,w,h,p.dust*(temporal?.dustGain??1),temporal?.dustSeed??seed);
  if(temporal)ctx.restore();
  if(parameters.monochrome){const gray=ctx.getImageData(0,0,w,h);applyMonochrome(gray.data,parameters.monochrome);ctx.putImageData(gray,0,0);}
  // Blend the complete effected frame with the original, not effect parameters.
  if(original){const effected=ctx.getImageData(0,0,w,h),t=Math.max(0,Math.min(1,intensity));for(let i=0;i<effected.data.length;i++)effected.data[i]=original[i]*(1-t)+effected.data[i]*t;ctx.putImageData(effected,0,0);}return canvas;
}

export function applyMonochrome(data,amount=1){for(let i=0;i<data.length;i+=4){const l=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];for(let c=0;c<3;c++)data[i+c]=data[i+c]*(1-amount)+l*amount;}}



