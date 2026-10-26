#!/usr/bin/env node
/** castle-token-re2.mjs — minimal, proven hooks; prints to console. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const PORT = 8983;
const bundle = readFileSync('/tmp/opencode/castle/castle-expose.js','utf8');
const INIT = `(() => {
  const W=window; W.__cap={b64:[], b64st:[], atob:[], strfy:[], subtle:[]};
  const push=(a,o,n=600)=>{ if(a.length<n) a.push(o); };
  const ob=W.btoa; W.btoa=function(s){
    const out=ob.call(this,s);
    try{ push(W.__cap.b64,{inLen:String(s).length,outLen:out.length}); if(String(s).length>1500) push(W.__cap.b64st,{stack:(new Error()).stack.split('\\n').slice(1,9).join(' | ')}); }catch(_){}
    return out;
  };
  const oa=W.atob; W.atob=function(s){ try{ push(W.__cap.atob,{len:String(s).length}); }catch(_){} return oa.call(this,s); };
  const oS=JSON.stringify; W.JSON.stringify=function(v,r,sp){
    let out; try{ out=oS.call(this,v,r,sp); }catch(e){ try{ out=oS.call(this,v); }catch(e2){ return undefined; } }
    try{ if(typeof out==='string' && out.length>500) push(W.__cap.strfy,{len:out.length, keys:(v&&typeof v==='object'&&!Array.isArray(v))?Object.keys(v).slice(0,150):null, head:out.slice(0,600)}); }catch(_){}
    return out;
  };
  if (W.crypto && W.crypto.subtle) for (const m of ['digest','sign','encrypt']) {
    const o=W.crypto.subtle[m];
    if (typeof o==='function') W.crypto.subtle[m]=function(...a){ try{ push(W.__cap.subtle,{op:m, algo:a[0]&&(a[0].name||String(a[0]))}); }catch(_){} return o.apply(this,a); };
  }
})();`;
const html = `<!doctype html><html><body><script>
window.__go=async()=>{ try{ const C=window.Castle; C.configure({pk:'pk_AvRa79bHyJSYSQHnRpcVtzyxetSvFerx'}); window.__t1=await C.createRequestToken(); window.__t2=await C.createRequestToken(); window.__fpres='ok'; }catch(e){ window.__fpres='ERR:'+String(e).slice(0,200); } };
</script><script src="/castle.js"></script></body></html>`;
const server = createServer((q,r)=>{ if(q.url==="/"){r.writeHead(200,{'content-type':'text/html'});r.end(html);} else if(q.url==="/castle.js"){r.writeHead(200,{'content-type':'application/javascript'});r.end(bundle);} else {r.writeHead(200,{'content-type':'text/plain'});r.end('ok');} });
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext(); await ctx.addInitScript({content:INIT});
const page = await ctx.newPage();
await page.route(/m\.castle\.io|castle\.io/, r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'load'});
await page.waitForFunction(()=>typeof window.Castle!=='undefined',{timeout:20000}).catch(()=>{});
console.log('capType after load:', await page.evaluate(()=>typeof window.__cap));
await page.evaluate(()=>window.__go&&window.__go());
await page.waitForTimeout(8000);
const cap = await page.evaluate(()=>window.__cap).catch(e=>String(e));
console.log('fpres:', await page.evaluate(()=>window.__fpres));
console.log('cap:', JSON.stringify(cap, null, 1).slice(0,6000));
await b.close(); server.close();
