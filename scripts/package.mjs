import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Zip without dependencies, caches, temporary files or user progress.
const python=process.env.PYTHON||'python';
if(!existsSync('dist/index.html'))throw Error('Build first');
const program=`from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path.cwd()
with ZipFile(root/'1c-trainer.zip','w',ZIP_DEFLATED) as z:
 for name in ['.github','src','scripts','tests','public','dist']:
  for p in sorted((root/name).rglob('*')):
   if p.is_file() and '__pycache__' not in p.parts and not (name=='dist' and 'data' in p.relative_to(root/'dist').parts):z.write(p,p.relative_to(root))
 for name in ['.gitignore','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','README.md','VERIFICATION.md','requirements.txt','start.cmd','ein leichtes Erfolg.pdf']:
  z.write(root/name,name)
print('Created 1c-trainer.zip')
`;
const result=spawnSync(python,['-c',program],{stdio:'inherit'});process.exitCode=result.status||0;
