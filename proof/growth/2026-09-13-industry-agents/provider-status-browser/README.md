# Provider status switching

DANS1 development preview, current provider UI and transport changes. The successful `provider-status-browser-1132` campaign executed 22 raw-CDP operations and disposed its temporary browser context. It held an actual Gemini status response, switched back to MiniMax, then released the old response. The selected provider retained its own freshly requested status. Only GET status requests occurred; this is not model authentication or task-execution proof.

Root visually inspected the desktop and 1024 x 768 tablet screenshots. Provider options and composer were readable, with no horizontal overflow or recorded runtime errors. The status now says Configured because configuration presence does not establish successful authentication.

The earlier 1128 run failed because the preview tunnel was no longer available. The 1130 runner attempted to query a React menu before it rendered; the corrected runner separates the click and exact DOM wait. Both failed runs remain preserved.

Focused DANS1 transport/provider tests and type checking are recorded in `../hvac/provider-status-check/`. Production-build acceptance remains separate until recorded against the new immutable build.
