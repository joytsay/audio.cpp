#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
# Reuse bootstrap to preserve existing credentials and back up legacy flows.
docker compose exec -T -u node n8n node /templates/bootstrap-local.mjs
printf '%s\n' 'Publish GeoVision · Workflow at http://127.0.0.1:5678/workflow/ivrWorkflow.'
