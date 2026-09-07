import { readFileSync, writeFileSync } from 'node:fs';
const files = ['priceBooks.ts', 'PriceBookPanel.tsx', 'priceBooks.css', 'priceBooks.test.ts'];
for (const file of files) writeFileSync(`proof/growth/2026-09-07-pricing/before-${file}.txt`, readFileSync(`src/studio/pricing/${file}`));
