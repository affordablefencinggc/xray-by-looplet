# Background cleanup

Approved: user requested unused agent-owned processes be killed within 10 minutes. Durable rule: AGENTS.project.md. This is an agent operating rule, not an installed scheduled service. Current preview and normal apps are retained. Cleanup results are recorded beside this file.


## 2026-09-08 - 10-minute idle cleanup rule applied

User authorized termination of unused agent-owned X-Ray processes within10minutes. Rule saved in AGENTS.project.md: immediate cleanup at completion,10-minute maximum idle reuse, verified PID/creation/command, bounded graceful close then termination, preserve active user preview and all data. This is an agent operating rule, not an installed scheduler.

Executed cleanup: nine local processes stopped (one lingering test app, six completed test helpers, two superseded SSH tunnels); followup verification found none remaining. Twelve superseded Dans1 previews stopped; only currentcandidate71f5b012342b preview and its wrappers remain. Local8080development and8095currentpreview retained. The old native shutdown issue remains unresolved; terminating the test process is cleanup, not a product bug fix. Evidence: proof/growth/2026-09-08-process-cleanup/.
