import { readFileSync, writeFileSync } from 'node:fs';
const actions = JSON.parse(readFileSync('proof/audit/IW-PRICE-BOOK/import-final.json', 'utf8'));
const commands = [
  ['set', 'viewport', '1440', '1000'], ['open', 'http://127.0.0.1:8080/'], ['wait', '--load', 'networkidle'],
  ['wait', '--fn', "document.querySelector('.workbench')?.dataset.hydrationStatus==='ready'"],
  ['find', 'role', 'button', 'click', '--name', 'Cost', '--exact'], ['wait', '--fn', "!!document.querySelector('.price-books')"],
  ['find', 'role', 'button', 'click', '--name', 'Collapse left menu', '--exact'],
  ['find', 'role', 'button', 'click', '--name', 'Collapse right menu', '--exact'],
  ['find', 'role', 'button', 'click', '--name', 'Import CSV', '--exact'],
  ['upload', "input[aria-label='Supplier price CSV']", 'C:/Users/danie/repo/xray-by-looplet/proof/audit/IW-PRICE-BOOK/supplier.csv'],
  ['wait', '--fn', "document.querySelector('.price-books')?.textContent.includes('Match your columns')"], ...actions,
  ['eval', "(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('xray:price-books:v1:'));const value=JSON.parse(localStorage.getItem(key));if(value.books.length!==1||value.worksheet.length!==1)throw Error('Library/worksheet not saved');return {key,jobId:value.jobId,books:value.books.length,worksheet:value.worksheet.length};})()"],
];
writeFileSync('proof/audit/IW-PRICE-BOOK/fresh.json', JSON.stringify(commands, null, 2));
