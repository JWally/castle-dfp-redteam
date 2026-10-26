#!/usr/bin/env node
/** castle-probe.mjs — run the real Castle browser SDK locally (dummy pk),
 *  intercept everything (monitor POST + token), capture what it ships. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PORT = 8975;
const bundle = readFileSync('/tmp/opencode/castle/castle-patched.js','utf8');

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>castle probe</h1>
<script>
window.__c={net:[], worker:[]};
const oF=window.fetch; window.fetch=function(u,i){ try{ window.__c.net.push({kind:'fetch', url:String(u), method:(i&&i.method)||'GET', body:(i&&typeof i.body==='string')?i.body.slice(0,6000):null}); }catch(_){} return oF.apply(this,arguments); };
const oX=XMLHttpRequest.prototype.open, oS=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){ this.__cu=String(u); return oX.apply(this,arguments); };
XMLHttpRequest.prototype.send=function(b){ try{ window.__c.net.push({kind:'xhr', url:this.__cu, body:typeof b==='string'?b.slice(0,6000):null}); }catch(_){} return oS.apply(this,arguments); };
const oBeacon=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator);
if(oBeacon) navigator.sendBeacon=function(u,d){ try{ window.__c.net.push({kind:'beacon', url:String(u), body:typeof d==='string'?d.slice(0,6000):null}); }catch(_){} return oBeacon(u,d); };
window.__go=async()=>{
  try {
    const C = window.Castle || window.castle || (await import('/castle.js')).default || (await import('/castle.js'));
    window.__api = typeof C;
    C.configure({ pk: 'pk_AvRa79bHyJSYSQHnRpcVtzyxetSvFerx', apiUrl: 'https://m.castle.io/v1/monitor' });
    window.__configured = true;
    if (typeof C.createRequestToken==='function') {
      try { const t = await C.createRequestToken(); window.__token = t; window.__token2 = await C.createRequestToken(); } catch(e){ window.__tokErr = String(e).slice(0,200); }
    }
    window.__fpres='ok';
  } catch(e){ window.__fpres='ERR:'+String(e).slice(0,400); }
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
const ctx = await b.newContext();
const page = await ctx.newPage();
const posts = [];
// capture worker scripts + monitor traffic; fulfill castle.io locally
await page.route(/m\.castle\.io|castle\.io|cdn\.castle/, async route => {
  const req = route.request();
  const pd = req.postData() || null;
  const url = req.url();
  if (pd) posts.push({ url: url.slice(0,160), body: pd.slice(0,8000) });
  await route.fulfill({ status:200, contentType:'application/json', body:'{}' });
});
page.on('pageerror', e => posts.push({ pageerror: String(e).slice(0,300) }));

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:'load' });
await page.waitForFunction(()=>typeof window.Castle!=='undefined' || window.__api!==undefined, { timeout:20000 }).catch(()=>{});
console.log('Castle typeof:', await page.evaluate(()=>typeof window.Castle));
await page.evaluate(()=>window.__go && window.__go());
await page.waitForTimeout(12000);
const res = await page.evaluate(()=>({ fpres: window.__fpres, configured: window.__configured, token: window.__token, token2: window.__token2, sameToken: window.__token===window.__token2, tokErr: window.__tokErr, net: window.__c.net, ls: Object.keys(localStorage), cookie: document.cookie, cs: window.__cs, csErr: (()=>{try{return window.__csErr}catch(e){return null}})() })).catch(()=>null);
console.log('RESULT:', JSON.stringify(res, null, 1).slice(0,3500));
console.log('\n=== monitor/network posts ===');
for (const p of posts) console.log('  ', p.url||'', p.pageerror||(p.body||'').slice(0,600));

mkdirSync('/tmp/opencode/castle',{recursive:true});
writeFileSync('/tmp/opencode/castle/probe-result.json', JSON.stringify({res, posts}, null, 2));
await b.close(); server.close();
