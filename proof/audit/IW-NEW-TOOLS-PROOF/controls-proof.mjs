import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:8080/';
const mode = url.includes('8081') ? 'built' : 'dev';
const dir = resolve('screenshots/new-tools-proof', mode); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await context.newPage(); page.setDefaultTimeout(30000);
const report = { url, fixture: 'Isolated QA browser. All entered quantities, notes and stock lines are fictional test data.', checks: [], errors: [], screenshots: [] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); });
const button = name => page.getByRole('button', { name, exact: true });
const input = name => page.getByLabel(name, { exact: true });
async function ready() { await page.waitForFunction(() => !document.querySelector('.workbench-loading')); }
async function saved() { return page.evaluate(() => { const key = Object.keys(localStorage).find(k => k.startsWith('xray:source-takeoff:')); return { key, raw: key ? localStorage.getItem(key) : null }; }); }
async function check(tool, action) { await action(); report.checks.push({ tool, result: 'pass' }); writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2)); }
async function shot(name) { const path = resolve(dir, name + '.png'); await page.screenshot({ path }); report.screenshots.push(path); }
async function download(name, file) { const pending = page.waitForEvent('download'); await button(name).click(); const path = resolve(dir, file); await (await pending).saveAs(path); return readFileSync(path, 'utf8'); }
async function newLine(code, unit, quantity) {
  await button('Add material').click(); await input('Stock code / order line').fill(code);
  await input('Material description').fill('QA ONLY - ' + code);
  await input('Schedule / order / supplier reference').fill('QA fixture, no actual project specification');
  await input('Quantity unit').selectOption(unit); await input('Stock quantity').fill(quantity);
}
try {
  await check('Open real high-rise plan / source-bound Components', async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    const pending = page.waitForEvent('filechooser'); await button('Open plan').first().click();
    await (await pending).setFiles(resolve('downloads/high_rise_plans/03_Seattle_Altitude_Hotel_and_Residences_50Story_Tower.pdf'));
    await page.locator('.document-preview[data-source-ready="true"]').waitFor({ timeout: 60000 });
    await button('Components').click(); await page.getByRole('region', { name: 'Altitude source takeoff' }).waitFor();
    await button('Save inventory').click(); const value = JSON.parse((await saved()).raw);
    assert.equal(value.sourceSha256, '0136bfd4e943f648a74ce0877e5c20ea835b045a679483f465f0a1738a6805a7');
    assert.equal(value.rows.length, 5); assert.equal(value.materials.length, 0);
  });
  await check('All / Doors / Windows / Structure filters and inspector selection', async () => {
    for (const [category, count] of [['Doors', 2], ['Windows', 2], ['Structure', 1], ['All', 5]]) {
      await button(category).click(); assert.equal(await page.locator('.takeoff-row').count(), count);
      await page.locator('.takeoff-row').first().click();
      const name = await page.locator('.takeoff-row b').first().innerText();
      assert.equal(await page.locator('.takeoff-inspector h2').innerText(), name);
    }
  });
  await check('Included floors / evidence disclosure', async () => {
    await page.getByText('Included floors and evidence', { exact: true }).click();
    const text = await page.locator('.takeoff-inspector details').innerText();
    assert.ok(text.includes('Floors 8, 9, 10')); assert.ok(text.includes('44, 45, 46, 47, 48')); assert.ok(text.includes('SHA-256 0136bfd4'));
    await shot('01-count-evidence');
  });
  await check('Changed count requires note; reviewed unknown rejected', async () => {
    const before = await saved(); await input('Count per typical floor').fill('10'); await button('Save group').click();
    assert.equal((await saved()).raw, before.raw);
    await input('Count per typical floor').fill(''); await input('Count / review note').fill('QA unknown review should fail');
    await input('Count reviewed against source').check(); await button('Save group').click();
    // Changing the count clears review first, so the unknown quantity can be saved as pending.
    assert.equal(JSON.parse((await saved()).raw).rows[0].review, 'pending');
    const unknown = await saved(); await input('Count reviewed against source').check(); await button('Save group').click(); assert.equal((await saved()).raw, unknown.raw);
  });
  await check('Count edit / review / packaging invalidates review', async () => {
    await input('Count per typical floor').fill('9'); await input('Count / review note').fill('QA ONLY - review workflow');
    await button('Save group').click(); assert.equal(JSON.parse((await saved()).raw).rows[0].review, 'pending');
    await input('Count reviewed against source').check(); await button('Save group').click(); assert.equal(JSON.parse((await saved()).raw).rows[0].review, 'reviewed');
    await input('Counted items per package').fill('10');
    await input('Package length (m)').fill('2'); await input('Package width (m)').fill('1'); await input('Package height (m)').fill('.5');
    await input('Specified weight per item (kg)').fill('12');
    const before = await saved(); await button('Save group').click(); assert.equal((await saved()).raw, before.raw);
    await input('Supplier / specification reference').fill('QA ONLY - complete counted assembly package'); await button('Save group').click();
    assert.equal(JSON.parse((await saved()).raw).rows[0].review, 'pending');
    const summary = await page.locator('.takeoff-count-view .takeoff-summary').innerText(); assert.ok(summary.includes('26 m³')); assert.ok(summary.includes('3,024 kg'));
  });
  await check('Unknown versus explicit zero count and reset', async () => {
    await button('Windows').click(); await page.locator('.takeoff-row').first().click();
    assert.equal(await input('Count per typical floor').inputValue(), '');
    await input('Count per typical floor').fill('0'); await input('Count / review note').fill('QA explicit zero for behavior test'); await button('Save group').click();
    assert.equal(JSON.parse((await saved()).raw).rows[2].countPerFloor, 0);
    await input('Count per typical floor').fill(''); await button('Save group').click(); assert.equal(JSON.parse((await saved()).raw).rows[2].countPerFloor, null);
  });
  await button('Materials & storage').click();
  await check('Empty register / cancel / required and numeric validation', async () => {
    assert.equal(await button('Export materials CSV').isDisabled(), true);
    const before = await saved(); await button('Add material').click(); await button('Save material').click();
    assert.equal(await input('Stock code / order line').evaluate(e => e.validity.valueMissing), true);
    await input('Stock code / order line').fill('QA-INVALID'); await input('Material description').fill('QA ONLY invalid'); await input('Schedule / order / supplier reference').fill('QA');
    await input('Stock quantity').fill('-1'); await button('Save material').click(); assert.equal(await input('Stock quantity').evaluate(e => e.validity.rangeUnderflow), true);
    await input('Stock quantity').fill('1.5'); await button('Save material').click(); assert.equal(await input('Stock quantity').evaluate(e => e.validity.stepMismatch), true);
    assert.equal((await saved()).raw, before.raw); await button('Cancel changes').click(); assert.equal(await page.locator('.material-line').count(), 0);
  });
  for (const [unit, quantity, capacity, unitKg, volume, weight] of [
    ['each', '23', '10', '4', 3, 92], ['m', '12.5', '5', '2', 3, 25], ['m2', '25.5', '10', '3', 3, 76.5], ['m3', '.28', '.01', '2', 28, .56], ['kg', '125', '50', null, 3, 125],
  ]) await check(`Stock unit ${unit}: quantity, whole-package volume and specified weight`, async () => {
    await newLine('QA-' + unit, unit, quantity); await page.getByRole('spinbutton', { name: /^Quantity per package/ }).fill(capacity);
    for (const [name, value] of [['Outer package length (m)', '2'], ['Outer package width (m)', '1'], ['Outer package height (m)', '.5']]) await input(name).fill(value);
    if (unitKg !== null) await input('Specified weight (kg)').fill(unitKg); else assert.equal(await input('Specified weight (kg)').isDisabled(), true);
    const preview = await page.getByLabel('Material calculation preview', { exact: true }).innerText();
    assert.ok(preview.includes(`${volume} m³`), preview); assert.ok(preview.includes(`${weight} kg`), preview);
    await button('Save material').click(); assert.equal(JSON.parse((await saved()).raw).materials.at(-1).unit, unit);
  });
  await check('Package-weight basis for kg stock / edit revision', async () => {
    await page.locator('.material-line').filter({ hasText: 'QA-kg' }).click();
    await input('Weight applies to').selectOption('package'); assert.equal(await input('Specified weight (kg)').isDisabled(), false);
    await input('Specified weight (kg)').fill('55'); assert.ok((await page.getByLabel('Material calculation preview', { exact: true }).innerText()).includes('165 kg'));
    await button('Save material').click(); assert.equal(JSON.parse((await saved()).raw).materials.at(-1).revision, 2);
  });
  await check('Explicit zero stock and missing fields retain distinct totals', async () => {
    await newLine('QA-ZERO', 'each', '0'); await button('Save material').click();
    await newLine('QA-UNKNOWN', 'each', ''); await button('Save material').click();
    assert.ok((await page.locator('.material-line').filter({ hasText: 'QA-ZERO' }).innerText()).includes('0 m³'));
    assert.ok((await page.locator('.material-line').filter({ hasText: 'QA-UNKNOWN' }).innerText()).includes('Unknown'));
    const text = await page.locator('.material-register .takeoff-summary').innerText(); assert.ok(text.includes('40 m³')); assert.ok(text.includes('359.06 kg')); assert.ok(text.includes('6 / 7')); assert.ok(text.includes('Partial'));
    await shot('02-all-units-and-coverage');
  });
  await check('CSV download safely exports quotes, newlines, formulas and source identity', async () => {
    await newLine('=QA-FORMULA', 'each', '0'); await input('Material description').fill('QA ONLY "quoted"');
    await input('Schedule / order / supplier reference').fill('QA reference\nsecond line'); await button('Save material').click();
    const csv = await download('Export materials CSV', 'qa-all-units.csv');
    assert.ok(csv.includes('"\'=QA-FORMULA"')); assert.ok(csv.includes('"QA ONLY ""quoted"""')); assert.ok(csv.includes('"QA reference\nsecond line"')); assert.ok(csv.includes('0136bfd4e943f648a74ce0877e5c20ea835b045a679483f465f0a1738a6805a7'));
    for (const unit of ['each', 'm', 'm2', 'm3', 'kg']) assert.ok(csv.includes(`"${unit}"`));
  });
  await check('Full count JSON export includes current counts, material lines and evidence', async () => {
    const value = JSON.parse((await saved()).raw), exported = JSON.parse(await download('Export count', 'qa-full-takeoff.json'));
    assert.deepEqual(exported.rows, value.rows); assert.deepEqual(exported.materials, value.materials);
    assert.equal(exported.groups[0].definition.page, 48); assert.equal(exported.groups[0].quantity, 252); assert.ok(exported.status.includes('incomplete'));
  });
  await check('Conflicting saved snapshot blocks overwrite and recovers latest line', async () => {
    await page.locator('.material-line').first().click(); await input('Stock quantity').fill('24'); const original = await saved(), other = JSON.parse(original.raw);
    other.revision++; other.materials[0].quantity = 99; other.materials[0].revision++;
    const otherRaw = JSON.stringify(other); await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: original.key, raw: otherRaw });
    await button('Save material').click(); assert.equal((await saved()).raw, otherRaw); assert.equal(await button('Save material').isDisabled(), true);
    await shot('03-conflict-protection'); await button('Retry restore').click();
    // The old editor remains explicit until cancelled; its revision is stale and cannot overwrite recovery.
    await button('Save material').click(); assert.equal((await saved()).raw, otherRaw);
    await button('Cancel changes').click(); await page.locator('.material-line').first().click(); assert.equal(await input('Stock quantity').inputValue(), '99');
    await button('Cancel changes').click();
  });
  await check('Final reload / mobile export and source navigation', async () => {
    const before = await saved(); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await button('Components').click(); await button('Materials & storage').click();
    assert.equal((await saved()).raw, before.raw); assert.equal(await page.locator('.material-line').count(), 8);
    await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await shot('04-mobile-tools'); const csv = await download('Export materials CSV', 'qa-mobile-export.csv'); assert.ok(csv.includes('"99"'));
    await button('Drawing allowances').click(); await button('Doors').click(); await page.locator('.takeoff-row').nth(1).click(); await button('View source page 50').click();
    await page.locator('.document-preview[data-source-ready="true"]').waitFor();
    assert.equal(await page.locator('.document-preview-page').innerText(), 'Page 50');
    const documentState = await page.evaluate(() => JSON.parse(localStorage.getItem('xray:fencing-job:v2')));
    assert.equal(documentState.activeSheet, 49); assert.equal(documentState.documents.find(d => d.id === documentState.activeDocumentId).pageCount, 58);
    assert.equal(await page.locator('.document-preview-hash').getAttribute('title'), '0136bfd4e943f648a74ce0877e5c20ea835b045a679483f465f0a1738a6805a7'); await shot('05-mobile-source-page');
  });
  await check('Complex plan: six distant sheets render and fit with correct page identity', async () => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    for (const number of [42, 44, 48, 50, 53, 58]) {
      await button(`Open source page ${number}`).click(); await page.locator('.document-preview[data-source-ready="true"]').waitFor();
      assert.equal(await page.locator('.document-preview-page').innerText(), `Page ${number}`);
      const actual = await page.locator('img.document-source-page').evaluate(e => ({ complete: e.complete, width: e.naturalWidth, height: e.naturalHeight }));
      assert.ok(actual.complete && actual.width > 500 && actual.height > 500);
    }
    await button('Fit sheet').click(); await shot('06-complex-plan-render');
  });
  await check('Oversized plan rejection preserves open source and saved takeoff', async () => {
    const before = await saved(); const pending = page.waitForEvent('filechooser'); await button('Open plan').first().click();
    await (await pending).setFiles(resolve('artifacts/research/construction-platforms-2026-09-05/DGS-24-235656-main-construction-plans.pdf'));
    await page.getByText(/larger than the 100 MB plan limit/).first().waitFor();
    assert.equal((await saved()).raw, before.raw); assert.equal(await page.locator('.document-preview-hash').getAttribute('title'), '0136bfd4e943f648a74ce0877e5c20ea835b045a679483f465f0a1738a6805a7');
    await shot('07-plan-limit-preserves-work');
  });
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.ok = false; report.failure = String(error.stack); await shot('failure'); throw error; }
finally { writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
