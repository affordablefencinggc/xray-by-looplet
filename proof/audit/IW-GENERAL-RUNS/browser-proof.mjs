import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:8080/';
assert.ok(['http://127.0.0.1:8080/', 'http://127.0.0.1:8081/'].includes(url));
const env = url.includes('8081') ? 'built' : 'dev';
const dir = resolve('screenshots/general-runs', env); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
const report = { url, fixture: 'Synthetic QA drawing and calibration, not a real building quantity', checks: [], errors: [], screenshots: [] };
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
const button = name => page.getByRole('button', { name, exact: true });
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('xray:fencing-job:v2')));
async function ready() { await page.waitForFunction(() => !document.querySelector('.workbench-loading')); }
async function shot(name) { const path = resolve(dir, name + '.png'); await page.screenshot({ path }); report.screenshots.push(path); }
async function check(name, action) { await action(); report.checks.push({ name, result: 'pass' }); }
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#faf7ef"/><text x="80" y="100" font-size="32">DEMONSTRATION / QA ONLY</text><text x="80" y="150" font-size="22">Synthetic strip — no building quantities</text><path d="M100 300H1000V450H100Z" fill="none" stroke="#39433e" stroke-width="4"/><text x="120" y="550" font-size="22">Manual test span = 10 m; section = 2 m × 0.2 m</text></svg>';
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
  const chooser = page.waitForEvent('filechooser'); await button('Open plan').first().click();
  await (await chooser).setFiles({ name: 'QA-general-strip.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.locator('.document-preview[data-source-ready="true"]').waitFor(); await button('Measure').click();
  await page.locator('.measure-document-preview[data-source-ready="true"]').waitFor();
  await page.getByLabel('Known distance', { exact: true }).fill('10'); await button('Pick two points').click();
  const canvas = page.locator('.measure-document-preview canvas').last();
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(); assert.ok(box);
  const points = [{ x: box.width * .25, y: box.height * .4 }, { x: box.width * .65, y: box.height * .4 }];
  await canvas.click({ position: points[0] }); await canvas.click({ position: points[1] }); await button('Lock scale').click();
  await page.getByRole('button', { name: /^Run L$/ }).click();
  const snap = page.getByRole('button', { name: /^Snap S$/ }); if (await snap.getAttribute('aria-pressed') === 'true') await snap.click();
  await canvas.click({ position: points[0] }); await canvas.click({ position: points[1] }); await button('Finish trace').click();
  await check('New source run defaults to general construction, with no fence fields', async () => {
    await page.getByLabel('Takeoff type', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Takeoff type', { exact: true }).inputValue(), 'construction');
    assert.equal(await page.getByLabel('Bay width (m)', { exact: true }).count(), 0);
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('Quantity unavailable'));
  });
  await check('Length, area and volume use the traced scale with explicit source dimensions', async () => {
    await page.getByLabel('Construction assembly', { exact: true }).selectOption('slab');
    await page.getByLabel('Trade / work package', { exact: true }).fill('Concrete — QA only');
    await page.getByLabel('Quantity source reference', { exact: true }).fill('QA synthetic span and section, not a project schedule');
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('10 m'));
    await page.getByLabel('Quantity basis', { exact: true }).selectOption('area');
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('Quantity unavailable'));
    await page.getByLabel('Section width / height (m)', { exact: true }).fill('2');
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('20 m²'));
    await page.getByLabel('Quantity basis', { exact: true }).selectOption('volume');
    await page.getByLabel('Section depth / thickness (m)', { exact: true }).fill('0.2');
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('4 m³'));
    await page.getByLabel('General run quantity').scrollIntoViewIfNeeded(); await shot('01-volume-editor');
  });
  await check('Switching to fencing and back preserves both specifications', async () => {
    await page.getByLabel('Takeoff type', { exact: true }).selectOption('fencing');
    await page.getByLabel('Assembly / system', { exact: true }).selectOption('colorbond');
    await page.getByLabel('Bay width (m)', { exact: true }).fill('2.4');
    await page.getByLabel('Takeoff type', { exact: true }).selectOption('construction');
    assert.equal(await page.getByLabel('Section depth / thickness (m)', { exact: true }).inputValue(), '0.2');
    const job = await saved(); assert.equal(job.runs[0].specification.bayWidthM, 2.4);
  });
  await check('Review accepts complete general evidence without fence fields', async () => { await button('Review').click(); await page.getByLabel('Reviewer', {exact:true}).fill('QA reviewer'); await button('Approve').click(); assert.equal((await saved()).runs[0].review.status, 'approved'); await page.getByText('All current evidence checks pass.', {exact:true}).waitFor(); });
  await check('Cost shows measured geometry and withholds fence recipe controls', async () => {
    await button('Cost').click(); const region = page.getByRole('region', { name: 'General construction quantities' }); await region.waitFor();
    assert.ok((await region.innerText()).includes('4 m³'));
    assert.equal(await page.getByText('Recipe review', { exact: true }).count(), 0);
    await shot('02-cost-quantities');
  });
  await check('Reload preserves source, dimensions and quantity; incomplete edits withhold totals', async () => {
    const before = await saved(); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await button('Cost').click();
    assert.ok((await page.getByRole('region', { name: 'General construction quantities' }).innerText()).includes('4 m³'));
    assert.deepEqual((await saved()).runs[0].specification, before.runs[0].specification);
    await button('Edit Run 01').click(); await page.getByLabel('Section depth / thickness (m)', { exact: true }).fill('');
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('Quantity unavailable'));
    await page.getByLabel('Section depth / thickness (m)', { exact: true }).fill('0.3');
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('6 m³'));
    assert.ok((await saved()).runs[0].revision > before.runs[0].revision); assert.equal((await saved()).runs[0].review.status, 'needs-review');
  });
  await check('Mobile inspector and cost support edits without horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Section depth / thickness (m)', { exact: true }).fill('0.2');
    await page.getByLabel('General run quantity').scrollIntoViewIfNeeded();
    assert.ok((await page.getByLabel('General run quantity').innerText()).includes('4 m³')); assert.equal(await page.getByLabel('General run quantity').evaluate(el => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), true); await shot('03-mobile-editor'); report.mobileLayout = await page.getByLabel('General run quantity').evaluate(el => { const rows=[]; for(let n=el;n;n=n.parentElement){const b=n.getBoundingClientRect(),c=getComputedStyle(n); rows.push({class:n.className,top:b.top,height:b.height,scrollHeight:n.scrollHeight,scrollTop:n.scrollTop,overflow:c.overflow});}return rows; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await button('Cost').click(); await page.getByRole('region', { name: 'General construction quantities' }).scrollIntoViewIfNeeded(); await shot('04-mobile-cost');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  });
  await check('Existing calibration guard prevents changing scale beneath a measured run', async () => {
    await button('Edit Run 01').click(); await button('Unlock to change').click();
    await page.getByText('Remove measurements from this sheet before changing its locked calibration.', {exact:true}).first().waitFor(); assert.equal((await saved()).calibrations[0].locked, true);
  });
  assert.deepEqual(report.errors, []); report.result = 'pass';
} catch (error) { report.result = 'fail'; report.failure = error.stack; writeFileSync(resolve(dir, 'failure-body.txt'), await page.locator('body').innerText()); writeFileSync(resolve(dir, 'failure-state.json'), JSON.stringify(await saved(), null, 2)); await shot('failure'); process.exitCode = 1; }
finally { writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await browser.close(); }
