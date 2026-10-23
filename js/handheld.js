const noise=(seed,n)=>{let x=Math.imul(seed^(n+1),1597334677);x=Math.imul(x^(x>>>16),2246822507);return (x>>>0)/4294967296*2-1;};
function smooth(seed,time){const n=Math.floor(time),u=time-n,t=u*u*(3-2*u);return noise(seed,n)*(1-t)+noise(seed,n+1)*t;}
export function handheldPose(seed,time,amount,w,h){
  const strength=Math.max(0,Math.min(1,amount||0)),t=Math.max(0,time||0);
  if(!strength)return {angle:0,x:0,y:0,scale:1};
  const angle=(smooth(seed^31,t*.9)*1.25+smooth(seed^97,t*6)*.2)*strength*Math.PI/180;
  const x=(smooth(seed^113,t*1.3)*.009+smooth(seed^131,t*7)*.0015)*w*strength;
  const y=(smooth(seed^157,t*1.1)*.009+smooth(seed^181,t*6)*.0015)*h*strength;
  const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  // Inverse-map viewport corners to cover them even with both rotation and pan.
  const scale=strength?Math.max((c*(w+2*Math.abs(x))+s*(h+2*Math.abs(y)))/w,(s*(w+2*Math.abs(x))+c*(h+2*Math.abs(y)))/h)+.002:1;
  return {angle,x,y,scale};
}
export function drawHandheld(ctx,source,w,h,seed,time,amount){
  const pose=handheldPose(seed,time,amount,w,h);
  ctx.save();ctx.translate(w/2+pose.x,h/2+pose.y);ctx.rotate(pose.angle);ctx.scale(pose.scale,pose.scale);ctx.drawImage(source,-w/2,-h/2,w,h);ctx.restore();
}
