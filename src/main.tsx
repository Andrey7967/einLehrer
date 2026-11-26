import { SourceContent } from './SourceContent';
import { KeywordSourceSwitch } from './KeywordSourceSwitch';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BookOpen, Check, CheckCheck, ChevronLeft, ChevronRight, Download, Flag, GraduationCap, LayoutGrid, ListChecks, Menu, Search, ShieldCheck, Shuffle, Sparkles, Target, WifiOff, X } from './icons';
import type { Annotation, Bank, Content, Question, Session, KeywordSource, SemanticKeywords } from './types';
import { exam, isCorrect, sessionValid, shuffle, validAnnotation, validProgressRecords } from './engine';
import './style.css';
const BASE = import.meta.env.BASE_URL;
const url = (path: string) => BASE + path;
const DATA = url('data/');
function read<T>(key: string, fallback: T): T { try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
}
catch {
    return fallback;
} }
function save(key: string, value: unknown) { try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
}
catch {
    return false;
} }
type Page = 'home' | 'study' | 'practice' | 'chapters' | 'review';
type Review = Record<string, {
    checked: boolean;
    note: string;
}>;
function App() {
    const [textSize,setTextSize]=useState(()=>{const saved=read<number>('text-size-percent',100);return typeof saved==='number'&&Number.isFinite(saved)?Math.max(80,Math.min(160,saved)):100;});
    useEffect(()=>{document.documentElement.style.setProperty('--text-scale',String(textSize/100));save('text-size-percent',textSize);},[textSize]);
    const [bank, setBank] = useState<Bank | null>(null), [algorithmAnnotations, setAlgorithmAnnotations] = useState<Record<string, Annotation>>({}), [error, setError] = useState('');
    const [semantic, setSemantic] = useState<SemanticKeywords|null>(null);
    const [semanticOverrides,setSemanticOverrides] = useState<Record<string,Annotation>>(read('keyword-overrides-semantic',{}));
    const [keywordSource,setKeywordSource] = useState<KeywordSource>(()=>read<KeywordSource>('keyword-source','algorithm')==='semantic'?'semantic':'algorithm');
    const annotations = keywordSource==='semantic'?{...semantic?.annotations,...semanticOverrides}:algorithmAnnotations;
    const overrideKey = keywordSource==='semantic'?'keyword-overrides-semantic':'keyword-overrides';
    const [page, setPage] = useState<Page>('home'), [chapter, setChapter] = useState(0), [query, setQuery] = useState(''), [keywords, setKeywords] = useState(read('keywords-enabled', true)), [mixed, setMixed] = useState(false);
    const [session, setSession] = useState<Session | null>(null), [selected, setSelected] = useState<string[]>([]), [stats, setStats] = useState<Record<string, {
        right: number;
        wrong: number;
    }>>(read('stats', {}));
    const [reviews, setReviews] = useState<Review>(read('source-reviews', {})), [reviewId, setReviewId] = useState(''), [edit, setEdit] = useState<Content | null>(null), [phrase, setPhrase] = useState('');
    const [offline, setOffline] = useState(''), [offlineBusy, setOfflineBusy] = useState(false), [install, setInstall] = useState<any>(null), [menu, setMenu] = useState(false), [notice, setNotice] = useState('');
    const [studyLimit, setStudyLimit] = useState(20);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lock = useRef(false);
    const version = bank?.meta.sha256 || '';
    useEffect(() => { Promise.all([fetch(DATA + 'bank.json').then(r => { if (!r.ok)
            throw Error('Не удалось загрузить банк'); return r.json(); }), fetch(DATA + 'keywords.json').then(r => { if (!r.ok)
            throw Error('Не удалось загрузить подсказки'); return r.json(); }), fetch(DATA + 'keywords-semantic.json').then(r=>{if(!r.ok)throw Error('Не удалось загрузить смысловой разбор');return r.json();})]).then(([b, a, semanticData]) => { if(semanticData.sourceSha256!==b.meta.sha256)throw Error('Смысловые подсказки относятся к другой версии банка');setSemantic(semanticData);setBank(b); const overrides = read<Record<string, Annotation>>('keyword-overrides', {}); setAlgorithmAnnotations({ ...a, ...overrides }); const old = read<Session | null>('session', null); if (old && sessionValid(old, b.meta.sha256, b.questions))
        setSession(old); }).catch(e => setError(String(e))); }, []);
    useEffect(() => { const handler = (e: Event) => { e.preventDefault(); setInstall(e); }; window.addEventListener('beforeinstallprompt', handler); if ('serviceWorker' in navigator && import.meta.env.PROD) {
        navigator.serviceWorker.register(url('sw.js'), { scope: BASE }).then(() => navigator.serviceWorker.ready).then(reg => { reg.active?.postMessage({ type: 'STATUS' }); }).catch(() => setOffline('Не удалось включить офлайн-режим'));
    } const msg = (e: MessageEvent) => { if (e.data?.type === 'PROGRESS')
        setOffline(`Загрузка: ${e.data.done} / ${e.data.total}`); if (e.data?.type === 'READY') {
        setOffline('Готово к работе без интернета');
        setOfflineBusy(false);
    } if (e.data?.type === 'ERROR') {
        setOffline('Загрузка прервана. Нажмите, чтобы повторить.');
        setOfflineBusy(false);
    } }; navigator.serviceWorker?.addEventListener('message', msg); return () => { window.removeEventListener('beforeinstallprompt', handler); navigator.serviceWorker?.removeEventListener('message', msg); }; }, []);
    useEffect(() => { if (session && !save('session', session))
        setNotice('Не удалось сохранить прогресс: память устройства заполнена.'); }, [session]);
    useEffect(() => { save('keywords-enabled', keywords); }, [keywords]);
    useEffect(()=>{save('keyword-source',keywordSource);},[keywordSource]);
    useEffect(() => { return () => { if (timer.current)
        clearTimeout(timer.current); }; }, []);
    function navigate(p: Page) { if (timer.current)
        clearTimeout(timer.current); setPage(p); setMenu(false); setSelected([]); setStudyLimit(20); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function start(mode: string, c = chapter, random = mixed) { if (!bank)
        return; let qs = mode === 'exam' ? exam(bank.questions, bank.chapters.map(x => x.id)) : bank.questions.filter(q => !c || q.chapterId === c); if (mode !== 'exam' && random)
        qs = shuffle(qs); if (!qs.length)
        return; setSession({ version, mode, ids: qs.map(q => q.id), index: 0, responses: {}, finished: false, chapter: c, shuffle: random }); setSelected([]); lock.current = false; navigate('practice'); }
    function next() { if (timer.current)
        clearTimeout(timer.current); setSession(s => s ? ({ ...s, index: Math.min(s.index + 1, s.ids.length - 1), finished: s.index + 1 >= s.ids.length }) : s); setSelected([]); lock.current = false; }
    function submit(ids: string[]) { if (!bank || !session || lock.current)
        return; const q = bank.questions.find(q => q.id === session.ids[session.index])!; if (session.responses[q.id] || !ids.length)
        return; lock.current = true; setSelected(ids); setSession(s => s ? ({ ...s, responses: { ...s.responses, [q.id]: ids } }) : s); const ok = isCorrect(q, ids); setStats(prev => { const row = prev[q.id] || { right: 0, wrong: 0 }; const st = { ...prev, [q.id]: { right: row.right + (ok ? 1 : 0), wrong: row.wrong + (ok ? 0 : 1) } }; save('stats', st); return st; }); if (ok)
        timer.current = setTimeout(next, 1100); }
    async function download() { if (import.meta.env.DEV) {
        setNotice('Офлайн-режим доступен в production-сборке: npm run build, затем npm run preview.');
        return;
    } if (!('serviceWorker' in navigator)) {
        setNotice('Для офлайн-режима откройте приложение через HTTPS или localhost.');
        return;
    } setOfflineBusy(true); setOffline('Подготовка загрузки…'); try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'DOWNLOAD' });
    }
    catch {
        setOfflineBusy(false);
        setOffline('Не удалось начать загрузку');
    } }
    function updateReview(id: string, patch: Partial<Review[string]>) { setReviews(prev => { const next = { ...prev, [id]: { ...(prev[id] || { checked: false, note: '' }), ...patch } }; if (!save('source-reviews', next))
        setNotice('Не удалось сохранить отметку сверки'); return next; }); }
    function exportProgress() { const data = { version, stats, reviews, annotations: read('keyword-overrides', {}), semanticAnnotations: read('keyword-overrides-semantic',{}), keywordSource, session }; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); link.download = '1c-progress.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
    async function importProgress(file?: File) { if (!file || !bank)
        return; try {
        const d = JSON.parse(await file.text());
        if (d.version !== version)
            throw Error('Файл относится к другой версии банка');
        if (d.session && !sessionValid(d.session, version, bank.questions))
            throw Error('Повреждённая сессия');
        const contents = new Map(bank.questions.flatMap(q => [q, ...q.answers]).map(x => [x.id, x]));
        for (const [id, a] of Object.entries(d.annotations||{}).concat(Object.entries(d.semanticAnnotations||{}))) {
            const t = contents.get(id);
            if (!t || !validAnnotation(t.text, t.sha256, a as Annotation))
                throw Error('Повреждена разметка подсказок');
        }
        if (!validProgressRecords(d.stats,d.reviews,new Set(bank.questions.map(q=>q.id))))
            throw Error('Неверная структура файла');
        setStats(d.stats);
        setReviews(d.reviews);
        setSession(d.session || null);
        setAlgorithmAnnotations(prev => ({ ...prev, ...d.annotations }));
        setSemanticOverrides(d.semanticAnnotations||{});
        if(d.keywordSource==='semantic'||d.keywordSource==='algorithm')setKeywordSource(d.keywordSource);
        save('stats', d.stats);
        save('source-reviews', d.reviews);
        save('keyword-overrides', d.annotations || {});
        save('keyword-overrides-semantic',d.semanticAnnotations||{});
        if(!d.session){try{localStorage.removeItem('session');}catch{}}
        if(timer.current)clearTimeout(timer.current);lock.current=false;
        setNotice('Прогресс восстановлен');
    }
    catch (e) {
        setNotice(`Импорт отклонён: ${e}`);
    } }
    function annotate(ranges: Annotation['ranges']) { if (!edit)
        return; const a: Annotation = { sha256: edit.sha256, ranges, status: 'reviewed' }; if (!validAnnotation(edit.text, edit.sha256, a)) {
        setNotice('Диапазоны пересекаются или не соответствуют тексту');
        return;
    } const overrides = { ...read<Record<string, Annotation>>(overrideKey, {}), [edit.id]: a }; if (!save(overrideKey, overrides))
        setNotice('Не удалось сохранить подсказку'); if(keywordSource==='semantic')setSemanticOverrides(prev=>({...prev,[edit.id]:a}));else setAlgorithmAnnotations(prev => ({ ...prev, [edit.id]: a })); }
    const ContentView = ({content,highlight=false}:{content:Content;highlight?:boolean}) => <SourceContent content={content} highlight={highlight} annotation={annotations[content.id]} dataBase={DATA}/>;
    function qTools(q: Question) { return <>{keywordSource==='semantic'&&!semantic?.reviewedQuestionIds.includes(q.id)&&<p className="semantic-unavailable">Для этого вопроса смысловой разбор ещё не подготовлен. Алгоритмические подсказки не подставляются.</p>}<div className="q-tools"><button className="text-button" onClick={() => { setReviewId(q.id); navigate('review'); }}><ShieldCheck size={14}/> Сверить с PDF</button><button className="text-button" onClick={() => { setEdit(q); setPhrase(''); }}><Sparkles size={14}/> Ключевые слова</button></div></>; }
    function SemanticNote({question}:{question:Question}) {const note=semantic?.notes[question.id];return keywordSource==='semantic'&&note?<aside className="semantic-note"><strong>Смысловая опора</strong><p>{note}</p></aside>:null;}
    if (error)
        return <div className="loading"><h1>Не удалось открыть тренажёр</h1><p>{error}</p><button onClick={() => location.reload()}>Повторить</button></div>;
    if (!bank)
        return <div className="loading"><span className="brand-icon">✓</span><h2>Собираем вашу практику…</h2></div>;
    const all = bank.questions;
    const filtered = all.filter(q => (!chapter || q.chapterId === chapter) && (!query || `${q.text} ${q.answers.map(a => a.text).join(' ')}`.toLowerCase().includes(query.toLowerCase())));
    const totalAttempts = Object.values(stats).reduce((n, s) => n + s.right + s.wrong, 0);
    const right = Object.values(stats).reduce((n, s) => n + s.right, 0);
    const learned = Object.values(stats).filter(s => s.right > s.wrong).length;
    const reviewed = all.filter(q => reviews[q.id]?.checked).length;
    const current = session ? all.find(q => q.id === session.ids[session.index]) : undefined;
    const given = current && session?.responses[current.id];
    const correct = current && given ? isCorrect(current, given) : false;
    const rq = all.find(q => q.id === reviewId) || filtered[0] || all[0];
    const ri = all.findIndex(q => q.id === rq.id);
    const nav = [{ id: 'home', label: 'Обзор', icon: LayoutGrid }, { id: 'study', label: 'Изучение', icon: BookOpen }, { id: 'practice', label: 'Марафон', icon: Flag }, { id: 'chapters', label: 'Разделы', icon: ListChecks }, { id: 'review', label: 'Сверка с PDF', icon: ShieldCheck }] as const;
    return <div className="app"><aside className={menu ? 'sidebar open' : 'sidebar'}><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('home'); }}><span className="brand-icon"><CheckCheck size={25}/></span><span>Практика<span className="brand-sub">ТРЕНАЖЁР 1С</span></span></a><div className="sidebar-caption">ВАШЕ ПРОСТРАНСТВО</div><nav>{nav.map(n => <button key={n.id} className={page === n.id ? 'nav-item active' : 'nav-item'} onClick={() => { if (n.id === 'practice' && !session)
        start('marathon', 0);
    else
        navigate(n.id); }}><n.icon size={19}/>{n.label}{n.id === 'chapters' && <span className="nav-count">14</span>}</button>)}</nav><div className="sidebar-bottom"><div className="daily"><span className="tiny-icon"><Target size={18}/></span><strong>Маленькие шаги.<br />Большой результат.</strong><p>Каждый вопрос — ближе<br />к уверенности на тесте.</p></div><button className="offline-button" onClick={download} disabled={offlineBusy}><WifiOff size={16}/><span>{offline || 'Скачать для офлайн'}</span></button>{install && <button className="offline-button" onClick={async () => { await install.prompt(); setInstall(null); }}><Download size={16}/>Установить приложение</button>}<div className="storage-actions"><button onClick={exportProgress}>Экспорт прогресса</button><label>Импорт<input type="file" accept="application/json" onChange={e => importProgress(e.target.files?.[0])}/></label></div><div className="local-label"><span /> Прогресс на этом устройстве</div></div></aside><div className="workspace"><div><label htmlFor="text-size">Размер текста </label><input id="text-size" type="range" min="80" max="160" step="5" value={textSize} aria-valuetext={`${textSize}%`} onInput={event=>setTextSize(Number(event.currentTarget.value))}/><output htmlFor="text-size"> {textSize}%</output></div><header className="topbar"><button className="mobile-menu" aria-label="Меню" onClick={() => setMenu(!menu)}><Menu /></button><div className="breadcrumb">Подготовка к тестированию <span>/</span> <strong>{page === 'home' ? 'Обзор' : page === 'chapters' ? 'Разделы' : page === 'study' ? 'Изучение' : page === 'review' ? 'Сверка с PDF' : 'Практика'}</strong></div><div className="topbar-right"><span className="status-dot"/> Личная практика <span className="avatar">Я</span></div></header><main>
 {notice && <div className="notice" role="status">{notice}<button aria-label="Закрыть" onClick={() => setNotice('')}><X size={16}/></button></div>}
 <KeywordSourceSwitch source={keywordSource} onChange={value=>{setKeywordSource(value);setEdit(null);}} reviewed={semantic?.reviewedQuestionIds.length||0} total={bank.questions.length}/>
 {page === 'home' && <><div className="page-heading"><div><div className="eyebrow">УЧИТЬСЯ. ПРАКТИКОВАТЬСЯ. ПОНИМАТЬ.</div><h1>К тесту — с уверенностью<span className="heading-dot">.</span></h1><p>Всё для подготовки по 1С в одном месте. В вашем темпе.</p></div><span className="pill"><span /> {all.length} вопросов · 14 разделов</span></div><section className="hero"><div className="hero-copy"><span className="hero-kicker"><Flag size={14}/> ОДИН ВОПРОС ЗА ДРУГИМ</span><h2>Большая цель.<br />Понятный следующий шаг.</h2><p>Пройдите весь банк вопросов в марафоне.<br />Ключевые слова помогут заметить главное.</p><div className="hero-actions"><button className="button light" onClick={() => session && !session.finished ? (navigate('practice')) : start('marathon', 0, mixed)}>{session && !session.finished ? 'Продолжить марафон' : 'Начать марафон'}<ArrowRight size={18}/></button><label className="hero-shuffle"><input type="checkbox" checked={mixed} onChange={e => setMixed(e.target.checked)}/><Shuffle size={15}/> Перемешать</label></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-card art-back"><div /><div /><div /></div><div className="art-card art-front"><div className="art-tiny">ЕЩЁ ОДИН ШАГ</div><div className="art-check"><Check size={42}/></div><strong>Всё получится.</strong><span>Практика делает своё дело</span><div className="art-progress"><i /></div><div className="art-bottom">ВЫ НА ВЕРНОМ ПУТИ <Sparkles size={13}/></div></div><span className="art-spark">✳</span></div></section><section className="stats-grid"><div className="stat"><span className="stat-icon mint"><BookOpen /></span><div><span>Вопросов изучено</span><strong>{learned}<small> / {all.length}</small></strong></div><div className="stat-mini"><i style={{ width: `${learned / all.length * 100}%` }}/></div></div><div className="stat"><span className="stat-icon peach"><Target /></span><div><span>Точность ответов</span><strong>{totalAttempts ? Math.round(right / totalAttempts * 100) : 0}<small>%</small></strong></div><span className="stat-note">{totalAttempts ? `${totalAttempts} ответов` : 'Начнём с первого шага'}</span></div><div className="stat"><span className="stat-icon lavender"><ListChecks /></span><div><span>Разделов в программе</span><strong>14<small> тем</small></strong></div><span className="stat-note">От основ до сложных механизмов</span></div></section><div className="section-heading"><h2>Выберите свой формат</h2><span>Как будем заниматься сегодня?</span></div><section className="mode-grid"><button className="mode-card" onClick={() => navigate('study')}><span className="mode-icon mint"><BookOpen /></span><span className="card-arrow"><ArrowRight size={19}/></span><h3>Спокойное изучение</h3><p>Вопросы и правильные ответы.<br />Замечайте главное с подсказками.</p><span className="mode-footer">Весь банк вопросов <span>Без спешки</span></span></button><button className="mode-card" onClick={() => start('exam', 0, true)}><span className="mode-icon peach"><GraduationCap /></span><span className="card-arrow"><ArrowRight size={19}/></span><h3>Проверка знаний</h3><p>14 вопросов — по одному из каждой<br />главы. Проверьте свою готовность.</p><span className="mode-footer">14 случайных вопросов <span>Мини-тест</span></span></button><button className="mode-card" onClick={() => navigate('chapters')}><span className="mode-icon lavender"><ListChecks /></span><span className="card-arrow"><ArrowRight size={19}/></span><h3>Практика по разделам</h3><p>Сосредоточьтесь на одной теме.<br />Изучите её и закрепите тестом.</p><span className="mode-footer">14 тематических разделов <span>По темам</span></span></button></section><div className="section-heading"><h2>Раздел за разделом</h2><button className="text-button" onClick={() => navigate('chapters')}>Все разделы <ArrowRight size={15}/></button></div><div className="chapter-preview">{bank.chapters.slice(0, 3).map(c => <button key={c.id} onClick={() => { setChapter(c.id); navigate('study'); }}><span className="chapter-number">{String(c.id).padStart(2, '0')}</span><div><strong>{c.title}</strong><span>{c.count} вопросов</span></div><ChevronRight size={17}/></button>)}</div><div className="source-note"><ShieldCheck size={16}/><span>Ответы перенесены по зелёным отметкам PDF. Автопроверки выполнены; ручная сверка: {reviewed} / {all.length}.</span><button onClick={() => navigate('review')}>Проверить источник</button></div></>}
 {page === 'chapters' && <><div className="page-heading"><div><div className="eyebrow">14 ТЕМ ДЛЯ УВЕРЕННОГО РЕЗУЛЬТАТА</div><h1>Практика по разделам</h1><p>Выберите тему для изучения или отдельного теста.</p></div></div><div className="chapters-grid">{bank.chapters.map(c => <article className="chapter-card" key={c.id}><span className="chapter-number">{String(c.id).padStart(2, '0')}</span><span className="chapter-count">{c.count} вопросов</span><h3>{c.title}</h3><div className="chapter-actions"><button className="button secondary" onClick={() => { setChapter(c.id); navigate('study'); }}>Изучать</button><button className="button" onClick={() => start('chapter', c.id, true)}>Тест <ArrowRight size={15}/></button></div></article>)}</div></>}
 {page === 'study' && <><div className="page-heading"><div><div className="eyebrow">ЗАМЕЧАЙТЕ ГЛАВНОЕ</div><h1>Спокойное изучение</h1><p>Исходные формулировки, правильные ответы и подсказки.</p></div></div><div className="toolbar"><select aria-label="Раздел" value={chapter} onChange={e => { setChapter(+e.target.value); setStudyLimit(20); }}><option value={0}>Все 14 разделов</option>{bank.chapters.map(c => <option value={c.id} key={c.id}>{c.id}. {c.title}</option>)}</select><label className="search"><Search size={17}/><input placeholder="Поиск по вопросам и ответам" value={query} onChange={e => { setQuery(e.target.value); setStudyLimit(20); }}/></label><label className="toggle"><input type="checkbox" checked={keywords} onChange={e => setKeywords(e.target.checked)}/><Sparkles size={16}/> Ключевые слова</label></div><p className="muted">Найдено: {filtered.length}. {keywordSource==='algorithm'?'Подсказки предложены автоматически; их можно проверить и поправить.':'Смысловые подсказки подготовлены для всего банка: 961 вопрос, 14 разделов.'}</p>{filtered.slice(0, studyLimit).map(q => <article className="question-card study-card" key={q.id}><div className="question-meta">РАЗДЕЛ {q.chapterId} <span>ВОПРОС {q.number}</span>{reviews[q.id]?.checked && <span className="verified"><Check size={13}/> Сверен</span>}</div><h3><ContentView content={q} highlight={keywords}/></h3><div className="study-answers">{q.answers.map(a => <div key={a.id} className={a.correct ? 'study-answer right' : 'study-answer'}>{a.correct ? <Check size={17}/> : <span className="answer-dot"/>}<ContentView content={a} highlight={keywords && a.correct}/>{a.correct && <button className="edit-answer" aria-label="Изменить подсказки ответа" onClick={() => { setEdit(a); setPhrase(''); }}><Sparkles size={14}/></button>}</div>)}</div><SemanticNote question={q}/>{qTools(q)}</article>)}{studyLimit < filtered.length && <button className="button load-more" onClick={() => setStudyLimit(n => n + 20)}>Показать ещё 20 вопросов</button>}</>}
 {page === 'practice' && session && current && !session.finished && <><div className="page-heading"><div><div className="eyebrow">{session.mode === 'exam' ? 'ПО ОДНОМУ ВОПРОСУ ИЗ КАЖДОГО РАЗДЕЛА' : session.shuffle ? 'СЛУЧАЙНЫЙ ПОРЯДОК' : 'ВОПРОСЫ ПО ПОРЯДКУ'}</div><h1>{session.mode === 'exam' ? 'Проверка знаний' : session.mode === 'chapter' ? 'Тест по разделу' : 'Марафон'}</h1><p>{bank.chapters.find(c => c.id === current.chapterId)?.title}</p></div><button className="button secondary" onClick={() => navigate('home')}>Продолжить позже</button></div><div className="practice-layout"><div><div className="practice-progress"><span>Вопрос <strong>{session.index + 1}</strong> из {session.ids.length}</span><label className="toggle"><input type="checkbox" checked={keywords} onChange={e => setKeywords(e.target.checked)}/><Sparkles size={15}/> Подсказки в вопросе</label></div><div className="progress-track"><i style={{ width: `${(session.index + 1) / session.ids.length * 100}%` }}/></div><article className="question-card"><div className="question-meta">РАЗДЕЛ {current.chapterId}<span>ВОПРОС {current.number}</span></div><h2 className="question-title"><ContentView content={current} highlight={keywords}/></h2>{current.answers.filter(a => a.correct).length > 1 && <p className="muted">Выберите все правильные ответы и нажмите «Проверить».</p>}<div className="choices">{current.answers.map(a => { const chosen = (given || selected).includes(a.id); return <div className={`choice ${given ? (a.correct ? 'correct' : chosen ? 'incorrect' : 'dim') : chosen ? 'selected' : ''}`} key={a.id}><button className="choice-hit" disabled={!!given} onClick={() => { if (current.answers.filter(a => a.correct).length === 1)
        submit([a.id]);
    else
        setSelected(s => s.includes(a.id) ? s.filter(x => x !== a.id) : [...s, a.id]); }}><span className="choice-indicator">{given && a.correct ? <Check size={18}/> : given && chosen ? <X size={18}/> : chosen ? <Check size={16}/> : a.number}</span><ContentView content={a} highlight={!!given && a.correct}/></button></div>; })}</div>{!given && current.answers.filter(a => a.correct).length > 1 && <button className="button" disabled={!selected.length} onClick={() => submit(selected)}>Проверить</button>}{given && <div className={correct ? 'feedback success' : 'feedback failure'} role="status"><div>{correct ? <Check size={24}/> : <X size={24}/>}<div><strong>{correct ? 'Правильно!' : 'Пока не получилось'}</strong><span>{correct ? 'Отлично, переходим дальше.' : 'Правильный ответ отмечен зелёным. Обратите внимание на ключевые слова.'}</span></div></div><button className="button" onClick={next}>{session.index + 1 === session.ids.length ? 'Результат' : 'Далее'}<ArrowRight size={17}/></button></div>}{given&&<SemanticNote question={current}/>}
 {qTools(current)}</article></div><aside className="session-panel"><span className="eyebrow">ВАША ПРАКТИКА</span><h3>Шаг за шагом</h3><div className="session-score"><span>Правильно</span><strong>{Object.entries(session.responses).filter(([id, ids]) => isCorrect(all.find(q => q.id === id)!, ids)).length}</strong></div><div className="session-score"><span>Ошибок</span><strong>{Object.entries(session.responses).filter(([id, ids]) => !isCorrect(all.find(q => q.id === id)!, ids)).length}</strong></div><p>После ошибки не спешите: прочитайте правильный ответ и найдите отличие.</p><button className="text-button" onClick={() => start(session.mode, session.chapter, session.shuffle)}>Начать заново</button></aside></div></>}
 {page === 'practice' && session?.finished && <>{(() => { const answered = Object.entries(session.responses), good = answered.filter(([id, ids]) => isCorrect(all.find(q => q.id === id)!, ids)).length; const wrong = answered.filter(([id, ids]) => !isCorrect(all.find(q => q.id === id)!, ids)); return <><div className="result-hero"><span className="result-icon"><GraduationCap size={38}/></span><div className="eyebrow">ПРАКТИКА ЗАВЕРШЕНА</div><h1>Ещё один шаг вперёд.</h1><p>Правильных ответов: <strong>{good} из {session.ids.length}</strong> · {Math.round(good / session.ids.length * 100)}%</p><div className="result-actions"><button className="button" onClick={() => start(session.mode, session.chapter, session.shuffle)}>Пройти ещё раз</button><button className="button secondary" onClick={() => navigate('home')}>На главную</button></div></div>{wrong.length > 0 && <><div className="section-heading"><h2>Разберём ошибки</h2><span>{wrong.length} вопросов для повторения</span></div>{wrong.map(([id, ids]) => { const q = all.find(q => q.id === id)!; return <article className="question-card" key={id}><h3><ContentView content={q} highlight={keywords}/></h3>{q.answers.filter(a => a.correct || ids.includes(a.id)).map(a => <div className={`study-answer ${a.correct ? 'right' : 'wrong'}`} key={a.id}>{a.correct ? <Check size={17}/> : <X size={17}/>}<ContentView content={a} highlight={a.correct}/></div>)}<SemanticNote question={q}/>{qTools(q)}</article>; })}</>}</>; })()}</>}
 {page === 'practice' && !session && <div className="result-hero"><h1>Начнём практику?</h1><button className="button" onClick={() => start('marathon', 0)}>Начать марафон</button></div>}
 {page === 'review' && <><div className="page-heading"><div><div className="eyebrow">ПРОВЕРЯЕМ ПЕРЕНОС ПО ИСТОЧНИКУ</div><h1>Сверка с PDF</h1><p>Автопроверка не заменяет визуальную сверку. Проверено вами: {reviewed} / {all.length}.</p></div><a className="button secondary" href={DATA + 'import-report.json'} target="_blank" rel="noreferrer">Отчёт парсера</a></div><div className="toolbar"><select aria-label="Вопрос для сверки" value={rq.id} onChange={e => setReviewId(e.target.value)}>{all.map(q => <option key={q.id} value={q.id}>{reviews[q.id]?.checked ? '✓ ' : ''}Раздел {q.chapterId} · Вопрос {q.number}</option>)}</select><button className="button secondary" disabled={ri === 0} onClick={() => setReviewId(all[ri - 1].id)}><ChevronLeft size={17}/></button><button className="button secondary" disabled={ri === all.length - 1} onClick={() => setReviewId(all[ri + 1].id)}><ChevronRight size={17}/></button><label className="toggle"><input type="checkbox" checked={reviews[rq.id]?.checked || false} onChange={e => updateReview(rq.id, { checked: e.target.checked })}/> Текст, картинки и ответ сверены</label></div><div className="review-layout"><div className="source-pages">{rq.pages.map(p => <figure key={p}><figcaption>Исходная страница {p} · <a href={DATA + `source.pdf#page=${p}`} target="_blank" rel="noreferrer">Открыть PDF</a></figcaption><img src={DATA + `pages/${String(p).padStart(3, '0')}.webp`} alt={`Исходная страница ${p}`} loading="lazy"/></figure>)}</div><div><article className="question-card"><div className="question-meta">ПЕРЕНЕСЁННЫЙ ВОПРОС</div><h3><ContentView content={rq}/></h3>{rq.answers.map(a => <div key={a.id} className={`study-answer ${a.correct ? 'right' : ''}`}>{a.correct ? <Check size={16}/> : <span className="answer-dot"/>}<ContentView content={a}/></div>)}{qTools(rq)}<label className="note-label">Замечание по переносу<textarea value={reviews[rq.id]?.note || ''} onChange={e => updateReview(rq.id, { note: e.target.value })} placeholder="Что требует проверки?"/></label></article><p className="muted">Зелёный ответ определён по цвету букв в PDF. Отметка сверки и замечания сохраняются на вашем устройстве и входят в экспорт прогресса.</p></div></div></>}
 <footer><span>Практика · Тренажёр 1С</span><span>Учитесь в своём ритме <span className="footer-flower">✳</span></span></footer></main></div>{edit && <div className="modal-backdrop" onClick={() => setEdit(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Закрыть" onClick={() => setEdit(null)}><X /></button><div className="eyebrow">ПОДСКАЗКИ БЕЗ ИЗМЕНЕНИЯ ТЕКСТА</div><h2 id="edit-title">Выделить главное</h2><p>Выделите мышью фразу в тексте ниже или введите её точно. Сохраняются только позиции символов.</p><div className="editable-source" onMouseUp={() => { const s = window.getSelection()?.toString(); if (s && edit.text.includes(s))
        setPhrase(s); }}>{edit.text}</div><label className="note-label">Фраза из исходного текста<input value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="Например: только на сервере"/></label><div className="phrase-actions"><button className="button" disabled={!phrase || !edit.text.includes(phrase)} onClick={() => { const old = annotations[edit.id]?.ranges || []; const start = edit.text.indexOf(phrase); annotate([...old.filter(r => !(start < r.end && start + phrase.length > r.start)), { start, end: start + phrase.length, text: phrase }].sort((a, b) => a.start - b.start)); setPhrase(''); }}>Выделить первое совпадение</button><button className="button secondary" onClick={() => annotate([])}>Убрать всё</button></div><div className="range-list">{annotations[edit.id]?.ranges.map(r => <button key={r.start} onClick={() => annotate(annotations[edit.id].ranges.filter(x => x.start !== r.start))}><mark>{r.text}</mark><X size={13}/></button>)}</div><p className="muted">Набор: {keywordSource==='semantic'?'смысловой разбор':'алгоритм'}. Разметка: {annotations[edit.id]?.status === 'reviewed' ? 'проверена вручную' : 'автоматическое предложение'}. Изменения сохраняются локально.</p></section></div>}</div>;
}
createRoot(document.getElementById('root')!).render(<App />);
