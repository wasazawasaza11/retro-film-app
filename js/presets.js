export const fields = [
  ['exposure','露出',-2,2,.05],['contrast','コントラスト',0,2,.02],['saturation','彩度',0,2,.02],['temperature','色温度',-1,1,.02],['fade','フェード',0,1,.01],['grain','粒子',0,1,.01],['vignette','ビネット',0,1,.01],['lightLeak','光漏れ',0,1,.01],['scratches','傷',0,1,.01],['dust','ホコリ',0,1,.01],['rgbShift','RGBずれ',0,1,.01]
];
const preset = (name, tint, values, monochrome=0) => ({name,tint,values:{...Object.fromEntries(fields.map((f,i)=>[f[0],values[i]])),monochrome,vhs:name==='VHS'?1:0}});
export const presets = [
  preset('35mm Film','#a38d63',[.1,1.15,.88,.18,.12,.25,.28,.12,.08,.1,.02]),
  preset('Disposable','#7b9266',[.25,1.3,1.1,.3,.08,.48,.55,.35,.1,.2,.08]),
  preset('Faded Photo','#bdad96',[.15,.78,.65,.22,.5,.16,.18,.08,.18,.25,.01]),
  preset('8mm','#a2784c',[-.1,1.4,.65,.4,.18,.65,.65,.25,.65,.45,.12]),
  preset('VHS','#736d9e',[0,.88,.8,-.2,.15,.35,.25,.06,.1,.08,.8]),
  preset('90s Compact','#628e97',[.18,1.24,1.25,-.15,.08,.2,.32,.1,.03,.05,.13]),
  preset('Instant','#b4a387',[.25,.85,.72,.32,.3,.22,.42,.18,.08,.18,.02]),
  preset('B&W','#a2a2a2',[.08,1.25,0,0,.18,.38,.3,0,.06,.12,0],1)
];
export const wrap = i => ((i % presets.length) + presets.length) % presets.length;
export function angleToBlend(position) { const floor=Math.floor(position);return {presetIndex:wrap(floor),nextIndex:wrap(floor+1),blendRatio:position-floor}; }
export function interpolate(a,b,t){return Object.fromEntries([...fields.map(([key])=>key),'monochrome','vhs'].map(key=>[key,(a[key]??0)+((b[key]??0)-(a[key]??0))*t]));}




