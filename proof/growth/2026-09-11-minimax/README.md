# MiniMax default

MiniMax is the default for new, missing, invalid and unreadable provider preferences. Version 2 of the preference key resets old Gemini selections once; later explicit selections persist. Unknown endpoint/label fallbacks also resolve to MiniMax. Existing Gemini-only tool guards remain. Native MiniMax status now reports unavailable instead of displaying Gemini status; native MiniMax transport is not implemented and never reroutes to Gemini.

DANS1 verification: 7/7 provider tests; typecheck, focused tests and production web build passed. Source SHA-256 `d6ac611802d352a498d593b4a7589d4986917c0f4ec3117e97fcc6936f2ac0e7`. Dev and production Fast CDP each passed 10/10 operations, including reload with an old Gemini preference, visible MiniMax selection, and no Gemini status request. Screenshots visually inspected; no uncaught runtime errors. No paid AI response was requested. Test environment has no provider credentials. No deployment or native package build claimed.

Incremental code diff, build receipt, screenshots and identity-checked test process cleanup are retained here.
