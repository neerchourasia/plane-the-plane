#!/usr/bin/env python3
"""Takes a picture of a prepared scene with headless Chrome.

Usage:  python3 tools/shot.py plane-747 out.png        (one plane, close up)
        python3 tools/shot.py apron out.png            (an airport apron)
        python3 tools/shot.py plane-737 out.png --region alps
"""
import argparse, functools, http.server, os, subprocess, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('scene'); ap.add_argument('out')
    ap.add_argument('--region', default='classic'); ap.add_argument('--size', default='1280,720')
    ap.add_argument('--gpu', action='store_true', help='use the real graphics card (Metal on a Mac) instead of the software renderer')
    args = ap.parse_args()
    chrome = next((c for c in CHROMES if os.path.exists(c)), None)
    if not chrome: sys.exit('Chrome not found')
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_POST(self): self.send_error(501)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:%d/index.html?shot=%s' % (port, args.scene)
    profile = '/tmp/plane-shot-profile-%d' % port
    if args.region != 'classic':
        os.makedirs(profile, exist_ok=True)
        helper = os.path.join(ROOT, '.shot-region.html')
        open(helper, 'w').write("<script>localStorage.setItem('plane-the-plane-region','%s');location.href='/index.html?shot=%s';</script>" % (args.region, args.scene))
        url = 'http://127.0.0.1:%d/.shot-region.html' % port
    gfx = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] if args.gpu else ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    cmd = [chrome, '--headless=new', '--no-sandbox'] + gfx + ['--user-data-dir=' + profile,
           '--window-size=' + args.size, '--virtual-time-budget=14000', '--screenshot=' + os.path.abspath(args.out), url]
    try: subprocess.run(cmd, capture_output=True, timeout=240)
    finally:
        srv.shutdown()
        try: os.remove(os.path.join(ROOT, '.shot-region.html'))
        except OSError: pass
    print('saved', args.out)

if __name__ == '__main__':
    main()
