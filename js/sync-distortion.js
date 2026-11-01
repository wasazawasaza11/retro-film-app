const unit=(v,f)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):f;
export function normalizeSync(value){return {enabled:value?.enabled===true,shift:unit(value?.shift,.35),wave:unit(value?.wave,.45),thickness:unit(value?.thickness,.5),frequency:unit(value?.frequency,.5),duration:Number.isFinite(value?.duration)?Math.max(.1,Math.min(3,value.duration)):1,position:unit(value?.position,.55)};}
const noise=(seed,n)=>{let x=Math.imul(seed^(n+1),1597334677);x=Math.imul(x^(x>>>16),2246822507);return (x>>>0)/4294967296;};
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function smooth(seed,t){const n=Math.floor(t),u=ease(t-n);return (noise(seed,n)*(1-u)+noise(seed,n+1)*u)*2-1;}
export function syncState(seed,time,settings){
  const p=normalizeSync(settings),t=Math.max(0,Number.isFinite(time)?time:0),period=p.duration+.6,slot=Math.floor(t/period);
  if(!p.enabled||!p.frequency||noise(seed^31,slot)>=p.frequency)return {active:false,gain:0,shift:0,phase:0,span:.1};
  const start=slot*period+noise(seed^59,slot)*.3,length=p.duration*(.6+.4*noise(seed^71,slot)),age=t-start;
  if(age<0||age>=length)return {active:false,gain:0,shift:0,phase:0,span:.1};
  const gain=ease(age/Math.min(.12,length*.2))*ease((length-age)/Math.min(.15,length*.2));
  return {active:true,gain,shift:smooth(seed^97,t*12)*p.shift*.012*gain,phase:noise(seed^113,slot)*Math.PI*2+age*8,span:.06+p.thickness*.55,center:Math.max(.05,Math.min(.9,p.position+(noise(seed^149,slot)-.5)*.1)),direction:noise(seed^173,slot)<.5?-1:1};
}
export function syncRowShift(y,h,w,state,settings){
  const p=normalizeSync(settings);if(!state.active)return 0;
  const z=(y/h-state.center)/state.span;
  const fold=Math.exp(-(((z-.2)/.42)**2));
  const tail=z>0?Math.sin(z*5-state.phase*.2)*Math.exp(-z*2)*.18:0;
  return w*(state.shift+p.wave*.42*state.gain*state.direction*(fold+tail));
}
export function applySyncDistortion(ctx,w,h,seed,time,settings){
  const p=normalizeSync(settings),state=syncState(seed,time,p);
  if(!state.active||(!p.shift&&!p.wave))return;
  const image=ctx.getImageData(0,0,w,h),data=image.data,row=new Uint8ClampedArray(w*4);
  const sample=(x,c)=>{x=Math.max(0,Math.min(w-1,x));const a=Math.floor(x),b=Math.min(w-1,a+1),t=x-a;return row[a*4+c]*(1-t)+row[b*4+c]*t;};
  for(let y=0;y<h;y++){
    const offset=y*w*4,shift=syncRowShift(y,h,w,state,p);row.set(data.subarray(offset,offset+w*4));

    for(let x=0;x<w;x++)for(let c=0;c<3;c++)data[offset+x*4+c]=sample(x-shift,c);
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
