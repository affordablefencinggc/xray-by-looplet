# CS-01 — clear composer on message acceptance

Changed src/studio/assistant/useAssistantChat.ts: optional onAccepted callback runs inside the protected try immediately after the user entry and busy state are published, before asynchronous work-packet/provider work.
Changed src/studio/LiveAssistant.tsx: composer text and sent attachments clear in that callback, using existing project and draft identity guards. Removed completion-dependent clearing. Pre-acceptance rejection leaves the draft intact. Reply pills retain unrelated drafts. Source geometry and evidence records are unchanged.

Validation: npx tsc --noEmit exit 0; scoped ESLint exit 0; git diff --check exit 0.
Live existing user Edge tab 2025848458: Enter submitted a harmless composer check. The immediate DOM snapshot showed the user bubble, Assistant is working, and an empty disabled textarea showing its placeholder. Gemini returned Message received; input remained empty. Second check used the Send button then Stop: the sent message stayed in the conversation and the enabled input remained empty. Final desktop screenshot visually inspected in the tool transcript. No geometry-changing tool was called. No full suite, native/package build, tablet acceptance, or simulated provider-error test claimed.
No owned browsers or background servers launched. Existing user browser and development server retained.
