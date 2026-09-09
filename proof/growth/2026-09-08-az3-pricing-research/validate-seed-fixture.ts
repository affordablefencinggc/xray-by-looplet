// Proves the QA seed record is accepted by the real price book schema before it is written into the browser profile.
import { readFileSync } from "node:fs";
import { parsePriceBookLibrary, priceBookKey } from "../../../src/studio/pricing/priceBooks.ts";
const text = readFileSync(new URL("./seed-price-book.fixture.json", import.meta.url), "utf8")
  .replace("__JOB_ID__", "qa-job").replace("__BOOK_ID__", crypto.randomUUID());
const library = parsePriceBookLibrary(text, "qa-job");
console.log(JSON.stringify({ key: priceBookKey("qa-job"), books: library.books.length, rows: library.books[0].revisions[0].rows.length, bytes: text.length }));
