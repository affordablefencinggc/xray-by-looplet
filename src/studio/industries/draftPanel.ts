import type { IndustrySourceState } from "./sourceBinding.ts";
import type { SourceAreaMeasurement } from "../domain.ts";
import type { Calibration } from "../calibration.ts";

/** A real project entity that a worksheet may bind to. The geometry inputs are
 * hashed by the consumer; no verification verdict is stored here. */
export type IndustryGeometryEntitySource = {
  entityId: string;
  entityType: "wall-run" | "room-area" | "roof-plane" | "duct-run" | "construction-run";
  label: string;
  revision: number;
  points: readonly { x: number; y: number }[];
  measuredQuantity: string;
  unit: string;
  calibrationId: string | null;
  sourceSha256: string | null;
  areaGeometry?: {
    holes: readonly (readonly { x: number; y: number }[])[];
    pitchDegrees: number | null;
    azimuthDegrees: number | null;
    basis: SourceAreaMeasurement;
    calibrationOperands: Calibration | null;
  };
};

/** Controlled industry forms. The shared host owns project-scoped draft storage, and supplies the
 * current project source state so a worksheet can report whether its binding is still current.
 * Panels read no project store themselves.
 */
export type IndustryDraftPanelProps<T> = {
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
  source: IndustrySourceState;
  geometryEntities?: readonly IndustryGeometryEntitySource[];
};
