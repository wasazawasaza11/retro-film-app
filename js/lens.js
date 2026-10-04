// Preview-only lens geometry. The incoming glass sweeps in vertically;
// its final circle contains every corner, including unusually tall photos.
export function incomingLens(width,height,progress,direction){
  const radius=Math.max(width*1.1,Math.hypot(width,height)/2+2);
  const start=direction>0?-radius:height+radius;
  return {x:width/2,y:start+(height/2-start)*progress,radius};
}




