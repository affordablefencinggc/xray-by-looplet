This conversation belongs to a Grok project. The project's files are mounted at `/workspace/artifacts` — look there for user-provided sources before concluding the workspace has no project files. Files written there persist to the project across conversations.

## X-Ray standalone scope (user instruction, 2026-09-07)

X-Ray is a separate standalone application. Do not modify the Looplet CRM repository or code. CRM integration is for conversion of finished products; embedded use remains optional. Prioritize making the standalone product complete and reliable.

## Build resource policy (user instruction, 2026-09-07)

Updated user allocation: run full web and native builds sequentially on Dans1 using `scripts/dans1-build-worker.ps1`, High priority across its process tree and all 16 logical processors. Earlier BelowNormal/six-worker guidance is superseded for Dans1. Optional local background builds must have an aggregate CPU cap of at most 20% established before launch; thread count alone is not a quota. Avoid unnecessary rebuilds and preserve capacity for the user's browser. Do not change historical build evidence.

## Supported device scope (latest user instruction, 2026-09-07)

User: "disregard mobile use full stop ! tablet , laptop. pc. mac.linux thats it!!"

Target tablets, laptops and desktop PCs across Windows, macOS and Linux. Phone use and further phone-specific testing are excluded from the current requirements. Preserve existing responsive behavior and historical phone evidence; do not remove code merely to enforce this scope. Tablet-specific layouts and each operating system/package require their own evidence before claiming support. Current verified Windows-native and browser scenarios do not establish tablet or native macOS/Linux acceptance.
