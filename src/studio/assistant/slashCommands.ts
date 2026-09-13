export const SLASH_COMMANDS = [
  {command:'/monkeysee',label:'Start recording'},
  {command:'/monkeydo',label:'Stop and review'},
  {command:'/draw',label:'Play existing drafting model'},
  {command:'/tour',label:'Start a cinematic tour'},
  {command:'/draftsman',label:'Show drafting status'},
  {command:'/capabilities',label:'Show available tools'},
];
function distance(a:string,b:string):number {
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next;}
  return row[b.length];
}
export function suggestSlashCommands(draft:string) {
  const query=draft.trim().toLowerCase();
  if(!/^\/[a-z-]*$/.test(query)||query.length>32)return [];
  const prefix=SLASH_COMMANDS.filter(item=>item.command.startsWith(query));
  if(prefix.length)return prefix;
  if(query.length<4)return [];
  return SLASH_COMMANDS.filter(item=>distance(query,item.command)<=2).slice(0,3);
}
