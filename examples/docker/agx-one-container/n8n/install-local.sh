#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
# Import fixed IDs so the workflow's credential references resolve automatically.
# These credentials contain only the dummy key for local unauthenticated servers.
docker compose exec -T -u node n8n n8n import:credentials --input=/templates/local-credentials.json
docker compose exec -T -u node n8n n8n import:workflow --input=/templates/maintenance-knowledge-rag.json
docker compose exec -T -u node n8n n8n import:workflow --input=/templates/work-orders.json
docker compose exec -T -u node n8n n8n import:workflow --input=/templates/maintenance-mcp-tools.json
printf '%s\n' 'Publish http://192.168.5.151:5678/workflow/ivrMaintenanceKnowledge , http://192.168.5.151:5678/workflow/ivrWorkOrders and http://192.168.5.151:5678/workflow/ivrMaintenanceMcp.'
