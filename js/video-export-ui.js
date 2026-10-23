import {capabilityReport} from './video-capabilities.js?v=20261019-2';
const time=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
export class VideoExportUI{
  constructor({getSnapshot,lock,debug}){
    this.getSnapshot=getSnapshot;this.lock=lock;this.debug=debug;this.controller=null;this.url=null;this.result=null;this.generation=0;
    this.dialog=document.getElementById('video-export-sheet');this.$=id=>document.getElementById(id);
    this.$('video-export-diagnostics').hidden=!debug;
    this.dialog.querySelector('.close-sheet').addEventListener('click',()=>{if(!this.controller)this.dialog.close();});
    this.dialog.addEventListener('click',event=>{if(event.target===this.dialog&&!this.controller){const r=this.dialog.getBoundingClientRect();if(event.clientY<r.top||event.clientX<r.left||event.clientX>r.right)this.dialog.close();}});
    this.$('video-export-start').addEventListener('click',()=>this.start());
    this.$('video-export-cancel').addEventListener('click',()=>{this.controller?.abort();this.message('キャンセル処理中…');});
    this.$('video-export-share').addEventListener('click',()=>this.share());
    for(const id of ['video-export-resolution','video-export-quality'])this.$(id).addEventListener('change',()=>{this.clearResult();this.inspect();});
    this.dialog.addEventListener('cancel',event=>{if(this.controller)event.preventDefault();});
    this.dialog.addEventListener('close',()=>{this.generation++;this.clearResult();});
    window.addEventListener('pagehide',()=>{this.controller?.abort();this.clearResult();});
  }
  message(text){this.$('video-export-status').textContent=text;}
  clearResult(){if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.result=null;this.$('video-export-share').hidden=true;this.$('video-export-download').hidden=true;}
  report(report){this.debug?.info('VIDEO EXPORT CAPABILITY '+JSON.stringify(report));this.$('video-export-capabilities').textContent=JSON.stringify(report,null,2);}
  open(){if(this.controller)return;this.clearResult();this.dialog.showModal();this.inspect();}
  async inspect(){
    const generation=++this.generation;this.$('video-export-start').disabled=true;this.message('書き出し機能を確認中…');
    try{
      const base=await capabilityReport();if(generation!==this.generation)return;this.report(base);
      const {inspectVideoExport}=await import('./video-export.js?v=20261019-2');
      const snapshot=this.getSnapshot();const report=await inspectVideoExport(snapshot.file,this.$('video-export-resolution').value);
      if(generation!==this.generation||!this.dialog.open)return;
      this.report(report);this.$('video-export-info').textContent=`MP4 / H.264・${report.input.hasAudio?'元音声を保持（AAC）':'元動画は音声なし'} / ${report.output.width}×${report.output.height} / ${report.output.frameRate.toFixed(2)}fps`;
      const capable=report.h264Encoder&&report.input.canDecode&&report.VideoEncoder&&report.VideoDecoder;
      this.$('video-export-start').disabled=!capable;
      this.message(!capable?'この環境は必要なH.264エンコードまたは入力デコードに非対応です。能力レポートを確認してください。':report.input.width*report.input.height>1920*1080||report.input.duration>60?'高解像度または長い動画は、書き出し時間とメモリが増えます。1080p以下・60秒程度を推奨します。':'設定を確認して「MP4を生成」を押してください。');
    }catch(error){if(generation===this.generation)this.message(error.message);}
  }
  async start(){
    if(this.controller)return;
    const snapshot=this.getSnapshot(),generation=++this.generation;
    this.clearResult();this.controller=new AbortController();const signal=this.controller.signal;
    this.lock(true);this.setProcessing(true);this.$('video-export-progress').value=0;this.message('動画を書き出しています 0%');
    try{
      const {exportVideo}=await import('./video-export.js?v=20261019-2');
      const result=await exportVideo({...snapshot,resolution:this.$('video-export-resolution').value,quality:this.$('video-export-quality').value,signal,
        onReport:report=>this.report(report),onProgress:(progress,current,total)=>{this.$('video-export-progress').value=progress;this.message(`動画を書き出しています ${Math.floor(progress*100)}%　${time(current)} / ${time(total)}`);}});
      if(signal.aborted||generation!==this.generation)return;
      this.result=result.file;this.url=URL.createObjectURL(result.file);this.$('video-export-download').href=this.url;this.$('video-export-download').download=result.file.name;
      this.$('video-export-share').hidden=false;this.message('MP4生成完了。「共有して保存」で標準共有シートを開きます。');
    }catch(error){if(error.name==='AbortError'){this.message('書き出しをキャンセルしました。');this.dialog.close();}else{this.message(error.message);this.debug?.error('video export',error);}}
    finally{this.controller=null;this.setProcessing(false);this.lock(false);}
  }
  setProcessing(active){
    for(const id of ['video-export-resolution','video-export-quality','video-export-start'])this.$(id).disabled=active;
    this.dialog.querySelector('.close-sheet').disabled=active;this.$('video-export-cancel').hidden=!active;this.$('video-export-progress').hidden=!active;
  }
  share(){
    if(!this.result||this.controller)return;
    let supported=false;try{supported=!!navigator.share&&!!navigator.canShare&&navigator.canShare({files:[this.result]});}catch{}
    const download=()=>{this.$('video-export-download').hidden=false;this.$('video-export-download').click();this.message('ダウンロード先を確認してください。');};
    if(!supported){download();return;}
    this.$('video-export-share').disabled=true;this.lock(true);
    let promise;try{promise=navigator.share({files:[this.result]});}catch(error){promise=Promise.reject(error);}
    Promise.resolve(promise).then(()=>this.message('共有先で「ビデオを保存」を選び、保存結果を確認してください。')).catch(error=>{if(error.name==='AbortError')this.message('共有をキャンセルしました。');else download();}).finally(()=>{this.$('video-export-share').disabled=false;this.lock(false);});
  }
}
