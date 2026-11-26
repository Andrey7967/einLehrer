"""Reproducible source import. Never correct source wording or infer answer content.
Run: python scripts/parse_pdf.py [path.pdf]. Dependencies: pdfplumber, pypdf, Pillow.
"""
from pathlib import Path
import collections, hashlib, json, re, shutil, sys
import pdfplumber
from pypdf import PdfReader
from PIL import Image, ImageDraw
from font_recovery import install_recovery

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(next((a for a in sys.argv[1:] if not a.startswith('--')),str(ROOT/'ein leichtes Erfolg.pdf')))
OUT = ROOT/'public'/'data'
OUT.mkdir(parents=True, exist_ok=True)
(OUT/'images').mkdir(exist_ok=True)
(OUT/'pages').mkdir(exist_ok=True)
reuse_assets='--reuse-assets' in sys.argv
if reuse_assets:
    assert json.loads((OUT/'bank.json').read_text(encoding='utf8'))['meta']['sha256']==hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'Cannot reuse assets from a different PDF'
issues=[]; chapters=[]; questions=[]; ledger=[]; image_count=0; inventories=[]; comparison_notes=[]
current=None; answer=None; chapter=None
reader=PdfReader(SOURCE)
font_recoveries=install_recovery(reader)

def green(c):
    rgb=c.get('non_stroking_color')
    return isinstance(rgb,(tuple,list)) and len(rgb)==3 and rgb[1]>.25 and rgb[1]>rgb[0]*2 and rgb[1]>rgb[2]*2

def add_line(target, line, page, kind):
    # Keep line boundaries. No automatic dehyphenation, spell correction or normalization.
    target['blocks'].append({'type':'text','text':line['text'],'page':page,'bbox':[round(line[k],3) for k in ['x0','top','x1','bottom']]})
    target.setdefault('sourceGreen',[]).append({'green':sum(green(c) for c in line['chars'] if not c['text'].isspace()),'total':sum(not c['text'].isspace() for c in line['chars'])})
    ledger.append({'page':page,'kind':kind,'questionId':current['id'],'text':line['text']})

with pdfplumber.open(SOURCE) as doc:
 for page in doc.pages:
    pn=page.page_number
    lines=page.extract_text_lines(layout=False,strip=True,return_chars=True)
    inventories.append(collections.Counter(''.join((page.extract_text() or '').split())))
    # Chapter title can span two lines; identify it before consuming questions.
    header_indexes=set(); header_events=[]
    for i,line in enumerate(lines):
        m=re.match(r'^Глава\s+(\d+)\.\s*(.*)',line['text'])
        if m:
            title=m[2]; header_indexes.add(i)
            j=i+1
            while j<len(lines) and not re.match(r'^\d+[.)]\s*',lines[j]['text']):
                title+=' '+lines[j]['text']; header_indexes.add(j); j+=1
            header_events.append((line['top'],-1,i,{'id':int(m[1]),'title':title,'page':pn}))
    events=[(l['top'],0,i,l) for i,l in enumerate(lines) if i not in header_indexes]
    events += [(im['top'],1,i,im) for i,im in enumerate(page.images)]
    events += header_events
    events.sort(key=lambda e:(e[0],e[1]))
    rendered=None
    for top,typ,i,obj in events:
        if typ==-1:
            chapter=obj; chapters.append(chapter); current=None; answer=None; continue
        if typ==1:
            image_count+=1
            if current is None:
                issues.append({'type':'unassigned-image','page':pn,'index':i}); continue
            scale=150/72
            box=(max(0,obj['x0']),max(0,obj['top']),min(page.width,obj['x1']),min(page.height,obj['bottom']))
            name=f'images/p{pn:03d}-{i:02d}.png'
            if not reuse_assets or not (OUT/name).exists():
                if rendered is None: rendered=page.to_image(resolution=150).original
                rendered.crop(tuple(round(v*scale) for v in box)).save(OUT/name)
            (answer or current)['blocks'].append({'type':'image','src':name,'page':pn,'bbox':list(box),'width':round((box[2]-box[0])*scale),'height':round((box[3]-box[1])*scale)})
            current['pages']=sorted(set(current['pages']+[pn])); continue
        line=obj; text=line['text']
        qm=re.match(r'^(\d+)\.\s+(.*)',text)
        am=re.match(r'^(\d+)\)\s*(.*)',text)
        if qm:
            if chapter is None: raise ValueError(f'Question without chapter on page {pn}')
            current={'id':f'c{chapter["id"]}-q{qm[1]}','chapterId':chapter['id'],'number':int(qm[1]),'blocks':[],'answers':[],'pages':[pn]}
            questions.append(current); answer=None
            # Keep full source line, including original question number.
            add_line(current,line,pn,'question')
        elif am and current:
            answer={'id':f'{current["id"]}-a{am[1]}','number':int(am[1]),'blocks':[],'correct':False}
            current['answers'].append(answer); add_line(answer,line,pn,'answer')
        elif current:
            add_line(answer or current,line,pn,'answer' if answer else 'question')
        else:
            issues.append({'type':'unassigned-text','page':pn,'text':text})
        if current: current['pages']=sorted(set(current['pages']+[pn]))
    consumed=[l['text'] for l in ledger if l['page']==pn]
    consumed += [line['text'] for i,line in enumerate(lines) if i in header_indexes]
    expected=[line['text'] for line in lines]
    if collections.Counter(consumed)!=collections.Counter(expected):
        issues.append({'type':'line-coverage-mismatch','page':pn})
    # Source page preview for visual review, independent of extracted text/images.
    if not reuse_assets or not (OUT/'pages'/f'{pn:03d}.webp').exists():
        preview=page.to_image(resolution=85).original.convert('RGB')
        preview.save(OUT/'pages'/f'{pn:03d}.webp',quality=82)
    if pn%25==0: print(f'Parsed {pn}/{len(doc.pages)} pages',flush=True)
    page.close()

