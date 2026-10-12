"""Exercise curses/SDL playback through a pseudo-terminal and dummy audio device."""
import base64
import fcntl
import http.server
import io
import json
import math
import os
from pathlib import Path
import pty
import select
import struct
import subprocess
import sys
import termios
import threading
import time
import wave


def main():
    cli = str(Path(sys.argv[1]).resolve())
    pcm = b"".join(struct.pack("<h", int(16000 * math.sin(i * 2 * math.pi * 440 / 24000)))
                   for i in range(24000))
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(pcm)
    wav_bytes = buffer.getvalue()
    requests = []
    request_ready = threading.Event()

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            requests.append(body)
            request_ready.set()
            if body["input"] == "wait":
                time.sleep(4)  # Cancel before any audio callback can occur.
                return
            raw = body["response_format"] == "pcm"
            payload = pcm if raw else wav_bytes
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream" if raw else "audio/wav")
            self.end_headers()
            try:
                for offset in range(0, len(payload), 257):
                    self.wfile.write(payload[offset:offset + 257])
                    self.wfile.flush()
                    time.sleep(0.001)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}"

    def session(raw=False, cancelling=False):
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 100, 0, 0))
        env = dict(os.environ, TERM="xterm-256color", SDL_AUDIODRIVER="dummy")
        args = [cli, "tui", url, "test"] + (["24000", "1"] if raw else [])
        child = subprocess.Popen(args, stdin=slave, stdout=slave, stderr=slave, env=env)
        os.close(slave)
        output = bytearray()

        def until(marker, timeout=5):
            deadline = time.monotonic() + timeout
            while marker not in output and time.monotonic() < deadline:
                if select.select([master], [], [], 0.05)[0]:
                    try:
                        output.extend(os.read(master, 65536))
                    except OSError:
                        break
            assert marker in output, bytes(output[-3000:])

        try:
            until(b"VOICE DECK")
            assert b"lingCL" in output and b"WangSG" in output
            os.write(master, b"\te\x15" + (b"wait" if cancelling else "Hello 你好".encode()) + b"\n\n")
            if cancelling:
                assert request_ready.wait(3)
                os.write(master, b"q")
                child.wait(timeout=3)
            else:
                until(b"Playing")
                os.write(master, b" ")
                until(b"AUSED")  # curses may reuse the P from Playing.
                os.write(master, b" s")
                until(b"Stopped")
                os.write(master, b"\n")
                until(b"Finished", timeout=6)
                os.write(master, b"q")
                child.wait(timeout=3)
            assert child.returncode == 0
            body = requests[-1]
            expected = Path(__file__).parent / "voices/wangSG9s.wav"
            assert base64.b64decode(body["voice_ref"]["data"]) == expected.read_bytes()
            assert body["input"] == ("wait" if cancelling else "Hello 你好")
            if raw:
                assert body["stream_format"] == "audio"
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()
            os.close(master)

    try:
        session()
        session(raw=True)
        request_ready.clear()
        session(cancelling=True)
    finally:
        server.shutdown()
        server.server_close()
    print("PASS: TUI WAV/PCM playback, voice selection, UTF-8 editor, pause/stop/replay, cancellation")


if __name__ == "__main__":
    main()
