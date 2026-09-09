# Native build setup references

- [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/): Microsoft C++ tools and Rust.
- [Microsoft native build-tools example](https://github.com/microsoft/vs-dockerfiles/blob/main/native-desktop/Dockerfile): official bootstrapper and C++ workload.
- [Microsoft installer command-line reference](https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio?view=vs-2022): quiet, wait, no-restart and component selection.
- [Rust installation](https://rust-lang.org/learn/get-started/): official x64 Rustup download.

Setup is restricted to Dans1. Microsoft Authenticode and Rustup SHA256 are verified before execution. Rust 1.98.0 matches the local compiler. Rust paths remain under the isolated X-Ray toolchain; no system PATH modification requested. C++ tools use `C:\BuildTools\XRay`.
