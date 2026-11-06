# Maintenance voice assistant with n8n MCP tools

Selecting **Dialogue source → n8n** in the demo now uses this flow:

```text
ASR → local LLM ↔ MCP client ↔ n8n MCP Server Trigger → maintenance tools
          ↓                                              ↓
         TTS                                  Simple Vector Store RAG
```

The local LLM chooses tools, receives their results, and generates the final
spoken reply. The demo no longer sends the whole turn to a reply-generating
n8n webhook. ASR and TTS retain their existing models and streaming settings.
The MCP client/tool loop runs in the existing TypeScript WebUI; model inference
remains in the C++ servers. n8n tool code is JavaScript. No Python is required.
This conversion applies to the WebUI demo, not the separate SIP client.

## Deploy

From `examples/docker/agx-one-container` on the AGX, with the existing `.env`:

```sh
docker compose up -d --build
```

Automatic setup waits for the n8n owner account, then imports the local
credentials and these three workflows, preserving any existing edits:

| Workflow | File | Editor |
|---|---|---|
| IVR Maintenance Knowledge · RAG Tool | [maintenance-knowledge-rag.json](maintenance-knowledge-rag.json) | `http://192.168.5.151:5678/workflow/ivrMaintenanceKnowledge` |
| IVR Work Orders · CSD workbook | [work-orders.json](work-orders.json) | `http://192.168.5.151:5678/workflow/ivrWorkOrders` |
| IVR Maintenance MCP Tools | [maintenance-mcp-tools.json](maintenance-mcp-tools.json) | `http://192.168.5.151:5678/workflow/ivrMaintenanceMcp` |

**Publish all three workflows**, then select **n8n** in the demo's Dialogue source
and save model settings. Use a local model with tool/function-call support
and a compatible chat template, for example the configured Qwen2.5 Instruct
model. Models that omit tool calls or reject the tools API produce a visible
error; the application does not silently fall back to the old webhook.

Run **Scenario 1** or send the Scenario 2 recordings to test the complete flow.
The Events panel records `MCP_TOOL_STARTED`, `MCP_TOOL_COMPLETED`, and
`MCP_TOOL_FAILED`. A report or notes turn should call guidance and the matching
readback tool before speech is synthesized.

The existing `scenario-1-rag.json` remains a legacy webhook example. Existing
copies are not deleted or overwritten; automatic setup now imports the MCP
workflows instead. It is not the endpoint used by the demo's n8n option.

## Prefilled endpoints

| Service | Address |
|---|---|
| n8n editor | `http://192.168.5.151:5678` |
| Audio API | `http://192.168.5.151:8081` |
| Local LLM | `http://192.168.5.151:8082/v1` |
| Local embeddings | `http://192.168.5.151:8084/v1` |
| Maintenance MCP production URL | `http://192.168.5.151:5678/mcp/ivr-maintenance` |
| Same-origin HTTPS MCP URL | `https://192.168.5.151:8083/n8n/mcp/ivr-maintenance` |

The browser uses the relative same-origin MCP URL through Caddy. Caddy forwards
MCP sessions and flushes SSE responses immediately. Vite also proxies `/n8n`
to local port 5678 for development.

The MCP Server Trigger is **version 2**, using Streamable HTTP at
`/mcp/ivr-maintenance`. It does not use the older `/sse` transport, the legacy
`/webhook/ivr-scenario-1` endpoint, or the instance-management endpoint
`/mcp-server/http`. Instance-level MCP access and Codex OAuth are not needed
for the voice assistant. This follows the workflow-level MCP Server Trigger
pattern, as in the restaurant example.

Authentication is set to **None** for the existing LAN demo, matching the old
webhook. This workflow exposes only the supplied maintenance tools; it does
not expose n8n administration. If you add authentication, keep tokens on a
server-side proxy rather than embedding them in the WebUI bundle.

## Tools and conversation state

| Tool | Behavior |
|---|---|
| `lookup_maintenance_guidance` | Calls the RAG subworkflow to retrieve reporting rules. |
| `list_work_orders` | Returns all dispatch rows from CSD資料庫.xlsx / 派工, with provenance. |
| `get_report_draft` | Returns the simulated draft reconstructed from this call's user transcripts. |
| `read_back_maintenance` | Reads back the reported equipment, work, and quantities, ending with `以上是否正確。` |
| `read_back_notes` | Groups matching parts while preserving each SN/date/capacitance pairing, ending with `以上是否正確。` |
| `confirm_startup_test` | Requires the current user transcript to confirm a normal start-up test, then uses the actual work-order title for the completion reply. |

