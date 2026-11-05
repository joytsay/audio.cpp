#!/bin/sh
set -eu
echo '[ivr-n8n] Starting automatic Scenario 1 setup.'
node /templates/bootstrap-local.mjs &
exec /docker-entrypoint.sh "$@"
