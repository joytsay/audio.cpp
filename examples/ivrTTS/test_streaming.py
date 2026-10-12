"""Test transport and playback plumbing without model weights or an audio device."""
import base64
import http.server
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import wave


def main():
    cli = str(Path(sys.argv[1]).resolve())
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        reference = root / "reference.wav"
        with wave.open(str(reference), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(24000)
            wav.writeframes(b"\x00\x00" * 100)
        wav_bytes = reference.read_bytes()
        received = root / "received"
        args_file = root / "player_args"
        player = root / "ffplay"
        player.write_text(
            "#!/usr/bin/env python3\n"
            "import os, sys\n"
            "from pathlib import Path\n"
            "Path(os.environ['PLAYER_ARGS']).write_text(' '.join(sys.argv[1:]))\n"
            "with open(os.environ['PLAYER_AUDIO'], 'wb', buffering=0) as out:\n"
            " while True:\n"
            "  data=os.read(0, 4096)\n"
            "  if not data: break\n"
            "  out.write(data)\n"
        )
        player.chmod(0o755)
        env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ["PATH"],
                   PLAYER_ARGS=str(args_file), PLAYER_AUDIO=str(received))
        requests = []
        early = threading.Event()

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                assert self.path == "/v1/audio/speech"
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                requests.append(body)
                if body["input"] == "fail":
                    self.send_response(503)
                    self.end_headers()
                    self.wfile.write(b'{"error":"server_busy"}')
                    return
                if body["input"] == "bad":
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error":"unexpected JSON"}')
                    return
                pcm = body["response_format"] == "pcm"
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream" if pcm else "audio/wav")
                self.end_headers()
                if pcm:
                    assert body["stream_format"] == "audio"
                    self.wfile.write(b"\x01\x02\x03")  # Deliberately split a sample.
                    self.wfile.flush()
                    # Require delivery to the player BEFORE sending the final buffer.
                    deadline = time.monotonic() + 5
                    while time.monotonic() < deadline:
                        if received.exists() and received.read_bytes() == b"\x01\x02\x03":
                            early.set()
                            break
                        time.sleep(0.01)
                    self.wfile.write(b"\x04")
                else:
                    self.wfile.write(wav_bytes[:5])  # Split the WAV identification header.
                    self.wfile.flush()
                    time.sleep(0.03)
                    self.wfile.write(wav_bytes[5:])

            def log_message(self, *args):
                pass

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}"

        def run(*args, success=True):
            result = subprocess.run([cli, *args], env=env, capture_output=True, text=True, timeout=15)
            assert (result.returncode == 0) == success, result.stderr
            return result

        try:
            text = 'Hello "quoted" \\ text\n你好'
            run("run", url, "test", str(root / "out.wav"), text, "alba")
            assert (root / "out.wav").read_bytes() == wav_bytes
            assert requests[-1]["input"] == text and requests[-1]["voice"] == "alba"
            run("play-clone", url, "test", text, str(reference), "transcript")
            assert received.read_bytes() == wav_bytes
            assert base64.b64decode(requests[-1]["voice_ref"]["data"]) == wav_bytes
            assert requests[-1]["reference_text"] == "transcript"
            received.unlink()
            run("stream", url, "test", "24000", "1", text)
            assert early.is_set(), "PCM was buffered until request completion"
            assert received.read_bytes() == b"\x01\x02\x03\x04"
            assert "-f s16le -ar 24000 -ch_layout 1c" in args_file.read_text()
            received.unlink()
            run("stream-clone", url, "test", "24000", "1", text, str(reference), "transcript")
            assert "voice_ref" in requests[-1]
            for voice, basename in [(None, "lingCLvocals"), ("WangSG", "wangSG9s")]:
                received.unlink(missing_ok=True)
                args = ["play", url, "test", text]
                if voice:
                    args.append(voice)
                run(*args)
                preset_path = Path(__file__).parent / "voices" / (basename + ".wav")
                assert base64.b64decode(requests[-1]["voice_ref"]["data"]) == preset_path.read_bytes()
                assert requests[-1]["reference_text"]
                assert "voice" not in requests[-1]
            received.unlink()
            failure = run("play", url, "test", "fail", success=False)
            assert "503" in failure.stderr and "server_busy" in failure.stderr
            assert not received.exists(), "HTTP error forwarded to player"
            run("play", url, "test", "bad", success=False)
            assert not received.exists(), "JSON forwarded to player"
            run("stream", url, "test", "24000;echo unsafe", "1", text, success=False)
            player.write_text("#!/bin/sh\nexit 1\n")
            run("play", url, "test", text, success=False)
        finally:
            server.shutdown()
            server.server_close()
    print("PASS: WAV/PCM callbacks, incremental playback, cloning, HTTP errors, player failures")


if __name__ == "__main__":
    main()
