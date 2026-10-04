// Native-coordinate, non-destructive crop shared by preview and export.
export const cropRatios=[['free','Free'],[1,'1:1'],[4/3,'4:3'],[3/4,'3:4'],[16/9,'16:9'],[9/16,'9:16']];
export function createCrop(width,height){return {cx:width/2,cy:height/2,width,height,scale:1,angle:0,quarter:0,fine:0,ratio:'free'};}
// Cover the frame around the existing source anchor, without recentering it.
export function setCropAngle(crop,fine,width,height){
  crop.fine=fine;crop.angle=crop.quarter*90+fine;
  const a=crop.angle*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
  const ex=(c*crop.width+s*crop.height)/2,ey=(s*crop.width+c*crop.height)/2;
  crop.minScale=Math.max(ex/Math.max(1e-6,Math.min(crop.cx,width-crop.cx)),ey/Math.max(1e-6,Math.min(crop.cy,height-crop.cy)));
  crop.scale=Math.max(crop.scale,crop.minScale);
  return crop;
}
export function constrainCrop(crop,width,height){
  const a=crop.angle*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
  const ex=(c*crop.width+s*crop.height)/2,ey=(s*crop.width+c*crop.height)/2;
  crop.scale=Math.max(crop.scale,ex*2/width,ey*2/height,1e-6);
  const x=ex/crop.scale,y=ey/crop.scale;
  crop.cx=Math.min(width-x,Math.max(x,crop.cx));crop.cy=Math.min(height-y,Math.max(y,crop.cy));return crop;
}
export function setCropRatio(crop,ratio,width,height){
  crop.ratio=ratio;
  const quarter=((crop.quarter%4)+4)%4,baseW=quarter%2?height:width,baseH=quarter%2?width:height;
  if(ratio==='free'){crop.width=baseW;crop.height=baseH;}
  else {crop.width=Math.min(baseW,baseH*Number(ratio));crop.height=crop.width/Number(ratio);}
  return constrainCrop(crop,width,height);
}
export function panCrop(crop,dx,dy,displayScale,width,height){
  const a=crop.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),k=displayScale*crop.scale;
  crop.cx-=(c*dx+s*dy)/k;crop.cy-=(-s*dx+c*dy)/k;return constrainCrop(crop,width,height);
}
export function cropFrame(source,nativeWidth,nativeHeight,crop,maxEdge=Infinity){
  if(!crop)return null;
  const width=Math.max(1,Math.round(crop.width)),height=Math.max(1,Math.round(crop.height)),factor=Math.min(1,maxEdge/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*factor));canvas.height=Math.max(1,Math.round(height*factor));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('トリミング用Canvasを作成できませんでした。');
  ctx.scale(canvas.width/crop.width,canvas.height/crop.height);ctx.translate(crop.width/2,crop.height/2);ctx.rotate(crop.angle*Math.PI/180);ctx.scale(crop.scale,crop.scale);ctx.translate(-crop.cx,-crop.cy);ctx.drawImage(source,0,0,nativeWidth,nativeHeight);return canvas;
}




