#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if (( $# < 1 || $# > 2 )); then
    echo 'Usage: ./analyze-rtp.sh CAPTURE.pcap [OUTPUT_DIRECTORY]' >&2
    exit 1
fi
capture="$(realpath -- "$1")"
[[ -f "$capture" ]] || { echo 'Capture file does not exist' >&2; exit 1; }
output="${2:-evidence-rtp}"
mkdir -p -- "$output"
output="$(realpath -- "$output")"
exec docker compose run --rm --no-deps --user "$(id -u):$(id -g)" \
    --entrypoint /opt/sip/bin/analyzeRTP \
    --volume "$capture:/capture.pcap:ro" --volume "$output:/evidence-rtp" \
    sip-test /capture.pcap --output /evidence-rtp
