import { z } from "zod";
import { writeFile, readFile } from "node:fs/promises";
import {
  constructionJobSchema,
  quantityResultSchema,
} from "../../src/studio/construction/contract.ts";

// JSON Schema encodes structure. Cross-record identity, evidence closure, immutable transitions,
// simple polygon validation and recomputation MUST also use the named runtime validators.
const entries = [
  [
    "construction-job-v1.schema.json",
    constructionJobSchema,
    "constructionJobSchema.parse + validateJobTransition",
  ],
  [
    "quantity-result-v1.schema.json",
    quantityResultSchema,
    "parseQuantityResult + validateQuantityAgainstJob",
  ],
];
for (const [name, schema, validator] of entries) {
  const output = {
    ...z.toJSONSchema(schema, { target: "draft-2020-12" }),
    $comment:
      "Structural schema only. Custom semantic refinements are not representable in JSON Schema; passing this schema alone does not establish a valid or verified estimate. See planning/industry-contract.md.",
    "x-required-semantic-validator": validator,
  };
  const expected = JSON.stringify(output, null, 2) + "\n";
  const url = new URL(name, import.meta.url);
  if (process.argv.includes("--check")) {
    if ((await readFile(url, "utf8")) !== expected)
      throw new Error(`Stale structural schema: ${name}`);
    console.log(`PASS structural schema freshness: ${name}`);
  } else {
    await writeFile(url, expected, "utf8");
    console.log(`Wrote structural schema: ${name}`);
  }
}
