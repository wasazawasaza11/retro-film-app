const unit=(v,f)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):f;
export function normalizeSync(value){return {enabled:value?.enabled===true,shift:unit(value?.shift,.35),wave:unit(value?.wave,.45),thickness:unit(value?.thickness,.5),frequency:unit(value?.frequency,.5),duration:Number.isFinite(value?.duration)?Math.max(.1,Math.min(3,value.duration)):1,bleed:unit(value?.bleed,.3)};}
const noise=(seed,n)=>{let x=Math.imul(seed^(n+1),1597334677);x=Math.imul(x^(x>>>16),2246822507);return (x>>>0)/4294967296;};
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function smooth(seed,t){const n=Math.floor(t),u=ease(t-n);return (noise(seed,n)*(1-u)+noise(seed,n+1)*u)*2-1;}
export function syncState(seed,time,settings){
  const p=normalizeSync(settings),t=Math.max(0,Number.isFinite(time)?time:0),period=p.duration+.6,slot=Math.floor(t/period);
  if(!p.enabled||!p.frequency||noise(seed^31,slot)>=p.frequency)return {active:false,gain:0,shift:0,phase:0,span:.1};
  const start=slot*period+noise(seed^59,slot)*.3,length=p.duration*(.6+.4*noise(seed^71,slot)),age=t-start;
  if(age<0||age>=length)return {active:false,gain:0,shift:0,phase:0,span:.1};
  const gain=ease(age/Math.min(.12,length*.2))*ease((length-age)/Math.min(.15,length*.2));
  return {active:true,gain,shift:smooth(seed^97,t*12)*p.shift*.012*gain,phase:noise(seed^113,slot)*Math.PI*2+age*8,span:.025+p.thickness*.575};
}
export function syncRowShift(y,h,w,state,settings){
  const p=normalizeSync(settings);if(!state.active)return 0;
  return w*(state.shift+p.wave*.12*state.gain*(Math.sin(y/h/state.span*Math.PI*2+state.phase)*.8+Math.sin(y/h/state.span*Math.PI*3.1-state.phase*.6)*.2));
}
export function applySyncDistortion(ctx,w,h,seed,time,settings){
  const p=normalizeSync(settings),state=syncState(seed,time,p);
  if(!state.active||(!p.shift&&!p.wave&&!p.bleed))return;
  const image=ctx.getImageData(0,0,w,h),data=image.data,row=new Uint8ClampedArray(w*4);
  const sample=(x,c)=>{x=Math.max(0,Math.min(w-1,x));const a=Math.floor(x),b=Math.min(w-1,a+1),t=x-a;return row[a*4+c]*(1-t)+row[b*4+c]*t;};
  for(let y=0;y<h;y++){
    const offset=y*w*4,shift=syncRowShift(y,h,w,state,p);row.set(data.subarray(offset,offset+w*4));
    const trail=w*.018*p.bleed*state.gain,mix=p.bleed*.35*state.gain;
    for(let x=0;x<w;x++)for(let c=0;c<3;c++)data[offset+x*4+c]=sample(x-shift,c)*(1-mix)+sample(x-shift-trail,c)*mix;
  }
  // Clamp edge sampling instead of wrapping or revealing transparent strips.
  ctx.putImageData(image,0,0);
}
