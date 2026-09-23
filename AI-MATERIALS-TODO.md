# AI drawing interpretation

Authorized: continue on with what's next; incorporate sascscsc.md as the architectural roadmap. Branch feat/model-wireframe-navigation at 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. Snapshot touched files in proof/audit/IW-AI-MATERIALS/before. Preserve shared changes and index; no staging, commits, publishing or worktrees.

- [x] SC-01 Validated AI request/proposal contract, source binding and persistent review queue; predictions never become approved quantities automatically. Proof: `proof/audit/IW-AI-MATERIALS/completion.md`.
- [x] SC-02 Real provider transport for web and desktop, bounded page images, cancellation, secret handling and truthful connection status. Proof: `proof/audit/IW-AI-MATERIALS/completion.md`.
- [x] SC-03 Drawing image preparation, AI review UI, evidence regions, material promotion/linking and backup persistence. Proof: `proof/audit/IW-AI-MATERIALS/completion.md`.
- [x] SC-04 Accuracy benchmark against checked ground truth: detection precision/recall and quantity agreement; no invented live score. Proof: `proof/audit/IW-AI-MATERIALS/completion.md`.
- [x] SC-05 Remove canned Copilot connection/results; regression and dev/built/native/installed proof, update app and close test services. Proof: `proof/audit/IW-AI-MATERIALS/completion.md`.
- [ ] LIVE-01 Run an actual configured AI provider on the public drawings and record measured benchmark results. Gemini key now configured in ignored .env.local; gemini-3.8-flash model access verified with Google. Actual drawing interpretation and benchmark run remain pending. Blocker: still open. Next: complete the work named in this item and cite on-disk proof before checking this box. [section 05]

The broader architectural roadmap is tracked in ARCHITECTURE-ROADMAP.md. No compliance or full-building completeness claim follows from AI output or software test success.

SC-01 through SC-05 are complete for the implemented review workflow and the recorded test scope. Real provider execution is explicitly excluded from these completion checks and remains LIVE-01. Web uses injected provider fixtures; native uses real configuration IPC and imported fixture backups. See proof/audit/IW-AI-MATERIALS/completion.md and README.md.
Document status: open (1)
