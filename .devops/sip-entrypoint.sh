#!/usr/bin/env bash
set -Eeuo pipefail

for key in SIP_ACCOUNT SIP_PROXY SIP_SECRET LLM_MODEL; do
    if [[ -z "${!key:-}" ]]; then
        echo "[sip] Set $key in examples/docker/agx-one-container/.env" >&2
        exit 1
    fi
done
if [[ "$SIP_SECRET" == REPLACE_WITH_TEST_ACCOUNT_PASSWORD || "$LLM_MODEL" == REPLACE_WITH_REGISTERED_LLM_ID ]]; then
    echo "[sip] Replace the SIP password and LLM model placeholders in .env" >&2
    exit 1
fi
export SIP_TARGET="${SIP_TARGET:-listen}"
export AUDIOCPP_URL="${AUDIOCPP_URL:-http://127.0.0.1:8081}"
export LLM_URL="${LLM_URL:-http://127.0.0.1:8082/v1}"
export RAG_URL="${RAG_URL:-${AUDIOCPP_URL}/v1/rag}"
export IVRTTS_VOICE_DIR="${IVRTTS_VOICE_DIR:-/opt/sip/share/voices}"
export BARESIP_MODULE_PATH="${BARESIP_MODULE_PATH:-/opt/sip/lib/baresip/modules}"
# Wait for HTTP workers after a restart. Model installation can continue through
# the WebUI; HTTP readiness does not mean every model has finished downloading.
for url in "${AUDIOCPP_URL%/}/health" "${LLM_URL%/v1}/health"; do
    until curl -fsS --connect-timeout 3 --max-time 5 "$url" >/dev/null; do
        echo "[sip] Waiting for $url"
        sleep 2
    done
done
# Outgoing calls run once. Incoming calls reopen registration after normal
# hangup. Docker retries failures, and forwards SIGTERM for a clean SIP BYE.
if [[ "$SIP_TARGET" != listen ]]; then
    exec /opt/sip/bin/exampleSIP --pipeline "$SIP_ACCOUNT" "$SIP_PROXY" "$SIP_TARGET"
fi
sip_pid=""
stopping=0
stop_sip() {
    stopping=1
    if [[ -n "$sip_pid" ]]; then kill -TERM "$sip_pid" 2>/dev/null || true; fi
}
trap stop_sip INT TERM
while (( ! stopping )); do
    /opt/sip/bin/exampleSIP --pipeline "$SIP_ACCOUNT" "$SIP_PROXY" "$SIP_TARGET" &
    sip_pid=$!
    set +e
    wait "$sip_pid"
    status=$?
    set -e
    if (( stopping )); then
        wait "$sip_pid" 2>/dev/null || true
        exit 0
    fi
    sip_pid=""
    if (( status != 0 )); then exit "$status"; fi
    echo "[sip] Call finished; waiting for the next caller"
    sleep 1
done