for q in questions:
 for target in [q]+q['answers']:
    target['text']='\n'.join(b['text'] for b in target['blocks'] if b['type']=='text')
    target['sha256']=hashlib.sha256(target['text'].encode()).hexdigest()
 for a in q['answers']:
    g=sum(x['green'] for x in a['sourceGreen']); total=sum(x['total'] for x in a['sourceGreen'])
    a['correct']=g>0
    if g and g/total<.85: issues.append({'type':'partially-green-answer','questionId':q['id'],'answerId':a['id'],'ratio':g/total})
 if not any(a['correct'] for a in q['answers']): issues.append({'type':'no-correct-answer','questionId':q['id']})
 if sum(a['correct'] for a in q['answers'])>1: issues.append({'type':'multiple-correct-answers','questionId':q['id']})
 if len(q['answers'])<2: issues.append({'type':'too-few-answers','questionId':q['id']})
 if [a['number'] for a in q['answers']]!=list(range(1,len(q['answers'])+1)): issues.append({'type':'answer-numbering','questionId':q['id']})
for c in chapters:
 nums=[q['number'] for q in questions if q['chapterId']==c['id']]
 c['count']=len(nums)
 if nums!=list(range(1,len(nums)+1)): issues.append({'type':'question-numbering','chapterId':c['id'],'numbers':nums})

# Independent text extraction: compare non-whitespace characters page by page.
for i,p in enumerate(reader.pages):
 independent=''.join((p.extract_text() or '').split())
 raw=''.join(l['text'] for l in ledger if l['page']==i+1)
 # Include chapter title, which is intentionally outside the question ledger.
 # Compare character inventory to avoid treating PDF line ordering as text edits.
 # Full inventories are also stored for transparent review.
 if collections.Counter(independent)!=inventories[i]:
    ligatures={'ﬂ':'fl','ﬁ':'fi','ﬀ':'ff','ﬃ':'ffi','ﬄ':'ffl'}
    def expand_counts(counts):
        out=collections.Counter()
        for char,n in counts.items():
            for ch in ligatures.get(char,char): out[ch]+=n
        return out
    if expand_counts(collections.Counter(independent))==expand_counts(inventories[i]):
        comparison_notes.append({'type':'equivalent-font-ligature','page':i+1,'difference':dict(collections.Counter(independent)-inventories[i]),'resolution':'Compare expanded ligatures only; bank text is unchanged. Page 2 was also visually inspected.'})
    else:
        issues.append({'type':'independent-extraction-difference','page':i+1,'difference':dict(collections.Counter(independent)-inventories[i])})

meta={'source':'source.pdf','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'pageCount':len(reader.pages),'questionCount':len(questions),'imageCount':image_count,'reviewStatus':'automatic-checks-only','version':1}
bank={'meta':meta,'chapters':chapters,'questions':questions}
(OUT/'bank.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'import-report.json').write_text(json.dumps({'meta':meta,'issues':issues,'fontRecoveries':font_recoveries,'comparisonNotes':comparison_notes,'chapters':chapters,'ledger':ledger},ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copyfile(SOURCE,OUT/'source.pdf')
for size in [192,512]:
 im=Image.new('RGB',(size,size),'#17634f'); draw=ImageDraw.Draw(im); draw.line([(size*.25,size*.52),(size*.43,size*.70),(size*.77,size*.30)],fill='#e5f5b6',width=round(size*.085)); im.save(ROOT/'public'/f'icon-{size}.png')
print(json.dumps({'questions':len(questions),'chapters':chapters,'images':image_count,'issues':issues},ensure_ascii=False,indent=2),flush=True)
