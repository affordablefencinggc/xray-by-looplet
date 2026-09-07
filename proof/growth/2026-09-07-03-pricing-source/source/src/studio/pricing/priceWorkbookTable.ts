import type { CsvTable } from "./priceBooks.ts";
export type PriceWorkbookSheet = { name: string; rows: CsvTable["records"]; issue?: string; formulaCells: number };
export type PriceWorkbook = { sheets: PriceWorkbookSheet[] };
export function workbookPriceTable(sheet: PriceWorkbookSheet, headerRow: number): CsvTable {
  if (sheet.issue) throw Error(sheet.issue);
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 100) throw Error("Choose a header row from 1 to 100.");
  const header = sheet.rows.find(row => row.line === headerRow);
  if (!header || !header.cells.some(cell => cell.trim())) throw Error("Selected header row is empty. Choose the row containing your column headings.");
  if (Object.keys(header.cellErrors ?? {}).length) throw Error(`Header row ${headerRow}: ${Object.values(header.cellErrors!)[0]}`);
  if (header.cells.some(cell => cell.length > 300)) throw Error("Column headings must be at most 300 characters.");
  const records = sheet.rows.filter(row => row.line > headerRow && (row.cells.some(cell => cell.trim()) || Object.keys(row.cellErrors ?? {}).length));
  if (!records.length || records.length > 5000) throw Error("Select a worksheet with 1 to 5,000 rate rows after its header.");
  return { headers: header.cells, records, headerLine: headerRow };
}
