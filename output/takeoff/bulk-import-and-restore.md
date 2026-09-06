# Bulk import and backup restore

In Altitude's Components view, use **Import materials CSV** or **Restore backup**. Both show a preview and require an explicit Apply/Replace action. Selecting a file or cancelling does not change saved inventory.

## Material CSV

Download the CSV template from the app, enter actual stock lines, then import it. Required headings are Stock code, Description, Unit and Source reference. Optional headings cover quantity, package capacity and dimensions, specified kg and weight basis. Use each, m, m2/m², m3/m³ or kg. Numeric cells use decimal points without thousands separators or unit suffixes. Blank values stay unknown.

Files must be UTF-8, comma-separated, at most 5 MB and 5,000 stock lines. Quoted commas, escaped quotes and multiline references are supported. Unexpected headings, malformed fields, duplicate stock codes and references to another drawing are rejected without partial imports.

New codes are added. **Update matching stock codes** explicitly replaces those lines' fields, preserving their IDs and increasing revisions when values change. Blank or omitted fields clear their previous values. Unlisted material lines and all drawing counts are retained. Preview details show current and proposed fields, with 50 lines per page.

Current materials CSV exports can be reimported. Calculated totals and imported revision numbers are not trusted as inputs; totals are recalculated. The exported Text encoding marker preserves formula-like strings and literal apostrophes safely. Older CSVs without this marker retain apostrophes literally. A CSV Project column is informational; a supplied drawing hash must match the open Altitude source.

## Backup and restore

**Download backup** creates a JSON snapshot of all five drawing groups, notes, packaging and material lines. Original PDF files are separate. Keep the original drawing and backup together. JSON files up to 25 MB are accepted. Earlier takeoff JSON snapshots and Export count files are supported; newer unsupported versions and corrupt data are rejected.

**Restore backup** replaces the count groups and material register after showing the proposed contents and removals. Restored counts need review again; notes/references are preserved and revisions advance. A backup from another project can be copied into the current project only for the same drawing. If existing data is unreadable, the preview marks its quantities unavailable.

Before replacement, the previous saved bytes must be stored in a separate local recovery archive. An archive failure prevents replacement; a failed primary save leaves the original snapshot in place. Changed data since preview also blocks replacement. **Download previous snapshot** retrieves the latest archive, including after reload. A valid downloaded previous snapshot can itself be restored. Unreadable snapshots remain downloadable for recovery but cannot bypass validation.

Unsaved group/material edits block transfers and exports; save or cancel the draft first. Recovery archives use browser storage, so download backups for protection against browser-data clearing or device loss. The import adds no fabricated project quantities.

## Proof

- [Development browser results](../../screenshots/bulk-restore/dev/report.json) and [built browser results](../../screenshots/bulk-restore/built/report.json): 11 scenarios each, including mobile preview/pagination, rejected files, conflicting data, failed archive/save, legacy snapshot recovery and reload.
- [CSV preview](../../screenshots/bulk-restore/built/01-csv-preview.png), [backup replacement preview](../../screenshots/bulk-restore/built/03-backup-preview.png), [mobile preview](../../screenshots/bulk-restore/built/05-mobile-preview.png).
- [Downloaded template](../../screenshots/bulk-restore/built/template.csv). Other CSV/backup fixtures in the proof directory are explicitly synthetic QA data.
- [Exact code diff and verification logs](../../proof/audit/IW-BULK-RESTORE/completion.md).
