import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { sourceText, validAnnotation } from '../src/engine.ts';
import type { Bank, Annotation, SemanticKeywords } from '../src/types.ts';
const bank: Bank = JSON.parse(readFileSync('public/data/bank.json', 'utf8'));
const report = JSON.parse(readFileSync('public/data/import-report.json', 'utf8'));
const keywords: Record<string, Annotation> = JSON.parse(readFileSync('public/data/keywords.json', 'utf8'));
const semantic:SemanticKeywords=JSON.parse(readFileSync('public/data/keywords-semantic.json','utf8'));
assert.equal(semantic.sourceSha256,bank.meta.sha256);
assert.equal(bank.chapters.length, 14);
assert.equal(new Set(bank.questions.map(q => q.id)).size, bank.questions.length);
assert.equal(bank.questions.length, bank.meta.questionCount);
const sourceHash = createHash('sha256').update(readFileSync('ein leichtes Erfolg.pdf')).digest('hex');
assert.equal(bank.meta.sha256, sourceHash);
let images = 0, blocks = 0;
for (const c of bank.chapters) {
    const group = bank.questions.filter(q => q.chapterId === c.id);
    assert.equal(group.length, c.count);
    assert.deepEqual(group.map(q => q.number), Array.from({ length: c.count }, (_, i) => i + 1));
}
for (const q of bank.questions) {
    assert(q.answers.length >= 2, q.id);
    assert.equal(q.answers.filter(a => a.correct).length, 1, q.id);
    assert.deepEqual(q.answers.map(a => a.number), q.answers.map((_, i) => i + 1));
    for (const t of [q, ...q.answers]) {
        assert.equal(t.text, sourceText(t.blocks), t.id);
        assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t.text), `Undecodable source character: ${t.id}`);
        assert.equal(t.sha256, createHash('sha256').update(t.text).digest('hex'), t.id);
        if (keywords[t.id])
            assert(validAnnotation(t.text, t.sha256, keywords[t.id]), t.id);
        if (semantic.annotations[t.id])
            assert(validAnnotation(t.text,t.sha256,semantic.annotations[t.id]),t.id);
        for (const b of t.blocks) {
            if (b.type === 'image') {
                images++;
                assert(existsSync('public/data/' + b.src));
            }
            else
                blocks++;
        }
    }
    for (const p of q.pages)
        assert(existsSync(`public/data/pages/${String(p).padStart(3, '0')}.webp`));
}
assert.equal(images, bank.meta.imageCount);
assert.equal(blocks, report.ledger.length);
assert.equal(report.issues.length, 0, JSON.stringify(report.issues));
console.log(`PASS: ${bank.questions.length} questions, 14 chapters, ${images} images, ${blocks} source lines, hashes and ${Object.keys(keywords).length} keyword annotations.`);
console.log('Independent extraction findings:', JSON.stringify(report.issues));
console.log('Visual review status:', bank.meta.reviewStatus);
