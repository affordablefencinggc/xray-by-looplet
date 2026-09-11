import type { ArchitectProject } from "./model.ts";
import type { SheetLayout } from "./authoredSheetSet.ts";

/**
 * Title block field fitting for the authored drawing sheet.
 *
 * D-07's stated acceptance is that project metadata updates linked fields
 * "without clipping". The fields are linked already, but the block is drawn at
 * fixed paper coordinates, so a long project name or address silently ran past
 * the right-hand column and under the sheet number. This module computes the
 * fit so overflow is measured and reported rather than drawn over.
 *
 * Widths are paper millimetres. Text is measured with a per-character advance
 * ratio rather than a font metric: the sheet renders in SVG at print scale and
 * no measuring context exists during a pure state computation. The ratio is
 * deliberately conservative, so the fit errs toward truncating early rather
 * than toward drawing over a neighbouring field.
 */

/** Mean advance width of Helvetica-like glyphs as a fraction of font size. */
const ADVANCE_RATIO = 0.52;

/** The right-hand column starts at w-100; leave a gutter before it. */
const RIGHT_COLUMN_WIDTH = 100;
const LEFT_MARGIN = 14;
const GUTTER = 6;

export type TitleBlockField = {
  /** Stable key so a test or a caller can address one field. */
  key: "name" | "address" | "status" | "number" | "modelRevision";
  /** The text as it should be drawn: truncated with an ellipsis when it cannot fit. */
  text: string;
  /** The untruncated source text. */
  full: string;
  /** True when the source text did not fit and was shortened. */
  truncated: boolean;
  /** Paper mm available to this field. */
  available: number;
  /** Paper mm the untruncated text would need. */
  required: number;
};

export type TitleBlock = {
  fields: TitleBlockField[];
  /** True when any field was shortened, so the UI can say so honestly. */
  anyTruncated: boolean;
};

export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * ADVANCE_RATIO;
}

/**
 * Shorten to fit, appending a single-character ellipsis. Returns the original
 * when it already fits. Never returns text wider than `available`.
 */
export function fitText(text: string, fontSize: number, available: number): { text: string; truncated: boolean } {
  if (available <= 0) return { text: "", truncated: text.length > 0 };
  if (textWidth(text, fontSize) <= available) return { text, truncated: false };
  const ellipsis = "…";
  // The ellipsis itself has width: when even that does not fit, draw nothing
  // rather than overflowing the column with a marker.
  if (textWidth(ellipsis, fontSize) > available) return { text: "", truncated: true };
  const perChar = fontSize * ADVANCE_RATIO;
  // Reserve the ellipsis, then keep whole characters that still fit.
  const keep = Math.floor(available / perChar) - 1;
  if (keep <= 0) return { text: ellipsis, truncated: true };
  return { text: text.slice(0, keep).trimEnd() + ellipsis, truncated: true };
}

/**
 * Compute every linked title block field for one sheet at one paper width.
 * Pure: takes the project and layout, returns what should be drawn.
 */
export function titleBlockFields(
  p: Pick<ArchitectProject, "name" | "address" | "revision" | "designRevision">,
  layout: Pick<SheetLayout, "number" | "size">,
  paperWidth: number,
): TitleBlock {
  // Left column runs from the margin to the right column, less a gutter.
  const leftAvailable = paperWidth - RIGHT_COLUMN_WIDTH - LEFT_MARGIN - GUTTER;
  // Right column runs from w-100 to the frame edge at w-8.
  const rightAvailable = RIGHT_COLUMN_WIDTH - 8 - GUTTER;

  const source: Array<{ key: TitleBlockField["key"]; full: string; size: number; available: number }> = [
    { key: "name", full: p.name, size: 4.5, available: leftAvailable },
    { key: "address", full: p.address || "Project address not specified", size: 2.7, available: leftAvailable },
    { key: "status", full: "DESIGN REVIEW / not for construction", size: 2.7, available: leftAvailable },
    {
      key: "number",
      full: `${layout.number} / REV ${p.designRevision} / ${layout.size}`,
      size: 3.5,
      available: rightAvailable,
    },
    {
      key: "modelRevision",
      full: `Model revision ${p.revision} / print at 100%`,
      size: 2.7,
      available: rightAvailable,
    },
  ];

  const fields = source.map(({ key, full, size, available }) => {
    const fitted = fitText(full, size, available);
    return {
      key,
      text: fitted.text,
      full,
      truncated: fitted.truncated,
      available,
      required: textWidth(full, size),
    };
  });

  return { fields, anyTruncated: fields.some((field) => field.truncated) };
}

/** Convenience for the renderer: look one field up by key. */
export function titleBlockField(block: TitleBlock, key: TitleBlockField["key"]): TitleBlockField {
  const found = block.fields.find((field) => field.key === key);
  if (!found) throw Error(`Unknown title block field: ${key}`);
  return found;
}
