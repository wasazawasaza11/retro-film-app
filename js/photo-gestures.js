export class PhotoGestures {
  constructor(stage,callbacks){
    this.stage=stage;this.callbacks=callbacks;this.position=0;this.points=new Map();this.motion=0;this.gesture=null;this.lastTap=0;
    stage.addEventListener('pointerdown',e=>this.down(e));stage.addEventListener('pointermove',e=>this.move(e));stage.addEventListener('pointerup',e=>this.up(e));stage.addEventListener('pointercancel',e=>this.up(e,true));
    stage.addEventListener('lostpointercapture',e=>{if(this.points.has(e.pointerId))this.up(e,true);});
    stage.addEventListener('keydown',e=>{if(!callbacks.enabled()||callbacks.mode()==='crop')return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();this.begin();this.snap(this.position+(e.key==='ArrowDown'?1:-1));}if(e.key==='Escape')this.cancel();});
  }
  distance(){const [a,b]=[...this.points.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
  midpoint(){const [a,b]=[...this.points.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  begin(){if(this.motion){cancelAnimationFrame(this.motion);this.motion=0;this.position=Math.round(this.position);this.callbacks.onCommit(this.position);}this.phaseDirection=undefined;this.origin=this.position;this.callbacks.onBegin();}
  cancel(){cancelAnimationFrame(this.motion);this.motion=0;if(this.origin!==undefined){this.position=this.origin;this.callbacks.onCancel();}this.origin=undefined;this.gesture=null;}
  reset(position=0){this.cancel();this.position=position;this.points.clear();}
  down(e){
    if(e.target.closest('input,button,select,label,a,dialog,[role="button"]'))return;
    if(e.button!==0||!this.callbacks.enabled())return;e.preventDefault();this.stage.setPointerCapture(e.pointerId);
    if(!this.points.size){this.begin();this.gesture={type:this.callbacks.mode()==='crop'?'pan':'pending',x:e.clientX,y:e.clientY,lastY:e.clientY,time:performance.now(),velocity:0,moved:false};}
    this.points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.points.size===2){this.cancel();this.gesture={type:'pinch',distance:this.distance(),midpoint:this.midpoint()};this.callbacks.onPinchStart();}
  }
  move(e){
    if(!this.points.has(e.pointerId)||!this.gesture)return;e.preventDefault();const previous=this.points.get(e.pointerId);this.points.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=this.gesture;
    if(g.type==='pinch'){if(this.points.size===2)this.callbacks.onPinch(this.distance()/Math.max(1,g.distance),this.midpoint(),g.midpoint);return;}
    if(g.type==='suppressed')return;
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(g.type==='pan'){g.moved=true;this.callbacks.onPan(e.clientX-previous.x,e.clientY-previous.y);return;}
    if(g.type==='pending'){if(Math.abs(dy)<8||Math.abs(dy)<Math.abs(dx)*1.1)return;g.type='swipe';}
    g.moved=true;const now=performance.now(),dt=Math.max(8,now-g.time),distance=Math.max(90,Math.min(220,this.stage.clientHeight*.3));
    const velocity=(e.clientY-g.lastY)/distance/dt;g.velocity=g.velocity*.3+velocity*.7;g.lastY=e.clientY;g.time=now;
    const next=this.origin+dy/distance,direction=next>=this.origin?1:-1;this.phaseDirection=direction;this.position=next;this.emit(direction);
  }
  up(e,cancelled=false){
    if(!this.points.has(e.pointerId))return;this.points.delete(e.pointerId);const g=this.gesture;
    if(cancelled){this.cancel();if(this.points.size)this.gesture={type:'suppressed'};return;}
    if(this.points.size){this.gesture={type:'suppressed'};return;}
    this.gesture=null;if(!g)return;
    if(g.type==='swipe'){const velocity=performance.now()-g.time>90?0:Math.max(-.02,Math.min(.02,g.velocity));const current=Math.round(this.position);const target=Math.abs(velocity)>.0015?(velocity>0?Math.floor(this.position)+1:Math.ceil(this.position)-1):current;this.releaseTarget=Math.max(current-1,Math.min(current+1,target));this.snap(this.releaseTarget);}
    else {if(g.type==='pending'){const now=performance.now();if(now-this.lastTap<300){this.callbacks.onFit();this.lastTap=0;}else this.lastTap=now;}this.origin=undefined;}
  }
  emit(direction){
    const edge=direction>0?Math.floor(this.position):Math.ceil(this.position);
    const progress=Math.min(1,Math.max(0,direction>0?this.position-edge:edge-this.position));
    this.stage.dataset.position=this.position;this.stage.dataset.progress=progress;
    this.callbacks.onFrame({from:edge,to:edge+direction,progress,direction});
  }
  inertia(velocity){let last=performance.now();const tick=now=>{const dt=Math.min(48,now-last);last=now;const decay=Math.exp(-dt/260);this.position+=velocity*260*(1-decay);velocity*=decay;this.phaseDirection=velocity>=0?1:-1;this.emit(this.phaseDirection);if(Math.abs(velocity)>.00015)this.motion=requestAnimationFrame(tick);else{this.motion=0;this.snap(Math.round(this.position));}};this.motion=requestAnimationFrame(tick);}
  snap(target){const start=this.position,time=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:200;const tick=now=>{const t=duration?Math.min(1,(now-time)/duration):1;this.position=start+(target-start)*(1-(1-t)**3);this.emit(this.phaseDirection??(target>=start?1:-1));if(t<1)this.motion=requestAnimationFrame(tick);else{this.motion=0;this.position=target;this.origin=undefined;this.callbacks.onCommit(target);}};this.motion=requestAnimationFrame(tick);}
}




