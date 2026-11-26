import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
test('service worker caches shell, resumes interrupted download and serves complete bank offline under a subpath',async()=>{
 assert(existsSync('dist/sw.js'),'Build the production app first');
 const scope='https://example.test/trainer/',stores=new Map(),events={},messages=[];let online=true,failPath='data/images/p021-00.png',failOnce=true,requests=0;
 const key=r=>typeof r==='string'?r:r.url;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {async match(r){return store.get(key(r))?.clone();},async put(r,response){store.set(key(r),response.clone());},async keys(){return [...store.keys()].map(u=>new Request(u));},async addAll(urls){for(const u of urls){const r=await fetcher(u);if(!r.ok)throw Error('fetch failed');store.set(u,r);}}};},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},async match(r){for(const map of stores.values()){const v=map.get(key(r));if(v)return v.clone();}}};
 async function fetcher(request){if(!online)throw Error('offline');requests++;const p=new URL(key(request)).pathname.replace('/trainer/','');if(failOnce&&p===failPath){failOnce=false;throw Error('interrupted');}if(!existsSync('dist/'+p))return new Response('not found',{status:404});return new Response(readFileSync('dist/'+p));}
 const self={registration:{scope},clients:{async matchAll(){return[{postMessage(m){messages.push(m);}}];},async claim(){}},addEventListener(type,fn){events[type]=fn;}};
 vm.runInNewContext(readFileSync('dist/sw.js','utf8'),{self,caches,fetch:fetcher,URL,Response,Request,console});
 async function event(type,data){let promise=Promise.resolve();events[type]({...data,waitUntil(p){promise=p;}});await promise;}
 await event('install',{});await event('activate',{});assert(stores.size>=1);
 await event('message',{data:{type:'DOWNLOAD'}});assert(messages.some(m=>m.type==='ERROR'));assert(!messages.some(m=>m.type==='READY'));assert((await caches.keys()).some(k=>k.startsWith('1c-download-')));
 const requestsBefore=requests;await event('message',{data:{type:'DOWNLOAD'}});assert(messages.some(m=>m.type==='READY'));assert(!(await caches.keys()).some(k=>k.startsWith('1c-download-')));assert(requests>requestsBefore);
 online=false;
 async function offlineGet(path,mode='cors'){let result;events.fetch({request:{url:scope+path,method:'GET',mode},respondWith(p){result=p;}});return result;}
 const bankResponse=await offlineGet('data/bank.json');const bank=await bankResponse.json();assert.equal(bank.questions.length,961);assert.equal(bank.chapters.length,14);
 const semanticResponse=await offlineGet('data/keywords-semantic.json');const semantic=await semanticResponse.json();assert.equal(semantic.reviewedQuestionIds.length,77);assert.equal(semantic.sourceSha256,bank.meta.sha256);
 const image=await offlineGet('data/images/p021-00.png');assert((await image.arrayBuffer()).byteLength>100);
 const pdf=await offlineGet('data/source.pdf');assert((await pdf.arrayBuffer()).byteLength>4_000_000);
 const page=await offlineGet('data/pages/262.webp');assert((await page.arrayBuffer()).byteLength>100);
 const fallback=await offlineGet('unknown-route','navigate');assert((await fallback.text()).includes('root'));
 messages.length=0;await event('message',{data:{type:'STATUS'}});assert(messages.some(m=>m.type==='READY'));
});
