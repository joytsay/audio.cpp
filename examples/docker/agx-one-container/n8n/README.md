# GeoVision · Workflow

Startup installs three editable workflows from the [bundled template](workflow.json).

| Workflow | Use it to edit |
|---|---|
| [GeoVision · Workflow](http://127.0.0.1:5678/workflow/ivrWorkflow) | IVR call turns and saving completed work orders. |
| [GeoVision · Scenario Admin](http://127.0.0.1:5678/workflow/ivrScenarioAdmin) | Scenario uploads, listings and removals. |
| [GeoVision · Document RAG](http://127.0.0.1:5678/workflow/ivrDocumentRag) | Multimodal embedding and Qdrant indexing of uploaded documents. |

## IVR call flow

```
IVR Input → Ensure work_orders → Read work orders · Data Table → Add saved work orders → IVR call engine
  → IVR Output → Work order to save? → Extract work orders → One row per work order → Save work order · Data Table
```

Browser and SIP calls post `{sessionId, text}` (or `{sessionId, start: true}` to begin a call) to
`POST /webhook/ivr-agent` (browser proxy `/n8n/webhook/ivr-agent`). **Add saved work orders** attaches the
20 most recently saved `work_orders` rows, so callers can ask about them (「我想查詢最新的工單」).
**IVR call engine** forwards the request to the knowledge service's `POST /ivr`, which runs the whole call from the uploaded HTML
call script — see [the IVR engine](../knowledge/README.md#ivr-call-engine). The reply is returned
to the caller first. When the turn completed a work-order scenario, the workflow then asks the
engine to extract the work order and upserts it into the native `work_orders` Data Table, keyed by
`report_key`, so retries update the same row.

There is no AI Agent, Simple Memory or sub-workflow in the call path: the engine keeps the call
state on disk per session, so a restart of n8n does not lose a call.

Columns are `order_id`, `report_key`, `session_id`, `dispatch_date`, `reference_number`, `title`,
`equipment_number`, `maintenance_items`, `quantity`, `notes`, `test_result`, `transcripts` and
`results`. `transcripts` holds the caller's own words for that scenario; `results` holds JSON with
the scenario number and title, the extracted fields and the full scenario dialogue. The table
persists in `/home/node/.n8n` (volume **audiocpp-n8n-data**).

Workflow revision 31 replaces the previous agent flow. Startup backs up the installed drafts, and
unpublishes the retired **GeoVision · Knowledge Tools** sub-workflow (kept, with a backup, for
reference). With automatic publishing disabled, publish **GeoVision · Workflow**, **Scenario Admin**
and **Document RAG**.

## Browser, SIP and deployment

VAD/ASR and TTS/caller audio remain in audio.cpp. The SIP bridge starts the call script with the
welcome greeting (the script's language prompt is appended to `greetings.csv`), keeps that call on
the script for its whole duration, and reports `awaitingLanguage` so DTMF 1/2 selects the language.
Saving an empty **SIP scenario** in the demo turns the call script off for SIP; the `prompt.csv`
dialogue source then answers with the saved prompt.

## Local checks

```sh
node webui/native/tests/n8n-dialogue.mjs
node webui/native/tests/sip-n8n-dialogue.mjs
node webui/native/tests/n8n-bootstrap.mjs
node webui/native/tests/n8n-compose.mjs
docker exec ivr-knowledge node /app/test.mjs                 # offline engine tests
docker exec ivr-knowledge node /app/replay-scenarios.mjs      # live: every 情境 against the real model
```

## Add or remove a call script

In **Scenario → Add New Scenario**, select the HTML call script and its companion images together
(reimporting the same HTML adds missing images). Remove it with **Remove scenario**, which deletes
the uploaded files and any tables created for it.
