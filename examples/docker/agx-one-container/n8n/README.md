# GeoVision · Workflow

[workflow.json](workflow.json) contains three groups: **1. IVR Input → AI Agent → IVR Output**, **2. Knowledge MCP**, and **3. RAG · Q/A + Work Orders**. Groups 1 and 2 sit above group 3.

## One question, then save

1. Caller: **「我增加工单。」** (also 「新增工單」「我要回報工單」).
2. Assistant: **「工單日期、工單或設備編號、維修項目與數量是什麼？」**
3. Caller supplies the next response. **Save it immediately**, even if it omits the date, numbers or maintenance details.
4. Assistant: **「工單 GV-… 已新增。」**

There is exactly one follow-up question per new report. No second required-field question, confirmation phrase or normal-startup result is required. Unknown fields stay blank. Spoken dates/numbers and simplified/traditional Chinese are normalized for structured fields; raw transcripts are preserved. Later details and retries upsert the same row rather than creating duplicates. Explicit cancellation stops the report; lookup questions remain lookups.

The first question uses **Register caller turn → Fixed reply? → Return fixed reply → IVR Output**. It skips knowledge retrieval, embeddings and AI Agent inference; fresh explicit intake requests also skip LLM warm-up in the shared browser/SIP transport. The next caller response keeps the normal tool and Data Table save path. Original caller transcripts also ground the agent context, including intake turns that skipped inference.

The phase is determined from registered caller turns before the model runs. The flow works even when a local model refuses tool calling or asks unnecessary questions. The acknowledgment is produced only after the storage node successfully returns a saved row.

## Native n8n Data Table

New entries are stored in **n8n → your project → Data tables → `work_orders`**. The table is created automatically on the first workflow tool execution, using native **Ensure work_orders** (Data Table / Create, reuse existing).

- **Save work order · Data Table** upserts rows using a stable `report_key`.
- **Read work orders · Data Table** retrieves the saved rows for RAG and work-order queries.
- **Return saved work order** acknowledges persistence only after the native save node succeeds.

Columns are `order_id`, `report_key`, `session_id`, `dispatch_date`, `reference_number`, `title`, `equipment_number`, `maintenance_items`, `quantity`, `notes`, `test_result`, and `transcripts`. n8n adds its own row ID and creation/update timestamps. Identifiers and quantities use string columns to preserve leading zeros. `transcripts` contains the original caller turns as JSON text.

The table persists with the existing n8n database in `/home/node/.n8n`, backed by **audiocpp-n8n-data**. No separate database server or additional credential is needed.

New orders are no longer written to the knowledge service's JSON file. An existing `/data/work-orders.json` is retained read-only for recovery and legacy lookup; those old entries are not automatically copied into the Data Table UI. When IDs overlap, current Data Table values take precedence in lookup results. Bundled source documents have been removed; upload your own through Add New Scenario.

## Knowledge MCP and RAG

The MCP endpoint remains `/mcp/ivr-maintenance`; its server node is **Knowledge MCP Server**, with exactly two tools:

| Tool | Behavior |
|---|---|
| `retrieve_knowledge` | Read the Data Table and source-grounded Q/A or actual workbook dispatch records. |
| `add_work_order` | Prepare the caller's response and execute the native Data Table upsert branch in this same workflow. |

Both tools invoke **RAG tool input → Prepare tool request → Ensure work_orders**. A branch then either saves the work order or reads table rows and performs RAG. The main IVR flow's **Retrieve current turn** executes the server-selected tool deterministically.

Latest/oldest/all queries use fresh facts on every turn. Month-only follow-ups inherit the query, “this month” uses Asia/Taipei time, and month filtering happens before date ranking. Unambiguous spreadsheet dates such as `202611/06` normalize to `2026-11-06` for sorting with the original value retained. Replies are one line and do not ask for lookup details or confirmation. Missing dates are not fabricated for ranking.

The knowledge store starts empty. Upload your own DOCX, XLSX, CSV, PDF, TXT or Markdown through **Add New Scenario**. Uploaded source text and Q/A stay attributed; spreadsheet rows preserve their source values. The C++ multimodal worker reuses content-addressed vectors and ranks only the current corpus. `prompt.csv` remains the system prompt and is not indexed as work-order facts.

## Browser, SIP and deployment

Browser and SIP turns use `POST /webhook/ivr-agent` (browser proxy `/n8n/webhook/ivr-agent`). VAD/ASR and TTS/caller audio remain in audio.cpp. The UI receives workflow events, completed tool names and the spoken reply. Simple Memory keeps three exchanges per call; lookup results are refreshed every turn.

The Call greeting section provides an automatically saved wait-notice delay of 1–60 seconds (default 3), shared by browser and SIP. When a lookup remains pending for that duration (including model preparation), the shared client announces `查詢中，請稍後。` once while the workflow continues. Faster lookups stay silent. Browser and SIP audio play the notice before the final reply; the notice is excluded from dialogue history. Report saves do not announce a lookup. Browser and SIP transcripts use the same local Traditional Chinese and spoken-number normalization. Typed turns and scenarios can be sent during an active SIP IVR call; replies play back on the phone.

This is **workflow revision 22**. On your next deployment, rebuild the knowledge service for the new modules and recreate services as you normally do. Startup backs up the installed workflow, upgrades prior revisions, and preserves the existing chat model settings and registered scenario tools. Startup automatically publishes the installed **GeoVision · Workflow** at `http://127.0.0.1:5678/workflow/ivrWorkflow`. On a fresh instance, complete owner account setup once; import and publishing then continue automatically. Set `N8N_AUTO_PUBLISH_WORKFLOW=false` in `.env` to keep publishing manual. Startup publishes the current installed draft, including saved local edits, and skips unchanged published versions. Old `ivrMaintenanceMcp` installations migrate to this ID; the old workflow is unpublished to release its webhook routes and retained for recovery.

