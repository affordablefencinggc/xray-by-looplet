#!/usr/bin/env node
import { runWorkbenchPaneAudit } from "./workbench-pane-audit.mjs";

const result = await runWorkbenchPaneAudit({
  auditName: "feature-audit",
  viewport: { width: 1400, height: 900 },
});

console.log(JSON.stringify(result.summary, null, 2));
process.exitCode = result.ok ? 0 : 1;
