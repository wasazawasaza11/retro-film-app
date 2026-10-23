import {AdjustmentStore} from './adjustment-store.js?v=20261024-3';
import {loadImage} from './image-loader.js?v=20261024-3';
import {Renderer} from './renderer.js?v=20261024-3';
import {presets,fields,interpolate,wrap} from './presets.js?v=20261024-3';
import {PhotoGestures} from './photo-gestures.js?v=20261024-3';
import {incomingLens} from './lens.js?v=20261024-3';
import {createCrop,constrainCrop,setCropRatio,panCrop,setCropAngle} from './crop.js?v=20261024-3';
import {exportImage,shareableFile} from './exporter.js?v=20261024-3';
import {loadVideo,VideoPlayback} from './video-source.js?v=20261024-3';
import {VideoExportUI} from './video-export-ui.js?v=20261024-3';
const debug=window.retroDebug; const adjustments=new AdjustmentStore();
const $=id=>{const element=document.getElementById(id);if(!element){const error=new Error(`Required DOM element #${id} is null`);debug?.error("DOM reference",error);throw error;}return element;},stage=$('stage'),view=$('photo-view');
let displayReady=false;
let angleEditing=false,angleAnchor=null,pendingAngle=null,angleRequest=0;
let renderCalls=0,angleFrames=0,renderSource='state-update';
let image=null,parameters=adjustments.values(0),intensity=.7,index=0,busy=false,before=false,transition=null;
// image remains the renderer's drawable adapter; media owns separate sources/state.
const media={type:'image',photo:null,photoCrop:null,video:null,playback:null};
let crop=null,draft=null,snapshot=null,zoom=1,pan={x:0,y:0},pinch=null,viewSize={width:1,height:1};
let downloadUrl=null,prepared=null,exportToken=0,revision=0,toastTimer=0;
const sliders=new Map(),status=message=>$('status').textContent=message;
const renderer=new Renderer($('preview'),(width,height)=>{const resized=viewSize.width!==width||viewSize.height!==height;viewSize={width,height};if(resized||!angleEditing)layout();if(angleEditing)recordAngle();});
function render(source='state-update'){if(image&&displayReady&&!(media.type==='video'&&image.source.seeking)){renderCalls++;renderSource=source;renderer.schedule(image,parameters,intensity,error=>{debug?.error("effect render",error);status(error.message);if(media.type==='video')media.playback?.pause();},{crop:media.type==='image'?(draft||crop):null,transition,before});}}
function recordAngle(){
  if(!debug||!draft)return;const canvas=$('preview'),s=getComputedStyle(canvas),v=getComputedStyle(view),r=view.getBoundingClientRect(),vp=visualViewport;
  debug.info('ANGLE FRAME '+JSON.stringify({angle:draft.angle,panX:pan.x,panY:pan.y,zoom,baseScale:Math.min(stage.clientWidth/viewSize.width,stage.clientHeight/viewSize.height),minScale:draft.minScale,effectiveScale:draft.scale,cropCenterX:draft.cx,cropCenterY:draft.cy,cropRect:{x:draft.cx-draft.width/2,y:draft.cy-draft.height/2,w:draft.width,h:draft.height},canvas:[canvas.width,canvas.height],canvasCSS:[s.width,s.height],wrapper:{x:r.x,y:r.y,w:r.width,h:r.height},transform:v.transform,transformOrigin:v.transformOrigin,devicePixelRatio,displayX:r.x,displayY:r.y,drawX:-draft.cx,drawY:-draft.cy,scroll:[scrollX,scrollY],viewport:vp?{x:vp.offsetLeft,y:vp.offsetTop,w:vp.width,h:vp.height,scale:vp.scale}:null,renderSource,renderCalls,requestAnimationFrameCount:angleFrames,drawCount:renderer.drawCount}));
}
function layout(){
  if(!viewSize.width||!viewSize.height||!stage.clientWidth||!stage.clientHeight)return;
  const fit=Math.min(stage.clientWidth/viewSize.width,stage.clientHeight/viewSize.height);
  const width=viewSize.width*fit,height=viewSize.height*fit;view.style.width=`${width}px`;view.style.height=`${height}px`;
  const maxX=Math.max(0,(width*zoom-stage.clientWidth)/2),maxY=Math.max(0,(height*zoom-stage.clientHeight)/2);
  pan.x=Math.max(-maxX,Math.min(maxX,pan.x));pan.y=Math.max(-maxY,Math.min(maxY,pan.y));
  view.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;stage.dataset.zoom=zoom;
  $('crop-frame').hidden=!draft;
  $('lens').classList.toggle('visible',!!transition&&!before);
  if(transition){const c=incomingLens(width,height,transition.progress,transition.direction);$('lens').style.width=$('lens').style.height=`${c.radius*2}px`;$('lens').style.transform=`translate(${c.x-c.radius}px,${c.y-c.radius}px)`;}
}
new ResizeObserver(layout).observe(stage);
let toastPositionFrame=0;
function positionVideoToast(){
  const toast=$('preset-toast');
  if(media.type!=='video'){toast.style.removeProperty('top');return;}
  const controls=$('video-controls'),controlsRect=controls.getBoundingClientRect(),stageRect=stage.getBoundingClientRect(),videoRect=view.getBoundingClientRect();
  const valid=!controls.hidden&&controlsRect.width>0&&controlsRect.height>0;
  // Viewport coordinates throughout: use the visible lower part of the image,
  // but keep the entire toast above the measured controls, not their center.
  const imageBottom=Math.min(stageRect.bottom,videoRect.bottom);
  const targetBottom=valid?Math.min(controlsRect.top-40,imageBottom-32):imageBottom-100;
  const scaleY=stage.offsetHeight?stageRect.height/stage.offsetHeight:1;
  let top=(targetBottom-stageRect.top)/scaleY-stage.clientTop-toast.offsetHeight;
  toast.style.top=`${top}px`;
  // Verify the final rendered edge, including padding, line-height and transforms.
  const correction=targetBottom-toast.getBoundingClientRect().bottom;
  if(Math.abs(correction)>.25){top+=correction/scaleY;toast.style.top=`${top}px`;}
}
function trackToastPosition(){
  cancelAnimationFrame(toastPositionFrame);positionVideoToast();
  if(media.type==='video'&&($('preset-toast').classList.contains('visible')||Number(getComputedStyle($('preset-toast')).opacity)>0))toastPositionFrame=requestAnimationFrame(trackToastPosition);
}
function resetView(){zoom=1;pan={x:0,y:0};layout();}
function refreshSliders(){for(const [key,{input,output}] of sliders){input.value=parameters[key];output.value=parameters[key].toFixed(2);}}
function clearDownload(){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=null;prepared=null;$('download').hidden=true;exportToken++;$('share-save').disabled=true;}
function changed(){revision++;clearDownload();}
function showName(){clearTimeout(toastTimer);$('preset-toast').textContent=presets[index].name;$('preset-toast').classList.add('visible');trackToastPosition();toastTimer=setTimeout(()=>$('preset-toast').classList.remove('visible'),1100);}
function setBusy(value){busy=value;$('photo').disabled=value;for(const id of ['adjust-button','crop-button','compare-button','export-button'])$(id).disabled=value||!image||!displayReady||(media.type==='video'&&id==='crop-button');for(const id of ['video-play','video-seek'])$(id).disabled=value||media.type!=='video';}
function sheetOpen(){return [...document.querySelectorAll('dialog')].some(d=>d.open);}
function setBefore(value){before=value;$('compare-button').setAttribute('aria-pressed',String(value));$('compare-label').hidden=!value;render();}
const gestures=new PhotoGestures(stage,{
  enabled:()=>!!image&&displayReady&&!busy&&!sheetOpen()&&!before&&!angleEditing,
  mode:()=>draft?'crop':'normal',
  onBegin:()=>{snapshot={parameters:{...parameters},index,position:gestures.position};},
  onFrame:({from,to,progress,direction})=>{
    const outside=snapshot&&from===snapshot.position?snapshot.parameters:adjustments.values(wrap(from));
    parameters=interpolate(outside,adjustments.values(wrap(to)),progress);transition={outside:{...outside},progress,direction};render();
  },
  onCommit:position=>{index=wrap(position);parameters=adjustments.values(index);snapshot=null;transition=null;changed();refreshSliders();showName();render();},
  onCancel:()=>{if(snapshot){parameters=snapshot.parameters;index=snapshot.index;}snapshot=null;transition=null;render();},
  onFit:()=>{if(!draft)resetView();},
  onPinchStart:()=>{pinch={zoom,pan:{...pan},cropScale:draft?.scale};},
  onPinch:(ratio,mid,start)=>{
    if(draft){draft.scale=Math.min(20,Math.max(.1,pinch.cropScale*ratio));constrainCrop(draft,image.width,image.height);render();}
    else {zoom=Math.max(1,Math.min(8,pinch.zoom*ratio));const box=stage.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2,factor=zoom/pinch.zoom;pan.x=mid.x-cx-(start.x-cx-pinch.pan.x)*factor;pan.y=mid.y-cy-(start.y-cy-pinch.pan.y)*factor;layout();}
  },
  onPan:(dx,dy)=>{if(draft){panCrop(draft,dx,dy,parseFloat(view.style.width)/draft.width,image.width,image.height);render();}}
});
function settle(){if(transition||gestures.motion){const position=Math.round(gestures.position);gestures.cancel();gestures.position=position;index=wrap(position);parameters=adjustments.values(index);changed();refreshSliders();transition=null;render();}gestures.points.clear();gestures.gesture=null;}
const videoExporter=new VideoExportUI({getSnapshot:()=>({file:media.video.file,parameters:{...parameters},intensity,seed:media.video.seed}),lock:value=>setBusy(value),debug});
for(const [key,name,min,max,step] of fields){const row=document.createElement('div');row.className='control';const label=document.createElement('label'),output=document.createElement('output'),input=document.createElement('input');input.id=`adjust-${key}`;label.htmlFor=input.id;label.append(name,output);input.type='range';input.min=min;input.max=max;input.step=step;row.append(label,input);$('adjustments').append(row);sliders.set(key,{input,output});input.addEventListener('input',()=>{parameters[key]=Number(input.value);adjustments.update(index,parameters);output.value=Number(input.value).toFixed(2);changed();render();});}
refreshSliders();
const favorites=document.createElement('div');favorites.className='favorite-controls';favorites.innerHTML='<button id="reset-preset">初期値に戻す</button><button data-favorite="0">★1</button><button data-favorite="1">★2</button><button data-favorite="2">★3</button><select id="favorite-slot" aria-label="保存先"><option value="0">★1</option><option value="1">★2</option><option value="2">★3</option></select><button id="save-favorite">保存</button>';
$('adjustments').before(favorites);
$('reset-preset').addEventListener('click',()=>{adjustments.reset(index);parameters=adjustments.values(index);refreshSliders();changed();render();});
$('save-favorite').addEventListener('click',()=>{const slot=Number($('favorite-slot').value);if(adjustments.favorites[slot]&&!confirm(`★${slot+1}を上書きしますか？`))return;adjustments.save(slot,index,intensity,parameters);status(`★${slot+1}に保存しました。`);});
for(const button of favorites.querySelectorAll('[data-favorite]'))button.addEventListener('click',()=>{const f=adjustments.favorites[Number(button.dataset.favorite)];if(!f){status('このお気に入りは未登録です。');return;}settle();index=presets.findIndex(p=>p.name===f.preset);parameters={...f.values,vhs:presets[index].values.vhs};intensity=f.strength;adjustments.update(index,parameters);gestures.reset(index);$('intensity').value=Math.round(intensity*100);$('intensity-value').value=`${Math.round(intensity*100)}%`;refreshSliders();changed();render();showName();});
$('photo').addEventListener('change',async event=>{
  debug?.reset();debug?.step('input change');
  const files=event.target?.files;
  debug?.info(`event.target.files: ${files?'FileList':'null'}; length: ${files?.length??'null'}`);
  const file=files?.[0];debug?.info(`event.target.files[0]: ${file?'File':'undefined'}`);
  if(!file){const error=new Error('選択ファイルが0件です。');debug?.error('file received',error);status(error.message);return;}
  debug?.step('file received');debug?.file(file);$('photo').value='';
  if(busy){debug?.error('input change / busy guard',new Error('Another operation is active'));return;}
  if(file.type.startsWith('video/')){await selectVideo(file);return;}
  if(file.type&&!file.type.startsWith('image/')){status('写真または動画を選択してください。');return;}
  let operation='Imageロード';
  settle();setBusy(true);status('写真を読み込み中…');
  try{
    const next=await loadImage(file,debug);
    operation='source image登録';renderer.clear();const previous=media.photo;media.playback?.dispose();media.playback=null;media.video?.release();media.video=null;media.type='image';media.photo=next;media.photoCrop=null;image=next;displayReady=false;$('video-controls').hidden=true;stage.dataset.mediaType='image';
    debug?.info('source image registered');
    operation='zoom/pan/crop初期化';gestures.reset(index);crop=draft=null;transition=null;snapshot=null;before=false;
    $('compare-button').setAttribute('aria-pressed','false');$('compare-label').hidden=true;
    document.body.classList.remove('cropping');$('crop-panel').hidden=true;resetView();changed();refreshSliders();
    debug?.info('zoom/pan/crop initialized');
    operation='preview canvas / drawImage';
    debug?.info(`stage.clientWidth: ${stage.clientWidth}; stage.clientHeight: ${stage.clientHeight}`);
    debug?.styles($('empty'),'empty before draw');
    renderer.initializePreview(image,debug);
    previous?.release();
    operation='effect render';debug?.info('effect render start');
    await new Promise((resolve,reject)=>renderer.schedule(image,parameters,intensity,reject,{onComplete:resolve}));
    debug?.step('render complete');
    operation='empty state hidden';$('empty').hidden=true;
    debug?.step('empty state hidden');debug?.styles($('empty'),'empty after render');
    debug?.styles($('preview'),'preview after render');
    const emptyStyle=getComputedStyle($('empty'));
    if(emptyStyle.display!=='none')throw new Error('Empty state remains displayed after hidden=true');
    displayReady=true;setBusy(false);debug?.info('toolbar enabled');
    debug?.step('render complete (pipeline)');status('上下スワイプでフィルター・2本指で拡大');
  }catch(error){debug?.error(operation,error);status(error.message);}
  finally{setBusy(false);}
});

