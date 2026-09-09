import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PRICE_CSV_LIMIT, editPriceBook, emptyPriceBookLibrary, persistPriceBooks, priceBookKey, readPriceBooks } from "../pricing/priceBooks.ts";
import { PRICE_BOOKS_CHANGED, PRICE_BOOK_REFRESH_NOTE, importPriceBook, importPriceBookFromStorage, notifyPriceBooksChanged, priceImportInputSchema, sha256Hex } from "./priceImportTool.ts";

const JOB = "job/1", KEY = priceBookKey(JOB);
function storage() {
  const map = new Map<string, string>();
  return { map, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
}
const csv = "Stock code,Description,Unit,Rate\r\nP100,Treated pine post 100x100,each,18.50\r\nR75,Rail 75x50,m,4.2\r\n\r\nPAL,Paling 100x12,each,1.15\r\n";
const metadata = { supplier: "Timber Co", currency: "AUD", taxBasis: "exclusive" as const, taxPercent: 10, effectiveDate: "2026-09-01", sourceReference: "Quote Q-1234" };
const base = { expectedJobId: JOB, expectedLibraryRevision: 0, csvText: csv, metadata };
const at = (store: { getItem(key: string): string | null; setItem(key: string, value: string): void }) => ({ ...base, expectedLibraryRevision: readPriceBooks(store, JOB).value.revision });
const nodeSha = (text: string) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

test("creates a new price book from CSV text with the panel's provenance and a verified readback", async () => {
  const store = storage();
  const receipt = await importPriceBookFromStorage(store, { ...at(store), bookName: "Timber Co 2026", fileName: "timber.csv" }, { makeId: () => "11111111-1111-4111-8111-111111111111", now: () => "2026-09-09T00:00:00.000Z" });
  assert.equal(receipt.saved, true); assert.equal(receipt.readbackVerified, true); assert.equal(receipt.created, true);
  assert.equal(receipt.bookId, "11111111-1111-4111-8111-111111111111"); assert.equal(receipt.bookName, "Timber Co 2026"); assert.equal(receipt.revision, 1); assert.equal(receipt.libraryRevision, 1);
  assert.equal(receipt.rows, 3); assert.equal(receipt.importedAt, "2026-09-09T00:00:00.000Z"); assert.equal(receipt.storageKey, KEY); assert.equal(receipt.jobId, JOB);
  assert.equal(receipt.sha256, nodeSha(csv)); assert.equal(receipt.sizeBytes, Buffer.byteLength(csv, "utf8")); assert.equal(receipt.fileName, "timber.csv"); assert.equal(receipt.delimiter, ",");
  assert.equal(receipt.headerRow, 1); assert.deepEqual(receipt.headers, ["Stock code", "Description", "Unit", "Rate"]); assert.deepEqual(receipt.mapping, { stockCode: 0, description: 1, unit: 2, rate: 3 });
  assert.deepEqual(receipt.metadata, { ...metadata, amountDecimals: 2, sourceReference: "Live assistant paste · Quote Q-1234" });
  assert.ok(receipt.scope.includes(PRICE_BOOK_REFRESH_NOTE)); assert.match(receipt.scope, /no quantities, quotes or currency conversion/);
  const session = readPriceBooks(store, JOB);
  assert.equal(session.blocked, false); assert.equal(session.value.revision, 1); assert.equal(session.value.books.length, 1);
  const [book] = session.value.books;
  assert.equal(book.name, "Timber Co 2026"); assert.equal(book.archived, false); assert.equal(book.revisions.length, 1);
  assert.deepEqual(book.revisions[0].rows.map(row => [row.sourceLine, row.stockCode, row.unit, row.rate]), [[2, "P100", "each", 18.5], [3, "R75", "m", 4.2], [5, "PAL", "each", 1.15]]);
  assert.deepEqual(book.revisions[0].source, { fileName: "timber.csv", sha256: nodeSha(csv), sizeBytes: Buffer.byteLength(csv, "utf8"), kind: "csv", delimiter: ",", headerRow: 1, headers: ["Stock code", "Description", "Unit", "Rate"], mapping: { stockCode: 0, description: 1, unit: 2, rate: 3 } });
  assert.equal(store.map.size, 1);
});

test("appends a new revision to an existing book by id, keeps its name and rejects archived or unknown targets", async () => {
  const store = storage();
  const first = await importPriceBookFromStorage(store, { ...at(store), bookName: "Timber Co" });
  const revised = csv.replace("18.50", "19.25");
  const second = await importPriceBookFromStorage(store, { ...at(store), csvText: revised, bookId: first.bookId, metadata: { ...metadata, effectiveDate: "2026-10-01" } });
  assert.equal(second.created, false); assert.equal(second.bookId, first.bookId); assert.equal(second.bookName, "Timber Co"); assert.equal(second.revision, 2); assert.equal(second.libraryRevision, 2);
  assert.equal(second.sha256, nodeSha(revised)); assert.notEqual(second.sha256, first.sha256);
  const library = readPriceBooks(store, JOB).value;
  assert.equal(library.books.length, 1); assert.equal(library.books[0].revisions.length, 2);
  assert.equal(library.books[0].revisions[0].rows[0].rate, 18.5); assert.equal(library.books[0].revisions[1].rows[0].rate, 19.25);
  assert.equal(library.books[0].revisions[1].metadata.effectiveDate, "2026-10-01");
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), bookId: "22222222-2222-4222-8222-222222222222" }), /no longer exists/);
  const archivedSession = readPriceBooks(store, JOB);
  persistPriceBooks(store, archivedSession, editPriceBook(archivedSession.value, first.bookId, { archived: true }));
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), bookId: first.bookId }), /Restore the archived price book/);
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), bookId: first.bookId, bookName: "Both" }), /not both/);
  assert.equal(readPriceBooks(store, JOB).value.books[0].revisions.length, 2);
});

