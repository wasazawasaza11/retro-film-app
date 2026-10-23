import {processFrame} from './effects.js?v=20261024-1';
import {cropFrame} from './crop.js?v=20261024-1';
export async function exportImage(image,parameters,intensity,type,quality,crop=null){
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  let canvas,cropped;
  try{
    canvas=processFrame(image.source,image.width,image.height,parameters,image.seed,intensity);
    cropped=crop?cropFrame(canvas,image.width,image.height,crop):null;
    const blob=await new Promise((resolve,reject)=>(cropped||canvas).toBlob(b=>b?resolve(b):reject(new Error('書き出しに失敗しました。画像サイズを確認してください。')),type,quality));
    if(blob.type!==type)throw new Error('このブラウザでは指定形式に書き出せません。');return blob;
  }finally{for(const c of [canvas,cropped])if(c)c.width=c.height=0;}
}
export function shareableFile(blob){const file=new File([blob],`retro-film.${blob.type==='image/png'?'png':'jpg'}`,{type:blob.type});let supported=false;try{supported=!!navigator.share&&!!navigator.canShare&&navigator.canShare({files:[file]});}catch{}return {file,supported};}




