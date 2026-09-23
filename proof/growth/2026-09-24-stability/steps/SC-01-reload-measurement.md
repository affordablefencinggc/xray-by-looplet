# SC-01: reload measurement and current regression gates

Status: current gates PASS; historical-cause investigation remains OPEN.

DANS1, captured 2026-09-23 for the 25-30 Sep handover. Product source is unchanged from 8a6226fc93a6: 727 src files hash-identical. No persistence race was reproduced and no application patch is claimed.

- SC-09 development: 135/135; production: 138/138.
- Diagnostic startup runs: 138/138 development and 141/141 production, including pre-document instrumentation and recovery-order assertion. Development journal reads 390.8 ms, hydration ready 461.1 ms; production reads 100.8 ms, ready 131.8 ms. No project setItem occurred before recovery reads in either reload. This measures storage order, not every async side effect.
- Source-tool change: raw-CDP init-script installs instrumentation before each document executes; existing runner tests 6/6 and TypeScript exit 0.

[Development report](../campaigns/v1-sc09-baseline3/browser-results.json), [production report](../sc09-production-results.json), [startup dev](../startup-measurement-results.json), [startup production](../startup-production-results.json), [runner tests](../runner-tests-v1.log), [inspected screenshot](../captures/dev-reloaded-roof-highlight-desktop-1600x1000.png), [exact diff](../changes.diff).

Neither an invented dev-order-race unit test nor a speculative persistence patch is added. Earlier intermittent failures remain unexplained; these bounded passes do not establish universal graphics, long-session or installed reliability.
