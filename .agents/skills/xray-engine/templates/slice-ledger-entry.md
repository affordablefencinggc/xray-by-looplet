## [<REQUIREMENT-ID>] <Short task title>

**Date:** <YYYY-MM-DD>  
**Branch:** `<branch-name>`  
**Commit / working state:** `<commit-sha-or-uncommitted>`  

### Scope

<One concise paragraph describing the user-visible and technical outcome.>

### Checklist

- [x] `<REQUIREMENT-ID>` — <exact requirement text or concise mapping>
- [x] Evidence / provenance impact reviewed
- [x] Desktop proof captured
- [x] iOS mobile proof captured
- [x] Logic proof captured where applicable

### Files changed

- `<path/to/file>`
- `<path/to/file>`

### Exact diff summary

<Describe the actual behavioural changes. Do not claim work that is not in the diff.>

### Evidence and data status

- **Document source:** `<sample | web | desktop | derived | unknown>`
- **SHA-256 status:** `<verified | unchanged | not applicable | blocked>`
- **Calibration status:** `<valid | missing | conflicted | not applicable>`
- **Affected evidence states:** `<source-measured, source-traced, inferred, etc.>`
- **Quote / BOM status:** `<blocked | draft-only | review-required | quote-ready>`
- **Limitations:** <Explicit assumptions and exclusions.>

### Verification executed

```text
<exact command>
<result summary>
```

```text
<exact command>
<result summary>
```

### Visual proof

- Desktop: `<screenshots/requirement-desktop-after.png>`
- iOS 390×844: `<screenshots/requirement-ios-after.png>`
- Interaction state: `<screenshots/requirement-ios-interaction.png>`

### Result

<What is proven by the screenshots and test output.>

### Remaining work

- <Any known limitation, intentionally deferred item, or manual review requirement.>
