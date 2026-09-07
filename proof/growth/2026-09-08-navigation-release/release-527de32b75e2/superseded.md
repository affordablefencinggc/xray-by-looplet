# Superseded navigation candidate

Source `527de32b75e2f6aa1548c1e851aaabfa89009b6497fde95a2fc2d7c67892e0f4` passed dependency restore, typecheck, 110 focused tests, web build and native NSIS build (146.29 seconds), with observed High priority and 16 workers. The build completed before any preview or installation was started for it.

This candidate is **superseded**, not final acceptance: live tablet QA found upper Fly/Walk controls around 29.9 pixels high (Fly 28.5 pixels wide) at 1024 pixels. The five lower controls remained 44 pixels. Root is applying a scoped `sourceBuilding.css` correction and will freeze a new snapshot. These logs are retained, with the failed visual boundary explicit. No old production preview is launched and no unused large artifact bundle is copied locally.

Its compiled native cache may be copied into a new independent target only after source identity, successful completion and executable SHA verification. Native source SHA-256 `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7`; compiled executable SHA-256 `afa442a098beb90b313713da77350a9b1bda0986fa687455745dcbff88840313`. A successful cache is not evidence that the superseded user interface passed tablet acceptance.
