/** Validate executed Cargo proof, including required current test names. */
export function parseCargoProof(text, path, requiredTests = []) {
  const matches = [...text.matchAll(/test result: (ok|FAILED)\.\s+(\d+) passed;\s+(\d+) failed;\s+(\d+) ignored/gu)];
  if (matches.length === 0 || matches.some((match) => match[1] !== "ok" || Number(match[3]) !== 0)) {
    throw new Error(`${path} is not a passing Cargo test result.`);
  }
  const executed = matches.reduce((sum, match) => sum + Number(match[2]), 0);
  if (executed < 1) throw new Error(`${path} did not execute any tests.`);
  const lines = new Set(text.split(/\r?\n/u).map((line) => line.trim()));
  for (const name of requiredTests) {
    if (!lines.has(`test ${name} ... ok`)) {
      throw new Error(`${path} lacks current passing test: ${name}`);
    }
  }
  return { resultGroups: matches.length, executed, failed: 0 };
}