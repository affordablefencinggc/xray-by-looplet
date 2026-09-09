import fs from 'node:fs';
const dir = 'proof/growth/2026-09-08-daily-recovery/';
const setup = JSON.parse(fs.readFileSync(dir + 'authored-sheets-open-attempt2.json', 'utf8'));
const journey = JSON.parse(fs.readFileSync(dir + 'authored-sheets-journey.json', 'utf8'));
fs.writeFileSync(dir + 'authored-sheets-journey-attempt2.json', JSON.stringify([...setup, ...journey], null, 2), {flag: 'wx'});
