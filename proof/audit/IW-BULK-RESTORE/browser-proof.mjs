import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const url = process.argv[2] ?? 'http://127.0.0.1:8080/', mode = url.includes('8081') ? 'built' : 'dev';
const dir = resolve('screenshots/bulk-restore', mode); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } }), page = await context.newPage(); page.setDefaultTimeout(30000);
const report = { url, fixture: 'Synthetic QA CSV/backup data in an isolated browser. No actual tower material quantities.', checks: [], errors: [], screenshots: [] };
page.on('pageerror', e => report.errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); });
const button = name => page.getByRole('button', { name, exact: true });
async function saved() { return page.evaluate(() => { const key = Object.keys(localStorage).find(k => k.startsWith('xray:source-takeoff:') && !k.includes(':recovery:')); return { key, raw: key ? localStorage.getItem(key) : null }; }); }
async function ready() { await page.waitForFunction(() => !document.querySelector('.workbench-loading')); }
async function components() { await button('Components').click(); await page.getByRole('region', { name: 'Altitude source takeoff' }).waitFor(); }
async function select(name, text, filename) { const pending = page.waitForEvent('filechooser'); await button(name).click(); await (await pending).setFiles({ name: filename, mimeType: filename.endsWith('.csv') ? 'text/csv' : 'application/json', buffer: Buffer.from(text) }); }
async function downloaded(name, filename) { const pending = page.waitForEvent('download'); await button(name).click(); const path = resolve(dir, filename); await (await pending).saveAs(path); return readFileSync(path, 'utf8'); }
async function check(tool, action) { await action(); report.checks.push({ tool, result: 'pass' }); }
async function shot(name) { const path = resolve(dir, name + '.png'); await page.screenshot({ path }); report.screenshots.push(path); }
const header = 'Stock code,Description,Stock quantity,Unit,Units per package,Package length m,Package width m,Package height m,Specified kg,Weight basis,Source reference\r\n';
const csv = header + 'QA-A,"QA ONLY, packaged part",23,each,10,2,1,.5,4,unit,"QA supplier\nfictional line"\r\nQA-B,QA ONLY bulk,.28,m3,.01,.1,.2,.3,2,unit,QA supplier\r\n';
let originalBackup, originalSnapshot;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(); const pending = page.waitForEvent('filechooser'); await button('Open plan').first().click();
  await (await pending).setFiles(resolve('downloads/high_rise_plans/03_Seattle_Altitude_Hotel_and_Residences_50Story_Tower.pdf'));
  await page.locator('.document-preview[data-source-ready="true"]').waitFor({ timeout: 60000 }); await components(); await button('Save inventory').click();
  await check('Download template and protect unsaved count/material drafts', async () => {
    assert.equal(await downloaded('Download CSV template', 'template.csv'), header);
    await page.getByLabel('Count / review note', { exact: true }).fill('QA unsaved count note'); assert.equal(await button('Import materials CSV').isDisabled(), true); assert.equal(await button('Restore backup').isDisabled(), true);
    await button('Cancel group changes').click(); assert.equal(await button('Import materials CSV').isEnabled(), true);
    await button('Materials & storage').click(); await button('Add material').click(); assert.equal(await button('Restore backup').isDisabled(), true); await button('Cancel changes').click();
  });
  await check('CSV preview/cancel does not save; explicit apply imports two lines atomically', async () => {
    const before = await saved(); await select('Import materials CSV', csv, 'qa-materials.csv'); await page.getByRole('heading', { name: 'Preview material import' }).waitFor();
    assert.equal((await saved()).raw, before.raw); assert.ok((await page.getByLabel('Transfer preview').innerText()).includes('2 added'));
    await page.locator('.transfer-lines details').first().locator('summary').click(); await shot('01-csv-preview'); await button('Cancel import').click(); assert.equal((await saved()).raw, before.raw);
    await select('Import materials CSV', csv, 'qa-materials.csv'); await button('Apply material import').click();
    const current = JSON.parse((await saved()).raw); assert.equal(current.materials.length, 2); assert.deepEqual(current.rows, JSON.parse(before.raw).rows);
    const totals = await page.locator('.material-register .takeoff-summary').innerText(); assert.ok(totals.includes('3.168 m³')); assert.ok(totals.includes('92.56 kg')); await shot('02-imported-stock');
  });
  await check('Duplicate/malformed/foreign CSV rejected with no partial writes', async () => {
    const before = await saved();
    for (const [name, text] of [['duplicate', header + 'A,QA,1,each,,,,,,,QA\n a ,QA,2,each,,,,,,,QA'], ['malformed', header + 'A,"unclosed'], ['foreign', 'Stock code,Description,Unit,Source reference,Drawing SHA-256\nX,QA,each,QA,wrong']]) {
      await select('Import materials CSV', text, name + '.csv'); await page.getByRole('alert').last().waitFor(); assert.equal((await saved()).raw, before.raw); assert.equal(await button('Apply material import').count(), 0);
    }
  });
  await check('Matching-code updates are explicit, retain IDs and increment revisions', async () => {
    const before = JSON.parse((await saved()).raw); await select('Import materials CSV', csv.replace(',23,each', ',24,each'), 'update.csv');
    await page.getByRole('alert').last().waitFor(); assert.equal(await button('Apply material import').isDisabled(), true);
    await page.getByLabel('Update matching stock codes', { exact: true }).check(); assert.ok((await page.getByLabel('Transfer preview').innerText()).includes('1 updated'));
    await button('Apply material import').click(); const current = JSON.parse((await saved()).raw);
    assert.equal(current.materials[0].id, before.materials[0].id); assert.equal(current.materials[0].revision, 2); assert.equal(current.materials[1].revision, 1); assert.equal(current.materials[0].quantity, 24);
  });
  await check('Current CSV export reimports unchanged, with computed totals ignored', async () => {
    const exported = await downloaded('Export materials CSV', 'qa-export.csv'); await select('Import materials CSV', exported, 'roundtrip.csv');
    await page.getByLabel('Update matching stock codes', { exact: true }).check(); assert.ok((await page.getByLabel('Transfer preview').innerText()).includes('2 unchanged')); await button('Cancel import').click();
  });
  await check('Backup download preserves complete saved input and file reload restores it', async () => {
    originalBackup = await downloaded('Download backup', 'qa-backup.json'); originalSnapshot = await saved();
    assert.deepEqual(JSON.parse(originalBackup).inventory, JSON.parse(originalSnapshot.raw));
    const changed = JSON.parse(originalBackup); changed.inventory.materials[0].quantity = 12; changed.inventory.rows[0].countPerFloor = 10; changed.inventory.rows[0].note = 'QA ONLY count adjustment';
    await select('Restore backup', JSON.stringify(changed), 'qa-modified-backup.json'); await page.getByRole('heading', { name: 'Preview backup restore' }).waitFor();
    assert.equal((await saved()).raw, originalSnapshot.raw); await shot('03-backup-preview'); await button('Replace inventory with backup').click();
    const restored = JSON.parse((await saved()).raw); assert.equal(restored.materials[0].quantity, 12); assert.equal(restored.rows[0].countPerFloor, 10); assert.equal(restored.rows[0].review, 'pending');
    assert.equal(await downloaded('Download previous snapshot', 'previous-snapshot.json'), originalSnapshot.raw);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await components(); assert.equal(await downloaded('Download previous snapshot', 'previous-after-reload.json'), originalSnapshot.raw);
  });
  await check('Restoring the previous snapshot recovers original stock and notes', async () => {
    await select('Restore backup', originalSnapshot.raw, 'previous-snapshot.json'); await button('Replace inventory with backup').click();
    const value = JSON.parse((await saved()).raw); assert.equal(value.materials[0].quantity, 24); assert.equal(value.rows[0].countPerFloor, 9);
  });
  await check('Unsupported backup rejected; failed archive/write retain prior data and preview', async () => {
    const before = await saved(); await select('Restore backup', '{"schema":"future"}', 'future.json'); await page.getByRole('alert').last().waitFor(); assert.equal((await saved()).raw, before.raw);
    await select('Restore backup', originalBackup, 'qa-backup.json');
    await page.evaluate(() => { window.__qaSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if(k.includes(':recovery:')) throw Error('QA archive quota'); return window.__qaSet.call(this, k, v); }; });
    await button('Replace inventory with backup').click(); assert.equal((await saved()).raw, before.raw); await page.getByText(/QA archive quota/).first().waitFor();
    await page.evaluate(() => { Storage.prototype.setItem = function(k, v) { if(k.startsWith('xray:source-takeoff:') && !k.includes(':recovery:')) throw Error('QA primary quota'); return window.__qaSet.call(this, k, v); }; });
    await button('Replace inventory with backup').click(); assert.equal((await saved()).raw, before.raw); await page.getByText(/QA primary quota/).first().waitFor();
    await page.evaluate(() => { Storage.prototype.setItem = window.__qaSet; delete window.__qaSet; }); await button('Replace inventory with backup').click();
    assert.equal(await button('Replace inventory with backup').count(), 0);
  });
  await check('Unreadable saved data stays protected until explicit validated backup recovery', async () => {
    const value = await saved(), future = '{"schema":"future-version","preserve":"exact bytes"}'; await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: value.key, raw: future });
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await components(); assert.equal(await button('Import materials CSV').isDisabled(), true);
    assert.equal(await downloaded('Download saved snapshot', 'unreadable-original.json'), future);
    await select('Restore backup', originalBackup, 'recovery.json'); await page.getByText(/Existing quantities unavailable/).waitFor(); assert.equal((await saved()).raw, future); await button('Replace inventory with backup').click();
    assert.equal(await downloaded('Download previous snapshot', 'unreadable-archived.json'), future); assert.equal(await button('Import materials CSV').isEnabled(), true); await shot('04-recovered-inventory');
  });
  await check('Conflict after preview blocks apply without overwriting the other snapshot', async () => {
    await select('Restore backup', originalBackup, 'conflict.json'); const before = await saved(), other = JSON.stringify({ ...JSON.parse(before.raw), revision: 99 });
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: before.key, raw: other }); await button('Replace inventory with backup').click(); assert.equal((await saved()).raw, other);
    await button('Cancel import').click(); await button('Retry restore').click();
  });
  await check('Mobile CSV preview and pagination, then backup restore', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const many = header + Array.from({ length: 51 }, (_, i) => `QA-M${i},QA ONLY mobile ${i},1,each,,,,,,,QA`).join('\n');
    await select('Import materials CSV', many, 'qa-51-lines.csv'); await page.getByRole('heading', { name: 'Preview material import' }).scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.transfer-lines details').count(), 50); await shot('05-mobile-preview'); await button('Next preview page').click(); assert.equal(await page.locator('.transfer-lines details').count(), 1);
    await button('Apply material import').click(); assert.equal(JSON.parse((await saved()).raw).materials.length, 53);
    await select('Restore backup', originalBackup, 'mobile-restore.json'); await button('Replace inventory with backup').click(); assert.equal(JSON.parse((await saved()).raw).materials.length, 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await button('Materials & storage').click(); await shot('06-mobile-restored');
  });
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (e) { report.ok = false; report.failure = String(e.stack); await shot('failure'); throw e; }
finally { writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
