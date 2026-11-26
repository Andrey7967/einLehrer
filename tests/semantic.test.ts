import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validAnnotation} from '../src/engine.ts';
import type {Bank,SemanticKeywords} from '../src/types.ts';
const bank:Bank=JSON.parse(readFileSync('public/data/bank.json','utf8'));
const semantic:SemanticKeywords=JSON.parse(readFileSync('public/data/keywords-semantic.json','utf8'));
test('authored semantic source covers exactly every question and correct answer of chapter one',()=>{
 assert.equal(semantic.sourceSha256,bank.meta.sha256);assert.equal(semantic.method,'authored-contrastive-analysis');
 const chapter=bank.questions.filter(q=>q.chapterId===1);assert.equal(chapter.length,77);assert.deepEqual(semantic.reviewedQuestionIds,chapter.map(q=>q.id));
 assert.equal(Object.keys(semantic.annotations).length,154);
 for(const q of chapter){assert(semantic.notes[q.id]?.length>30,q.id);for(const t of [q,...q.answers.filter(a=>a.correct)]){const a=semantic.annotations[t.id];assert(a?.ranges.length,t.id);assert.equal(a.status,'reviewed');assert(validAnnotation(t.text,t.sha256,a),t.id);}}
 for(const q of bank.questions.filter(q=>q.chapterId!==1)){assert(!semantic.annotations[q.id]);assert(!semantic.notes[q.id]);}
});
test('contrastive phrases retain condition, negation, restrictions, OR and file extensions',()=>{
 const phrases=(id:string)=>semantic.annotations[id].ranges.map(r=>r.text).join(' ').replace(/\s+/g,' ');
 assert(phrases('c1-q10').includes('обычных форм'));assert(phrases('c1-q11').includes('управляемых форм'));
 assert(phrases('c1-q18-a2').includes('не имеющих объектной природы'));
 assert(phrases('c1-q7-a4').includes('потеря функциональности'));
 assert(phrases('c1-q77-a4').includes('или'));
 assert(phrases('c1-q5-a1').includes('epf'));assert(phrases('c1-q5-a1').includes('erf'));assert(phrases('c1-q5-a1').includes('сf'));
 assert(phrases('c1-q71').includes('нового'));assert(phrases('c1-q72').includes('существующего'));
});
test('compiling either annotation source never changes any bank text or hash',()=>{
 for(const q of bank.questions)for(const t of [q,...q.answers])assert.equal(createHash('sha256').update(t.text).digest('hex'),t.sha256);
});
