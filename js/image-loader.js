export function createSeed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
function loadWithOnload(src,debug,route){
  return new Promise((resolve,reject)=>{
    const image=new Image();let done=false;
    const waiting=setTimeout(()=>debug?.info(`WAITING: image.onload (${route}, 8s)`),8000);
    const timeout=setTimeout(()=>finish(new Error(`Image load timeout (${route}, 30s)`)),30000);
    function finish(error){if(done)return;done=true;clearTimeout(waiting);clearTimeout(timeout);image.onload=image.onerror=null;if(error){image.src='';reject(error);}else resolve(image);}
    image.onload=()=>{
      debug?.step('image.onload');debug?.info(`route: ${route}`);
      debug?.step('natural size取得');debug?.info(`naturalWidth: ${image.naturalWidth}\nnaturalHeight: ${image.naturalHeight}`);
      if(!image.naturalWidth||!image.naturalHeight){finish(new Error('Image.onload succeeded but natural image size is zero'));return;}finish();
    };
    image.onerror=event=>finish(new Error(event.message||`Image.onerror (${route}; event.type=${event.type})`));
    debug?.step('image load start');debug?.info(`route: ${route}`);
    try{image.src=src;}catch(error){finish(error);}
  });
}
function readDataURL(file,debug){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    const timeout=setTimeout(()=>{reader.abort();reject(new Error('FileReader timeout (30s)'));},30000);
    reader.onload=()=>{clearTimeout(timeout);if(typeof reader.result!=='string'){reject(new Error('FileReader result is not a data URL'));return;}debug?.step('FileReader.onload');resolve(reader.result);};
    reader.onerror=()=>{clearTimeout(timeout);reject(reader.error||new Error('FileReader.onerror'));};
    reader.onabort=()=>{clearTimeout(timeout);reject(new Error('FileReader aborted'));};
    debug?.step('FileReader.readAsDataURL');
    try{reader.readAsDataURL(file);}catch(error){clearTimeout(timeout);reject(error);}
  });
}
export async function loadImage(file,debug){
  if(!file)throw new Error('Fileがありません。');
  let url=null,image,route='Object URL';
  try{
    url=URL.createObjectURL(file);debug?.step('objectURL created');
    image=await loadWithOnload(url,debug,route);
  }catch(error){
    debug?.error('Object URL + Image.onload',error);
    // Only failed loading is cleaned up here. Successful URLs belong to the
    // retained source, and live past the first draw until the next selection.
    if(url){URL.revokeObjectURL(url);url=null;}
    try{route='FileReader fallback';debug?.step('FileReader fallback');const dataURL=await readDataURL(file,debug);image=await loadWithOnload(dataURL,debug,route);}
    catch(fallbackError){debug?.error('FileReader + Image.onload',fallbackError);throw new Error('写真を読み込めませんでした。Object URLとFileReaderの両方で読込に失敗しました。');}
  }
  try{
    const seed=createSeed();
    return {source:image,width:image.naturalWidth,height:image.naturalHeight,seed,route,release:()=>{image.src='';if(url){URL.revokeObjectURL(url);url=null;}}};
  }catch(error){image.src='';if(url)URL.revokeObjectURL(url);debug?.error('source image registration / seed',error);throw error;}
}




