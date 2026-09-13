import { create } from 'zustand';
import { browserSingleton } from '../browserSingleton';
import { DEVELOPER_MODE_KEY, readDeveloperMode } from './developerMode';
const runtime=browserSingleton('xray.assistant-developer-mode.v1',()=>create<{enabled:boolean;error:string}>(()=>({enabled:typeof localStorage==='undefined'?true:readDeveloperMode(localStorage),error:''})));
export const useDeveloperMode=runtime.value;
export function setDeveloperMode(enabled:boolean) {
  try { localStorage.setItem(DEVELOPER_MODE_KEY,String(enabled)); useDeveloperMode.setState({enabled,error:''}); }
  catch { useDeveloperMode.setState({enabled,error:'This choice applies now but could not be saved on this device.'}); }
}
