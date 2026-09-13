import { useEffect, useRef, useState } from 'react';
import { layoutMindMap } from './mindMapLayout';
import type { MindNode } from './replyMarkdown';
import { CopyAction } from './CopyAction';

export function mermaidTree(root: MindNode): string {
  const lines=['flowchart TD'];
  let count=0;
  const visit=(node:MindNode,parent?:string,depth=0)=>{
    if(count>=60||depth>=4)return;
    const id=`n${count++}`;
    const label=node.label.replace(/&/g,'#38;').replace(/"/g,'#quot;').replace(/[<>\r\n]/g,' ');
    lines.push(`  ${id}["${label}"]`);
    if(parent)lines.push(`  ${parent} --> ${id}`);
    node.children.forEach(child=>visit(child,id,depth+1));
  };
  visit(root);return lines.join('\n');
}

export function TopDownMindMap({root,label='Top-down mind map'}:{root:MindNode;label?:string}) {
  const [closed,setClosed]=useState<Set<string>>(()=>new Set(root.children.flatMap((child,i)=>child.children.length?[`n.${i}`]:[])));
  const viewport=useRef<HTMLElement>(null);
  const [copied,setCopied]=useState(false);
  const prune=(node:MindNode,id='n'):MindNode=>({...node,children:closed.has(id)?[]:node.children.map((child,i)=>prune(child,`${id}.${i}`))});
  const branches=new Set<string>();
  const collect=(node:MindNode,id='n')=>{if(node.children.length)branches.add(id);node.children.forEach((c,i)=>collect(c,`${id}.${i}`));};collect(root);
  const layout=layoutMindMap(prune(root));
  useEffect(()=>{const frame=requestAnimationFrame(()=>{if(viewport.current)viewport.current.scrollLeft=(viewport.current.scrollWidth-viewport.current.clientWidth)/2;});return()=>cancelAnimationFrame(frame);},[closed,layout.width]);
  const toggle=(id:string)=>setClosed(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});
  return <details className="assistant-map-disclosure" open>
    <summary>{label}<CopyAction text={mermaidTree(root)} label="mind map as Mermaid"/></summary>
    <figure ref={viewport} className="assistant-mindmap" aria-label={label}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height} aria-label={`Top-down: ${root.label}`}>
        {layout.edges.map(edge=><path key={`${edge.from}-${edge.to}`} d={edge.path} className="assistant-mindmap-edge"/>)}
        {layout.nodes.map(node=><g key={node.id} className={`assistant-mindmap-node depth-${node.depth}`} transform={`translate(${node.x} ${node.y})`}
          role={branches.has(node.id)?'button':undefined} tabIndex={branches.has(node.id)?0:undefined}
          aria-label={branches.has(node.id)?`${closed.has(node.id)?'Expand':'Collapse'} ${node.full}`:undefined}
          aria-expanded={branches.has(node.id)?!closed.has(node.id):undefined}
          onClick={()=>{if(branches.has(node.id))toggle(node.id);}}
          onKeyDown={event=>{if(branches.has(node.id)&&['Enter',' '].includes(event.key)){event.preventDefault();toggle(node.id);}}}>
          <title>{node.full}</title><rect width={node.width} height={node.height} rx={8}/>
          <text x={node.width/2} y={node.height/2+4} textAnchor="middle">{node.label}{closed.has(node.id)?' +':''}</text>
        </g>)}
      </svg>
    </figure>
    <details className="assistant-mindmap-source"><summary>Mermaid source</summary><pre>{mermaidTree(root)}</pre>
      <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(mermaidTree(root));setCopied(true);}catch{setCopied(false);}}}>{copied?'Copied':'Copy Mermaid'}</button>
    </details>
  </details>;
}
