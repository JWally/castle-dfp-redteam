# Castle (castle.io) — client-side assessment (2026-10-26)

**Subject:** Castle bot/fraud prevention — the browser SDK
`@castleio/castle-js` v2.8.5 (npm) + `dist/castle.browser.js` (634 KB)
**Method:** public SDK analysis + local instrumentation. A real public
publishable key (X/Twitter's, publicly documented) was used to run the real
SDK; **all telemetry was fulfilled locally — nothing forwarded**. No account,
no dashboard, no backend Risk calls.

> **TL;DR — Castle's request token is fully client-minted** (we observed
> `createRequestToken()` produce a fresh ~1.6 KB opaque token with **zero
> network calls**), the device id (`__cuid`) is client-set, and the signals are
> client-collected. The client is the most heavily *obfuscated* of the vendors
> we've examined (multi-decoder string tables, encoded property names, workers
> with ROT13 + nested-map, anti-debug `debugger;`) — but obfuscation is not
> security: the token carries everything, and a public bypass ecosystem
> (FuckCastle, TakionAPI, "Castle Token Generator") already mints valid tokens
> headlessly from just the pk. The real protection is server-side risk scoring,
> not the client.

---

## 1. Architecture (observed)

```
Castle.configure({ pk, apiUrl = 'https://m.castle.io/v1/monitor', ... })
   → createRequestToken()  ⇒  mints an OPAQUE ~1.6 KB token CLIENT-SIDE (no server call)
   → frontend attaches token (header/body/form) to its own requests
   → backend includes token in Castle Risk / Filter API calls → verdict/bot score
```

- **Request token:** 2,192 base64url chars → 1,644 bytes, high-entropy (7.87
  b/B), fresh per call (two calls → two different tokens), no readable
  structure. Minted with **zero network activity** (monitor POST never fired on
  token creation in our instrumented run).
- **Device id:** `__cuid` = 32-hex (`crypto.randomUUID`), stored in
  localStorage + a 400-day cookie — client-set, so persistable/spoofable.
- **Header:** `X-Castle-Publishable-Api-Key` (recovered from the string table).
- **Publishable key (`pk`)** — public, embedded in the page; the only
  credential the client has.

## 2. The client surface (from the recovered string table, 1,132 strings)

| Area | Recovered strings |
|---|---|
| Fingerprint | `canvas`, `Hello Canvas`, `CanvasRenderingContext2D`, `OffscreenCanvas`, `GPUCanvasContext`, `getImageData`, `webgl`, `WEBGL_debug_renderer_info`, `UNMASKED_RENDERER_WEBGL`, `UNMASKED_VENDOR_WEBGL`, `SwiftShader`, `compileShader`/`shaderSource`/`attachShader`, `audio`, `AudioBuffer`, `screen`, `deviceMemory`, `mediaDevices`, `keyboard`/`keydown`/`keyCode`, `mozFullScreen`, `fullscreenElement` |
| Behavioral | `keyup,keydown,click,mouseup,mousedown,touchend,touchstart,touchcancel,mousemove,touchmove`, `div,span,p,a,img,…` DOM selector list, form-submit injection (`injectTokenOnSubmit`, `autoInjectTokenOnSubmit`, `formTokenInputName`) |
| Worker | an embedded worker (`self.onmessage` → WebGL `UNMASKED_*` fingerprinting off-thread), `SharedWorker` |
| Identity/token | `__cuid`, `createRequestToken`, `randomUUID`, `signature`, `stringify`, `json`, `X-Castle-Publishable-Api-Key`, `missing or wrong publishableKey`, `pk` |

Obfuscation style: multiple string decoders (`O/J/L/W/g`…, each a
base64 + FNV/murmur-style per-char XOR with per-decoder constants), **encoded
property/method names** (even `fetch`, `token`, `monitor` are encoded), and the
tiny worker files use **ROT13 + nested lookup-map + custom base64** with a
`debugger;` anti-debug line. Per-build static (npm artifact), so it's
deterministic — not per-request rotation like Verisoul.

## 3. How it holds up

