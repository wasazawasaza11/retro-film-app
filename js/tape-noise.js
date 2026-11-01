const unit=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
export function normalizeTapeNoise(value){
  const top=unit(value?.top,0),bottom=unit(value?.bottom,1);
  return {enabled:value?.enabled===true,top:Math.min(top,bottom),bottom:Math.max(top,bottom),amount:unit(value?.amount,.7),size:unit(value?.size,.5),frequency:unit(value?.frequency,.5),distortion:unit(value?.distortion,.4)};
}
function random(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),s|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function tapeNoiseMarks(seed,time,settings){
  const p=normalizeTapeNoise(settings);
  if(!p.enabled||!p.amount||!p.frequency||p.bottom<=p.top)return [];
  const slot=Math.floor(Math.max(0,Number.isFinite(time)?time:0)*8),r=random(seed^Math.imul(slot+1,668265263));
  if(r()>p.frequency)return [];
  const marks=[],span=p.bottom-p.top;
  const colors=['#fff5e9','#e9eaff','#d5efff','#ff65dc','#41ffe0','#795fff'];
  const add=(x,y,w,h,opacity,color)=>{h=Math.min(h,span);marks.push({x,y:Math.max(p.top,Math.min(p.bottom-h,y)),w,h,opacity:p.amount*opacity,color});};
  // Sparse dropout dashes plus a dense, irregular colored tracking band.
  const count=8+Math.floor(r()*28);
  for(let i=0;i<count;i++)add(r(),p.top+r()*span,.004+r()*.075*(.2+p.size),.0007+r()*.0025*(.2+p.size),.2+r()*.7,colors[Math.floor(r()*colors.length)]);
  if(r()<.8){
    const height=Math.min(span,(.006+r()*.075)*(.2+p.size)),y=p.top+r()*Math.max(0,span-height);
    const count=80+Math.floor(250*p.size*r());
    for(let i=0;i<count;i++){
      const row=r(),edge=Math.sin(Math.PI*row);
      add(r(),y+row*height,.002+r()*.035*(.3+p.size),.0006+r()*.0035*(.2+p.size),(.12+r()*.75)*edge,colors[Math.floor(r()*colors.length)]);
    }
  }
  return marks;
}
export function tapeDistortionRows(w,h,seed,time,settings,marks=tapeNoiseMarks(seed,time,settings)){
  const p=normalizeTapeNoise(settings),rows=new Float32Array(h);
  if(!p.enabled||!p.distortion||!marks.length)return rows;
  const start=Math.ceil(p.top*h),end=Math.floor(p.bottom*h);
  for(const m of marks){
    const center=(m.y+m.h/2)*h,radius=Math.max(1,m.h*h*2);
    for(let y=Math.max(start,Math.floor(center-radius));y<Math.min(end,Math.ceil(center+radius));y++){
      const weight=Math.max(0,1-Math.abs(y+.5-center)/radius)*m.opacity;
      rows[y]=Math.max(rows[y],weight);
    }
  }
  const slot=Math.floor(Math.max(0,Number.isFinite(time)?time:0)*8),r=random(seed^Math.imul(slot+1,1274126177));
  const phase=r()*Math.PI*2,direction=r()<.5?-1:1;
  for(let y=start;y<end;y++)rows[y]*=w*.065*p.distortion*(direction*.55+Math.sin(y/h*90+phase)*.45);
  return rows;
}
function distortTape(ctx,w,h,rows){
  if(!rows.some(x=>Math.abs(x)>.01))return;
  const image=ctx.getImageData(0,0,w,h),data=image.data,row=new Uint8ClampedArray(w*4);
  for(let y=0;y<h;y++){
    if(Math.abs(rows[y])<=.01)continue;
    const offset=y*w*4;row.set(data.subarray(offset,offset+w*4));
    for(let x=0;x<w;x++){
      const source=Math.max(0,Math.min(w-1,x-rows[y])),left=Math.floor(source),right=Math.min(w-1,left+1),t=source-left;
      for(let c=0;c<3;c++)data[offset+x*4+c]=row[left*4+c]*(1-t)+row[right*4+c]*t;
    }
  }
  ctx.putImageData(image,0,0);
}
export function drawTapeNoise(ctx,w,h,seed,time,settings){
  const p=normalizeTapeNoise(settings),marks=tapeNoiseMarks(seed,time,p);if(!marks.length)return;
  if(p.distortion)distortTape(ctx,w,h,tapeDistortionRows(w,h,seed,time,p,marks));
  ctx.save();ctx.beginPath();ctx.rect(0,p.top*h,w,(p.bottom-p.top)*h);ctx.clip();ctx.globalCompositeOperation='screen';
  for(const m of marks){
    const x=m.x*w,y=m.y*h,length=Math.max(.5,m.w*w),height=Math.max(.5,m.h*h);
    const g=ctx.createLinearGradient(x,y,x+length,y);g.addColorStop(0,'#0000');g.addColorStop(.15,m.color);g.addColorStop(.8,m.color);g.addColorStop(1,'#0000');
    ctx.globalAlpha=m.opacity*.3;ctx.fillStyle=m.color;ctx.fillRect(x-1,y-.5,length+2,height+1);
    ctx.globalAlpha=m.opacity;ctx.fillStyle=g;ctx.fillRect(x,y,length,height);
  }
  ctx.restore();
}
