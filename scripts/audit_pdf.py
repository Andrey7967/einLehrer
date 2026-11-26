"""Read-only re-audit of every imported line, answer colour and image box against PDF."""
from pathlib import Path
import hashlib,json,collections
import pdfplumber
from pypdf import PdfReader
from font_recovery import install_recovery
ROOT=Path(__file__).resolve().parents[1]
data=ROOT/'public'/'data'
bank=json.loads((data/'bank.json').read_text(encoding='utf8'))
install_recovery(PdfReader(ROOT/'ein leichtes Erfolg.pdf'))
assert hashlib.sha256((ROOT/'ein leichtes Erfolg.pdf').read_bytes()).hexdigest()==bank['meta']['sha256']
blocks_by_page=collections.defaultdict(list)
for q in bank['questions']:
 for target in [q]+q['answers']:
  for block in target['blocks']:blocks_by_page[block['page']].append((q,target,block))
checked_lines=0;checked_images=0;checked_answers=set();issues=[]
def green(c):
 rgb=c.get('non_stroking_color')
 return isinstance(rgb,(tuple,list)) and len(rgb)==3 and rgb[1]>.25 and rgb[1]>rgb[0]*2 and rgb[1]>rgb[2]*2
answer_green=collections.Counter()
with pdfplumber.open(ROOT/'ein leichtes Erfolg.pdf') as doc:
 for page in doc.pages:
  lines=page.extract_text_lines(return_chars=True)
  used=set()
  for q,target,b in blocks_by_page[page.page_number]:
   if b['type']=='text':
    hits=[(i,l) for i,l in enumerate(lines) if [round(l[k],3) for k in ['x0','top','x1','bottom']]==b['bbox']]
    assert len(hits)==1,(page.page_number,q['id'],b)
    i,line=hits[0];assert i not in used,('duplicate line',page.page_number,i);used.add(i)
    assert line['text']==b['text'],('changed text',target['id'])
    if 'correct' in target:
     answer_green[target['id']]+=sum(green(c) for c in line['chars']);checked_answers.add(target['id'])
    else:assert not any(green(c) for c in line['chars']),('green in question',q['id'])
    checked_lines+=1
   else:
    hits=[im for im in page.images if max(abs(x-y) for x,y in zip([max(0,im['x0']),max(0,im['top']),min(page.width,im['x1']),min(page.height,im['bottom'])],b['bbox']))<.01]
    assert len(hits)==1,('image bbox',q['id'],b);assert (data/b['src']).is_file();checked_images+=1
  # Unassigned lines must be chapter titles, including title continuation lines.
  for i,line in enumerate(lines):
   if i not in used:
    assert 'ExtraBold' in line['chars'][0]['fontname'],('unassigned content',page.page_number,line['text'])
  page.close()
for q in bank['questions']:
 for a in q['answers']:assert a['correct']==bool(answer_green[a['id']]),('wrong correct flag',a['id'])
result={'sourceSha256':bank['meta']['sha256'],'questions':len(bank['questions']),'checkedAnswers':len(checked_answers),'checkedTextLines':checked_lines,'checkedImages':checked_images,'checks':['Every text block exactly matches source line and bounding box','No source content lines omitted or duplicated; only chapter headings excluded','Every correct-answer flag matches source green characters','Every image has a matching source image bounding box'],'issues':issues,'visualReview':'Not a complete manual visual review. Source pages are available in the app.'}
(data/'audit-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False,indent=2))
