#!/bin/sh
set -eu
node /templates/sip-dialogue-server.mjs &
echo '[ivr-n8n] Starting automatic workflow setup and publishing.'
node /templates/bootstrap-local.mjs &
exec /docker-entrypoint.sh "$@"
