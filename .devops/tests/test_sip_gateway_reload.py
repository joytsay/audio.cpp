#!/usr/bin/env python3
"""Exercise WebUI settings reload and shutdown without contacting a SIP gateway."""
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


def wait_for(predicate, message):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.05)
    raise AssertionError(message)


with tempfile.TemporaryDirectory(prefix="sip-gateway-reload-") as directory:
    root = Path(directory)
    (root / "curl").write_text("#!/bin/sh\nexit 0\n")
    (root / "curl").chmod(0o755)
    client = root / "exampleSIP"
    client.write_text('''#!/bin/sh
[ "$SIP_CONTINUOUS" = 1 ] || exit 4
[ "$1" = --env ] && [ "$#" = 2 ] || exit 2
[ "$SIP_MONITOR_DIR" = "$SIP_SETTINGS_DIR" ] || exit 5
[ -z "${SIP_INTERFACE+x}" ] && [ -z "${SIP_MODE+x}" ] || exit 6
# Compose credentials must not shadow the settings file.
[ -z "${SIP_ACCOUNT+x}" ] && [ -z "${SIP_SECRET+x}" ] || exit 3
cat "$2" >> "$TEST_CALLS"
printf 'started\\n' >> "$TEST_CALLS"
trap 'exit 0' TERM
while :; do sleep 0.1; done
''')
    client.chmod(0o755)
    entry = root / "entry.sh"
    source = Path(__file__).resolve().parents[1] / "sip-entrypoint.sh"
    entry.write_text(source.read_text().replace("/opt/sip/bin/exampleSIP", str(client)))
    settings = root / "settings"
    calls = root / "calls"
    env = os.environ.copy()
    env.update(PATH=f"{root}:{env['PATH']}", SIP_SETTINGS_DIR=str(settings),
               TEST_CALLS=str(calls), SIP_ACCOUNT="old-account", SIP_SECRET="old-secret",
               SIP_INTERFACE="obsolete-interface", SIP_MODE="pipeline")
    process = subprocess.Popen(["bash", str(entry)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        wait_for(settings.exists, "shared directory was not created")
        time.sleep(0.2)
        assert not calls.exists(), "worker started before settings were saved"
        (settings / "gateway.env").write_text('SIP_ACCOUNT="sip:521@first.test"\n')
        wait_for(lambda: calls.exists() and "first.test" in calls.read_text(), "saved settings were not loaded")
        wait_for(lambda: (settings / "worker.heartbeat").exists(), "worker heartbeat missing")
        (settings / "gateway.env.tmp").write_text('SIP_ACCOUNT="sip:521@second.test"\n')
        (settings / "gateway.env.tmp").replace(settings / "gateway.env")
        wait_for(lambda: "second.test" in calls.read_text(), "worker did not restart with updated settings")
        (settings / "gateway.env").write_text('SIP_ENABLED="0"\n')
        wait_for(lambda: not (settings / "worker.heartbeat").exists(), "disable did not stop worker")
        count = calls.read_text().count("started")
        time.sleep(1.3)
        assert calls.read_text().count("started") == count, "disabled worker restarted"
        (settings / "gateway.env").write_text('SIP_ENABLED="1"\nSIP_MODE="tts"\nSIP_ACCOUNT="sip:521@echo.test"\n')
        wait_for(lambda: "echo.test" in calls.read_text(), "echo mode did not start after enabling")
        wait_for(lambda: (settings / "worker.heartbeat").exists(), "enabled worker has no heartbeat")
        process.send_signal(signal.SIGTERM)
        output, errors = process.communicate(timeout=5)
        assert process.returncode == 0, errors.decode()
        assert not (settings / "worker.heartbeat").exists(), "heartbeat survived shutdown"
        assert b"old-secret" not in output + errors
    finally:
        if process.poll() is None:
            process.send_signal(signal.SIGTERM)
            process.communicate(timeout=5)
print("PASS: shared settings, credential precedence, reload, heartbeat and clean shutdown")
