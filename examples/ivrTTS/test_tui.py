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
    server_state = {"bad_catalog": False}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            assert self.path == "/v1/models"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if server_state["bad_catalog"]:
                self.wfile.write(b'{"data": broken JSON}')
                return
            models = [
                {"id": "asr", "family": "qwen3_asr", "task": "asr", "mode": "offline", "loaded": False},
                {"id": "test", "family": "zipvoice", "task": "clon", "mode": "offline", "loaded": False},
                {"id": "other", "family": "pocket_tts", "task": "tts", "mode": "offline", "loaded": True},
                {"id": "test-stream", "family": "voxcpm1", "task": "tts", "mode": "streaming", "loaded": False},
            ]
            self.wfile.write(json.dumps({"object": "list", "data": models}).encode())

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

    def session(raw=False, cancelling=False, picker=False):
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 100, 0, 0))
        env = dict(os.environ, TERM="xterm-256color", SDL_AUDIODRIVER="dummy")
        args = [cli, "tui", url, "test-stream" if raw else "test"] + (["24000", "1"] if raw else [])
        if picker:
            args = [cli, "tui", url]
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
            until(b"refreshed")
            assert b"lingCL" in output and b"WangSG" in output
            if picker:
                # Default speech model skips ASR; the picker lists it but rejects selection.
                os.write(master, b"mk\n")
                until(b"not a text-to-speech")
                os.write(master, b"\x1b")
                time.sleep(0.1)
                os.write(master, b"mjjj\npinvalid\n")
                until(b"Enter output RATE CHANNELS")
                os.write(master, b"\x1524000 1\n")
                until(b"PCM format saved")
                raw = True  # The selected model now uses the configured raw PCM path.
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
                if picker:
                    assert requests[-1]["model"] == "test-stream"
                    before = len(requests)
                    server_state["bad_catalog"] = True
                    output.clear()
                    os.write(master, b"r")
                    until(b"invalid model-list JSON")
                    server_state["bad_catalog"] = False
                    output.clear()
                    os.write(master, b"r")
                    until(b"refreshed")
                    assert len(requests) == before
                # History survives a new message and a model switch. Replay the older entry.
                if not raw:
                    request_ready.clear()
                    os.write(master, b"mj\nk\n")
                    assert request_ready.wait(3)
                    assert requests[-1]["model"] == "other"
                    assert requests[-1]["input"] == "Hello, welcome to our voice service."
                    time.sleep(1.5)
                    request_ready.clear()
                    os.write(master, b"j\n")
                    assert request_ready.wait(3)
                    assert requests[-1]["model"] == "other"
                    assert requests[-1]["input"] == "Hello 你好"
                    time.sleep(1.5)
                    # Add a multiline message; cancel a later draft without changing history.
                    request_ready.clear()
                    os.write(master, b"eFirst line\x0eSecond line\n\n")
                    assert request_ready.wait(3)
                    assert requests[-1]["input"] == "First line\nSecond line"
                    time.sleep(1.5)
                    request_ready.clear()
                    os.write(master, b"eDiscard this\x1b")
                    time.sleep(0.1)
                    os.write(master, b"\n")
                    assert request_ready.wait(3)
                    assert requests[-1]["input"] == "First line\nSecond line"
                    time.sleep(1.5)
                os.write(master, b"q")
                child.wait(timeout=3)
            assert child.returncode == 0
            body = requests[-1]
            expected = Path(__file__).parent / "voices/wangSG9s.wav"
            assert base64.b64decode(body["voice_ref"]["data"]) == expected.read_bytes()
            assert body["input"] == ("wait" if cancelling else "Hello 你好" if raw else "First line\nSecond line")
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
        session(picker=True)
        request_ready.clear()
        session(cancelling=True)
    finally:
        server.shutdown()
        server.server_close()
    print("PASS: model switching, chat history/replay, multiline drafts, WAV/PCM, pause/stop, cancellation")


if __name__ == "__main__":
    main()
