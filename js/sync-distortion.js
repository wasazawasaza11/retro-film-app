const unit=(v,f)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):f;
export function normalizeSync(value){
  const position=unit(value?.position,.55),a=unit(value?.top,Math.max(0,position-.15)),b=unit(value?.bottom,Math.min(1,position+.15));
  return {enabled:value?.enabled===true,shift:unit(value?.shift,.35),wave:unit(value?.wave,.45),thickness:unit(value?.thickness,.5),frequency:unit(value?.frequency,.5),duration:Number.isFinite(value?.duration)?Math.max(.1,Math.min(3,value.duration)):1,top:Math.min(a,b),bottom:Math.max(a,b),colorNoise:unit(value?.colorNoise,.45),monochrome:unit(value?.monochrome,0)};
}
const noise=(seed,n)=>{let x=Math.imul(seed^(n+1),1597334677);x=Math.imul(x^(x>>>16),2246822507);return (x>>>0)/4294967296;};
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function smooth(seed,t){const n=Math.floor(t),u=ease(t-n);return (noise(seed,n)*(1-u)+noise(seed,n+1)*u)*2-1;}
export function syncState(seed,time,settings){
  const p=normalizeSync(settings),t=Math.max(0,Number.isFinite(time)?time:0),period=p.duration+.6,slot=Math.floor(t/period);
  if(!p.enabled||!p.frequency||noise(seed^31,slot)>=p.frequency)return {active:false,gain:0,shift:0,phase:0,span:.1};
  const start=slot*period+noise(seed^59,slot)*.3,length=p.duration*(.6+.4*noise(seed^71,slot)),age=t-start;
  if(age<0||age>=length)return {active:false,gain:0,shift:0,phase:0,span:.1};
  const gain=ease(age/Math.min(.12,length*.2))*ease((length-age)/Math.min(.15,length*.2));
  return {active:true,gain,shift:smooth(seed^97,t*12)*p.shift*.012*gain,phase:noise(seed^113,slot)*Math.PI*2+age*8,span:.015+p.thickness*.38,center:p.top+(p.bottom-p.top)*(.5+.5*smooth(seed^Math.imul(slot+1,149),t*2.2)),direction:noise(seed^173,slot)<.5?-1:1};
}
export function syncRowShift(y,h,w,state,settings){
  const p=normalizeSync(settings);if(!state.active)return 0;
  // A horizontal timing step followed by AFC re-lock over subsequent lines.
  // 480 virtual scanlines keep the sharp onset independent of export resolution.
  const line=(y/h-state.center)*480;
  if(line<0)return w*state.shift;
  const recoveryLines=Math.max(1,state.span*480);
  const onset=ease(line/1.5);
  const phaseError=state.direction*p.wave*.42*state.gain*onset*Math.exp(-line/recoveryLines);
  return w*(state.shift+phaseError);
}
export function applySyncDistortion(ctx,w,h,seed,time,settings){
  const p=normalizeSync(settings),state=syncState(seed,time,p);
  if(!state.active||(!p.shift&&!p.wave))return;
  const image=ctx.getImageData(0,0,w,h),data=image.data,row=new Uint8ClampedArray(w*4);
  const raw=p.colorNoise&&p.wave?new Uint8ClampedArray(data):null;
  const sample=(x,c)=>{x=Math.max(0,Math.min(w-1,x));const a=Math.floor(x),b=Math.min(w-1,a+1),t=x-a;return row[a*4+c]*(1-t)+row[b*4+c]*t;};
  const read=(x,y,c)=>{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,Math.round(y)));const a=Math.floor(x),b=Math.min(w-1,a+1),t=x-a,offset=y*w*4;return raw[offset+a*4+c]*(1-t)+raw[offset+b*4+c]*t;};
  const clock=Math.floor(Math.max(0,time)*24),key=seed^Math.imul(clock+1,997);
  for(let y=0;y<h;y++){
    const offset=y*w*4,shift=syncRowShift(y,h,w,state,p);row.set(data.subarray(offset,offset+w*4));
    const line=(y/h-state.center)*480,virtualLine=Math.floor(y/h*480),radius=3+p.colorNoise*7;
    const band=Math.exp(-line*line/(2*radius*radius))*Math.min(1,2.8*p.colorNoise*state.gain*Math.sqrt(p.wave));
    if(!raw||band<.002){for(let x=0;x<w;x++)for(let c=0;c<3;c++)data[offset+x*4+c]=sample(x-shift,c);continue;}
    // Model unstable line clocks and short dropout holds using source pixels.
    const rowError=(noise(key^313,virtualLine)*2-1)*w*.13*band;
    const clockScale=1+(noise(key^521,virtualLine)*2-1)*.65*band;
    for(let x=0;x<w;x++){
      const block=Math.floor(x/w*42),segment=virtualLine*43+block;
      const fault=noise(key^659,segment),hold=fault>.48;
      const sourceY=y+(hold?-1-Math.floor(noise(key^733,segment)*4):noise(key^797,segment)-.5)*h/480*band;
      const sourceShift=syncRowShift(sourceY,h,w,state,p);
      const address=(x-w/2)*clockScale+w/2-sourceShift+rowError+(fault-.5)*w*.08*band;
      const r=read(address,sourceY,0),g=read(address,sourceY,1),b=read(address,sourceY,2);
      const delay=w*.045*band*(noise(key^887,segment)*2-1);
      const cr=read(address-delay,sourceY,0),cg=read(address-delay,sourceY,1),cb=read(address-delay,sourceY,2);
      const luma=.299*r+.587*g+.114*b;
      const i=.596*cr-.274*cg-.322*cb,q=.211*cr-.523*cg+.312*cb;
      const phase=(noise(key^941,segment)*2-1)*2.2*band,cos=Math.cos(phase),sin=Math.sin(phase);
      const iq=i*cos-q*sin,qq=i*sin+q*cos;
      // Distort/recombine actual chroma; no additive grain or colored overlay.
      const mono=p.monochrome;
      const rr=(luma+.956*iq+.621*qq)*(1-mono)+luma*mono;
      const gg=(luma-.272*iq-.647*qq)*(1-mono)+luma*mono;
      const bb=(luma-1.106*iq+1.703*qq)*(1-mono)+luma*mono;
      data[offset+x*4]=sample(x-shift,0)*(1-band)+rr*band;
      data[offset+x*4+1]=sample(x-shift,1)*(1-band)+gg*band;
      data[offset+x*4+2]=sample(x-shift,2)*(1-band)+bb*band;
    }
  }
  // Clamp edge sampling instead of wrapping or revealing transparent strips.
  ctx.putImageData(image,0,0);
}

export function normalizeBleed(value){return {enabled:value?.enabled===true,amount:unit(value?.amount,.3),width:unit(value?.width,.5),frequency:unit(value?.frequency,.5),duration:Number.isFinite(value?.duration)?Math.max(.1,Math.min(3,value.duration)):1};}
export function applyVideoBleed(ctx,w,h,seed,time,settings){
  const p=normalizeBleed(settings),state=syncState(seed^751,time,p);
  if(!state.active||!p.amount||!p.width)return;
  const image=ctx.getImageData(0,0,w,h),data=image.data,row=new Uint8ClampedArray(w*4);
  const trail=w*.05*p.width*state.gain,mix=p.amount*.65*state.gain;
  for(let y=0;y<h;y++){
    const offset=y*w*4;row.set(data.subarray(offset,offset+w*4));
    for(let x=0;x<w;x++){
      const source=Math.max(0,x-trail),a=Math.floor(source),b=Math.min(w-1,a+1),t=source-a;
      for(let c=0;c<3;c++)data[offset+x*4+c]=row[x*4+c]*(1-mix)+(row[a*4+c]*(1-t)+row[b*4+c]*t)*mix;
    }
  }
  ctx.putImageData(image,0,0);
}
