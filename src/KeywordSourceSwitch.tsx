import type {KeywordSource} from './types';
import {Sparkles} from './icons';
export function KeywordSourceSwitch({source,onChange,reviewed,total}:{source:KeywordSource;onChange:(source:KeywordSource)=>void;reviewed:number;total:number}){
 return <section className="keyword-source-panel" aria-label="Настройки ключевых слов">
  <div className="keyword-source-title"><Sparkles size={17}/><span>Ключевые слова</span></div>
  <div className="keyword-source-switch" role="group" aria-label="Источник ключевых слов">
   <button type="button" aria-pressed={source==='algorithm'} onClick={()=>onChange('algorithm')}>Алгоритм</button>
   <button type="button" aria-pressed={source==='semantic'} onClick={()=>onChange('semantic')}>Смысловой разбор</button>
  </div>
  <p className="keyword-source-description">{source==='algorithm'?'Автоматический подбор по различиям слов.':`Разобрано по смыслу: ${reviewed} из ${total}. Первый раздел — целиком. В остальных разделах этого набора пока нет.`}</p>
 </section>;
}
