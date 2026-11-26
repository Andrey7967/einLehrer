import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exam, shuffle, isCorrect, validAnnotation, sessionValid } from '../src/engine.ts';
import type { Bank, Session } from '../src/types.ts';
const bank: Bank = JSON.parse(readFileSync('public/data/bank.json', 'utf8'));
test('shuffle preserves every ID exactly once and leaves original untouched', () => { const ids = bank.questions.map(q => q.id), before = [...ids]; const mixed = shuffle(ids, () => .123); assert.deepEqual(ids, before); assert.equal(new Set(mixed).size, ids.length); assert.deepEqual([...mixed].sort(), [...ids].sort()); assert.notDeepEqual(mixed, ids); });
test('exam always selects exactly one question from each of the 14 chapters', () => { for (const random of [() => 0, () => .99999, Math.random]) {
    const questions = exam(bank.questions, bank.chapters.map(c => c.id), random);
    assert.equal(questions.length, 14);
    assert.equal(new Set(questions.map(q => q.id)).size, 14);
    assert.deepEqual(questions.map(q => q.chapterId), bank.chapters.map(c => c.id));
} });
test('answer checking rejects wrong, missing, extra and duplicate choices', () => { for (const q of bank.questions) {
    const correct = q.answers.filter(a => a.correct).map(a => a.id);
    assert(isCorrect(q, correct), q.id);
    assert(!isCorrect(q, []));
    assert(!isCorrect(q, [q.answers.find(a => !a.correct)!.id]));
    assert(!isCorrect(q, [...correct, ...correct]));
} });
test('stale, overlapping and incorrect keyword ranges are rejected', () => { const text = 'Только на сервере', hash = 'abc'; const a = { sha256: hash, status: 'suggested' as const, ranges: [{ start: 0, end: 6, text: 'Только' }] }; assert(validAnnotation(text, hash, a)); assert(!validAnnotation(text, 'changed', a)); assert(!validAnnotation(text, hash, { ...a, ranges: [{ start: 0, end: 6, text: 'ТОЛЬКО' }] })); assert(!validAnnotation(text, hash, { ...a, ranges: [...a.ranges, ...a.ranges] })); assert(!validAnnotation(text, hash, { ...a, ranges: [{ start: -1, end: 6, text: 'Только' }] })); });
test('resume validates dataset identity and answer membership', () => { const q = bank.questions[0]; const s: Session = { version: bank.meta.sha256, mode: 'marathon', ids: [q.id], index: 0, responses: { [q.id]: [q.answers[0].id] }, finished: false, chapter: 0, shuffle: false }; assert(sessionValid(s, bank.meta.sha256, bank.questions)); assert(!sessionValid({ ...s, version: 'old' }, bank.meta.sha256, bank.questions)); assert(!sessionValid({ ...s, index: 1 }, bank.meta.sha256, bank.questions)); assert(!sessionValid({ ...s, responses: { [q.id]: ['foreign-answer'] } }, bank.meta.sha256, bank.questions)); });
