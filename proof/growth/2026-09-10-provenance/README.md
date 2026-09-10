# Making the open project obvious — 2026-09-10

Raised after an assistant reply described a 36-page structural PDF and calibrated sheets on a project the user expected to be empty. The worry was fair: if a user cannot see which job an action landed in, "is it copying someone else's work?" is a reasonable thing to ask.

## First, the diagnosis: nothing was leaking

The live browser state and the reported screenshot were two different profiles.

| | Reported screenshot | Inspected profile |
|---|---|---|
| Project | Crown Wharf A4 | New project |
| Documents | crown-wharf-a4-structural.pdf, 36 pages | "No source plan" (sample) |
| Registry | several tabs | none |
| Shelved projects | — | 0 |

The Crown Wharf PDF had genuinely been imported into that project, so the assistant was reporting its own project's contents. Tools read `state.job.documents` for whichever job is open, every design tool is bound to a project id, and `assertContext` already stops a turn if the project changes mid-flight.

A new project is also genuinely blank: a fresh unique id, zero measurements, revision 1, and one placeholder document named "No source plan" with a null hash and `source: "sample"` so the sheet pane has something to render. That placeholder is not anyone's drawing.

## What was still missing

Being correct is not the same as being visibly correct. Three changes make the open project impossible to mistake.

**1. A "New" button in the top header, beside "Open".** Starting an empty project previously meant the assistant's `+` menu, then Projects, then New project. It now sits where a user looks for it. It confirms first, and the confirmation names what is being closed and how many imported drawings it holds. The open project is saved through the same compare-and-swap path a normal save uses, and the switch rolls back if any write fails.

**2. The assistant banner names the project, always.** It read "Your drawing workspace". It now reads the project name first, then the drawing, or "· no drawing imported" when there is none.

**3. Every tool receipt is stamped with the project it acted on** and the revision it produced. The project is read from the live store at the moment the row is created, not from a closure, so a stale value cannot be recorded. The transcript itself now answers which job each action touched.

## Verified live

Fast CDP, desktop 1280x800, exit 0:

| Assertion | Result |
|---|---|
| Header carries both New and Open | true |
| New sits beside Open, same row, 36 px | true |
| Assistant banner names the project | "New project · no drawing imported" |

Screenshot `desktop-02-project-banner.png` inspected: New is in the header beside Open, and the banner names the open job above the conversation.

## Gates

Full suite 1,145 tests across 88 suites pass; `tsc --noEmit` exit 0.

## Not claimed

The per-receipt project stamp is proven by construction and typecheck, not yet by a live run: the provider quota blocked a real tool-calling session in the browser at the time of writing. It should be confirmed in the next live session that produces tool receipts.
