import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});const files=[];for(const e of entries){const path=dir+'/'+e.name;if(e.isDirectory())files.push(...await walk(path));else files.push(path);}return files;}
const files=(await walk('dist')).map(p=>p.slice(5)).filter(p=>p!=='sw.js');
const hash=createHash('sha256');for(const f of files){hash.update(f);hash.update(await readFile('dist/'+f));}const version=hash.digest('hex').slice(0,16);
const core=files.filter(p=>!p.startsWith('data/')||['data/bank.json','data/keywords.json','data/keywords-semantic.json'].includes(p));
const source=`const VERSION=${JSON.stringify(version)},CORE=${JSON.stringify(core)},ALL=${JSON.stringify(files)};
const SHELL='1c-shell-'+VERSION,FULL='1c-full-'+VERSION,TEMP='1c-download-'+VERSION;
const absolute=p=>new URL(p,self.registration.scope).href;
const notify=m=>self.clients.matchAll({includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage(m)));
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(SHELL);await cache.addAll(CORE.map(absolute));})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('1c-')&&![SHELL,FULL,TEMP].includes(k))await caches.delete(k);await self.clients.claim();})()));
let downloading=null;
async function download(){
 const complete=await caches.open(FULL);if(await complete.match(absolute('__complete__'))){await notify({type:'READY'});return;}
 try{const cache=await caches.open(TEMP);let done=0;const total=ALL.length;
 for(const file of ALL){const u=absolute(file);if(!await cache.match(u)){const cached=await caches.match(u);const r=cached||await fetch(u,{cache:'reload'});if(!r.ok)throw Error('HTTP '+r.status);await cache.put(u,r.clone());}done++;await notify({type:'PROGRESS',done,total});}
 for(const key of await cache.keys()){const r=await cache.match(key);await complete.put(key,r);}
 await complete.put(absolute('__complete__'),new Response(VERSION));await caches.delete(TEMP);await notify({type:'READY'});
 }catch(e){await notify({type:'ERROR'});}}
self.addEventListener('message',e=>{if(e.data?.type==='DOWNLOAD'){if(!downloading)downloading=download().finally(()=>downloading=null);e.waitUntil(downloading);}if(e.data?.type==='STATUS')e.waitUntil((async()=>{const c=await caches.open(FULL);if(await c.match(absolute('__complete__')))await notify({type:'READY'});})());});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;e.respondWith((async()=>{const full=await caches.open(FULL),shell=await caches.open(SHELL);const cached=await full.match(e.request)||await shell.match(e.request);if(cached)return cached;try{const response=await fetch(e.request);return response;}catch(err){if(e.request.mode==='navigate'){const fallback=await shell.match(absolute('index.html'));if(fallback)return fallback;}throw err;}})());});
`;
await writeFile('dist/sw.js',source);await writeFile('dist/offline-files.json',JSON.stringify({version,files:files.length}));console.log('Service worker built:',files.length,'files, version',version);
