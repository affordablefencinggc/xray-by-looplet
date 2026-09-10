# Model switch above the composer — 2026-09-10

A model switch sits at the right of the row above the text input, beside the permission modes. It selects which server route the assistant talks to. Gemini remains the default and the verified provider.

## Verified live

Fast CDP against the development server, desktop 1280x800 and tablet 1024x768, exit 0.

| Assertion | Desktop | Tablet |
|---|---|---|
| Sits above the input, on the right | true | true |
| Menu stays inside the panel | true | true |
| Menu opens within the viewport | true | true |
| Smallest option height (touch target) | 65 px | 50 px |
| Default label with no stored choice | Gemini | — |
| After choosing MiniMax | MiniMax, stored `minimax` | — |
| After a full reload | MiniMax | — |
| Escape closes the menu only | — | menu closed, panel still open |
| Page errors | none | none |

Screenshots inspected: `desktop-02-menu-open.png`, `desktop-05-menu-within-panel.png`, `tablet-01-menu-open.png`.

## A layout fault found and fixed during the run

The first desktop screenshot showed the menu spilling past the panel's left edge onto the canvas, because it was anchored to the small button. It now anchors to the controls row and is bounded by the panel width. Re-run asserts `WITHIN_PANEL:true` with the menu at x=891 inside a panel starting at x=880. Both screenshots are kept, so the before and after are both visible.

## Design decisions

- **A menu, not a segmented control.** The permission modes beside it already use the segmented shape; repeating it would make two unrelated choices read as one group.
- **Opens upward.** The control sits directly above the composer, so a downward menu would cover the input.
- **Disabled during a turn.** Swapping mid-turn would leave an in-flight request answering to one route while its tool calls went to another.
- **Limits stated before the choice.** The MiniMax entry says plainly that it has no image input and no grounded web search, rather than letting a user discover that from a failure.
- **Unknown values fall back to Gemini.** A persisted value from a future build resolves to a working route rather than `fetch(undefined)`.

## Gates

6 new tests in `provider.test.ts`; full suite 1,141 tests across 88 suites pass, up from 1,135; `tsc --noEmit` exit 0; eslint clean on the new files; `git diff --check` clean.

## Not claimed

MiniMax has no configured credential, so selecting it will report that it is not configured until a key is added. No live MiniMax request has succeeded. The switch is web-only: native builds carry the Gemini transport alone and are unchanged.
