#!/usr/bin/env node
/** castle-cs.mjs — re-capture the decoder (arg→decoded) pairs cleanly + run token. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = 8993;
const bundle = readFileSync('/tmp/opencode/castle/castle-patched.js','utf8');
const html = `<!doctype html><html><body><script src="/castle.js"></script><script>
window.__go=async()=>{ try{ const C=window.Castle; C.configure({pk:'pk_AvRa79bHyJSYSQHnRpcVtzyxetSvFerx'}); window.__t=await C.createRequestToken(); window.__fpres='ok'; }catch(e){ window.__fpres='ERR:'+String(e).slice(0,150); } };
</script></body></html>`;
const server = createServer((q,r)=>{ if(q.url==="/"){r.writeHead(200,{'content-type':'text/html'});r.end(html);} else if(q.url==="/castle.js"){r.writeHead(200,{'content-type':'application/javascript'});r.end(bundle);} else {r.writeHead(200,{'content-type':'text/plain'});r.end('ok');} });
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await chromium.launch({ headless:true });
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'load'});
await p.evaluate(()=>window.__go&&window.__go());
await p.waitForTimeout(6000);
const cs = await p.evaluate(()=>window.__cs||[]).catch(()=>[]);
writeFileSync('/tmp/opencode/castle/cs-captures.json', JSON.stringify(cs));
console.log('cs captures:', cs.length);
await b.close(); server.close();
