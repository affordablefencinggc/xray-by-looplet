import { create } from 'zustand';
import { browserSingleton } from '../browserSingleton';
const KEY='xray:assistant-diagrams:v1';
const defaults={ncc:true, explanations:false};
const runtime=browserSingleton('xray.assistant-diagrams.v1',()=>create<typeof defaults>(()=>{
  try {const value=JSON.parse(localStorage.getItem(KEY)||'null');return {ncc:typeof value?.ncc==='boolean'?value.ncc:true,explanations:value?.explanations===true};}
  catch{return defaults;}
}));
export const useDiagramPreferences=runtime.value;
if(runtime.created && typeof window!=='undefined')useDiagramPreferences.subscribe(value=>{try{localStorage.setItem(KEY,JSON.stringify(value));}catch{/* Keep live choices. */}});
