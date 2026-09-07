import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const files = ['priceBooks.ts', 'PriceBookPanel.tsx', 'priceBooks.css', 'priceBooks.test.ts'];
const patches = files.map(file => {
  const result = spawnSync('git', ['diff', '--no-index', '--', 'NUL', `src/studio/pricing/${file}`], { encoding: 'utf8', windowsHide: true });
  if (![0, 1].includes(result.status)) throw Error(result.stderr);
  return result.stdout;
});
writeFileSync('proof/audit/IW-PRICE-BOOK/implementation.diff', patches.join('\n'));
