#!/usr/bin/env node
/** castle-differential.mjs — map signal payload tags to fields by mutating one
 *  browser attribute at a time and diffing the Nx-captured signal payload. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = 9015;
const bundle = readFileSync('/tmp/opencode/castle/castle-signals.js','utf8');
const html = `<!doctype html><html><body><script>
window.__go=async()=>{ try{ const C=window.Castle; C.configure({pk:'pk_AvRa79bHyJSYSQHnRpcVtzyxetSvFerx'}); window.__t=await C.createRequestToken(); window.__fpres='ok'; }catch(e){ window.__fpres='ERR:'+String(e).slice(0,150); } };
</script><script src="/castle.js"></script></body></html>`;
const server = createServer((q,r)=>{ if(q.url==="/"){r.writeHead(200,{'content-type':'text/html'});r.end(html);} else if(q.url==="/castle.js"){r.writeHead(200,{'content-type':'application/javascript'});r.end(bundle);} else {r.writeHead(200,{'content-type':'text/plain'});r.end('ok');} });
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

const b = await chromium.launch({ headless:true });

function mutationFor(name){
  const def=(p,k,g)=>{ try{ Object.defineProperty(p,k,{configurable:true,get:g}); }catch(e){} };
  switch(name){
    case 'screen1920x1080': return `(${def})(Screen.prototype,'width',()=>1920);(${def})(Screen.prototype,'height',()=>1080);(${def})(Screen.prototype,'availWidth',()=>1920);(${def})(Screen.prototype,'availHeight',()=>1080);`;
    case 'screen500x500':   return `(${def})(Screen.prototype,'width',()=>500);(${def})(Screen.prototype,'height',()=>500);(${def})(Screen.prototype,'availWidth',()=>500);(${def})(Screen.prototype,'availHeight',()=>500);`;
    case 'colorDepth8':     return `(${def})(Screen.prototype,'colorDepth',()=>8);(${def})(Screen.prototype,'pixelDepth',()=>8);`;
    case 'dpr2':            return `(${def})(window,'devicePixelRatio',()=>2);`;
    case 'viewport':        return `(${def})(window,'innerWidth',()=>1920);(${def})(window,'innerHeight',()=>1080);(${def})(window,'outerWidth',()=>1920);(${def})(window,'outerHeight',()=>1080);`;
    case 'ua_firefox':      return `(${def})(Navigator.prototype,'userAgent',()=>'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0');(${def})(Navigator.prototype,'appVersion',()=>'5.0 (X11)');(${def})(Navigator.prototype,'platform',()=>'Linux x86_64');`;
    case 'platform_win':    return `(${def})(Navigator.prototype,'platform',()=>'Win32');(${def})(Navigator.prototype,'userAgent',()=>'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');`;
    case 'lang_fr':         return `(${def})(Navigator.prototype,'language',()=>'fr-FR');(${def})(Navigator.prototype,'languages',()=>['fr-FR','fr']);`;
    case 'lang_many':       return `(${def})(Navigator.prototype,'languages',()=>['en-US','en','fr','de','es','zh','ja','ko','ar','hi']);`;
    case 'cores8':          return `(${def})(Navigator.prototype,'hardwareConcurrency',()=>8);`;
    case 'mem128':          return `(${def})(Navigator.prototype,'deviceMemory',()=>128);`;
    case 'touch10':         return `(${def})(Navigator.prototype,'maxTouchPoints',()=>10);`;
    case 'webdriver_true':  return `(${def})(Navigator.prototype,'webdriver',()=>true);`;
    case 'plugins5':        return `(${def})(Navigator.prototype,'plugins',()=>{const p=[];for(let i=0;i<5;i++)p.push({name:'Plugin'+i,description:'d',filename:'f',length:1,item:()=>null,namedItem:()=>null});return p;});`;
    case 'cookie_off':      return `(${def})(Navigator.prototype,'cookieEnabled',()=>false);`;
    case 'dnt1':            return `(${def})(Navigator.prototype,'doNotTrack',()=>'1');`;
    case 'tz_utc':          return `(()=>{ const o=Intl.DateTimeFormat; const old=o.prototype.resolvedOptions; Intl.DateTimeFormat.prototype.resolvedOptions=function(){ const r=old.call(this); r.timeZone='UTC'; return r; }; })();`;
    case 'canvas_red':      return `(()=>{ const og=CanvasRenderingContext2D.prototype.getImageData; CanvasRenderingContext2D.prototype.getImageData=function(...a){ const r=og.apply(this,a); for(let i=0;i<r.data.length;i++){r.data[i]^=0xff;} return r; }; })();`;
    case 'webgl_vendor':    return `(()=>{ const og=WebGLRenderingContext.prototype.getParameter; WebGLRenderingContext.prototype.getParameter=function(p){ if(p===37445) return 'MUTATED_VENDOR'; if(p===37446) return 'MUTATED_RENDERER'; return og.apply(this,arguments); }; })();`;
    default: return null;
  }
}

async function run(mutCode, ua){
  const ctx = await b.newContext({ userAgent: ua });
  if (mutCode) await ctx.addInitScript({ content: mutCode });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'load'});
  await p.evaluate(()=>window.__go&&window.__go());
  await p.waitForTimeout(4000);
  const nx = await p.evaluate(()=>window.__nx||[]).catch(()=>[]);
  await ctx.close();
  return nx[0] || [];
}
function flatten(sig){ const m={}; for(const g of sig||[]) for(const f of g){ const t=f.slice(0,2); if(!(t in m)) m[t]=f.slice(2); } return m; }
function diff(a,b){ const out=[]; for(const t in a){ if(b[t]!==undefined && b[t]!==a[t]) out.push(t); } return out; }

const base = flatten(await run(null, undefined));
const base2 = flatten(await run(null, undefined));
const noisy = Object.keys(base).filter(t=>base[t]!==base2[t]);
console.log('baseline tags:', Object.keys(base).length, '| noisy (change between identical runs):', noisy.length, noisy.slice(0,10));
const result = { base, noisy };
const muts = ['screen1920x1080','screen500x500','colorDepth8','dpr2','viewport','ua_firefox','platform_win','lang_fr','lang_many','cores8','mem128','touch10','webdriver_true','plugins5','cookie_off','dnt1','tz_utc','canvas_red','webgl_vendor'];
for (const name of muts){
  const mc = mutationFor(name);
  if (!mc) continue;
  const sig = flatten(await run(mc, undefined));
  const changed = diff(base, sig).filter(t=>!noisy.includes(t));
  const alsoNoisy = diff(base, sig).filter(t=>noisy.includes(t));
  result[name] = { changed, alsoNoisy };
  console.log(`${name}: changed=[${changed.join(',')}] alsoNoisy=[${alsoNoisy.join(',')}]`);
}
writeFileSync('/tmp/opencode/castle/differential.json', JSON.stringify(result,null,2));
await b.close(); server.close();
