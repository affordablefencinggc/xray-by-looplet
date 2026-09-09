# CP-01 — compact uniform assistant pills

Changed four CSS files: assistantPanel.css (shared 28px/11px/10px desktop tokens, 44px coarse-pointer height), liveAssistant.css (suggestions/reply pills), assistant/assistantProjects.css (project chips/tabs/close), assistant/permissionControls.css (mode pills).

Verified in the existing user Edge tab after refresh. A later .live-assistant button minimum-height rule initially overrode the suggestion/permission dimensions; the component selectors now explicitly outrank it. Final DOM measurements: all 10 visible suggestion/project/permission pills 28px high, 11px font. Final desktop screenshot visually inspected in conversation. Project tabs now have fully rounded pill corners. Tablet coarse-pointer height is retained via a shared variable but not independently exercised. No geometry edits or Gemini prompts were sent. Gemini Stop button count was zero. CSS diff whitespace check passed. No full build or regression-suite claim.

The idle user tab required refreshing because CSS HMR was not applying changes. Saved project remained; transient conversation reset as announced. No agent-owned processes launched; user tab/server retained.

CP-02: User requested a sharper left end on the permission container. Changed only .assistant-permission border-radius from 999px to 6px 999px 999px 6px in permissionControls.css. Live Edge computed style confirms exact radii; screenshot visually inspected. Idle/empty composer checked before refresh. Diff check passed; no Gemini requests or geometry edits.
