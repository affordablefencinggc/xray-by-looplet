import type { AssistantContent, AssistantDeclaration } from './contract.ts';
import { unsupportedFinalToolClaims, type ToolClaimOutcome, type UnsupportedToolClaim } from './finalToolClaims.ts';
import { WITHHELD_CANDIDATE_PREFIX } from './shortInteraction.ts';

const CALCULATORS = new Set(['calculate_draft_roof_area', 'calculate_draft_duct_material', 'classify_draft_quantities', 'calculate_draft_roof_sheet_coverage', 'calculate_draft_duct_wrap']);
const CONTEXT_READS = new Set(['read_project_context', 'read_workflow_route']);

/** A focused model retry, not execution authorization or a guarantee of tool use. */
export function createNamedToolRetry(input: {
  originalUserRequest: string;
  declarations: readonly AssistantDeclaration[];
  unsupportedClaims: readonly UnsupportedToolClaim[];
  currentTurnOutcomes: readonly ToolClaimOutcome[];
  alreadyRetried: boolean;
}): { declarations: AssistantDeclaration[]; instruction: string; toolName: string } | null {
  if (input.alreadyRetried) return null;
  const eligible = input.unsupportedClaims.filter(claim => claim.reason === 'not-executed'
    && CALCULATORS.has(claim.name)
    && input.declarations.some(declaration => declaration.name === claim.name)
    && !input.currentTurnOutcomes.some(outcome => outcome.name === claim.name && outcome.invoked)
    // Reuse the explicit imperative/negation boundary; a caller cannot promote an unrelated request.
    && unsupportedFinalToolClaims(input.originalUserRequest, [claim.name], `Tool receipt: ${claim.name}`, []).length > 0);
  const names = [...new Set(eligible.map(claim => claim.name))];
  if (names.length !== 1) return null;
  const toolName = names[0];
  return {
    toolName,
    declarations: structuredClone(input.declarations.filter(declaration => declaration.name === toolName || CONTEXT_READS.has(declaration.name))),
    instruction: `[xray:tool-claim-check] One focused retry: the explicitly requested ${toolName} has not been invoked in this turn. Use its declared function-call interface with the original user-supplied operands and references below. Do not substitute stored or historical values. If a required input is missing or ambiguous, ask for it; never invent arguments. No completed current-turn call or mutation should be repeated. This instruction does not authorize any project edits. Report only actual current-turn receipts; a prose promise or copied result is not execution. Original user request (preserved verbatim as JSON): ${JSON.stringify(input.originalUserRequest)}`,
  };
}

/** Remove only withheld model prose from provider input; preserve the original audit and protocol. */
export function providerContentsWithoutWithheldText(contents: readonly AssistantContent[]): AssistantContent[] {
  return structuredClone(contents).flatMap(entry => {
    if (entry.role !== 'model') return [entry];
    const parts = entry.parts.flatMap(part => {
      if (!part.text?.startsWith(WITHHELD_CANDIDATE_PREFIX)) return [part];
      const { text: _withheldText, ...rest } = part;
      // A combined part can carry a real function protocol item or media; never drop those.
      return rest.functionCall || rest.functionResponse || rest.inlineData ? [rest] : [];
    });
    return parts.length ? [{ ...entry, parts }] : [];
  });
}
