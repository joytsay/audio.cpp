#!/usr/bin/env bash
# Explicit live verification against OpenSIPS using authorized accounts 520/521.
set -Eeuo pipefail
cd "$(dirname "$0")"
mkdir -p evidence
attempts="${SIP_VERIFY_ATTEMPTS:-3}"
case "$attempts" in ''|*[!0-9]*) echo 'SIP_VERIFY_ATTEMPTS must be a positive integer' >&2; exit 2 ;; esac
(( attempts > 0 && attempts <= 10 )) || { echo 'Use between 1 and 10 attempts' >&2; exit 2; }
caller_container=""
cleanup_caller() {
    if [[ -n "$caller_container" ]]; then
        docker rm -f "$caller_container" >/dev/null 2>&1 || true
        caller_container=""
    fi
}
trap cleanup_caller EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for (( attempt=1; attempt<=attempts; attempt++ )); do
    # Allow the listener to complete unregister/re-register after the previous call.
    sleep 1
    started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "External SIP verification attempt $attempt/$attempts: 520 -> 521, #1 then #2"
    caller_container="sip-received-$(id -u)-$$-$attempt-$(date +%s)"
    call_status=0
    docker compose --profile verify run --name "$caller_container" --no-deps caller 2>&1 | tee "evidence/caller-$attempt.log" || call_status=$?
    recording="evidence/received-520-attempt-$attempt.wav"
    recording_saved=0
    # The receive stream is finalized when the caller exits. Copy it BEFORE
    # removing the stopped container; no writable host mount/UID matching needed.
    if docker cp "$caller_container:/tmp/received-520.wav" "$recording"; then
        riff="$(od -An -tx1 -N4 "$recording" | tr -d ' \n')"
        wave="$(od -An -tx1 -j8 -N4 "$recording" | tr -d ' \n')"
        if [[ "$riff" == 52494646 && "$wave" == 57415645 ]]; then
            recording_saved=1
            echo "Saved decoded 520 receive audio: $recording"
        else
            mv "$recording" "${recording%.wav}.pcm"
            echo 'Caller image produced raw PCM instead of WAV. Rebuild the SIP image before retrying.' >&2
        fi
    else
        echo 'No receive WAV could be retrieved from this caller.' >&2
    fi
    cleanup_caller
    if (( call_status == 0 && recording_saved )); then
        docker compose logs --since "$started" --no-color sip-test > "evidence/worker-$attempt.log"
        frames="$(awk '/Audible received frames:/ { print $NF }' "evidence/caller-$attempt.log" | tail -1)"
        first="$(awk '/Test greeting 1 audible frames:/ { print $NF }' "evidence/caller-$attempt.log" | tail -1)"
        second="$(awk '/Test greeting 2 audible frames:/ { print $NF }' "evidence/caller-$attempt.log" | tail -1)"
        if grep -Fq 'Caller pressed #1; starting greeting (lingCL).' "evidence/worker-$attempt.log" &&
           grep -Fq 'Caller pressed #2; starting greeting (WangSG).' "evidence/worker-$attempt.log" &&
           [[ "$frames" =~ ^[0-9]+$ && "$first" =~ ^[0-9]+$ && "$second" =~ ^[0-9]+$ ]] &&
           (( first >= 50 && second >= 50 )); then
            cp "$recording" evidence/received-520.wav
            echo "Received call WAV: $(pwd)/evidence/received-520.wav"
            echo "PASS: 520 reached 521 through the external SIP server; both greetings played; caller received $frames audible frames."
            exit 0
        fi
    fi
    echo 'Not passed: inspecting the next live call; evidence remains in ./evidence.' >&2
    sleep 2
done
echo 'FAIL: no verified call. Inspect evidence/caller-*.log and evidence/worker-*.log.' >&2
exit 1
