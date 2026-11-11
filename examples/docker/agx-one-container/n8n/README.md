# GeoVision RAG and MCP

The voice assistant uses two n8n workflows:

| Workflow | Template | Editor |
|---|---|---|
| GeoVision · MCP | [maintenance-mcp-tools.json](maintenance-mcp-tools.json) | http://192.168.5.151:5678/workflow/ivrMaintenanceMcp |
| GeoVision · RAG | [maintenance-knowledge-rag.json](maintenance-knowledge-rag.json) | http://192.168.5.151:5678/workflow/ivrMaintenanceKnowledge |

ASR → local LLM → MCP tools → local LLM reply → TTS. ASR/TTS models and
streaming settings are unchanged. MCP uses Streamable HTTP at
`/mcp/ivr-maintenance`, exposed to the WebUI through `/n8n/mcp/ivr-maintenance`.
No instance-level MCP/OAuth or Python runner is required.

## Deploy or roll back the CRUD version

From `examples/docker/agx-one-container`, after syncing this code to the AGX:

```sh
docker compose up -d --build
docker compose restart n8n
```

Startup waits for owner setup, imports missing local credentials and the two
workflows, and checks existing workflows for migrations. Existing CRUD tools
are removed with a workflow backup saved under `/home/node/.n8n/ivr-backups`.
The RAG source is restored to `CSD資料庫.xlsx`. Republish **GeoVision · MCP**
and **GeoVision · RAG**, then reload the WebUI with Ctrl+Shift+R and select
**Dialogue source → n8n**.

The old CSV and transaction backups are left on disk; they are no longer mounted
or used. No source files are converted or changed. There is no work-order
subworkflow or database-writing endpoint.

## Tools

| Tool | Purpose |
|---|---|
| `lookup_maintenance_guidance` | Retrieve source passages and reporting rules through RAG |
| `get_report_draft` | Inspect the simulated draft reconstructed from this call's ASR |
| `read_back_maintenance` | Repeat reported equipment, items and quantities; end with 以上是否正確。 |
| `read_back_notes` | Repeat reported part/SN/date/capacitance pairings; ask for confirmation |
| `confirm_startup_test` | Return completion wording after the user confirms startup tested normally |

These tools do not create, edit or delete database records. Completion refers
to the conversation draft. All source documents are read-only.

Only approved maintenance tools are sent to the LLM, even if an older published
workflow still advertises CRUD tools. Tools are offered by stage to keep local
model prompts small. Initial tool selection has a 128-token limit and 5-second
model-request timeout, with no retry. Missing tool calls return and speak:
`我目前無法回答關於這個問題，請換個方式詢問。`
Model loading, MCP connection, retrieval and TTS are outside that selection
budget. Actual upstream errors are preserved for diagnosis.

## Knowledge sources

Place the original files in the AGX project root. They are mounted read-only
into `ivr-knowledge`; port 8085 is internal to Compose.

- `prompt.csv`: maintenance reporting rules.
- `情境模擬_20261105.docx`: examples, not actual work-order records.
- `CSD資料庫.xlsx`: every worksheet, including 派工、客戶設備、設備類型、通訊錄.
- `(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf`: PDF text or local Chinese/English OCR.

RAG uses Load knowledge files → Prepare guidance → Default Document Loader →
Recursive Text Splitter → Simple Vector Store → Retrieve guidance → Return guidance.
Local Embeddings uses `http://voice-ai:8084/v1` on the Compose network, so
changing the host's LAN address does not break embedding requests. The model
remains `Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0` (1024 dimensions). The local
credential is imported automatically for new installations.

For an existing installation, update both **Local Embeddings → Options → Base URL**
and its **IVR local embeddings** credential's Base URL to
`http://voice-ai:8084/v1`. Existing credentials and workflow edits are preserved
by bootstrap, so rebuilding containers alone does not replace an old LAN URL.
Save and republish the workflow after editing; keep chunking and top-K unchanged.
Do not replace existing embedding credentials or retrieval tuning unnecessarily.

Retrieved passages are not a complete work-order inventory. Do not treat a DOCX
example as a real record, infer newest/oldest without evidence, or trust OCR
codes/numbers without checking the original PDF.

For manual RAG testing, open the **Test query** Code node, edit its `query`, and
run **Test RAG**. The **RAG tool input** trigger expects a query from MCP; running
it with empty input correctly fails validation.

Office editors may replace files on save. Recreate the knowledge container
following external source-file replacements to refresh its file bind mounts:
`docker compose up -d --no-deps --force-recreate knowledge`.

## Checks

```sh
node webui/native/tests/n8n-dialogue.mjs
node webui/native/tests/n8n-bootstrap.mjs
node webui/native/tests/n8n-compose.mjs
TEST_HTTP=1 npm test --prefix examples/docker/agx-one-container/knowledge
```

Tests cover Scenario 1 readbacks, source validation, no-tool fallback, rollback
backups/idempotence, read-only mounts and rejection of source-writing requests.


## Direct query results

For newest/oldest/all dispatch questions, `Load knowledge files` passes the
current query to the existing read-only `/documents` endpoint. It selects actual
派工 rows by valid 派工日期, includes all rows tied at the selected date, and skips
reporting-rule documents and PDF OCR for this query. Invalid/missing dates are
counted and excluded from date sorting. `Return guidance` passes these selected
facts through the same RAG workflow, without replacing them with top-K rule text.
The LLM answers with the results, not tool names or reporting instructions.
This adds no CRUD tools, write endpoints or extra workflows. Republish RAG after
the automatic query/result wiring migration; embedding credentials and top-K
settings are preserved.
