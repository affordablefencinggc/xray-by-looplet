import { z } from 'zod';
import { straightDuctScheduleSchema, calculateStraightDuctDraft } from './straightDuct.ts';

export const name = 'calculate_draft_duct_material';
export const description = 'Calculate draft straight rectangular or round duct lateral area from explicit developed dimensions in metres. Each dimension and optional sheet mass (kg/m2) requires its supplied sourceReference. Ask for missing operands; do not invent size, gauge, density, rates or references. Returns area and optional mass, retains references, and always marks output draft and ineligible for verified quotes. No sizing/airflow solver, fittings, end caps, seams, waste, insulation, supports, source verification, saved quantities or project edits.';
export const inputSchema = z.toJSONSchema(straightDuctScheduleSchema);
export const execute = (input: unknown) => calculateStraightDuctDraft(input);
