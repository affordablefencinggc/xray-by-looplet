# Run 197ab630793e launch record

- Explicit parent SOURCE FREEZE: scope SHA256 `47df19d2548b7bcb0d3d3afaba25d0904eb2bccb74d9335293ca49558ce5110c`, 15 files; guard passed before packaging.
- Web snapshot: 524 files, SHA256 `197ab630793e7604fde06b80e8b27e20ac82e84c145ff93ef58ced9829da205b`; native snapshot: 101 files, SHA256 `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7`. Every archive, manifest and transferred worker script hash verified on Dans1.
- First worker launch failed before build creation: PowerShell reported running scripts disabled (`PSSecurityException`, `UnauthorizedAccess`). No gate started.
- Launcher corrected to pass process-scoped `-ExecutionPolicy Bypass` for the already verified authorized worker scripts. No permanent machine execution-policy setting was changed. Second launch verified all 625 source files and began normally with Node v24.20.0.
- Parent source, prepared worker, package files, and transferred source identity were unchanged by this launcher correction.
