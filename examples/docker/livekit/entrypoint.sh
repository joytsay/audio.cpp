#!/usr/bin/env bash
set -Eeuo pipefail
python -m uvicorn adapter:app --host 127.0.0.1 --port "${ADAPTER_PORT:-8095}" &
adapter_pid=$!
python -m uvicorn web:app --host 0.0.0.0 --port "${WEB_PORT:-8090}" &
web_pid=$!
python agent.py start &
agent_pid=$!
stop() {
    kill -TERM "$adapter_pid" "$web_pid" "$agent_pid" 2>/dev/null || true
    wait "$adapter_pid" "$web_pid" "$agent_pid" 2>/dev/null || true
}
trap stop EXIT
trap 'exit 0' TERM INT
set +e
wait -n "$adapter_pid" "$web_pid" "$agent_pid"
status=$?
exit "$status"
