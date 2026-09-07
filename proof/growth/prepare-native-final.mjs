import fs from 'node:fs';
const base=JSON.parse(fs.readFileSync('proof/growth/native-sheets-desktop.json','utf8'));
const centre="(()=>{const root=document.querySelector('.measure-document-preview'),v=root?.querySelector('.document-preview-viewport')?.getBoundingClientRect(),p=root?.querySelector('.document-source-page')?.getBoundingClientRect(),b=window.__portableBookmark;return !!(v&&p&&b&&Math.abs((v.left+v.width/2-p.left)/p.width-b.center.x)<.002&&Math.abs((v.top+v.height/2-p.top)/p.height-b.center.y)<.002)})()";
const commands=[];
for(let command of base){
 command=command.map(v=>v.replaceAll('/native-','/native-final2-').replace("if(document.querySelector('.sheet-manager-list>li').dataset.originalPage!=='1')throw Error('Candidate needs fresh imported source order');",''));
 if(command[0]==='eval'&&command[1].includes("savedViewCount!=='0'"))commands.push(['click','.sheet-bookmarks summary'],['find','role','button','click','--name','Remove saved view Release drainage detail','--exact'],['wait','--fn',"document.querySelector('.sheet-bookmarks')?.dataset.savedViewCount==='0'"],['click','.sheet-bookmarks summary']);
 if(command[0]==='eval'&&command[1].includes('Math.abs(')&&command[1].includes('p.width'))commands.push(['wait','--fn',centre]);
 commands.push(command);
}
fs.writeFileSync('proof/growth/native-sheets-final.json',JSON.stringify(commands,null,2));