const formatTime=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
function updateVideoTime(element){$('video-time').textContent=`${formatTime(element.currentTime)} / ${formatTime(media.video.duration)}`;$('video-seek').value=element.currentTime;$('video-play').textContent=element.paused?'▶':'Ⅱ';$('video-play').setAttribute('aria-label',element.paused?'再生':'一時停止');}
async function selectVideo(file){
  finishAngle();settle();setBusy(true);status('動画を読み込み中…');let next=null;
  const previous={...media,adapter:image,crop,draft,zoom,pan:{...pan},ready:displayReady};
  media.playback?.pause();
  try{
    next=await loadVideo(file,debug);
    renderer.clear();media.playback?.dispose();
    if(media.type==='image'){media.photo=image;media.photoCrop=crop?{...crop}:null;}
    media.type='video';media.video=next;image=next;displayReady=false;
    gestures.reset(index);crop=draft=null;transition=snapshot=null;before=false;
    $('compare-button').setAttribute('aria-pressed','false');$('compare-label').hidden=true;
    document.body.classList.remove('cropping');$('crop-panel').hidden=true;resetView();changed();
    renderer.initializePreview(next,null);
    await new Promise((resolve,reject)=>renderer.schedule(next,parameters,intensity,reject,{onComplete:resolve}));
    $('empty').hidden=true;displayReady=true;stage.dataset.mediaType='video';
    $('video-controls').hidden=false;$('video-seek').max=next.duration;
    media.playback=new VideoPlayback(next,()=>render('video-frame'),updateVideoTime,error=>{debug?.error('video playback',error);status(error.message);});
    previous.video?.release();
    updateVideoTime(next.source);debug?.info(`video ready; frame callback=${media.playback.method}`);debug?.step('video render complete');
    status(next.width*next.height>1920*1080||next.duration>60?'大きい動画です。1080p・30fps程度・60秒以内を推奨します。':'再生ボタンで開始・上下スワイプでフィルター');
  }catch(error){
    debug?.error('video load / render',error);status(error.message);
    if(next&&media.video===next){
      media.playback?.dispose();next.release();renderer.clear();
      Object.assign(media,{type:previous.type,photo:previous.photo,photoCrop:previous.photoCrop,video:previous.video,playback:null});
      image=previous.adapter;crop=previous.crop;draft=previous.draft;zoom=previous.zoom;pan=previous.pan;displayReady=previous.ready;
      document.body.classList.toggle('cropping',!!draft);$('crop-panel').hidden=!draft;$('video-controls').hidden=media.type!=='video';stage.dataset.mediaType=media.type;
      if(media.video){media.playback=new VideoPlayback(media.video,()=>render('video-frame'),updateVideoTime,e=>status(e.message));$('video-seek').max=media.video.duration;updateVideoTime(media.video.source);}
      render('video-load-rollback');layout();
    }else next?.release();
  }
  finally{setBusy(false);}
}
$('video-play').addEventListener('click',()=>{if(!media.playback||busy)return;media.video.source.paused?media.playback.play():media.playback.pause();});
$('video-seek').addEventListener('input',()=>{if(!busy)media.playback?.seek(Number($('video-seek').value));});
document.addEventListener('visibilitychange',()=>{if(document.hidden)media.playback?.pause();});

