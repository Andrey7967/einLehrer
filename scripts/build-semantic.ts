import {readFileSync,writeFileSync} from 'node:fs';
import {chapter1} from './semantic-chapter-1.ts';
import type {Annotation,Bank,Content,SemanticKeywords} from '../src/types.ts';
import {validAnnotation} from '../src/engine.ts';
const bank:Bank=JSON.parse(readFileSync('public/data/bank.json','utf8'));
const result:SemanticKeywords={version:1,sourceSha256:bank.meta.sha256,method:'authored-contrastive-analysis',reviewedQuestionIds:[],annotations:{},notes:{}};
function locate(content:Content,phrases:string[]):Annotation{
 // Whitespace-normalized lookup is only a locator: saved ranges always use original text.
 const chars:{char:string;index:number}[]=[];let space=false;
 for(let i=0;i<content.text.length;i++){const c=content.text[i];if(/\s/.test(c)){if(!space)chars.push({char:' ',index:i});space=true;}else{chars.push({char:c,index:i});space=false;}}
 const normalized=chars.map(c=>c.char).join('');
 const ranges=phrases.map(phrase=>{const needle=phrase.replace(/\s+/g,' '),start=normalized.indexOf(needle);if(start<0)throw Error(`Missing authored phrase ${content.id}: ${phrase}`);const begin=chars[start].index,end=chars[start+needle.length-1].index+1;return {start:begin,end,text:content.text.slice(begin,end)};}).sort((a,b)=>a.start-b.start);
 const annotation:Annotation={sha256:content.sha256,ranges,status:'reviewed'};
 if(!validAnnotation(content.text,content.sha256,annotation))throw Error(`Invalid semantic ranges: ${content.id}`);
 return annotation;
}
for(const [number,entry]of Object.entries(chapter1)){
 const q=bank.questions.find(q=>q.id===`c1-q${number}`);if(!q)throw Error(`Question ${number} absent`);
 const correct=q.answers.filter(a=>a.correct);if(correct.length!==1)throw Error(q.id+' requires explicit multi-answer analysis');
 result.annotations[q.id]=locate(q,entry.question);result.annotations[correct[0].id]=locate(correct[0],entry.answer);
 result.notes[q.id]=entry.note;result.reviewedQuestionIds.push(q.id);
}
if(result.reviewedQuestionIds.length!==bank.chapters[0].count)throw Error('Incomplete first chapter');
writeFileSync('public/data/keywords-semantic.json',JSON.stringify(result,null,2)+'\n');
console.log(`Compiled authored semantic analysis: ${result.reviewedQuestionIds.length} questions, ${Object.keys(result.annotations).length} annotations. No automatic fallback.`);
