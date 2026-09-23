/**
 * Page titles of the curated source drawings (by source SHA-256, then 1-based page), copied from each
 * model's sourceSheets so the sheet list can name pages without loading the multi-megabyte model.
 * sourceSheetTitles.test.ts keeps this table in step with each public/models/<id>/source-building.json.
 */
export const SOURCE_SHEET_TITLES: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  // redburn
  "b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38": {"1":"Cover perspective","2":"Site plan","3":"Lower / ground plan","4":"Upper floor plan","5":"Front and right elevations","6":"Rear and left elevations","7":"Lower floor coverings","8":"Upper floor coverings","9":"Lower electrical","10":"Upper electrical","11":"Health and safety","12":"Survey 1","13":"Survey 2"},
  // crown-wharf
  "32a99e7680a94f7690bc1639913563f279a3452bcb9f0dd4e4ef63997ab2639a": {"27":"Ground level","28":"Level 01","29":"Level 02","30":"Level 03","31":"Levels 04–07","32":"Levels 08–11","33":"Levels 12–17","34":"Levels 18–30","35":"Level 31","36":"Roof and lift overruns"},
  // caroline
  "f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb": {"4":"Foundation and roof plan","5":"Downstairs plan","6":"Upstairs plan","7":"West and front elevations","8":"East and rear elevations","9":"Building sections","12":"Schedules and openings","13":"Source design overview","14":"Source downstairs cutaway","15":"Source upstairs cutaway","16":"Source front perspective","17":"Source rear perspective","18":"Source section perspective"},
  // ruffles
  "7bc2b13848091c42d8601d9acc8d8b8888cff193c32b416c9d61478887864a33": {"11":"Ground plan: carport and rooms","13":"Ground plan: full dwelling","15":"Roof plan: west","16":"Roof plan: east","17":"Front elevations","18":"Side elevations","19":"Rear elevation"},
};

/** The register name, or the curated title while the page still has its default "Sheet N" name. */
export function sheetDisplayName(name: string, pageIndex: number, sourceSha256: string | null | undefined): string {
  if (name !== `Sheet ${pageIndex + 1}` || !sourceSha256) return name;
  return SOURCE_SHEET_TITLES[sourceSha256]?.[pageIndex + 1] ?? name;
}
