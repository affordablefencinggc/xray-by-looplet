import os from 'node:os';
if(os.hostname().toLowerCase()!=='dans1')throw Error('Wrong host');
const tabs=await(await fetch('http://127.0.0.1:9337/json/list')).json();
for(const tab of tabs.filter(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:8080'))){
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'JSON.stringify({text:document.body.innerText.slice(-7000),panes:document.querySelector(".workspace-rails")?.dataset.pane,preview:!!document.querySelector(".sheets-document-preview")})',returnByValue:true}}));
await new Promise(r=>ws.addEventListener('message',e=>{console.log(e.data);ws.close();r()},{once:true}));
}
