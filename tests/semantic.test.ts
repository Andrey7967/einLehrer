import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validAnnotation} from '../src/engine.ts';
import type {Bank,SemanticKeywords} from '../src/types.ts';
const bank:Bank=JSON.parse(readFileSync('public/data/bank.json','utf8'));
const semantic:SemanticKeywords=JSON.parse(readFileSync('public/data/keywords-semantic.json','utf8'));
test('authored semantic source covers every question and correct answer in all 14 chapters',()=>{
 assert.equal(semantic.sourceSha256,bank.meta.sha256);assert.equal(semantic.method,'authored-contrastive-analysis');
 assert.equal(bank.chapters.length,14);assert.equal(bank.questions.length,961);assert.deepEqual(semantic.reviewedQuestionIds,bank.questions.map(q=>q.id));
 assert.equal(Object.keys(semantic.annotations).length,1922);assert.equal(Object.keys(semantic.notes).length,961);
 for(const q of bank.questions){assert(semantic.notes[q.id]?.trim().length>0,q.id);for(const t of [q,...q.answers.filter(a=>a.correct)]){const a=semantic.annotations[t.id];assert(a?.ranges.length,t.id);assert.equal(a.status,'reviewed');assert(validAnnotation(t.text,t.sha256,a),t.id);}}
 for(const chapter of bank.chapters)assert.equal(semantic.reviewedQuestionIds.filter(id=>id.startsWith(`c${chapter.id}-`)).length,chapter.count);
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
test('new semantic choices preserve contrasting technical conditions and values',()=>{
 const p=(id:string)=>semantic.annotations[id].ranges.map(r=>r.text).join(' ').replace(/\s+/g,' ');
 assert(p('c3-q7').includes('на объект'));assert(p('c3-q11').includes('в объекте'));
 assert(p('c6-q36').includes('COM'));assert(p('c6-q37').includes('подписки'));
 assert(p('c7-q30').includes('ПоГруппировкам'));assert(p('c7-q31').includes('СИерархией'));
 assert(p('c10-q7').includes('управляемой'));assert(p('c10-q8').includes('обычной'));
 assert(p('c13-q44').includes('хранения'));assert(p('c13-q45').includes('получать'));
 assert(p('c14-q4-a2').includes('фактический'));assert(p('c14-q5-a1').includes('регистрации'));
 assert(p('c14-q53-a4').includes('4000'));assert(p('c14-q55-a2').includes('2000'));
});
