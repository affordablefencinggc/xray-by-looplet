# Focused calculator first-turn live retest

One unchanged manual fixture prompt at2026-09-13T10:35:24Z. Actual classify_draft_quantities call_1f4917677fbe45ce9d608b53 succeeded: exact0.3m2 total/classified, no unclassified items, draft-classification, verifiedQuoteEligible:false. Call arguments explicitly preserve parentId:null and both source:null. Receipt agrees with manual form arithmetic. No project mutation. Provider idle.

Remaining defect: delivered explanation says omitting parentId is accepted and developer review recommends omission. This is FALSE: the successful call explicitly sent null, and field omission is schema-invalid. Review also discusses previous failed attempts rather than this current successful call. Screenshot after.png visually inspected; no claim of fully accurate final/developer review.

Actual reload completed (slow startup) and exact project/archive/draft comparisons all true. Previous failed turns remain visible history. Browser remains open. No app source changes or further model requests during this retest.
