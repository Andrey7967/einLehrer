import http from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
if(!existsSync(resolve(root,'index.html'))){console.error('Build not found. Run npm install, then npm run build.');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf'};
const port=Number(process.env.PORT||4173);
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let path;try{const u=new URL(req.url,'http://localhost');path=resolve(root,'.'+decodeURIComponent(u.pathname));}catch{res.writeHead(400);res.end();return;}
 if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 if(path===root)path=resolve(root,'index.html');
 // Source archive stores large data assets once, in public/data; full builds include them in dist/data.
 const relativeData=path.startsWith(resolve(root,'data')+sep)?path.slice(resolve(root,'data').length+1):null;
 if(!existsSync(path)&&relativeData)path=resolve(root,'../public/data',relativeData);
 if(!existsSync(path)||!statSync(path).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':statSync(path).size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
 if(req.method==='HEAD')res.end();else createReadStream(path).pipe(res);
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Open http://localhost:${port} or use another PORT.`:e);process.exitCode=1;});
server.listen(port,'0.0.0.0',()=>{const address=`http://localhost:${port}`;console.log(`1C Trainer: ${address}\nStatic frontend only. Press Ctrl+C to stop.`);if(process.argv.includes('--open')){const [cmd,args]=process.platform==='win32'?['cmd',['/c','start','',address]]:process.platform==='darwin'?['open',[address]]:['xdg-open',[address]];const child=spawn(cmd,args,{stdio:'ignore',windowsHide:true});child.on('error',()=>{});}});