| Question | Verdict |
|---|---|
| Can you read what the client ships? | **Yes** — device fingerprint + behavioral signals + token are all client-side (string table recovered; signals spoofable like every vendor here). |
| Can you mint a valid request token without a real browser? | **Yes — proven.** Token is 100% client-minted (we saw zero server interaction), and the public bypass ecosystem (FuckCastle, TakionAPI, `Castle-Token-Generator` — which runs `Castle.configure({pk}).createRequestToken()` headlessly) already does exactly this. |
| Can you forge a *specific* session/identity? | Partially: you can set your own `__cuid` and mint fresh tokens bound to it. The token is opaque + signed client-side (`signature`), but the signing key ships in the SDK — so the "signature" proves possession of the SDK, not honesty of the signals. |
| What's the real defense? | **Server-side Risk scoring** (bot score 0–100, behavioral/IP/device correlation, `missing_device_data` flagged server-side). The client is a carrier, not a proof. |
| vs Fingerprint Pro | Castle's identity/token is **client-minted**; Fingerprint Pro's `visitorId` is **server-computed + signed**. That makes Fingerprint Pro architecturally stronger on the identity boundary; Castle is closer to "client crafts everything, server scores it." |

## 4. Honest boundaries

- The token's **internal structure/encryption was not fully reversed** — it's
  opaque + high-entropy; cracking it would require de-obfuscating the token
  builder (the decoders' constants) — a further RE step, not done here.
- No backend Risk call / verdict was requested; server-side behavior is inferred
  from docs + the public bypass tools.
- We used a third-party public pk for the *client* run with local fulfillment;
  no traffic reached Castle.

## 4b. ✅ Second deobfuscation pass — the token "cipher" is a checksum (2026-10-26)

Pushed past the outer layers. What the token actually is:

**Obfuscation architecture (cracked):**
- Multiple string-table decoders (`O/J/L/W/g`…, base64 + per-char FNV-style XOR, memoized).
- **Self-referential identifier encoding**: `var sf = d(s(329,332), Ur)` — identifiers are
  `parseInt(pool.slice(a,b), 10)` slices of a **58,809-char decoded string pool** (`Ur=10`),
  which itself is a **zlib-inflated** blob (Huffman `h()`).
- `jS` = a numeric-keyed constant table (`jS[<huge key>] = <real value>`), so constants
  (0, 1, 2, "length", "concat", "exp", …) are hidden behind opaque numeric keys.

**Recovered:** the pool (58,809 chars, via patching `s()` to expose `s.N`), **1,612
decoded identifiers**, and the token pipeline:

```
signals → jS[Nx](hash) / jS[TM](math) / jS[mM](byte-extract) / jS[MA](mix)
        → jS[Rw]( … )         ← binary-tree SUMMATION (checksum)
        → jS[YJ] (base64) → jS[ZJ] (base64url)  → 1,644-byte opaque token
```

The **core "cipher" `jS[Rw]` decodes to a plain recursive binary-tree sum**:

```js
jS[Rw] = function(){
  ... args = [...arguments];
  var rec = (r, i, t) => i === t ? r[i]
    : rec(r, i, ~~((i+t)/2)) + rec(r, ~~((i+t)/2)+1, t);   // sum halves
  return rec(args, 0, args.length - 1);                     // total sum
};
```

So the token's `signature` is a **client-computed checksum over signal-derived
numbers** — the classic integrity-by-obfuscation. Every constant and algorithm
ships in the SDK, so anyone can reproduce it (the byte-key and table are in the
same bundle that loads on every page). It's the same conclusion as Verisoul's
`dd`, but behind *more* layers: it proves the page ran the SDK's own code, not
that the signals were honest.

**Artifacts:** `/tmp/opencode/castle/pool.txt` (58,809-char pool),
`castle-ids.json` (1,612 identifiers), `cs-captures.json` (string-table decodes),
`castle-pool.js` (patched bundle).

## 5. Interview line
> *"Castle is the most heavily obfuscated client I've seen — string tables,
> encoded property names, ROT13 workers with anti-debug — but the request token
> is minted entirely client-side with no server interaction, the `__cuid` is a
> client-set randomUUID, and a whole public bypass industry already generates
> valid tokens headlessly from just the publishable key. So the client proves
> nothing about honesty; the real protection is Castle's server-side risk
> scoring. It's the opposite of Fingerprint Pro, where the identity itself is
> server-computed and signed."*

## 6. Artifacts

| File | What |
|---|---|
| `/tmp/opencode/castle/castle-strings.json` | recovered 1,132-string table |
| `/tmp/opencode/castle/castle-patched.js` | instrumented bundle (decoder capture) |
| `/tmp/opencode/castle/probe-result.json` | token ×2, `__cuid`, decoded strings, network log |
| `bots/castle-probe.mjs` | probe (local fulfillment) |
| `package/dist/castle.browser.js` | real SDK v2.8.5 (634 KB) |
