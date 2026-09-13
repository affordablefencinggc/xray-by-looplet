# Nullable classification feedback

Changed classification schema descriptions and assistant adapter validation feedback. Explicit null remains accepted for a top-level parent and absent source. Empty strings/objects remain rejected with original field errors, followed by valid-null guidance and a prohibition on invented references. No default/coercion, new source inference or relaxed graph validation.

DANS1: 24 focused classification/adapter/form tests passed. Three staged source hashes match manifest.json. Regression uses the actual failed live argument pattern (parentId empty string, source empty object), verifies no mutation/coercion, and separately proves explicit null input yields exact0.3 with verifiedQuoteEligible:false. Source frozen; provider retest pending root signal.
