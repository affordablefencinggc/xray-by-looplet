# Parser-4 initial packaging failure

The first parser-only DANS1 invocation exited 1 after its real-log, synthetic-case and aggregate assertions, at the final diff-generation command: `The term 'git' is not recognized as the name of a cmdlet, function, script file, or operable program.` It produced no final results receipt.

Its generated parsed-case receipts remain preserved at this directory's `parsed/` paths. No product gate ran. Machine-2 originals were not edited. The retry uses the same changed parser helper, SHA-256 `d4c874de43964e8b6c3292a122696abc50bc30895f16c7b0db54f34d115d2546`, and a locally generated exact Git diff against the prior spawn-3 helper (`3e257cee8ef65e57688ff2e6d7cd29f428e6ad729ab6ae19467f4e6f31ce472a`). Local diff generation is source packaging, not product testing.

The corrected parser-only verifier runs into fresh `retry-1/`; it does not overwrite these initial receipts. A successful derived result does not substitute for the separately authorized fresh machine-3 qualification.
