# Bundled engine runtime

DANS1 release-profile native tests: 47 passed (41 existing + six new resolver tests). Logs included. Source hashes matched local/remote: lib.rs 255738d0bc81e889702e4a8eeb49dd65caa1160635f2692c846792c80ea8965c; bundled_engine.rs 9fc69e3fcffbf867e2167cdb8018ca93e3495e6b7f3d1be577bec369d79e8dba.

Tests exercise absent/malformed build identity, invalid explicit override refusing fallback, missing/tampered resource, path escape, actual Windows root junction rejection, repeated hash validation after replacement, and status/BOM command selection consistency. Commands are constructed but fixture bytes are never executed. Existing native transport/cancellation/source-binding tests remain passing.

The managed factory is selected once at setup and shared by status and BOM. Bundled commands require Windows, the fixed engine/bin/xray-engine.exe resource, an embedded expected SHA, and repeated ancestor/reparse/content validation. Explicit override retains existing ConfiguredRunner validation and is never silently replaced. No persistent environment mutation, dependency, Cargo manifest or build.rs changes.

Test snapshot reused isolated native-handshake source/target, not a qualified build target. Initial compile caught a missed old constructor call and Tauri's borrowed-State async return restriction; both corrected before final tests. Current status uses owned AppHandle to obtain the shared managed Arc, preserving response shape.

Acceptance limits: this is runtime integration and command-construction proof, not installed resource/installer proof. Root owns verified staging, compile-time expected hash, resource config and real no-override native UI qualification. Validation reduces accidental/tampered resource execution but does not claim to eliminate an adversarial filesystem race between verification and process creation. Windows execution security remains enabled and authoritative. All test processes finished.
