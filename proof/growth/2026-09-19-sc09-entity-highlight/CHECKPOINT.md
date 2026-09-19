# SC-09 checkpoint — work in progress

Historical first checkpoint (`0ea3f83`). For current source and proof limits after the second push (`a2935a9`), see [PROGRESS-20260919T1205.md](PROGRESS-20260919T1205.md). Do not read the historical failure below as the latest campaign result.

This checkpoint is not completion. SC-09 remains `[[partial]]`; SC-10 remains `[[pending]]`. The dashboard has not been regenerated.

**Grok hover log (reply here every cycle):** [CODEX-HOVER-LOG.md](../../../CODEX-HOVER-LOG.md). Fill the newest `### Codex confirmation` block. Silence is not confirmation.

## Implemented

QS items bind explicit measured entities, retain their geometry/source/calibration identities and fail closed for moved geometry, duplicate references, sample/inferred rows, foreign projects and unavailable source bytes. Coordinated 2D and 3D previews use the exact run identity. The browser scenario edits a real plan vertex through raw CDP input.

The shared `IndustryDraftWorkbench.tsx` and `IndustryDraftHost.tsx` were restored to their original contents. A QS-specific context provider in the Costs page now supplies geometry without changing that shared component contract. This final provider refactor still needs a fresh DANS1 execution.

## Executed evidence and limits

- DANS1 snapshot `84cadc02ab35`, source archive SHA-256 `258084dec17de466517d5c72f19ed03070e5149918031f3551421550582b4284`: [111 focused tests passed](dans1-84cadc02ab35/sc09-focused.stdout.log) and [typechecking passed](dans1-84cadc02ab35/typecheck.stdout.log).
- With separately hashed unchanged test-support inputs, [the full suite passed 1,878 tests](dans1-84cadc02ab35/full-tests-with-support2.stdout.log), with [the DANS1 execution receipt](dans1-84cadc02ab35/full-tests-with-support2.json). This is the pre-provider-refactor snapshot, not proof of the latest source.
- [Browser campaign dev3 failed](campaigns/sc09-84cadc02ab35-dev3/output/browser-results.json) on a boot-guard SSR hydration mismatch before the QS journey. That failure remains open. No successful screenshot or browser interaction proof exists for this checkpoint.
- Production build, current-source browser screenshots, tablet inspection and per-step completion records remain outstanding. No deployment/native-device acceptance is claimed.

## Git and ownership

User explicitly requested committing/pushing checkpoints and resolving conflicts. Only explicit SC-09 source, runner and evidence paths are included. Other chats' persistence work, untracked SC-10 work, old probes and the stray `20` are not part of this checkpoint. See [the exact checkpoint diff](checkpoint.diff).
