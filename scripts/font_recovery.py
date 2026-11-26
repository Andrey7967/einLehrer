"""Recover null-mapped ligatures from embedded TrueType GSUB; no word guessing."""
import re,struct
from pdfminer.pdffont import PDFCIDFont

def font_ligatures(font):
    font=font.get_object()
    if '/ToUnicode' not in font or '/DescendantFonts' not in font:return {}
    descendant=font['/DescendantFonts'][0].get_object()
    if descendant.get('/CIDToGIDMap')!='/Identity':return {}
    descriptor=descendant['/FontDescriptor']
    if '/FontFile2' not in descriptor:return {}
    cmap=font['/ToUnicode'].get_data().decode()
    mapping={int(a,16):bytes.fromhex(c).decode('utf-16-be') for section in re.findall(r'beginbfchar(.*?)endbfchar',cmap,re.S) for a,c in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',section)}
    for section in re.findall(r'beginbfrange(.*?)endbfrange',cmap,re.S):
        for a,c,t in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',section):
            for n in range(int(a,16),int(c,16)+1):mapping[n]=chr(int(t,16)+n-int(a,16))
    nulls={k for k,v in mapping.items() if v=='\0'}
    if not nulls:return {}
    b=descriptor['/FontFile2'].get_data()
    u=lambda p:struct.unpack_from('>H',b,p)[0]
    tables={b[12+i*16:16+i*16].decode():struct.unpack_from('>II',b,20+i*16) for i in range(u(4))}
    if 'GSUB' not in tables:return {}
    def coverage(p):
        if u(p)==1:return [u(p+4+2*i) for i in range(u(p+2))]
        out=[]
        for i in range(u(p+2)):
            start,end,index=struct.unpack_from('>HHH',b,p+4+i*6)
            out.extend(range(start,end+1))
        return out
    base=tables['GSUB'][0];ll=base+u(base+8);result={}
    for i in range(u(ll)):
        lookup=ll+u(ll+2+i*2);kind=u(lookup)
        for j in range(u(lookup+4)):
            sub=lookup+u(lookup+6+j*2);typ=kind
            if typ==7:
                typ=u(sub+2);sub+=struct.unpack_from('>I',b,sub+4)[0]
            if typ!=4:continue
            cov=coverage(sub+u(sub+2))
            for k in range(u(sub+4)):
                ls=sub+u(sub+6+k*2)
                for m in range(u(ls)):
                    lig=ls+u(ls+2+m*2);target=u(lig)
                    if target not in nulls:continue
                    comps=[cov[k]]+[u(lig+4+n*2) for n in range(u(lig+2)-1)]
                    text=''.join(mapping.get(c,'\0') for c in comps)
                    if '\0' not in text:result[target]=text
    return result

def install_recovery(reader):
    recovered={};seen=set();evidence=[]
    for page in reader.pages:
        for reference in page['/Resources'].get('/Font',{}).values():
            font=reference.get_object();name=str(font.get('/BaseFont','')).lstrip('/')
            key=reference.idnum if hasattr(reference,'idnum') else id(font)
            if key in seen:continue
            seen.add(key);mapping=font_ligatures(font)
            if mapping:
                # Repair only this reader's in-memory CMap for the independent decoder.
                stream=font['/ToUnicode'];cmap=stream.get_data().decode()
                for cid,text in mapping.items():
                    cmap=re.sub(r'(<'+f'{cid:04X}'+r'>\s*)<0000>',lambda m:m[1]+'<'+text.encode('utf-16-be').hex().upper()+'>',cmap,flags=re.I)
                stream.set_data(cmap.encode())
            for cid,text in mapping.items():
                if (name,cid) in recovered:assert recovered[name,cid]==text
                recovered[name,cid]=text
                evidence.append({'font':name,'cid':cid,'text':text,'method':'Embedded TrueType GSUB ligature components; CIDToGIDMap Identity'})
    # Different subsets of the same font may omit component letters from their CMap.
    # Apply recovered font+glyph identities consistently to every subset's decoder.
    for page in reader.pages:
        for reference in page['/Resources'].get('/Font',{}).values():
            font=reference.get_object();name=str(font.get('/BaseFont','')).lstrip('/')
            if '/ToUnicode' not in font:continue
            stream=font['/ToUnicode'];cmap=stream.get_data().decode();original_cmap=cmap
            for (fontname,cid),text in recovered.items():
                if fontname==name:cmap=re.sub(r'(<'+f'{cid:04X}'+r'>\s*)<0000>',lambda m:m[1]+'<'+text.encode('utf-16-be').hex().upper()+'>',cmap,flags=re.I)
            if cmap!=original_cmap:stream.set_data(cmap.encode())
    original=PDFCIDFont.to_unichr
    def decode(self,cid):
        value=original(self,cid)
        if value=='\0':
            name=self.fontname.decode() if isinstance(self.fontname,bytes) else self.fontname
            return recovered.get((name,cid),value)
        return value
    PDFCIDFont.to_unichr=decode
    return evidence
