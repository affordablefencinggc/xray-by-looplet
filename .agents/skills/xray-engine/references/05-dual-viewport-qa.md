# Fast CDP and Dual-Viewport QA

## Purpose

This document defines the mandatory browser, console, responsive, and visual proof
requirements for X-Ray UI, interaction, and Three.js changes.

## Required viewports

### Desktop

Use one of:

```text
1280x800
1440x900
```

Default proof viewport:

```text
1280x800
```

### iOS mobile

Use:

```text
390x844
hasTouch: true
isMobile: true
deviceScaleFactor: 1 or 3
```

The viewport must emulate touch interaction sufficiently to reveal mobile-only layout,
drawer, target-size, and scrolling defects.

## Error budget

The allowed error budget is zero:

- Zero unhandled console errors.
- Zero uncaught page errors.
- Zero page crashes.
- Zero hydration mismatch warnings.
- Zero unexpected failed essential requests.
- Zero horizontal page overflow on mobile.

Warnings that originate from an explicitly documented third-party library issue may only
be accepted after recording the exact warning and reason in `walkthrough.md`.

## Fast CDP strategy

Preferred automation is declarative JSON opcode streaming through a hot Chrome DevTools
Protocol connection.

Primary implementation may include:

```text
scripts/fast-cdp-test.mjs
scripts/browser-smoke.mjs
```

Where browser compatibility is required on Windows, use Playwright with:

```ts
{ channel: "msedge" }
```

Do not depend on a browser setup that cannot run in the project’s target environment.

## Mandatory UI proof

For every UI, visual, responsive, CAD, shader, or 3D interaction change:

1. Open the affected route.
2. Capture Desktop proof.
3. Capture iOS proof.
4. Execute at least one meaningful interaction.
5. Capture a post-interaction state if the task changes interaction.
6. Collect console and page errors.
7. Check document width against viewport width.
8. Confirm interactive targets satisfy the 44 px minimum where applicable.
9. Log screenshots and findings in the walkthrough ledger.

## Required checks

### Horizontal overflow

In browser automation:

```js
const hasHorizontalOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
```

Expected:

```text
false
```

### Minimum touch targets

For intended touch controls, verify width and height where feasible:

```js
const tooSmall = await page.locator("[data-xray-control]").evaluateAll((elements) =>
  elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((item) => item.width < 44 || item.height < 44),
);
```

Expected:

```text
[]
```

### Console capture

Treat these as failures:

- `console.error`
- page `error`
- browser `crash`
- hydration mismatch text
- unhandled promise rejection

## Server discipline

### Development server

Must bind:

```text
0.0.0.0:8080
```

### Production preview

Must bind:

```text
127.0.0.1:8081
```

Use the repository-defined preview command:

```bash
npm run preview:restart
```

Do not assume ports are available. Inspect the active process first.

On Windows:

```bash
netstat -ano | findstr :8080
netstat -ano | findstr :8081
tasklist /FI "PID eq <pid>"
```

## Screenshot naming

Use readable, deterministic names:

```text
screenshots/<requirement-id>-desktop-before.png
screenshots/<requirement-id>-desktop-after.png
screenshots/<requirement-id>-ios-before.png
screenshots/<requirement-id>-ios-after.png
```

If there is no meaningful before state, use only `after`.

## Proof standard

A screenshot proves appearance at a particular viewport and application state.

It does not prove:

- Geometry correctness.
- Scale correctness.
- Calibration correctness.
- Quote correctness.
- Source provenance.
- Test correctness.

Pair visual proof with executed test or validation proof where the change affects logic.
