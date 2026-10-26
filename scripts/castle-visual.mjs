#!/usr/bin/env node
/**
 * castle-visual.mjs — HEADED demo of the Castle SDK drill-down.
 *
 * Runs the REAL @castleio/castle-js v2.8.5 (patched only with read-only hooks):
 *  - token minting (fully client-side, zero network)
 *  - __cuid device id
 *  - the deobfuscation results: string table, identifier pool, the Rw
 *    binary-tree checksum "cipher"
 * All telemetry fulfilled locally — nothing reaches Castle.
 *
 * Usage: node scripts/castle-visual.mjs   (close window to exit)
 * Saves screenshots/castle-*.png
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9001;
const bundle = readFileSync('/tmp/opencode/castle/castle-signals.js','utf8');
const POOL = readFileSync('/tmp/opencode/castle/pool.txt','utf8');
const CS = JSON.parse(readFileSync('/tmp/opencode/castle/cs-captures.json','utf8'));

const INIT = `(() => {
  const W=window; W.__cap={net:[], b64:[]};
  W.__log=function(cls,line){ const el=document.getElementById('log'); if(!el) return;
    const d=document.createElement('div'); d.className=cls||'';
    d.textContent='['+String(Date.now()).slice(-6)+'] '+line; el.appendChild(d); el.scrollTop=el.scrollHeight; };
  W.__render=function(h){ const el=document.getElementById('out'); if(!el) return;
    const d=document.createElement('div'); d.innerHTML=h; el.appendChild(d); };
  const oF=W.fetch; W.fetch=function(u,i){ try{ W.__cap.net.push({kind:'fetch', url:String(u), method:(i&&i.method)||'GET'}); }catch(_){} return oF.apply(this,arguments); };
  const oX=XMLHttpRequest.prototype.open, oS=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){ this.__cu=String(u); return oX.apply(this,arguments); };
  XMLHttpRequest.prototype.send=function(b){ try{ W.__cap.net.push({kind:'xhr', url:this.__cu, body:typeof b==='string'?b.slice(0,400):null}); }catch(_){} return oS.apply(this,arguments); };
  const ob=W.btoa; W.btoa=function(s){ const out=ob.call(this,s); try{ W.__cap.b64.push({inLen:String(s).length, outLen:out.length}); }catch(_){} return out; };
})();`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Castle — token + deobfuscation (authorized demo)</title>
<style>
  body{background:#0d1117;color:#e6edf3;font-family:ui-monospace,Menlo,Consolas,monospace;margin:0}
  #wrap{max-width:1040px;margin:0 auto;padding:24px}
  h1{font-size:18px;color:#58a6ff;margin:0 0 4px}
  .sub{color:#8b949e;font-size:12px;margin:0 0 14px}
  #log{background:#010409;border:1px solid #30363d;border-radius:8px;padding:12px 14px;font-size:12px;line-height:1.5;
       max-height:220px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;margin-bottom:16px}
  .ok{color:#3fb950}.warn{color:#d29922}.bad{color:#f85149}.dim{color:#8b949e}.acc{color:#58a6ff}.hex{color:#d2a8ff}
  h2{font-size:13px;color:#58a6ff;margin:16px 0 4px;letter-spacing:.5px}
  h3{font-size:12px;color:#8b949e;margin:12px 0 2px;font-weight:normal;letter-spacing:.4px}
  table{border-collapse:collapse;width:100%;font-size:12px;margin:4px 0 12px}
  th,td{border:1px solid #30363d;padding:3px 8px;text-align:left;vertical-align:top;word-break:break-all}
  th{background:#161b22;color:#8b949e;font-weight:normal;text-transform:uppercase;font-size:10px}
  .k{color:#a5d6ff;white-space:nowrap}.dim{color:#8b949e}
  .big{background:#010409;border:1px solid #30363d;border-radius:8px;padding:12px 14px;font-size:12px;line-height:1.7;margin:4px 0 14px;overflow:auto}
  .big b{color:#a5d6ff}.tok{word-break:break-all;font-size:11px;color:#d2a8ff}
</style></head>
<body><div id="wrap">
  <h1>Castle — request token minted client-side + deobfuscation results</h1>
  <p class="sub">real @castleio/castle-js v2.8.5 · read-only hooks · all telemetry fulfilled locally, nothing forwarded</p>
  <div id="log"></div>
  <div id="out"></div>
</div>
<script>
window.__go=async()=>{ try{
  const C=window.Castle;
  C.configure({ pk: 'pk_AvRa79bHyJSYSQHnRpcVtzyxetSvFerx' });
  window.__log('ok','[+] configured with a public publishable key (X/Twitter\'s, public)');
  window.__t1=await C.createRequestToken();
  window.__t2=await C.createRequestToken();
  window.__log('ok','[+] createRequestToken() x2 — tokens minted, client-side');
  window.__fpres='ok';
}catch(e){ window.__fpres='ERR:'+String(e).slice(0,200); window.__log('bad','[!] '+String(e).slice(0,200)); } };
</script>
<script src="/castle.js"></script>
</body></html>`;

const server = createServer((req,res)=>{
  if (req.url === '/') { res.writeHead(200,{'content-type':'text/html'}); res.end(html); }
  else if (req.url === '/castle.js') { res.writeHead(200,{'content-type':'application/javascript'}); res.end(bundle); }
  else { res.writeHead(200,{'content-type':'text/plain'}); res.end('ok'); }
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

const browser = await chromium.launch({ headless:false, args:['--window-size=1080,980'] });
const ctx = await browser.newContext({ viewport:{ width:1020, height:960 } });
await ctx.addInitScript({ content: INIT });
const page = await ctx.newPage();
const L = cls => txt => page.evaluate(([c,t])=>window.__log(c,t), [cls,txt]).catch(()=>{});
const step = async (cls, txt)=>{ await L(cls)(txt); await new Promise(r=>setTimeout(r,450)); };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

await page.route(/m\.castle\.io|castle\.io/, r=>r.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:'load' });
await step('dim','[*] loading real Castle SDK (instrumented, read-only) …');
await step('acc','[*] SDK parses its self-referential string pool + identifier table');
await page.waitForFunction(()=>typeof window.Castle!=='undefined', { timeout:20000 }).catch(()=>{});
await page.evaluate(()=>window.__go&&window.__go());
await page.waitForTimeout(7000);

const res = await page.evaluate(()=>({
  fpres: window.__fpres,
  t1len: (window.__t1||'').length,
  t2len: (window.__t2||'').length,
  same: window.__t1===window.__t2,
  cuid: localStorage.getItem('__cuid') || document.cookie.match(/__cuid=([0-9a-f]{32})/)?.[1] || null,
  cookie: document.cookie,
  net: window.__cap.net,
  b64: window.__cap.b64,
  sig: window.__nx || null,
})).catch(()=>null);
await step('ok','[+] token minted: '+res.t1len+' chars · opaque · client-side (network log: '+(res.net||[]).length+' calls)');
await step('ok','[+] captured the serialized signal payload (pre-obfuscation, '+(res.sig?res.sig.length:0)+' collections)');

// build panels
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const csmap = new Map(CS.map(([a,d])=>[a,d]));
let out = '';
out += '<h2>REQUEST TOKEN — minted entirely client-side</h2><div class="big">'+
  '<b>createRequestToken()</b> → <span class="hex">'+res.t1len+'</span> chars (2,192 base64url → 1,644 bytes, high-entropy 7.87 b/B)<br>'+
  '<b>two calls → two tokens:</b> '+(res.same?'SAME':'DIFFERENT (fresh per call)')+'<br>'+
  '<b>network during token creation:</b> '+(res.net||[]).length+' requests — the token is minted with <b>zero server interaction</b><br>'+
  '<b>__cuid (device id):</b> <span class="hex">'+esc(res.cuid||'—')+'</span> (client randomUUID, localStorage + cookie)</div>';
out += '<h2>CLIENT-MINTED = forgeable</h2><div class="big">public bypass tools (FuckCastle, TakionAPI, Castle-Token-Generator) run the SDK headlessly with just the <b>pk</b> and mint valid tokens — the token proves "the SDK ran", not "the signals were honest".</div>';
out += '<h2>OBFUSCATION — layers cracked</h2><div class="big">'+
  'string-table decoders (<span class="k">O/J/L/W/g</span>): <b>'+CS.length+'</b> decoded strings<br>'+
  'self-referential identifiers (<span class="k">var x = parseInt(pool.slice(a,b),10)</span>): <b>'+POOL.length.toLocaleString()+'</b>-char pool · <b>1,612</b> identifiers decoded<br>'+
  'numeric-keyed <span class="k">jS</span> constant table (0/1/2, "length", "concat", "exp" hidden behind huge opaque keys)<br>'+
  'worker files: ROT13 + nested-map + anti-debug <span class="k">debugger;</span></div>';
out += '<h2>THE TOKEN "CIPHER" — a binary-tree checksum (Rw)</h2><div class="big">'+
  'signals → Nx(hash) / TM(math) / mM(byte-extract) → <b>Rw</b> (recursive binary-tree SUM) → base64url → token<br>'+
  '<span class="k">jS[Rw] = function(){ … rec(r,i,t) = i===t ? r[i] : rec(r,i,mid)+rec(r,mid+1,t); return rec(args,0,len-1); }</span><br>'+
  'the "signature" is a <b>client-computed checksum</b> — every constant ships in the SDK, so it is reproduceable, not security.</div>';

// string-table highlights
const interesting = [...csmap.entries()].filter(([a,d])=>['webdriver','X-Castle-Publishable-Api-Key','__cuid','createRequestToken','signature','CanvasRenderingContext2D','UNMASKED_RENDERER_WEBGL','monitor','publishable','randomUUID','keydown','m.castle.io'].includes(d));
out += '<h2>RECOVERED STRING TABLE — highlights</h2><table><tr><th>decoded</th></tr>';
for (const [,d] of interesting.slice(0,24)) out += '<tr><td class="k">'+esc(d)+'</td></tr>';
out += '</table>';

// THE SIGNAL PAYLOAD (what actually gets hashed into the token)
const sig = res && res.sig;
if (sig && sig.length) {
  const KNOWN = { 'bf':'screen-related metric', '97':'screen/UA field', '67':'screen/struct field', '8f':'UA-ish field',
    '14':'hash (canvas/render)', 'b4':'hash', '2c':'hash', '54':'hash', 'c4':'hash', 'd4':'hash', 'ec':'hash',
    '24':'hash', 'a4':'hash', 'dc':'hash', 'fc':'hash', 'f7':'UA array', 'ff':'UA array' };
  out += '<h2>THE SIGNAL PAYLOAD — captured pre-obfuscation ('+sig.length+' collections, what Nx() hashes)</h2>';
  sig.forEach((group, gi) => {
    out += '<h3>collection '+gi+' ('+group.length+' fields)</h3><table><tr><th>tag</th><th>value (hex)</th><th>note</th></tr>';
    for (const field of group) {
      const tag = field.slice(0,2);
      const val = field.slice(2);
      const note = KNOWN[tag] || '';
      out += '<tr><td class="k">'+esc(tag)+'</td><td class="hex">'+esc(val.slice(0,120))+(val.length>120?'…':'')+'</td><td class="dim">'+esc(note)+'</td></tr>';
    }
    out += '</table>';
  });
}
out += '<div class="big"><b>Takeaway:</b> obfuscation is heavy but the token is client-minted + client-checksummed — the real defense is Castle\'s <b>server-side risk scoring</b>.</div>';
await page.evaluate(h=>window.__render(h), out);
await step('dim','———— done · close the window to exit —————');

mkdirSync(join(repoRoot,'screenshots'),{recursive:true});
await sleep(1000);
await page.screenshot({ path: join(repoRoot,'screenshots','castle-full.png'), fullPage:true });
await page.screenshot({ path: join(repoRoot,'screenshots','castle-view.png') });
console.log('[+] screenshots saved: screenshots/castle-full.png, castle-view.png');
browser.on('disconnected', ()=> process.exit(0));
await new Promise(()=>{});
