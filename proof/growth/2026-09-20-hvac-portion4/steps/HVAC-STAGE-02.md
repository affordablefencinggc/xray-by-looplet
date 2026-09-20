# HVAC-STAGE-02 - straight sections and safe editor (WIP checkpoint)

Requirements: SC-12 visible rectangular/round duct and external insulation envelopes; SC-13 invalid editor values cannot destroy the saved network.

Source: `hvac4-b7c73f1b5f8d`, [frozen manifest](../source/freeze2.json), based on pushed `7f043fe6`. [Exact source diff](../source/stage2.patch).

DANS1 execution:
- [Machine gate](../machine2/results.json): 2,058/2,058 tests, TypeScript and scoped lint pass with zero warnings/errors.
- [Development browser](../campaigns/hvac4-straight-dev2/output/browser-results.json): 76/76 pass, no browser errors. Real form inputs produce 16 m2 metal, 64 kg declared mass and 18.5 m2 wrap (18 m2 exterior + 0.5 m2 longitudinal lap). Adding a round section produces 18.513274 m2 total and withholds total mass because the new section has none supplied.
- A zero-width edit is rejected and the saved network retains 0.4 m. Network errors/corrections, export invalidation, desktop/tablet layouts and successful draft save also exercised.
- [Failed dev1](../campaigns/hvac4-straight-dev1/output/browser-results.json) preserved: test selector incorrectly assumed a label used a single DOM text node. Corrected test selects combined label text; no product change was required for this failure.

Inspected screenshots: [straight wrap desktop](../campaigns/hvac4-straight-dev2/output/captures/straight-wrap-desktop.png), [tablet](../campaigns/hvac4-straight-dev2/output/captures/straight-wrap-tablet.png), [round + rectangular / unknown mass](../campaigns/hvac4-straight-dev2/output/captures/round-and-rectangular-desktop.png).

Status: source/development verified, latest production build and browser qualification pending at this automatic checkpoint. The earlier full development reload failure remains open; this bounded development campaign intentionally does not claim reload acceptance. Preview meshes are display envelopes, not fabricated sheet thickness or independently measured quantities.

Stage 1 was pushed as `7f043fe6d9bb153c3f89be4d4913fdfac4dbba5c` and origin was read back at that exact hash. This checkpoint triggered at 105 pending files, before adding this record/diff. Continue automatically with the required build worker and production checks after push.