Local Chat Model uses **IVR local LLM**, Base URL `http://voice-ai:8082/v1`. Document retrieval uses the [multimodal models](../knowledge/README.md#visual-document-retrieval) configured in Compose.

## Local checks

```sh
node webui/native/tests/n8n-dialogue.mjs
node webui/native/tests/sip-n8n-dialogue.mjs
node webui/native/tests/n8n-bootstrap.mjs
node webui/native/tests/n8n-compose.mjs
python3 webui/native/tests/n8n-workflow-runtime.py
TEST_HTTP=1 npm test --prefix examples/docker/agx-one-container/knowledge
```

The runtime test starts/removes isolated n8n and knowledge containers using installed images. It verifies the actual native Data Table nodes and API-visible rows: zero rows after the opener, one row after the next response, saving incomplete responses without more questions, retries, enrichment and subsequent retrieval. Real source files are mounted read-only; LLM/embeddings and PDF OCR are synthetic. It also checks caller separation and workflow-ID migration. No live service is changed and no deployment images are built.

The `results` string column contains JSON with `transcripts` and `fields` (`派工單號`, `派工日期`, `維修內容`, `FAN數量`, `備註`, `起機測試`). Dates without a year use the current year in Asia/Taipei. Missing fields are empty strings. Caller work-order numbers are shown in acknowledgments and lookup summaries; the internal `order_id` remains stable for retries. Startup adds `results` if missing, backs up existing rows, and repairs missing work-order numbers and structured results from their saved transcripts through n8n's API. Internal IDs and raw transcripts are retained. n8n 2.46.6 permits only ASCII letters, digits, and underscores in column names; Traditional Chinese field labels are stored within the JSON.

Work-order content questions, identifier follow-ups such as `F15P1 呢？`, and `FAN幾個` retrieve fresh records without saving. Full identifiers retain `/`, `_`, and `-`. For multiple equipment lines, FAN quantities are grouped by equipment and fan type; repeated lines in later turns replace the same equipment/type rather than doubling the count. Structured results include `FAN明細` when multiple items are present.

In SIP IVR mode, the Streaming switch saves the selected TTS model and mode for the next turn. The bridge loads a streaming model context, and the native client decodes SSE PCM chunks and plays them over RTP before synthesis completes. Playback waits through stream gaps and resumes caller input only after the final chunk drains.

VAD now waits for 2000 ms of silence by default. The demo VAD section exposes `End-of-speech silence (ms)` (500–5000 ms), saved automatically for browser and SIP calls. Continuous utterances can last up to 60 seconds before the duration limit ends a turn.

## Add a scenario from documents

In the demo **Scenarios** dropdown, choose **Add New Scenario**, select PDF, DOCX, XLSX, CSV, TXT, Markdown, or HTML files, and press **Add scenario**. Up to eight files and 10 MiB total are accepted. Each file creates an n8n subworkflow and a tool in **Scenario MCP**. The filename stem becomes the subworkflow and table name. HTML imports keep their file extension so they can coexist with Word copies. Excel tables append the worksheet name, such as `CSD資料庫_派工`.

The production webhook `/webhook/ivr-import-scenario` imports one file at a time. Generated subworkflows read the live Data Tables and return original column labels. Word question-and-answer conversations become voice templates, and recognizable tables become rows. The tool flags tables that contain OCR results. The legacy reference upload at `/webhook/ivr-add-scenario` still produces indexed Q/A.

Original uploads and import metadata persist at `/data/scenarios/<id>/` in `audiocpp-knowledge-data`. Retrying the same upload resumes its import. `/webhook/ivr-scenarios` lists completed imports for the dropdown. Selecting a reference upload enables the n8n dialogue source.

Select an imported IVR simulation HTML and start a browser call with LLM enabled. After the saved greeting, the assistant asks for language, phone holder name, the last three digits of the employee number, the direct supervisor, and the reason for the call. It selects one of the seven supported flows from the caller's request. A generic work-order request prompts for details to distinguish maintenance from troubleshooting.

Maintenance and troubleshooting reports go through `/webhook/ivr-scenario-report`. The workflow reads back caller values as supplied and acknowledges saving after the native `work_orders` upsert succeeds. The row stores the report dialogue through confirmation and the structured report fields. The shared verification prompts and answers are excluded.

Dispatch and transfer are simulated. The local chat model handles those conversations. Inventory, SOP and fault-code questions retrieve evidence from the selected HTML section through the C++ multimodal RAG service. The standard n8n document route uses the same service across uploaded documents. See [visual document retrieval](../knowledge/README.md#visual-document-retrieval) for the models and upload formats.

Local upload/client checks: `node webui/native/tests/knowledge-scenarios.mjs`; the isolated n8n workflow runtime check also verifies upload, indexing retry, listing and a later caller question grounded in the uploaded file.

## Remove an uploaded scenario

On the demo page, select an uploaded scenario in **Scenario**, then click
**Remove scenario**. This calls `/webhook/ivr-delete-scenario` in the same
workflow and deletes the scenario's uploaded files, tool, generated subworkflow,
and owned tables. For legacy Q/A uploads, it removes their files and saved Q/A.
The dropdown contains your uploaded scenarios and the manual Audio input option.
