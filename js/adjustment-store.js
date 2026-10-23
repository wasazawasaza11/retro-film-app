import {presets,fields} from './presets.js?v=20261024-5';
export const storageKey='retroFilm.adjustments.v1';
const validValues=value=>value&&fields.every(([k,label,min,max])=>Number.isFinite(value[k])&&value[k]>=min&&value[k]<=max)&&[0,1].includes(value.monochrome);
export class AdjustmentStore{
  constructor(){this.overrides={};this.favorites=[null,null,null];try{const data=JSON.parse(localStorage.getItem(storageKey));for(const p of presets)if(validValues(data?.overrides?.[p.name]))this.overrides[p.name]={...data.overrides[p.name]};this.favorites=this.favorites.map((_,i)=>{const f=data?.favorites?.[i];return f&&presets.some(p=>p.name===f.preset)&&validValues(f.values)&&Number.isFinite(f.strength)&&f.strength>=0&&f.strength<=1?f:null;});}catch{}}
  values(index){const p=presets[index];return {...(this.overrides[p.name]||p.values),vhs:p.values.vhs};}
  update(index,values){this.overrides[presets[index].name]={...values};this.persist();}
  reset(index){delete this.overrides[presets[index].name];this.persist();}
  save(slot,index,strength,values){this.favorites[slot]={preset:presets[index].name,strength,values:{...values}};this.persist();}
  persist(){try{localStorage.setItem(storageKey,JSON.stringify({overrides:this.overrides,favorites:this.favorites}));}catch{}}
}



