import fs from 'node:fs';
const dir='proof/growth/2026-09-07-sheets/';
const scenario=JSON.parse(fs.readFileSync(dir+'production-backup.json','utf8')).map(command=>command.map(text=>text
 .replaceAll('Production sheets and pricing a8a8c4946d93','Release sheet workspace backup')
 .replaceAll('/production-backup-','/candidate-backup-')
 .replace("if(!__backupUnchanged[priceKey])throw Error('Production pricing data absent');",'')
 .replace("const prices=JSON.parse(value.records.priceBooks);if(!prices.books.length)throw Error('Backup omitted pricing books');", "const prices=value.records.priceBooks?JSON.parse(value.records.priceBooks):{books:[],worksheet:[]};")
));
fs.writeFileSync(dir+'portable-backup.json',JSON.stringify(scenario,null,2));