test("a single bad row fails the whole import closed with the line errors and writes nothing", async () => {
  const store = storage();
  const bad = "Stock code,Description,Unit,Rate\r\nP100,Post,each,18.50\r\nR75,Rail,m,$4.20\r\nPAL,Paling,each,1.15\r\nP100,Duplicate post,each,2\r\n";
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: bad, bookName: "Bad" }), (error: Error) => {
    assert.match(error.message, /Import blocked until these lines are corrected \(2 issues; first 2 shown\)/);
    assert.match(error.message, /Line 3: Rate needs a non-negative decimal/); assert.match(error.message, /Line 5: Duplicate stock code P100/); assert.match(error.message, /No rates have been saved\./);
    return true;
  });
  assert.equal(store.map.size, 0); assert.equal(store.getItem(KEY), null);
  const many = "Description,Unit,Rate\r\n" + Array.from({ length: 12 }, (_, i) => `Item ${i},each,bad${i}\r\n`).join("");
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: many, bookName: "Bad" }), (error: Error) => {
    assert.match(error.message, /\(12 issues; first 10 shown\)/); assert.ok(error.message.includes("Line 11:")); assert.ok(!error.message.includes("Line 12:")); assert.ok(!error.message.includes("Line 13:"));
    return true;
  });
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: "Description,Unit,Rate\r\n", bookName: "Header only" }), /CSV: CSV needs a header and at least one rate/);
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: "Description,Unit,Rate\r\nPost,each,\"1.5\r\n", bookName: "Unclosed" }), /CSV: Line 2: unclosed quoted field/);
  assert.equal(store.map.size, 0);
});

test("oversized CSV text is refused before hashing or parsing", async () => {
  const store = storage();
  let digests = 0;
  const deps = { digest: () => { digests++; return "a".repeat(64); } };
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: "Description,Unit,Rate\r\n" + "x".repeat(PRICE_CSV_LIMIT), bookName: "Big" }, deps), /Price import input/);
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: "é".repeat(PRICE_CSV_LIMIT / 2 + 1), bookName: "Wide" }, deps), /Import a non-empty CSV up to 2 MB/);
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: "", bookName: "Empty" }, deps), /Price import input/);
  assert.equal(digests, 0); assert.equal(store.map.size, 0);
});

test("mapping defaults from the headers and an explicit mapping override is honoured and echoed", async () => {
  const store = storage();
  const aliased = "SKU\tItem\tUOM\tPrice\r\nA1\tPost\teach\t10\r\n";
  const tsv = await importPriceBookFromStorage(store, { ...at(store), csvText: aliased, fileName: "rates.tsv", bookName: "Aliased" });
  assert.equal(tsv.delimiter, "\t"); assert.deepEqual(tsv.mapping, { stockCode: 0, description: 1, unit: 2, rate: 3 }); assert.deepEqual(tsv.headers, ["SKU", "Item", "UOM", "Price"]);
  const unlabelled = "Rate;Unit;Description\r\n10;each;Post\r\n";
  const suggested = await importPriceBookFromStorage(store, { ...at(store), csvText: unlabelled, delimiter: ";", bookName: "Suggested" });
  assert.deepEqual(suggested.mapping, { stockCode: null, description: 2, unit: 1, rate: 0 });
  const swapped = "Col A;Col B;Col C\r\n10;each;Post\r\n";
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: swapped, delimiter: ";", bookName: "Wrong" }), /Line 2: /);
  const explicit = await importPriceBookFromStorage(store, { ...at(store), csvText: swapped, delimiter: ";", bookName: "Explicit", mapping: { stockCode: null, description: 2, unit: 1, rate: 0 } });
  assert.deepEqual(explicit.mapping, { stockCode: null, description: 2, unit: 1, rate: 0 });
  const library = readPriceBooks(store, JOB).value;
  assert.equal(library.books.length, 3); assert.equal(library.revision, 3);
  assert.deepEqual(library.books[2].revisions[0].rows, [{ sourceLine: 2, stockCode: "", description: "Post", unit: "each", rate: 10 }]);
  assert.deepEqual(library.books[2].revisions[0].source.mapping, { stockCode: null, description: 2, unit: 1, rate: 0 });
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: swapped, delimiter: ";", bookName: "Same column", mapping: { stockCode: null, description: 2, unit: 2, rate: 0 } }), /Map each field to a different column/);
  await assert.rejects(importPriceBookFromStorage(store, { ...at(store), csvText: swapped, delimiter: ";", bookName: "Outside", mapping: { stockCode: 5, description: 2, unit: 1, rate: 0 } }), /existing source column/);
  assert.equal(readPriceBooks(store, JOB).value.revision, 3);
});

