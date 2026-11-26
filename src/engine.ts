import type { Annotation, Question, Session } from './types.ts';
export function shuffle<T>(items: readonly T[], random = Math.random): T[] { const out = [...items]; for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
} return out; }
export function exam(questions: Question[], chapterIds: number[], random = Math.random): Question[] { return chapterIds.map(id => { const group = questions.filter(q => q.chapterId === id); if (!group.length)
    throw Error(`Раздел ${id} пуст`); return group[Math.floor(random() * group.length)]; }); }
export function isCorrect(q: Question, selected: string[]): boolean { const expected = q.answers.filter(a => a.correct).map(a => a.id); return selected.length === expected.length && new Set(selected).size === selected.length && expected.every(id => selected.includes(id)); }
export function validAnnotation(text: string, hash: string, a?: Annotation): boolean { return !!a && a.sha256 === hash && Array.isArray(a.ranges) && ['suggested', 'reviewed'].includes(a.status) && a.ranges.every((r, i) => r && Number.isInteger(r.start) && Number.isInteger(r.end) && r.start >= 0 && r.end > r.start && r.end <= text.length && text.slice(r.start, r.end) === r.text && (!i || r.start >= a.ranges[i - 1].end)); }
export function sessionValid(s: Session, version: string, questions: Question[]): boolean { if (!s || s.version !== version || !Array.isArray(s.ids) || !s.ids.length || new Set(s.ids).size !== s.ids.length || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.ids.length || !s.responses || typeof s.finished !== 'boolean')
    return false; const byId = new Map(questions.map(q => [q.id, q])); return s.ids.every(id => byId.has(id)) && Object.entries(s.responses).every(([id, ids]) => s.ids.includes(id) && Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(a => byId.get(id)?.answers.some(x => x.id === a))); }
export function sourceText(blocks: {
    type: string;
    text?: string;
}[]): string { return blocks.filter(b => b.type === 'text').map(b => b.text).join('\n'); }
export function validProgressRecords(stats:unknown,reviews:unknown,ids?:Set<string>):boolean {
    if (!stats || !reviews || typeof stats!=='object' || typeof reviews!=='object' || Array.isArray(stats) || Array.isArray(reviews)) return false;
    return Object.entries(stats).every(([id,row])=> (!ids||ids.has(id)) && row && typeof row==='object' && Number.isSafeInteger(row.right) && row.right>=0 && Number.isSafeInteger(row.wrong) && row.wrong>=0)
        && Object.entries(reviews).every(([id,row])=> (!ids||ids.has(id)) && row && typeof row==='object' && typeof row.checked==='boolean' && typeof row.note==='string');
}
