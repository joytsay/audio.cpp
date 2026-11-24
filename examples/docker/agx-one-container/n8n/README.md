# GeoVision · Workflow

Startup installs four editable workflows from the [bundled template](workflow.json).

| Workflow | Use it to edit |
|---|---|
| [GeoVision · Workflow](http://127.0.0.1:5678/workflow/ivrWorkflow) | Register caller turns, run the knowledge sub-workflow, and return spoken replies. |
| [GeoVision · Knowledge Tools](http://127.0.0.1:5678/workflow/ivrKnowledgeTools) | Direct sub-workflow for native work-order reads, saves, and structured lookups. |
| [GeoVision · Scenario Admin](http://127.0.0.1:5678/workflow/ivrScenarioAdmin) | Scenario uploads, imports, listings, and removals. |
| [GeoVision · Document RAG](http://127.0.0.1:5678/workflow/ivrDocumentRag) | Multimodal embedding, Qdrant search, and vision answers. Edit the shared Qdrant and embedding endpoints in **Prepare document RAG**. |

## One question, then save

1. Caller: **「我增加工单。」** (also 「新增工單」「我要回報工單」).
2. Assistant: **「工單日期、工單或設備編號、維修項目與數量是什麼？」**
3. Caller supplies the next response. **Save it immediately**, even if it omits the date, numbers or maintenance details.
4. Assistant: **「工單 GV-… 已新增。」**

There is exactly one follow-up question per new report. No second required-field question, confirmation phrase or normal-startup result is required. Unknown fields stay blank. Spoken dates/numbers and simplified/traditional Chinese are normalized for structured fields; raw transcripts are preserved. Later details and retries upsert the same row rather than creating duplicates. Explicit cancellation stops the report; lookup questions remain lookups.

The first question uses **Register caller turn → Fixed reply? → Return fixed reply → IVR Output**. It skips knowledge retrieval, embeddings and AI Agent inference; fresh explicit intake requests also skip LLM warm-up in the shared browser/SIP transport. The next caller response keeps the direct Data Table save path. Original caller transcripts also ground the agent context, including intake turns that skipped inference.

The phase is determined from registered caller turns before the model runs. The flow works even when a local model refuses tool calling or asks unnecessary questions. The acknowledgment is produced only after the storage node successfully returns a saved row.

## Native n8n Data Table

New entries are stored in **n8n → your project → Data tables → `work_orders`**. The table is created automatically on the first execution of the knowledge sub-workflow, using native **Ensure work_orders** (Data Table / Create, reuse existing).

- **Save work order · Data Table** upserts rows using a stable `report_key`.
- **Read work orders · Data Table** retrieves the saved rows for RAG and work-order queries.
- **Return saved work order** acknowledges persistence only after the native save node succeeds.

Columns are `order_id`, `report_key`, `session_id`, `dispatch_date`, `reference_number`, `title`, `equipment_number`, `maintenance_items`, `quantity`, `notes`, `test_result`, and `transcripts`. n8n adds its own row ID and creation/update timestamps. Identifiers and quantities use string columns to preserve leading zeros. `transcripts` contains the original caller turns as JSON text.

The table persists with the existing n8n database in `/home/node/.n8n`, backed by **audiocpp-n8n-data**. No separate database server or additional credential is needed.

New orders are no longer written to the knowledge service's JSON file. An existing `/data/work-orders.json` is retained read-only for recovery and legacy lookup; those old entries are not automatically copied into the Data Table UI. When IDs overlap, current Data Table values take precedence in lookup results. Bundled source documents have been removed; upload your own through Add New Scenario.

## Direct knowledge and RAG

**Retrieve current turn** executes the **Knowledge Tools** sub-workflow with the operation, query, and call ID already resolved. The sub-workflow either saves the report in the native Data Table or reads records and retrieves evidence through **Document RAG**. The reply uses the result from that execution.

Latest/oldest/all queries use fresh facts on every turn. Month-only follow-ups inherit the query, “this month” uses Asia/Taipei time, and month filtering happens before date ranking. Unambiguous spreadsheet dates such as `202611/06` normalize to `2026-11-06` for sorting with the original value retained. Replies are one line and do not ask for lookup details or confirmation. Missing dates are not fabricated for ranking.

The knowledge store starts empty. Upload your own DOCX, XLSX, CSV, PDF, TXT or Markdown through **Add New Scenario**. Uploaded source text and Q/A stay attributed; spreadsheet rows preserve their source values. The n8n document flow reuses vectors saved in Qdrant and ranks evidence from the current corpus. `prompt.csv` remains the system prompt and is not indexed as work-order facts.

## Browser, SIP and deployment

Browser and SIP turns use `POST /webhook/ivr-agent` (browser proxy `/n8n/webhook/ivr-agent`). VAD/ASR and TTS/caller audio remain in audio.cpp. The UI receives workflow events, completed n8n step names and the spoken reply. Simple Memory keeps three exchanges per call; lookup results are refreshed every turn.

The Call greeting section provides an automatically saved wait-notice delay of 1–60 seconds (default 3), shared by browser and SIP. When a lookup remains pending for that duration (including model preparation), the shared client announces `查詢中，請稍後。` once while the workflow continues. Faster lookups stay silent. Browser and SIP audio play the notice before the final reply; the notice is excluded from dialogue history. Report saves do not announce a lookup. Browser and SIP transcripts use the same local Traditional Chinese and spoken-number normalization. Typed turns and scenarios can be sent during an active SIP IVR call; replies play back on the phone.

Workflow revision 27 replaces the bundled MCP graph with direct execution. Startup backs up installed drafts, preserves model credentials, and updates each managed workflow independently. The work-order table, scenario uploads, and Qdrant volumes carry over. With automatic publishing disabled, publish **Knowledge Tools** before **GeoVision · Workflow**, then publish **Scenario Admin** and **Document RAG**. The production IVR and scenario webhook paths stay the same.

If you are also moving an existing standalone Qdrant into `knowledge`, rebuild `knowledge` and stop `ivr-qdrant` before recreating `knowledge`. Keep the `ivr-qdrant-data` volume.

Local Chat Model uses **IVR local LLM**, Base URL `http://voice-ai:8082/v1`. Document retrieval uses the [multimodal models](../knowledge/README.md#visual-document-retrieval) configured in Compose.

## Local checks

```sh
node webui/native/tests/n8n-dialogue.mjs
node webui/native/tests/sip-n8n-dialogue.mjs
node --test \
  webui/native/tests/ivr-opening.mjs
node webui/native/tests/n8n-bootstrap.mjs
node webui/native/tests/n8n-compose.mjs
python3 webui/native/tests/n8n-workflow-runtime.py
TEST_HTTP=1 npm test --prefix examples/docker/agx-one-container/knowledge
```

The opening test uses `~/Documents/scenarios/情境模擬_20261105.html` by default. Set
`IVR_SCENARIO_HTML` to use a different path. It tests all seven supported routes
in Chinese and English, requires at least 80% normalized text similarity for
each prompt, and writes a UTC timestamped `*-log.txt` in the working directory.
Set `IVR_TEST_LOG_DIR` to use a different log directory. Downstream n8n, chat and
retrieval replies use local fixtures.

The runtime test starts/removes isolated n8n and knowledge containers using installed images. It verifies the actual native Data Table nodes and API-visible rows: zero rows after the opener, one row after the next response, saving incomplete responses without more questions, retries, enrichment and subsequent retrieval. It also tests the real Document RAG workflow with a new HTML script, figure retrieval, cached vectors, indirect routing and a live-value follow-up. Model responses, embeddings, Qdrant and PDF OCR use test fixtures. No live service is changed and no deployment images are built.

The `results` string column contains JSON with `transcripts` and `fields` (`派工單號`, `派工日期`, `維修內容`, `FAN數量`, `備註`, `起機測試`). Dates without a year use the current year in Asia/Taipei. Missing fields are empty strings. Caller work-order numbers are shown in acknowledgments and lookup summaries; the internal `order_id` remains stable for retries. Startup adds `results` if missing, backs up existing rows, and repairs missing work-order numbers and structured results from their saved transcripts through n8n's API. Internal IDs and raw transcripts are retained. n8n 2.46.6 permits only ASCII letters, digits, and underscores in column names; Traditional Chinese field labels are stored within the JSON.

Work-order content questions, identifier follow-ups such as `F15P1 呢？`, and `FAN幾個` retrieve fresh records without saving. Full identifiers retain `/`, `_`, and `-`. For multiple equipment lines, FAN quantities are grouped by equipment and fan type; repeated lines in later turns replace the same equipment/type rather than doubling the count. Structured results include `FAN明細` when multiple items are present.

In SIP IVR mode, the Streaming switch saves the selected TTS model and mode for the next turn. The bridge loads a streaming model context, and the native client decodes SSE PCM chunks and plays them over RTP before synthesis completes. Playback waits through stream gaps and resumes caller input only after the final chunk drains.

VAD now waits for 2000 ms of silence by default. The demo VAD section exposes `End-of-speech silence (ms)` (500–5000 ms), saved automatically for browser and SIP calls. Continuous utterances can last up to 60 seconds before the duration limit ends a turn.

## Add a scenario from documents

In **Scenario → Add New Scenario**, select the source document and any companion images. The importer persists dialogue and evidence and creates native Data Tables for structured records. Imports share the four managed workflows. The HTML filename remains the scenario name.

For a custom HTML call script, write the opening before the first scenario heading. Use speaker labels such as `Assistant:` and `Caller:` or `AI：` and `維修人員：`. Use headings such as `Scenario 1: Returns`, `Scenario: Delivery` or `情境 1：派工`. The assistant plays the opening prompts in order in the script's authored language. After the opening, callers can select a scenario by name or number, or describe what they need. **Document RAG** ranks the uploaded references and asks the VLM to match an indirect request to a scenario. An unclear match prompts the caller to choose. Once routed, each turn retrieves text and figures only from that section and sends the recent conversation separately from the example dialogue.

The supplied seven-scenario HTML keeps its Chinese and English opening, the dispatch reminder from the file, and the existing work-order confirmation rules. A generic work-order request prompts for details to distinguish maintenance from troubleshooting.

Maintenance and troubleshooting reports go through `/webhook/ivr-scenario-report`. The workflow reads back caller values as supplied and acknowledges saving after the native `work_orders` upsert succeeds. The row stores the report dialogue through confirmation and the structured report fields. The shared verification prompts and answers are excluded.

Dispatch and transfer are simulated. The local chat model handles those conversations. Inventory, SOP and fault-code questions retrieve evidence from the selected HTML section through the n8n multimodal workflow. The standard n8n document route uses the same workflow across uploaded documents. See [visual document retrieval](../knowledge/README.md#visual-document-retrieval) for the models and upload formats.

Local upload/client checks: `node webui/native/tests/knowledge-scenarios.mjs`; the isolated n8n workflow runtime check also verifies upload, indexing retry, listing and a later caller question grounded in the uploaded file.

## Remove an uploaded scenario

On the demo page, select an uploaded scenario in **Scenario**, then click
**Remove scenario**. This calls `/webhook/ivr-delete-scenario` in the same
workflow and deletes the scenario's uploaded files and owned tables. It also cleans up a legacy generated workflow if the upload has one. For legacy Q/A uploads, it removes their files and saved Q/A.
The dropdown contains your uploaded scenarios and the manual Audio input option.