For every maintenance Code Tool call, the client binds a `context` object with
`sessionId`, `current`, and `user_transcripts`. It removes this field from the
schema shown to the LLM and replaces any attempted model-supplied context with
the actual call data. This prevents the model from substituting sample codes,
serials, or numbers in the tool's source transcript. Assistant messages are not
used as maintenance facts.

Drafts are reconstructed from the current call history, not stored in a shared
cross-call variable. These are simulated reports, consistent with Scenario 1;
no external ticket is created or updated. Completion tools reject a call when
the user has not confirmed a normal test. The tools return `proposed_reply`
and state information to the LLM; the final reply still goes through the local
LLM rather than being replaced by a browser template.

For work-order listing queries such as `有哪些工單` or the ASR variant
`有哪些公單`, the client first offers `list_work_orders` when that tool is
available, falling back to `get_report_draft` only on older workflows. This keeps process-guidance retrieval from
being mistaken for a work-order database. Workbook inventory and current-call drafts are separate scopes; the reply
must identify which source was queried.
If the model initially emits prose instead of a required tool call, the client
retries once with an explicit tool-use reminder before reporting failure.

## RAG components and file sources

The knowledge workflow reads the actual project-root files:

1. `prompt.csv` — maintenance rules / SOP text.
2. `情境模擬_20261105.docx` — Word scenario examples, labelled as examples.
3. `CSD資料庫.xlsx` — every worksheet: 派工、客戶設備、設備類型、通訊錄.
4. `(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf` — the supplied scanned work report.

Ensure all four files also exist in the **AGX project root**. Word/Excel files
may be ignored by Git, so syncing code alone might not copy them. Compose mounts
the files read-only into `ivr-knowledge`; it refuses to create substitute
folders for missing files. Node.js reads Word/Excel and UTF-8 text; Poppler and
Tesseract provide local Traditional Chinese + English OCR for scanned PDFs.
No Python service is used. See [local extraction details](../knowledge/README.md).

```text
RAG tool input → Load knowledge files (http://knowledge:8085/documents)
                      ↓
                Prepare guidance → Seed Simple Vector Store → Retrieve guidance → Return guidance
                                      ↑ Document Loader        ↑ Local Embeddings
                                      ↑ Recursive Text Splitter
                                      ↑ Local Embeddings
```

The Default Document Loader, Recursive Text Splitter, Local Embeddings, and
Simple Vector Store remain native n8n components. Extracted text includes file,
sheet and row identifiers. `Return guidance` includes retrieved passages and
source metadata, including OCR/scenario-example labels. The existing execution
`/executions/1` is a historical run; open the editor and inspect a **new** execution
after deploying and publishing the updated workflow.

The supplied PDF is handwritten and has no text layer. OCR was tested, but its
recognition is incomplete and can misread codes or quantities. Results explicitly
require checking the original image. DOCX example values must not be used to
fill missing PDF details or treated as real workbook orders.

On each RAG call, the extractor checks file metadata and reuses unchanged
extraction (including OCR). Changed files are read again. n8n reloads the corpus
into its memory-only Simple Vector Store. Consequently in-place edits to source files do not require editing Code nodes
or rebuilding the image. Office editors often replace files when saving; after
such saves, run `docker compose up -d --no-deps --force-recreate knowledge` so
Docker remounts the new files. Changing file mounts also requires recreation. Larger corpora
should use separate ingestion and persistent vector storage.

For **complete work-order listings**, the `list_work_orders` MCP tool calls the
`IVR Work Orders · CSD workbook` subworkflow, which reads all rows from `派工`
through `http://knowledge:8085/work-orders`. The current workbook contains 12
dispatch rows. This avoids presenting a top-K RAG result as a complete inventory.
The model receives file/sheet/row provenance. `get_report_draft` continues to
represent only the current call, not the workbook inventory.

