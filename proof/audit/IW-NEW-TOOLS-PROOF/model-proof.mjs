import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const url = process.argv[2] ?? 'http://127.0.0.1:8081/';
const mode = url.includes('8081') ? 'built' : 'dev', dir = resolve('screenshots/new-tools-proof', 'model-' + mode); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }); page.setDefaultTimeout(60000);
const report = { url, model: 'Caroline: existing curated approximate reconstruction, not Altitude', checks: [], errors: [], screenshots: [], exports: [] };
page.on('pageerror', e => report.errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); });
const button = name => page.getByRole('button', { name, exact: true });
const canvas = page.getByRole('img', { name: 'Interactive source building model', exact: true });
async function data() { return canvas.evaluate(e => ({ ...e.dataset })); }
async function check(tool, action) { await action(); report.checks.push({ tool, result: 'pass', state: await data() }); }
async function shot(name) { const path = resolve(dir, name + '.png'); await page.screenshot({ path }); report.screenshots.push(path); }
async function state(key, expected) { await page.waitForFunction(({ key, expected }) => document.querySelector('[aria-label="Interactive source building model"]')?.dataset[key] === expected, { key, expected }); }
async function png(name) {
  const pending = page.waitForEvent('download'); await button('Download model PNG').click(); const path = resolve(dir, name + '.png'); await (await pending).saveAs(path);
  const bytes = readFileSync(path); assert.equal(bytes.subarray(1, 4).toString(), 'PNG'); assert.ok(bytes.readUInt32BE(16) > 300 && bytes.readUInt32BE(20) > 300);
  report.exports.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), state: await data() });
}
try {
  await page.goto(url + '?pane=model', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => !document.querySelector('.workbench-loading'));
  await button('Open Caroline plan in 3D').click(); await canvas.waitFor(); await page.waitForFunction(() => Number(document.querySelector('[aria-label="Interactive source building model"]')?.dataset.renderCalls) > 0);
  await check('Prepared source model loading and rendering', async () => {
    const actual = await data(); assert.equal(actual.sourceSha256, 'f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb'); assert.ok(Number(actual.meshCount) > 1000);
  });
  await check('Visual preset / Solid / Fit / PNG export', async () => {
    await button('Visual settings').click(); await page.getByLabel('Visual preset', { exact: true }).selectOption('ivory'); await button('Close visual settings').click();
    await button('Solid').click(); await button('Fit').click(); await state('displayMode', 'solid'); await png('01-caroline-solid'); await shot('01-solid-app');
  });
  await check('Wireframe and gold appearance export', async () => {
    await button('Wireframe').click(); await state('displayMode', 'wireframe'); await button('Visual settings').click(); await page.getByLabel('Visual preset', { exact: true }).selectOption('gold'); await button('Close visual settings').click();
    await png('02-caroline-wireframe'); assert.notEqual(report.exports[0].sha256, report.exports[1].sha256);
  });
  await check('Plan projection and Orbit projection', async () => {
    await button('Plan').click(); await state('projection', 'orthographic-plan'); await png('03-caroline-plan');
    await button('Orbit').click(); await state('projection', 'perspective');
  });
  await check('Ground / upper / whole-building selection and roof visibility', async () => {
    const all = Number((await data()).visibleMeshCount);
    for (const level of ['ground', 'upper']) { await page.getByLabel('Building floor', { exact: true }).selectOption(level); await state('level', level); assert.ok(Number((await data()).visibleMeshCount) < all); }
    await page.getByLabel('Building floor', { exact: true }).selectOption('all'); await state('roof', 'true'); await button('Roof on').click(); await state('roof', 'false'); await button('Roof off').click(); await state('roof', 'true');
  });
  await check('Wall cutaway and exploded view', async () => {
    await button('Solid').click(); await button('Wall cutaway').click(); await state('cutaway', 'true'); await state('level', 'ground'); await state('roof', 'false'); await button('Fit').click(); await png('04-caroline-cutaway');
    await button('Explode').click(); await state('explode', 'true'); await png('05-caroline-exploded'); await button('Explode').click(); await state('explode', 'false');
  });
  await check('Pointer orbit, wheel zoom and Fit reset', async () => {
    await page.getByLabel('Building floor', { exact: true }).selectOption('all'); await button('Fit').click();
    const before = await data(), box = await canvas.boundingBox(); const x = box.x + box.width * .45, y = box.y + box.height * .5;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 25, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(old => document.querySelector('[aria-label="Interactive source building model"]')?.dataset.cameraPosition !== old, before.cameraPosition);
    const orbited = await data(); await page.mouse.wheel(0, -250);
    await page.waitForFunction(old => document.querySelector('[aria-label="Interactive source building model"]')?.dataset.cameraPosition !== old, orbited.cameraPosition);
    await button('Fit').click();
  });
  await check('Source SVG export is a real vector artifact', async () => {
    await button('Plan').click(); await page.getByLabel('Building floor', { exact: true }).selectOption('ground');
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: /^SVG \/ ground plan$/ }).click(); const path = resolve(dir, 'caroline-ground-plan.svg'); await (await pending).saveAs(path);
    const svg = readFileSync(path, 'utf8'); assert.ok(svg.includes('<svg')); assert.ok(/<(path|polyline|polygon|line)\b/.test(svg)); report.exports.push({ path, bytes: Buffer.byteLength(svg), sha256: createHash('sha256').update(svg).digest('hex') });
  });
  await check('Mobile model controls and PNG export', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await button('Orbit').click(); await button('Fit').click(); await state('projection', 'perspective');
    const bounds = await canvas.boundingBox(); assert.ok(bounds.width >= 300 && bounds.height >= 300);
    await button('Visual settings').click(); await page.getByLabel('Visual preset', { exact: true }).selectOption('ivory'); await button('Close visual settings').click();
    await button('Wireframe').click(); await state('displayMode', 'wireframe'); await button('Solid').click();
    await button('Plan').click(); await state('projection', 'orthographic-plan'); await button('Orbit').click(); await button('Fit').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await shot('06-mobile-model'); await png('06-caroline-mobile');
    await canvas.scrollIntoViewIfNeeded(); await shot('07-mobile-canvas');
  });
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.ok = false; report.failure = String(error.stack); await shot('failure'); throw error; }
finally { writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
