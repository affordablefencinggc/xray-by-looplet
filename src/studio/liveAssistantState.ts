import { create } from "zustand";

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

export const useLiveAssistant = create<{
  open: boolean;
  draft: string;
  guide: boolean;
  review: AssistantReviewRequest | null;
}>(() => ({ open: false, draft: "", guide: false, review: null }));
