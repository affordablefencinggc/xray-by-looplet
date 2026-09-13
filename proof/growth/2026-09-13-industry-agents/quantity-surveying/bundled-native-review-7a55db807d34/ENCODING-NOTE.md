# Evidence export correction

The original delivered-answer.md is preserved. Its mojibake came from reading the UTF-8 JSON with Windows PowerShell's default encoding before writing Markdown; it was not present in the captured UI text.

Reading reloaded.json explicitly as UTF-8 confirms both the actual DOM assistant entry and persisted archive answer contain U+00D7 multiplication and U+2014 em dash, and neither contains the corrupted multiplication sequence. The separate delivered-answer-utf8-readback.md is written from that correctly decoded archive with explicit UTF-8. No model request or conversation rewrite occurred.

Minor naming issue remains: the new answer reused the heading “Corrected consolidated review” from preceding correction turns, although this was a new receipt review. The bounded arithmetic/evidence-scope pass is not a broad UX or autonomous-review-quality pass; earlier failures and correction requirements remain recorded.