function openSheet(id){settle();setBefore(false);$(id).showModal();}
$('adjust-button').addEventListener('click',()=>openSheet('adjust-sheet'));
$('export-button').addEventListener('click',()=>{if(media.type==='video'){settle();setBefore(false);media.playback?.pause();videoExporter.open();return;}openSheet('export-sheet');prepareExport();});
for(const dialog of document.querySelectorAll('dialog')){
  if(dialog.id==='video-export-sheet')continue;
  dialog.querySelector('.close-sheet').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)dialog.close();}});
  dialog.addEventListener('close',()=>{if(dialog.id==='export-sheet')exportToken++;});
}
$('compare-button').addEventListener('click',()=>{settle();setBefore(!before);status(before?'元画像を表示中。比較を押すと加工後に戻ります。':'上下スワイプでフィルター・2本指で拡大');});
$('intensity').addEventListener('input',()=>{intensity=Number($('intensity').value)/100;$('intensity-value').value=`${$('intensity').value}%`;changed();render();});
function syncCropControls(){
  $('crop-ratio').value=String(draft.ratio);$('free-size').hidden=draft.ratio!=='free';$('crop-angle').value=draft.fine;$('angle-value').value=`${draft.fine}°`;
  const sideways=draft.quarter%2,baseW=sideways?image.height:image.width,baseH=sideways?image.width:image.height;
  $('crop-width').value=Math.round(draft.width/baseW*100);$('crop-height').value=Math.round(draft.height/baseH*100);
}
$('crop-button').addEventListener('click',()=>{if(media.type!=='image')return;settle();setBefore(false);draft=crop?{...crop}:createCrop(image.width,image.height);resetView();document.body.classList.add('cropping');$('crop-panel').hidden=false;syncCropControls();render();});
function exitCrop(apply){finishAngle();gestures.cancel();if(apply){crop={...draft};changed();}draft=null;document.body.classList.remove('cropping');$('crop-panel').hidden=true;resetView();render();}
$('crop-cancel').addEventListener('click',()=>exitCrop(false));$('crop-apply').addEventListener('click',()=>exitCrop(true));
$('crop-ratio').addEventListener('change',()=>{setCropRatio(draft,$('crop-ratio').value,image.width,image.height);syncCropControls();render();});
for(const id of ['crop-width','crop-height'])$(id).addEventListener('input',()=>{const sideways=draft.quarter%2;draft.width=(sideways?image.height:image.width)*Number($('crop-width').value)/100;draft.height=(sideways?image.width:image.height)*Number($('crop-height').value)/100;constrainCrop(draft,image.width,image.height);render();});
function beginAngle(){if(!draft||angleEditing)return;gestures.cancel();gestures.points.clear();angleEditing=true;angleAnchor={cx:draft.cx,cy:draft.cy,pan:{...pan},zoom};}
function applyPendingAngle(){
  angleRequest=0;if(pendingAngle===null||!draft||!image)return;
  angleFrames++;
  const value=pendingAngle;pendingAngle=null;
  draft.cx=angleAnchor.cx;draft.cy=angleAnchor.cy;pan={...angleAnchor.pan};zoom=angleAnchor.zoom;
  setCropAngle(draft,value,image.width,image.height);$('angle-value').value=`${draft.fine}°`;
  debug?.info(`angle=${draft.angle} panX=${pan.x} panY=${pan.y} zoom=${zoom} minScale=${draft.minScale} effectiveScale=${draft.scale} cropCenterX=${draft.cx} cropCenterY=${draft.cy}`);
  render('angle-input');
}
function finishAngle(){if(!angleEditing)return;if(angleRequest)cancelAnimationFrame(angleRequest);applyPendingAngle();angleEditing=false;angleAnchor=null;}
$('crop-angle').addEventListener('pointerdown',beginAngle);
$('crop-angle').addEventListener('input',()=>{beginAngle();if(!angleEditing)return;pendingAngle=Number($('crop-angle').value);if(!angleRequest)angleRequest=requestAnimationFrame(applyPendingAngle);});
for(const event of ['change','pointerup','pointercancel','blur'])$('crop-angle').addEventListener(event,finishAngle);
$('rotate-90').addEventListener('click',()=>{draft.quarter=(draft.quarter+1)%4;draft.angle=draft.quarter*90+draft.fine;setCropRatio(draft,draft.ratio,image.width,image.height);syncCropControls();render();});
async function prepareExport(){
  if(!image||media.type!=='image')return;clearDownload();const token=exportToken,version=revision,type=$('format').value,quality=Number($('quality').value)/100;
  $('share-save').disabled=true;$('share-save').textContent='画像を準備中…';$('export-status').textContent='元解像度で加工中…';
  $('dimensions').textContent=`${Math.round(crop?.width??image.width)} × ${Math.round(crop?.height??image.height)} px${crop?' ・トリミング適用':' ・元解像度'}`;
  try{const blob=await exportImage(image,{...parameters},intensity,type,quality,crop?{...crop}:null);if(token!==exportToken||version!==revision||!$('export-sheet').open)return;prepared={...shareableFile(blob),revision:version};downloadUrl=URL.createObjectURL(blob);$('download').href=downloadUrl;$('download').download=prepared.file.name;$('share-save').textContent=prepared.supported?'設定を確定して共有':'設定を確定して保存';$('share-save').disabled=false;$('export-status').textContent='加工完了。下のボタンから保存してください。';}
  catch(e){if(token===exportToken){$('export-status').textContent=e.message||'書き出しに失敗しました。';$('share-save').textContent='準備を再試行';$('share-save').disabled=false;prepared=null;}}
}
$('format').addEventListener('change',()=>{$('quality-row').hidden=$('format').value==='image/png';prepareExport();});
let qualityTimer=0;
$('quality').addEventListener('input',()=>{$('quality-value').value=`${$('quality').value}%`;clearDownload();clearTimeout(qualityTimer);qualityTimer=setTimeout(prepareExport,180);});
$('share-save').addEventListener('click',()=>{
  if(!prepared){prepareExport();return;}if(prepared.revision!==revision)return;
  // Recheck the actual File on the confirming user gesture.
  try{prepared.supported=!!navigator.share&&!!navigator.canShare&&navigator.canShare({files:[prepared.file]});}catch{prepared.supported=false;}
  if(!prepared.supported){$('download').hidden=false;$('download').click();$('export-status').textContent='ダウンロード先を確認してください。';return;}
  // File is already prepared: call share synchronously in the click activation.
  $('share-save').disabled=true;setBusy(true);
  let share;
  try{share=navigator.share({files:[prepared.file]});}catch(e){share=Promise.reject(e);}
  Promise.resolve(share).then(()=>{$('export-status').textContent='共有先で保存結果を確認してください。';}).catch(e=>{if(e.name==='AbortError')$('export-status').textContent='共有をキャンセルしました。';else{$('download').hidden=false;$('download').click();$('export-status').textContent='共有できなかったためダウンロードへ切り替えました。保存先を確認してください。';}}).finally(()=>{setBusy(false);$('share-save').disabled=false;});
});

$('download').addEventListener('click',()=>status('ダウンロード先または画像表示後の共有メニューを確認してください。'));
document.querySelector('.open-photo').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('photo').click();}});
window.addEventListener('pagehide',e=>{gestures.cancel();media.playback?.pause();if(!e.persisted){media.playback?.dispose();media.video?.release();renderer.clear();if(downloadUrl)URL.revokeObjectURL(downloadUrl);}});
if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname)))navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>registration.update().catch(()=>{})).catch(()=>status('オフライン準備に失敗しました。接続中は利用できます。'));

debug?.info('app initialized; required DOM references resolved');
debug?.info('photo-gestures / lens / crop initialized with no source image');






