# SC12-STRAIGHT-WRAP-04 - qualified draft arithmetic and section preview

Requirement: rectangular/round surface quantities, outside insulation envelope and unknown partial mass.

Executed reference fixture: 10 m x 0.5 m x 0.3 m gives 16 m2 metal; supplied 4 kg/m2 gives 64 kg; 25 mm external insulation plus 50 mm longitudinal lap gives 18.5 m2 wrap. Adding 2 m of 0.4 m round duct gives 18.513274 m2 total, with total mass withheld until every section has a mass operand. Saved inputs and results rechecked after production reload. All values remain supplied drafts.

Inspected screenshots: [desktop](../campaigns/hvac4-final-built1/output/captures/straight-wrap-desktop.png), [tablet](../campaigns/hvac4-final-built1/output/captures/straight-wrap-tablet.png), [round + rectangular](../campaigns/hvac4-final-built1/output/captures/round-and-rectangular-desktop.png), [reloaded tablet](../campaigns/hvac4-final-built1/output/captures/straight-reloaded-tablet.png).

SC-12 remains partial: the existing declared gauge/thickness/density basis is tested for galvanized steel, aluminum and stainless but still needs a reviewed table-to-worksheet UI. No normative gauge thickness is inferred. Air velocity is not a physical operand in sheet mass; missing velocity remains unknown in the separate airflow schedule, rather than altering an explicitly supplied areal mass. The ledger's broader material-basis requirement is not silently marked complete.


DANS1 final source: hvac4-b7c73f1b5f8d, [manifest](../source/freeze2.json). Exact code: commits 7f043fe6 and 3b42c063; [stage 1 diff](../source/stage1.patch), [stage 2 diff](../source/stage2.patch). [Machine gate](../machine2/results.json): 2058/2058 (203 + 858 + 997), TypeScript exit 0, scoped lint exit 0 with no warnings. [Required build worker](../build2/results.json) PASS, High priority/all 16 CPUs; [worker completion](../build2/worker-completion.json). [Development](../campaigns/hvac4-straight-dev2/output/browser-results.json) 76/76 and [final production](../campaigns/hvac4-final-built1/output/browser-results.json) 99/99 PASS, zero browser errors and owned-process cleanup recorded. No deployment, native package or live tablet certification. The historical development reload failure at 37/46 remains open; the bounded 76-operation dev pass excludes reload.
