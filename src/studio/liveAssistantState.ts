import type { NccMatch } from './assistant/nccReferences';
import { readNccMatches } from './assistant/nccResultReferences';
import { create } from "zustand";
import { browserSingleton } from './browserSingleton';

export type AssistantReviewRequest = {
  id: string;
  documentId: string;
  sha256: string;
  page: number;
  focus: string;
};

export function reviewMatchesSource(request: AssistantReviewRequest, binary: { documentId: string; sha256: string } | null, pageCount: number) {
  return !!binary && request.documentId === binary.documentId && request.sha256 === binary.sha256
    && Number.isInteger(request.page) && request.page >= 1 && request.page <= pageCount;
}

const UI_KEY = 'xray:assistant-tab-ui:v1';
function restoredUi(): {open:boolean;draft:string;draftProjectId:string|null;nccReferences:NccMatch[]} {
  try {
    const value = typeof window === 'undefined' ? null : JSON.parse(sessionStorage.getItem(UI_KEY) || 'null');
    return {nccReferences:readNccMatches(value?.nccReferences).slice(0,6),open:value?.open===true,draft:typeof value?.draft==='string' && value.draft.length<=100000?value.draft:'',draftProjectId:typeof value?.draftProjectId==='string'?value.draftProjectId:null};
  } catch { return {open:false,draft:'',draftProjectId:null,nccReferences:[]}; }
}
const runtime = browserSingleton('xray.live-assistant-ui.v1', () => create<{
  nccReferences: NccMatch[];
  open: boolean;
  draft: string;
  draftProjectId: string|null;
  guide: boolean;
  review: AssistantReviewRequest | null;
}>(() => ({ ...restoredUi(), guide: false, review: null })));
export const useLiveAssistant = runtime.value;
if (runtime.created && typeof window !== 'undefined') useLiveAssistant.subscribe((state,previous) => {
  if (state.open===previous.open && state.draft===previous.draft && state.draftProjectId===previous.draftProjectId && state.nccReferences===previous.nccReferences) return;
  // Keep draft and visibility within this tab; project chat history stays in IndexedDB.
  try { sessionStorage.setItem(UI_KEY,JSON.stringify({open:state.open,draft:state.draft,draftProjectId:state.draftProjectId,nccReferences:state.nccReferences})); } catch { /* Retain the live draft if browser storage is unavailable. */ }
});
