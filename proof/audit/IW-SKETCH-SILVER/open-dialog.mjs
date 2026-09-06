import {chromium} from 'playwright';
const b=await chromium.connectOverCDP('http://127.0.0.1:9238');const p=b.contexts()[0].pages()[0];await p.getByRole('button',{name:'Open plan',exact:true}).click();await b.close();
