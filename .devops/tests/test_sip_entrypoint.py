#!/usr/bin/env python3
"""Check SIP container lifecycle without Docker, a PBX, or model downloads."""
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time

source = Path(__file__).resolve().parents[1] / "sip-entrypoint.sh"
with tempfile.TemporaryDirectory(prefix="sip-entrypoint-") as directory:
    root = Path(directory)
    curl = root / "curl"
    curl.write_text("#!/bin/sh\nexit 0\n")
    curl.chmod(0o755)
    client = root / "exampleSIP"
    client.write_text('''#!/bin/sh
[ "$1" = --pipeline ] && [ "$2" = sip:test@example.test ] && [ "$3" = sip:example.test ] || exit 2
[ "$AUDIOCPP_URL" = http://127.0.0.1:8081 ] && [ "$BARESIP_MODULE_PATH" = /opt/sip/lib/baresip/modules ] || exit 3
printf 'call\\n' >> "$TEST_CALLS"
case "$TEST_MODE" in
    fail) exit 7 ;;
    wait) trap 'exit 0' TERM; while :; do sleep 0.1; done ;;
    *) exit 0 ;;
esac
''')
    client.chmod(0o755)
    entry = root / "entry.sh"
    entry.write_text(source.read_text().replace("/opt/sip/bin/exampleSIP", str(client)))
    env = os.environ.copy()
    env.update(PATH=f"{root}:{env['PATH']}", SIP_ACCOUNT="sip:test@example.test",
               SIP_PROXY="sip:example.test", SIP_SECRET="test-secret", LLM_MODEL="test",
               TEST_CALLS=str(root / "calls"), TEST_MODE="once", SIP_TARGET="sip:other@example.test")
    result = subprocess.run(["bash", str(entry)], env=env, capture_output=True, text=True, timeout=5)
    assert result.returncode == 0, result.stderr
    assert (root / "calls").read_text().splitlines() == ["call"]
    env.update(SIP_TARGET="listen", TEST_MODE="fail")
    result = subprocess.run(["bash", str(entry)], env=env, capture_output=True, text=True, timeout=5)
    assert result.returncode == 7, result.stderr
    (root / "calls").unlink()
    env["TEST_MODE"] = "once"
    process = subprocess.Popen(["bash", str(entry)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if (root / "calls").exists() and len((root / "calls").read_text().splitlines()) >= 2:
                break
            time.sleep(0.05)
        assert len((root / "calls").read_text().splitlines()) >= 2, "incoming calls did not restart"
    finally:
        process.send_signal(signal.SIGTERM)
        process.communicate(timeout=5)
    env["TEST_MODE"] = "wait"
    (root / "calls").unlink()
    process = subprocess.Popen(["bash", str(entry)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        deadline = time.monotonic() + 5
        while not (root / "calls").exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert (root / "calls").exists(), "SIP client did not start"
        process.send_signal(signal.SIGTERM)
        process.communicate(timeout=5)
        assert process.returncode == 0, "SIP client did not stop cleanly"
    finally:
        if process.poll() is None:
            process.kill()
            process.communicate()
    del env["SIP_ACCOUNT"]
    result = subprocess.run(["bash", str(entry)], env=env, capture_output=True, text=True, timeout=5)
    assert result.returncode != 0 and "SIP_ACCOUNT" in result.stderr
    assert "test-secret" not in result.stderr
print("PASS: SIP readiness, configuration, incoming-call loop, outgoing call, failures and SIGTERM")
