# IW-GALLERY-REVIEW independent review, attempt 01

Verdict: **changes requested** for the screenshot verification gates. Live rendering passed. No gallery code or canonical task status was changed by this reviewer. This review does not assess the reviewer's own construction core or compatibility CLI.

## Blocking findings

**GALLERY-01 — source reports can validate while their gallery links are forbidden.** In `scripts/industry-ledger.mjs` screenshot validation, `reportPath` is checked for a matching file hash but not `artifactAllowed`. Replacing a screenshot's report with existing `package.json` and its correct SHA-256 leaves `validate(data).ok === true`, while `artifactAllowed(reportPath,data) === false` and the actual server returns 404. The user-visible proof claim can therefore have an inaccessible supporting report. Require a safe, allowlisted, nonempty regular report artifact before accepting capture metadata.

**GALLERY-02 — arbitrary text can satisfy mandatory screenshot proof.** The screenshot gate checks `.png` extension and SHA-256 without validating image content. The independent test writes a 34-byte text fixture named `proof/audit/IW-GALLERY-REVIEW/not-an-image.png`, supplies its correct hash and existing metadata, and constructs a fully bound independently attributed nonvisual verified-task fixture. The validator accepts it as `execution-capture` and accepts the task as verified. This defeats the new mandatory embedded-image gate even though a browser cannot display the file. Validate the declared image format/content sufficiently to reject non-images and incomplete images; retain independent real-browser decode proof as well. This does not claim that image parsing proves the truth of a screenshot's narrative.

Neither finding modified the live canonical ledger. Reproductions work on in-memory clones and write only a clearly named invalid-image fixture inside this review's proof directory.

## Passed checks

- Actual live gallery now contains **21 images** (author's earlier 19-image snapshot preceded current metadata additions). All 21 decoded in both 1280×900 desktop and 390×844 mobile browsers. No console/page errors or horizontal overflow.
- All distinct current image and supporting report URLs returned HTTP 200. Full-size images are served as image/png. Captions visibly carry source URL, scenario/result, classification, viewport/time and source identity; metadata fits within mobile cards. Baseline defects and non-UI execution reports are labeled explicitly.
- UI verified-task fixtures lacking screenshot metadata are rejected for before/before-mobile/after-desktop/after-mobile. Nonvisual fixtures lacking screenshot metadata are rejected for execution-capture. Nonlocal origins, zero-width viewport and mismatched report hashes reject.
- Real HTTP checks: loopback dashboard 200; write method 405; foreign Host/Origin 403; arbitrary source and environment paths 404; traversal/double-encoding 400. CSP limits images/scripts/styles to self and prevents framing; nosniff is present.
- Output uses `<img>` elements, not links alone. Current images are genuine decoded captures rather than placeholders. The server reads canonical file state without browser-side status edits.

## Exact proof and reviewed snapshot

- `proof/audit/IW-GALLERY-REVIEW/independent-tests-attempt-01.log`: 5 tests, 3 pass and the 2 reproduced findings fail as expected.
- `proof/audit/IW-GALLERY-REVIEW/review.test.mjs`: standalone independent reproductions; author must not alter these to hide failures.
- `proof/audit/IW-GALLERY-REVIEW/browser-results.json`: actual viewport/image dimensions/decodes, all checked URLs, timestamps and browser errors/overflow.
- `proof/audit/IW-GALLERY-REVIEW/http-results.json`: actual loopback safety responses.
- `proof/audit/IW-GALLERY-REVIEW/reviewed-source-hashes.json`: exact source and canonical metadata snapshot examined.
- `screenshots/industry-gallery-review/desktop-gallery.png` and `mobile-gallery.png`: actual gallery viewport captures, visually inspected together by this reviewer. `*-gallery-section.png` capture the entire featured gallery for detailed inspection.

Reviewed code hash for `scripts/industry-ledger.mjs`: `6d4f2811fd2025354804ca29dd7c51a0e61884829450122f8ffbe7f8faaaec4c`. Reviewed CSS hash: `03773757ea7fe5352f44e14ba2bbc8b0a536c4308d5735e1b8040b8ab3891895`. Other hashes are in the manifest. Branch/HEAD remain as recorded in startup; no commits made.

Next: author corrects the two gates and reports stable source. Reviewer reruns the unchanged reproductions, inspects the bounded fix and updates evidence in a new attempt. Canonical verification remains with the designated writer after this independent review passes. The current verdict is not approval of the gallery or whole tracker.
