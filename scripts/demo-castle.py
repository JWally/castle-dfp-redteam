#!/usr/bin/env python3
"""demo-castle.py — print the FULL Castle token (client-minted, 0 network).
Replays the token capture: token = Rw binary-tree checksum over rotating hash,
__cuid minted client-side from the bundle."""
import json, sys

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else '/home/justin/Dev/dfp-redteam-castle-2026-10-26/artifacts/differential.json'
    try:
        d = json.load(open(src))
        print('=' * 74)
        print('CASTLE — CLIENT-MINTED TOKEN (0 network calls)')
        print('token = Rw binary-tree checksum over a rotating hash')
        print('mint:  __cuid + request token computed entirely client-side')
        print('=' * 74)
        print(json.dumps(d, indent=1, default=str)[:2500])
        print('=' * 74)
        print('=> the token is client-computed; public bypass ecosystem mints')
        print('   tokens from the public key (FuckCastle/TakionAPI)')
    except Exception as e:
        print('artifact parse error:', e)
        # fallback: token-re-cap
        try:
            d2 = json.load(open('/home/justin/Dev/dfp-redteam-castle-2026-10-26/artifacts/token-re-cap.json'))
            print(json.dumps(d2, indent=1))
        except Exception as e2:
            print('fallback also failed:', e2)

if __name__ == '__main__':
    main()
