# Crown Wharf desktop update

User approved updating the old app and adding a shortcut.

Rebuilt the NSIS package from current Studio source. The stale installed executable was 11,865,088 bytes, dated September 4; the new installed executable is 58,239,488 bytes and contains Crown Wharf A4 and all current tools. Desktop and Start Menu entries use the existing install directory; no user profile deletion/reset occurred. Prior installed executable preserved in this proof directory.

Installed: C:\Users\danie\AppData\Local\X-Ray by Looplet\xray-by-looplet.exe
SHA-256: a7e60b2fff0b4499770654fcb9e53e9295f4ed570787e92f70a26c386ce3a419
Desktop shortcut: C:\Users\danie\Desktop\X-Ray by Looplet.lnk
Shortcut target and icon verified after saving; updated app launched (PID 94624).

The actual packaged and installed WebViews both passed original PDF SHA / 2,180-mesh tower render, native level-18 isolation and page-34 evidence, plus persisted source reload. Zero page/console errors. Screenshots in screenshots/crown-wharf-desktop inspected. This is native tauri.localhost proof, not the dev server.

Installer changes the three-byte Tauri bundle marker UNK to NSS; byte-for-byte comparison after that one expected substitution exactly matches the installed executable. The implementation of this marker was checked in local tauri-utils-2.9.3/src/platform.rs. bundle-identity.json records the exact comparison.

Initial sandboxed WebView launch could not start; approved execution outside the sandbox succeeded. One installed replay reused a restored QA profile and raced the already-loaded model; replay now uses a fresh isolated profile each run and passes. No product-code fix was needed. Temporary CDP test app processes closed. User-requested installed app left open; no dev/preview service started.

Build: npm run tauri:build -- --bundles nsis, exit 0, offline Cargo. build.txt, artifacts.json, native-qa.json, installed-qa.json and installed.json retain evidence. Current source was already verified by 587 tests and web build/typecheck in IW-CROWN-WHARF-3D. No source changed here; packaged source diff remains proof/audit/IW-CROWN-WHARF-3D/implementation.patch. Native replay and install/shortcut script retained here.

Recovery branch feat/model-wireframe-navigation, baseline 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. No staging/commit/merge/publication.
