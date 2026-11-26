import React from 'react';
import type {Annotation,Content} from './types';
import {validAnnotation} from './engine';

/** Render only substrings of the immutable source. Annotation text is never substituted. */
export function SourceContent({content,highlight=false,annotation,dataBase}:{content:Content;highlight?:boolean;annotation?:Annotation;dataBase:string}){
 let offset=0;
 const valid=validAnnotation(content.text,content.sha256,annotation);
 return <div className="source-content">{content.blocks.map((block,i)=>{
  if(block.type==='image')return <a className="image-link" key={i} href={dataBase+block.src} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><img src={dataBase+block.src} width={block.width} height={block.height} loading="lazy" alt={`Иллюстрация, исходная страница ${block.page}`}/></a>;
  const begin=offset;offset+=block.text.length+1;
  const ranges=highlight&&valid?annotation!.ranges.filter(r=>r.start<begin+block.text.length&&r.end>begin):[];
  let cursor=0;const parts:React.ReactNode[]=[];
  for(const [j,range]of ranges.entries()){
   const start=Math.max(0,range.start-begin),end=Math.min(block.text.length,range.end-begin);
   parts.push(block.text.slice(cursor,start),<mark key={j}>{block.text.slice(start,end)}</mark>);cursor=end;
  }
  parts.push(block.text.slice(cursor));
  return <React.Fragment key={i}><span className="source-line">{parts}</span>{content.blocks.slice(i+1).some(b=>b.type==='text')?'\n':null}</React.Fragment>;
 })}</div>;
}
