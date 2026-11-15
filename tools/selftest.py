#!/usr/bin/env python3
"""Plays the game by itself in headless Chrome and reports failures.

Usage:  python3 tools/selftest.py                          the full test in the classic world
        python3 tools/selftest.py --quick --regions alps,fuji,glencoe     a fast check of several real regions

It serves this folder on a local port, opens index.html?selftest in headless Chrome (no libraries needed), waits for the in-page tests in
selftest.js to finish, and prints one line per check. The exit code is 1 when any check fails.
"""
import argparse, functools, html, http.server, json, os, re, subprocess, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']

def run_once(chrome, region, quick, seconds, port):
    profile = '/tmp/plane-selftest-profile-%d-%s' % (port, region)
    os.makedirs(profile, exist_ok=True)
    query = 'selftest=quick' if quick else 'selftest=1'
    start = 'http://127.0.0.1:%d/index.html?%s' % (port, query)
    helper = os.path.join(ROOT, '.selftest-region.html')
    if region != 'classic':
        # the region is chosen by the same setting the game reads, so a tiny page sets it first
        open(helper, 'w').write("<script>localStorage.setItem('plane-the-plane-region','%s');location.href='/index.html?%s';</script>" % (region, query))
        start = 'http://127.0.0.1:%d/.selftest-region.html' % port
    cmd = [chrome, '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
           '--user-data-dir=' + profile, '--window-size=1280,720', '--virtual-time-budget=%d' % (seconds * 1000), '--dump-dom', start]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=seconds + 600).stdout
    except subprocess.TimeoutExpired:
        return None, 'Chrome did not finish in time'
    finally:
        try: os.remove(helper)
        except OSError: pass
    m = re.search(r'<pre id="selftest-result">(.*?)</pre>', out, re.S)
    if not m: return None, 'no result was written by the page: ' + out[-200:]
    return json.loads(html.unescape(m.group(1))), None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--regions', default='classic', help='comma list: classic, alps, canyon, hawaii, rainier, everest, ...')
    ap.add_argument('--quick', action='store_true', help='only the world, models, graphics and one take-off')
    ap.add_argument('--chrome', default=next((c for c in CHROMES if os.path.exists(c)), None))
    ap.add_argument('--seconds', type=int, default=500)
    args = ap.parse_args()
    if not args.chrome: sys.exit('Chrome was not found: pass --chrome PATH')
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_POST(self): self.send_error(501)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    failed_total = 0
    try:
        for region in args.regions.split(','):
            print('== %s world%s' % (region, ' (quick)' if args.quick else ''), flush=True)
            data, err = run_once(args.chrome, region.strip(), args.quick, args.seconds, port)
            if err: print('FAIL', err); failed_total += 1; continue
            for r in data['results']:
                print(('PASS' if r['ok'] else 'FAIL'), '%-62s' % r['name'], '-', r['detail'])
            print('%d checks, %d failed' % (data['total'], data['failed']), flush=True)
            failed_total += data['failed']
    finally:
        srv.shutdown()
    sys.exit(1 if failed_total else 0)

if __name__ == '__main__':
    main()
