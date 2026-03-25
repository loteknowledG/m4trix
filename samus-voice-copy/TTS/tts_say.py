#!/usr/bin/env python
import argparse, asyncio, json, os, sys, time, subprocess

PORT = 8766

async def send(text, rate=None, voice=None, wait=False, host='127.0.0.1', port=PORT):
    import websockets
    uri = f'ws://{host}:{port}'
    async with websockets.connect(uri) as ws:
        await ws.recv()  # ready
        payload = {'text': text}
        if rate is not None:
            payload['rate'] = rate
        if voice is not None:
            payload['voice'] = voice
        if wait:
            payload['wait'] = True
        await ws.send(json.dumps(payload))
        return await ws.recv()


def ensure_server(host='127.0.0.1', port=PORT):
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.2)
        try:
            s.connect((host, port))
            return True
        except Exception:
            pass

    # Start the TTS server in a foreground-capable mode so audio playback is reliable.
    # Write stdout/stderr to a rolling log file so playback can be diagnosed.
    root = os.path.dirname(os.path.abspath(__file__))
    server = os.path.join(root, 'tts_server.py')
    log_path = os.path.join(root, 'tts_server.log')

    # Use non-detached creationflags on Windows so the process has a normal
    # audio/session context. Capture stdout/stderr to the log file for debugging.
    try:
        logf = open(log_path, 'a', buffering=1, encoding='utf-8')
        try:
            proc = subprocess.Popen([sys.executable, server], stdout=logf, stderr=subprocess.STDOUT, creationflags=0)
        except TypeError:
            # creationflags may not be supported on some platforms — fall back
            proc = subprocess.Popen([sys.executable, server], stdout=logf, stderr=subprocess.STDOUT)
    except Exception:
        # Best-effort fallback to detached start if logging can't be opened
        try:
            subprocess.Popen([sys.executable, server], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    # Wait up to ~3s for the server to accept connections
    for _ in range(12):
        time.sleep(0.25)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.2)
            try:
                s.connect((host, port))
                return True
            except Exception:
                continue
    return False


def main():
    ap = argparse.ArgumentParser(description='Say text via persistent TTS server')
    ap.add_argument('text', nargs='+')
    ap.add_argument('--rate', type=int)
    ap.add_argument('--voice')
    ap.add_argument('--ensure', action='store_true', help='Start server if not running')
    ap.add_argument('--wait', action='store_true', help='Wait until playback completes (server will acknowledge after audio finishes)')
    ap.add_argument('--persist', action='store_true', help='Persist the provided --voice into local memory as preferred voice')
    ap.add_argument('--cloud', action='store_true', help='Force use of cloud TTS (edge-tts) for this request')
    args = ap.parse_args()

    msg = ' '.join(args.text)

    # If a cloud-style voice is requested (e.g. nb-NO-HeddaNeural) or --cloud used,
    # prefer edge-tts when available.
    used_cloud = False
    if args.voice and (args.cloud or 'Neural' in args.voice or args.voice.count('-') >= 2):
        edge_script = os.path.join(os.path.dirname(__file__), 'edge_tts.py')
        if os.path.exists(edge_script):
            try:
                subprocess.run([sys.executable, edge_script, '--voice', args.voice, msg], check=False)
                used_cloud = True
            except Exception:
                used_cloud = False

    if used_cloud:
        # persist preference if requested and exit
        if args.persist:
            try:
                from samus_manus_mvp.memory import get_memory
                get_memory().add('voice', args.voice, metadata={'source': 'tts_say'})
            except Exception:
                pass
        sys.exit(0)

    if args.ensure:
        ensure_server()

    # Try persistent TTS server first
    try:
        out = asyncio.run(send(msg, rate=args.rate, voice=args.voice, wait=args.wait))
        if out:
            print(out)
            # if server accepted and we should persist, do so now
            if args.persist and args.voice:
                try:
                    from samus_manus_mvp.memory import get_memory
                    get_memory().add('voice', args.voice, metadata={'source': 'tts_say'})
                except Exception:
                    pass
            sys.exit(0)
    except Exception:
        pass

    # Fallback one-shot if server unavailable
    try:
        import pyttsx3
        e = pyttsx3.init();
        if args.rate:
            e.setProperty('rate', args.rate)
        if args.voice:
            try:
                e.setProperty('voice', args.voice)
            except Exception:
                pass
        e.say(msg); e.runAndWait()
        # persist if requested
        if args.persist and args.voice:
            try:
                from samus_manus_mvp.memory import get_memory
                get_memory().add('voice', args.voice, metadata={'source': 'tts_say'})
            except Exception:
                pass
    except Exception as e:
        print({'ok': False, 'error': str(e)})

if __name__ == '__main__':
    main()
