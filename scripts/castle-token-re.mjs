#!/usr/bin/env node
/** castle-token-re.mjs — hook the byte boundaries around token creation to
 *  catch (a) the readable signals object (JSON.stringify), (b) the base64
 *  encoding of the token, (c) any crypto/hash. Local fulfillment only. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PORT = 8977;
const bundle = readFileSync('/tmp/opencode/castle/castle-patched.js','utf8');

const INIT = `(() => {
  const W=window; W.__cap={ b64:[], b64stacks:[], atob:[], strfy:[], enc:[], subtle:[] };
  const push=(a,o,n=800)=>{ if(a.length<n) a.push(o); };
  const ob=W.btoa; W.btoa=function(s){
    let out; try{ out=ob.call(this,s); }catch(e){ throw e; }
    try{
      push(W.__cap.b64,{ inLen:String(s).length, inHead:String(s).slice(0,120), outLen: out.length, outHead: out.slice(0,80) });
      if (String(s).length > 1500) push(W.__cap.b64stacks, { inLen:String(s).length, stack:(new Error()).stack.split('\n').slice(1,8).join(' | ') });
    }catch(_){}
    return out;
  };
  const oa=W.atob; W.atob=function(s){
    try{ push(W.__cap.atob,{ inLen:String(s).length, inHead:String(s).slice(0,120) }); }catch(_){}
    return oa.call(this,s);
  };
  const oS=JSON.stringify; W.JSON.stringify=function(v,r,sp){
    let out; try{ out=oS.call(this,v,r,sp); }catch(e){ try{ out=oS.call(this,v); }catch(e2){ return undefined; } }
    try{
      if (typeof out==='string' && out.length>300) {
        const keys = v && typeof v==='object' && !Array.isArray(v) ? Object.keys(v) : null;
        push(W.__cap.strfy,{ len: out.length, keys: keys ? keys.slice(0,200) : null, json: out.slice(0,4000) });
      }
    }catch(_){}
    return out;
  };
  const oE=TextEncoder.prototype.encode; TextEncoder.prototype.encode=function(s){
    try{ if (String(s).length>200) push(W.__cap.enc,{ len:String(s).length, head:String(s).slice(0,200) }); }catch(_){}
    return oE.call(this,s);
  };
  if (W.crypto && W.crypto.subtle) {
    for (const m of ['digest','sign','verify','encrypt','decrypt','generateKey','importKey']) {
      const o=W.crypto.subtle[m];
      if (typeof o==='function') W.crypto.subtle[m]=function(...a){
        try{ push(W.__cap.subtle,{ op:m, algo: a[0]&&(a[0].name||String(a[0])), args: String(a[1]).slice(0,80) }); }catch(_){}
        return o.apply(this,a);
      };
    }
  }
})();`;

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>castle token re</h1>
<script>
window.__go=async()=>{
  try {
    const C = window.Castle;
    C.configure({ pk: 'pk_AvRa79bHyJSYSQHnRpcVtzyxetSvFerx' });
    window.__t1 = await C.createRequestToken();
    window.__t2 = await C.createRequestToken();
    window.__fpres='ok';
  } catch(e){ window.__fpres='ERR:'+String(e).slice(0,300); }
};
</script>
<script src="/castle.js"></script>
</body></html>`;

const server = createServer((req,res)=>{
  if (req.url === '/') { res.writeHead(200,{'content-type':'text/html'}); res.end(html); }
  else if (req.url === '/castle.js') { res.writeHead(200,{'content-type':'application/javascript'}); res.end(bundle); }
  else { res.writeHead(200,{'content-type':'text/plain'}); res.end('ok'); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

const b = await chromium.launch({ headless:true });
const ctx = await b.newContext(); await ctx.addInitScript({content:INIT});
const page = await ctx.newPage();
await page.route(/m\.castle\.io|castle\.io/, r=>r.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:'load' });
await page.waitForFunction(()=>typeof window.Castle!=='undefined', { timeout:20000 }).catch(()=>{});
await page.evaluate(()=>window.__go && window.__go());
await page.waitForTimeout(10000);
const res = await page.evaluate(()=>({ fpres: window.__fpres, t1len:(window.__t1||'').length, t2len:(window.__t2||'').length, capType: typeof window.__cap, cap: window.__cap || null })).catch(()=>null);
mkdirSync('/tmp/opencode/castle',{recursive:true});
writeFileSync('/tmp/opencode/castle/token-re-res.json', JSON.stringify({ fpres: res&&res.fpres, t1len: res&&res.t1len, t2len: res&&res.t2len }));
if (res && res.cap) writeFileSync('/tmp/opencode/castle/token-re-cap.json', JSON.stringify(res.cap));
console.log('fpres:', res && res.fpres, '| t1:', res && res.t1len, '| t2:', res && res.t2len, '| cap present:', !!(res && res.cap));
const cap = res && res.cap || {};
console.log('b64 ops:', (cap.b64||[]).length, '| atob:', (cap.atob||[]).length, '| strfy>300:', (cap.strfy||[]).length, '| enc>200:', (cap.enc||[]).length, '| subtle:', (cap.subtle||[]).length);
console.log('\n=== largest b64 outputs (token candidates) ===');
const t1len = res && res.t1len || 2192;
for (const c of (cap.b64||[])) if (c.outLen > t1len*0.5) console.log('  outLen', c.outLen, 'inLen', c.inLen, 'inHead:', JSON.stringify(c.inHead.slice(0,60)));
console.log('\n=== large JSON.stringify (signals objects?) ===');
for (const c of (cap.strfy||[]).sort((a,b)=>b.len-a.len).slice(0,8)) console.log('  len', c.len, 'keys', (c.keys||[]).length, ':', c.json.slice(0,200));
console.log('\n=== long TextEncoder ===');
for (const c of (cap.enc||[]).sort((a,b)=>b.len-a.len).slice(0,6)) console.log('  len', c.len, ':', c.head.slice(0,160));
console.log('\n=== subtle ===');
for (const c of (cap.subtle||[]).slice(0,10)) console.log('  ', c.op, c.algo, String(c.args).slice(0,60));
await b.close(); server.close();
