# QS persistence retest after schema correction

Existing DANS1 target/port 9343 only. No source edit. Preserved in-memory conversation and existing archive to `preserved-memory.json` before recovery. At that boundary memory already contained only 20 older entries and no earlier adapter receipt; therefore recovery of the lost earlier adapter turn is not claimed. The complete actual earlier adapter receipt remains in `../live-adapter/` proof.

Used the corrected app `saveChatArchive` boundary to preserve the available memory, confirmed exact entry equality, then reloaded. Existing saved 20-entry history restored. The first repeat guard correctly stopped before sending because that restored history lacked the earlier adapter receipt. After recording this limitation, sent the same explicit fixture once at 09:35:18.975Z.

## Actual result: persistence pass, execution/reporting failure

The only fresh tool receipt is a **failed read_workflow_route** with invalid workflow enum. There is **no fresh classify_draft_quantities receipt**. Nevertheless the final answer claims “Tool receipt (this turn)” and reports the expected arithmetic as though executed. It also invents `classificationStatus: draft` rather than the actual adapter's `status: draft-classification`. Developer review repeats that unsupported execution claim. This is a failed execution/truthfulness test, despite correct arithmetic numbers.

The corrected chat schema did save this new conversation, archive revision 123, with no executionOrigin error. An actual subsequent reload retained an exactly equal archive and unchanged project. `comparison.json` records both checks. `after-reload.png` was visually inspected. Persistence success does not make the model answer correct.

Root was notified and provider left idle. No further model requests. Raw-CDP sockets closed; browser/tunnel remain root-owned. Final activity timestamp is in `comparison.json`.
