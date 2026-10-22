#!/usr/bin/env bash
set -Eeuo pipefail

# Incoming calls reuse pre-generated greetings in the native worker.
export SIP_CONTINUOUS=1

# Shared settings mode: the WebUI atomically replaces gateway.env. No file is
# sourced; exampleSIP parses literal values with its existing --env loader.
if [[ -n "${SIP_SETTINGS_DIR:-}" ]]; then
    mkdir -p "$SIP_SETTINGS_DIR"
    settings="$SIP_SETTINGS_DIR/gateway.env"
    heartbeat="$SIP_SETTINGS_DIR/worker.heartbeat"
    export AUDIOCPP_URL="${AUDIOCPP_URL:-http://127.0.0.1:8081}"
    export LLM_URL="${LLM_URL:-http://127.0.0.1:8082/v1}"
    export RAG_URL="${RAG_URL:-${AUDIOCPP_URL}/v1/rag}"
    export IVRTTS_VOICE_DIR="${IVRTTS_VOICE_DIR:-/opt/sip/share/voices}"
    export BARESIP_MODULE_PATH="${BARESIP_MODULE_PATH:-/opt/sip/lib/baresip/modules}"
    sip_pid=""
    stop_shared_sip() {
        trap - EXIT INT TERM
        rm -f "$heartbeat"
        if [[ -n "$sip_pid" ]]; then
            kill -TERM "$sip_pid" 2>/dev/null || true
            wait "$sip_pid" 2>/dev/null || true
        fi
        exit 0
    }
    trap stop_shared_sip EXIT INT TERM
    for url in "${AUDIOCPP_URL%/}/health" "${LLM_URL%/v1}/health"; do
        until curl -fsS --connect-timeout 3 --max-time 5 "$url" >/dev/null; do sleep 2; done
    done
    while true; do
        if [[ ! -s "$settings" ]]; then sleep 1; continue; fi
        revision="$(sha256sum "$settings")"
        # The shared file must override any old Compose account environment.
        env -u SIP_ACCOUNT -u SIP_PROXY -u SIP_SECRET -u SIP_AUTHUSER -u SIP_DISPLAY_NAME -u SIP_TARGET \
            stdbuf -oL -eL /opt/sip/bin/exampleSIP --env "$settings" --pipeline &
        sip_pid=$!
        while kill -0 "$sip_pid" 2>/dev/null; do
            touch "$heartbeat"
            sleep 1
            if [[ "$(sha256sum "$settings")" != "$revision" ]]; then
                echo "[sip] Gateway settings changed; restarting SIP registration"
                kill -TERM "$sip_pid" 2>/dev/null || true
                break
            fi
        done
        set +e
        wait "$sip_pid"
        status=$?
        set -e
        sip_pid=""
        rm -f "$heartbeat"
        if (( status != 0 )); then echo "[sip] Worker exited ($status); retrying in two seconds"; fi
        sleep 1
    done
fi

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
echo "[sip] HTTP workers ready; starting SIP client"
# Outgoing calls run once. Incoming calls reopen registration after normal
# hangup. Docker retries failures, and forwards SIGTERM for a clean SIP BYE.
if [[ "$SIP_TARGET" != listen ]]; then
    exec stdbuf -oL -eL /opt/sip/bin/exampleSIP --pipeline "$SIP_ACCOUNT" "$SIP_PROXY" "$SIP_TARGET"
fi
sip_pid=""
stopping=0
stop_sip() {
    stopping=1
    if [[ -n "$sip_pid" ]]; then kill -TERM "$sip_pid" 2>/dev/null || true; fi
}
trap stop_sip INT TERM
while (( ! stopping )); do
    stdbuf -oL -eL /opt/sip/bin/exampleSIP --pipeline "$SIP_ACCOUNT" "$SIP_PROXY" "$SIP_TARGET" &
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