The local embedding model defaults to `Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0`.
Its credential is imported from `local-credentials.json`, using the dummy key
`local` and local port 8084. The local LLM remains selected in the IVR sidebar.

### Upgrade an existing published workflow

`docker compose up -d --build` starts the extractor and runs automatic setup.
For the older bundled RAG source and MCP tools, setup backs up the existing
workflow under `/home/node/.n8n/ivr-backups`, updates only the file-source/tool
wiring, and preserves embedding credentials and retrieval settings. The new
work-order subworkflow is imported automatically. **Republish Knowledge and
MCP Tools, and publish Work Orders** after the migration. Existing custom
workflows that no longer have the bundled source nodes can be updated manually
by importing the supplied templates after exporting edits to keep.

Test questions:

- `有哪些工單？` → `list_work_orders`, sourced from CSD's 派工 sheet.
- `情境模擬文件中的工單回報，確認內容時應該怎麼回答？` → RAG over the Word examples and prompt.
- `CSD 裡美光 MTB 的設備型號有哪些？` → RAG over the 客戶設備 sheet.
- `PDF 工單上有哪些維修項目？請註明 OCR 不確定的內容。` → PDF OCR, with uncertainty stated.

Inspect `Load knowledge files` for seven logical documents (prompt, Word, four
Excel sheets, PDF), `Retrieve guidance` for matching chunks/scores, and
`Return guidance` for passages/source metadata. Extractor startup/errors appear
in `docker compose logs knowledge`.

## Tune and extend

- Edit **Maintenance MCP Server → Instructions** for tool-use guidance. The
  client includes these instructions in the LLM's conversation.
- Edit the four mounted source files to change the knowledge text.
- Edit Code Tool descriptions and JavaScript to change maintenance behavior.
- Add tools connected to the MCP Server Trigger's tool connector. The client
  discovers tools on each turn, so published changes appear without a UI rebuild.
- Preserve the reserved `context` parameter on tools that need authoritative ASR
  data. It is injected by the voice client, not generated by the LLM.

The client initializes an MCP session, lists tools (including paginated lists),
and executes function calls sequentially. Tool results and call IDs are returned
to the local LLM until it produces a final reply. Each turn is bounded to eight
LLM rounds and sixteen tool calls, honors hang-up cancellation, and closes its
MCP session. Protocol and tool failures are surfaced instead of claiming work
was completed.

## Automatic setup and troubleshooting

```sh
docker compose logs -f n8n
```

Startup must log `[ivr-n8n] Starting automatic Scenario 1 setup`, then owner
readiness/import progress, and finally `Scenario 1 is ready`. Setup verifies
missing entities on every boot, even if a completion marker exists, and never
overwrites existing workflow or credential edits. Create the owner account if
setup is waiting for it. The optional `./n8n/install-local.sh` explicitly resets
the supplied credentials/workflows and should only be used after exporting edits
you want to keep.

If startup changes have not been applied, recreate n8n without a GPU rebuild:

```sh
docker compose up -d --no-deps --force-recreate n8n
```

A 404 at the maintenance MCP URL generally means the MCP tools workflow has not
been published, or the new Caddy configuration has not been applied. A local
LLM error mentioning tools means that its model/chat template needs tool-call
support. An RAG tool failure should be checked against the knowledge workflow's
publish state, Local Embeddings credential, and embedding worker on port 8084.

`scenario-1-turns.json` contains the original three turns and expected readbacks.
Tests cover JSON/SSE MCP responses, session headers, tool discovery/calls, real
maintenance tool code, context binding, cancellation, failures, and the local
LLM/tool/TTS loop in the browser. They use mocked services; publishing and a live
n8n execution must still be checked on the AGX.

### Editor cannot connect after a Compose update

n8n must keep the `audiocpp-n8n-data:/home/node/.n8n` database mount and the
`./n8n:/templates:ro` startup/template mount. The four document mounts belong
only to the `knowledge` service. The n8n editor starts independently of document
extraction readiness, so a missing document cannot block opening the editor.
Apply corrected mount/entrypoint settings without rebuilding model servers:

```sh
docker compose up -d --no-deps --force-recreate n8n
docker compose ps n8n
docker logs --tail 30 ivr-n8n
```

Then open `http://192.168.5.151:5678`. The existing named database volume is
retained, including the owner account and saved workflows.
