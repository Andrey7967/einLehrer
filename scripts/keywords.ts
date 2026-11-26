import { readFileSync, writeFileSync } from 'node:fs';
import type { Bank, Content, Annotation } from '../src/types.ts';
const bank: Bank = JSON.parse(readFileSync('public/data/bank.json', 'utf8'));
const result: Record<string, Annotation> = {};
const stop = new Set('в во на для и или а но с со по из к от до при как что это данного данный может быть можно используется использовать объект объекта объекты значение значения варианты вариант ответ ответы верны все указанные где каком каких какой какая каким производится позволяет необходимо нужно установить установки включения возможен верный набор правильны'.split(' '));
const terms = (s: string) => [...s.matchAll(/[\p{L}\p{N}_!]+/gu)].map(m => ({ word: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length }));
function annotate(t: Content, others: Content[], question = false) {
    const words = terms(t.text);
    const frequencies = new Map<string, number>();
    for (const o of others)
        for (const w of new Set(terms(o.text).map(w => w.word)))
            frequencies.set(w, (frequencies.get(w) || 0) + 1);
    const candidates: {
        start: number;
        end: number;
        text: string;
        score: number;
    }[] = [];
    for (let i = 1; i < words.length; i++)
        for (const size of [1, 2, 3, 4]) {
            const chunk = words.slice(i, i + size);
            if (chunk.length !== size)
                continue;
            const start = chunk[0].start, end = chunk.at(-1)!.end, text = t.text.slice(start, end);
            if (text.includes('\n') || text.length > 65 || text.length < 3)
                continue;
            const meaningful = chunk.filter(w => !stop.has(w.word) && w.word.length > 2);
            if (!meaningful.length)
                continue;
            if (stop.has(chunk[0].word) || stop.has(chunk.at(-1)!.word))
                continue;
            let score = meaningful.reduce((n, w) => n + Math.log(1 + (others.length + 1) / (1 + (frequencies.get(w.word) || 0))), 0) / Math.sqrt(size);
            if (chunk.some(w => ['не', 'только', 'кроме', 'нельзя', 'невозможно', 'всегда'].includes(w.word)))
                score += 2;
            if (/[!&<>]|\b(?:HTML|SQL|epf|erf|cfu|mxl)\b/i.test(text))
                score += 1;
            if (chunk.every(w => stop.has(w.word)))
                score -= 4;
            candidates.push({ start, end, text, score });
        }
    candidates.sort((a, b) => b.score - a.score || a.start - b.start);
    const chosen: typeof candidates = [];
    const budget = Math.min(question ? 70 : 90, Math.max(20, t.text.length * .3));
    let used = 0;
    for (const c of candidates) {
        if (chosen.length >= 2 || used + c.text.length > budget || chosen.some(x => c.start < x.end + 4 && c.end > x.start - 4))
            continue;
        chosen.push(c);
        used += c.text.length;
    }
    let ranges = chosen.sort((a, b) => a.start - b.start).map(({ start, end, text }) => ({ start, end, text }));
    const quoted = [...t.text.matchAll(/["«]([^"»\n]{3,55})["»]/g)].filter(m => terms(m[1]).some(w => !stop.has(w.word)));
    if (question && quoted.length) {
        const m = quoted[0];
        const start = m.index! + 1;
        ranges = [{ start, end: start + m[1].length, text: m[1] }];
    }
    if (!question && (/(?:вариант|ответ)[а-я]*\s+\d/i.test(t.text) || t.text.length < 55 || !ranges.length)) {
        const start = t.text.search(/\)\s*/) + 1;
        let begin = start;
        while (/\s/.test(t.text[begin] || 'x'))
            begin++;
        ranges = [{ start: begin, end: t.text.length, text: t.text.slice(begin) }];
    }
    result[t.id] = { sha256: t.sha256, ranges, status: 'suggested' };
}
for (const q of bank.questions) {
    // Rank neighbouring questions by shared vocabulary rather than raw document frequency.
    const own = new Set(terms(q.text).filter(w => !stop.has(w.word)).map(w => w.word));
    const similar = bank.questions.filter(x => x.id !== q.id && x.chapterId === q.chapterId).map(x => ({ x, n: terms(x.text).filter(w => own.has(w.word)).length })).sort((a, b) => b.n - a.n).slice(0, 8).map(x => x.x);
    annotate(q, similar, true);
    for (const a of q.answers)
        if (a.correct)
            annotate(a, q.answers.filter(x => x.id !== a.id));
}
writeFileSync('public/data/keywords.json', JSON.stringify(result, null, 2));
console.log(`Prepared ${Object.keys(result).length} separate, hash-bound keyword annotations (automatic suggestions).`);
