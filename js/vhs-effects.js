// Tape noise is evaluated in media time, so pause/seek reproduce the same frame.
export function applyVhs(data,w,h,amount,seed){
  if(!(amount>0))return;
  amount=Math.min(1,amount);
  const source=new Uint8ClampedArray(data),pixel=(x,y)=>((y*w+Math.max(0,Math.min(w-1,x)))*4);
  let state=(seed||1)>>>0;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const bleed=Math.max(1,Math.round(w/320)),jitter=Math.max(1,Math.round(w/500));
  const streakY=Math.floor(random()*h),streakStart=random()*w,streakLength=w*(.08+random()*.35);
  const streakOn=random()<.4,trackingOn=random()<.28;
  for(let y=0;y<h;y++){
    const bottom=y>h*.975&&trackingOn;
    const shift=Math.round((random()-.5)*jitter*amount+(bottom?(random()-.5)*w*.018*amount:0));
    const rowNoise=(random()-.5)*7*amount;
    const streak=streakOn&&Math.abs(y-streakY)<Math.max(1,h/700);
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4,j=pixel(x+shift,y),left=pixel(x+shift-bleed,y),right=pixel(x+shift+bleed,y);
      const l=.299*source[j]+.587*source[j+1]+.114*source[j+2];
      const ll=.299*source[left]+.587*source[left+1]+.114*source[left+2];
      const lr=.299*source[right]+.587*source[right+1]+.114*source[right+2];
      const red=source[left]-ll,blue=source[right+2]-lr;
      const shadow=1.25-.65*l/255;
      const noise=((random()-.5)*60*shadow+rowNoise)*amount;
      const colorNoise=(random()-.5)*22*amount;
      const dropout=streak&&x>streakStart&&x<streakStart+streakLength?45*amount:0;
      const r=l+red,b=l+blue,g=(l-.299*r-.114*b)/.587;
      data[i]=source[j]+(r-source[j])*.7*amount+noise+colorNoise+dropout;
      data[i+1]=source[j+1]+(g-source[j+1])*.7*amount+noise-colorNoise*.35+dropout;
      data[i+2]=source[j+2]+(b-source[j+2])*.7*amount+noise-colorNoise+dropout;
      // Alpha remains untouched, including at displaced image edges.
    }
  }
}