test("metadata is validated as the panel does and never defaulted from sample text", async () => {
  const store = storage();
  const attempt = (patch: Record<string, unknown>, drop?: string) => { const next: Record<string, unknown> = { ...metadata, ...patch }; if (drop) delete next[drop]; return importPriceBookFromStorage(store, { ...at(store), bookName: "Meta", metadata: next }); };
  await assert.rejects(attempt({}, "sourceReference"), /Price import input/);
  await assert.rejects(attempt({ sourceReference: "   " }), /Price import input/);
  await assert.rejects(attempt({}, "supplier"), /Price import input/);
  await assert.rejects(attempt({ effectiveDate: "2026-02-29" }), /Price metadata: Use a valid effective date/);
  await assert.rejects(attempt({ effectiveDate: "1/9/2026" }), /YYYY-MM-DD/);
  await assert.rejects(attempt({ currency: "AU$" }), /three-letter currency code/);
  await assert.rejects(attempt({ taxBasis: "unspecified", taxPercent: 10 }), /Unknown tax basis cannot have an assumed tax percentage/);
  await assert.rejects(attempt({ taxPercent: 101 }), /Price import input/);
  await assert.rejects(attempt({ amountDecimals: 5 }), /Price import input/);
  await assert.rejects(attempt({ notes: "extra" }), /Price import input/);
  assert.equal(store.map.size, 0);
  const receipt = await attempt({ currency: " aud ", taxBasis: "unspecified", taxPercent: null, amountDecimals: 0 });
  assert.deepEqual(receipt.metadata, { supplier: "Timber Co", currency: "AUD", amountDecimals: 0, taxBasis: "unspecified", taxPercent: null, effectiveDate: "2026-09-01", sourceReference: "Live assistant paste · Quote Q-1234" });
  assert.equal(readPriceBooks(store, JOB).value.books[0].revisions[0].metadata.currency, "AUD");
  assert.equal(priceImportInputSchema.safeParse({ ...base, bookName: "x" }).success, true);
  assert.equal(priceImportInputSchema.safeParse({ ...base }).success, false);
});

test("stale, blocked or foreign sessions and a failed readback are refused without writing", async () => {
  const store = storage();
  const persist = (session: ReturnType<typeof readPriceBooks>, next: Parameters<typeof persistPriceBooks>[2]) => persistPriceBooks(store, session, next);
  const stale = readPriceBooks(store, JOB);
  await importPriceBookFromStorage(store, { ...at(store), bookName: "Seed" });
  await assert.rejects(importPriceBook(stale, { ...base, expectedLibraryRevision: stale.value.revision, bookName: "Stale" }, { save: persist, readback: key => store.getItem(key) }), /changed in another window/);
  assert.equal(readPriceBooks(store, JOB).value.books.length, 1);
  await assert.rejects(importPriceBook({ value: emptyPriceBookLibrary(JOB), raw: null, blocked: true, error: "Saved price books could not be read." }, { ...base, bookName: "Blocked" }, { save: persist }), /could not be read/);
  await assert.rejects(importPriceBook(readPriceBooks(store, "job/2"), { ...base, bookName: "Foreign" }, { save: persist }), /belong to another project/);
  await assert.rejects(importPriceBook(readPriceBooks(store, JOB), { ...at(store), bookName: "Readback" }, { save: persist, readback: () => "tampered" }), /do not match the save receipt/);
  await assert.rejects(importPriceBook(readPriceBooks(store, JOB), { ...at(store), bookName: "Dropped" }, { save: session => ({ ...session, raw: "{}" }) }), /did not read back as written/);
  assert.equal(readPriceBooks(store, JOB).value.revision, 2);
});

test("sha256 matches Node's digest and the change notification is dispatched only when a window exists", async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode(csv)), nodeSha(csv));
  assert.equal(await sha256Hex(new TextEncoder().encode("﻿" + csv)), nodeSha("﻿" + csv));
  assert.equal(notifyPriceBooksChanged(KEY, undefined), false);
  const events: Event[] = [];
  assert.equal(notifyPriceBooksChanged(KEY, { dispatchEvent: event => { events.push(event); return true; } }), true);
  assert.equal(events[0].type, PRICE_BOOKS_CHANGED); assert.deepEqual((events[0] as CustomEvent<{ key: string }>).detail, { key: KEY });
});
