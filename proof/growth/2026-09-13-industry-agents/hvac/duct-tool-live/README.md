# HVAC live duct calculator ? first integrated attempt

DANS1 user-visible assistant invoked calculate_draft_duct_material once for explicit synthetic inputs:10m length,0.5m width,0.3m height,4kg/m? supplied sheet mass. The actual receipt returns16m?,64kg, draft-unverified and verifiedQuoteEligible:false, with explicit exclusions. This is not a measured source, engineering sizing or a quote. Full project before/final JSON is unchanged.

Arithmetic/tool execution PASS, final response FAIL. The generic missing-workflow guard blocked completion after two model corrections. No final developer review was emitted. final.json preserves the actual tool receipt and error with busy:false; verdict.json distinguishes the two results. result.png was visually inspected and shows the completed tool row plus workflow error.

Root is correcting successful pure-calculation routing before the next authorized retry. No extra message was sent by this observer. Browser/tunnel retained for root; scripts exited. Last capture09:35:53.778Z.
