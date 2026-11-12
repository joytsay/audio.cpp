#!/bin/sh
set -eu
node /templates/sip-dialogue-server.mjs &
echo '[ivr-n8n] Starting automatic Scenario 1 setup.'
node /templates/bootstrap-local.mjs &
exec /docker-entrypoint.sh "$@"
