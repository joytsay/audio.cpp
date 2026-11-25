# IVR knowledge service

`ivr-knowledge` serves the internal Compose network at `http://knowledge:8085`. It stores uploaded
scenarios under `/data/scenarios` and runs the IVR call engine. It starts empty: upload your HTML
call script through the Demo's **Add New Scenario** option.

## IVR call engine

`POST /ivr` runs one phone call from the uploaded HTML call script
(e.g. `情境模擬_20261105.html` with its companion images). The script is the only source of dialogue
behaviour; nothing about the scenarios is hard-coded.

| Request | Result |
|---|---|
| `{sessionId, start: true, scenarioId?}` | Starts a call; replies with the script's first opening prompt. |
| `{sessionId, text, scenarioId?, work_orders?}` | Answers one caller turn. `work_orders`: saved rows, newest first (n8n sends them). |
| `{sessionId, records: true}` | Extracts the work orders completed since the last request. |
| `{sessionId, text, intent: true}` | Says what that turn will be about (`intent`: the 情境 number, `lookup`, `menu` or `opening`) and its wait phrases (see [wait notice](../n8n/README.md#wait-notice)). |
| `{mock: true, scenarioId?, sections?}` | The caller's side of the script for the demo's mock call, with new names (model) and new numbers of the same length and format (code); part, model and fault codes, the language digit and outbound titles are kept, and scores stay on the asked scale. |
| `{sessionId, call: true}` | Returns `{rows: [call_sessions row], columns}` for the call so far (see [call sessions](../n8n/README.md#call-sessions)). |
| `{sessionId, end: true}` | Discards the call. |

Each reply carries `stage` (`opening`, `menu`, `scenario`), `status`, `scenario` (`{number, title}`),
`language` and `awaitingLanguage`, plus `work_order: {order_id, pending: true}` when a work-order
scenario just completed. `scenarioId` defaults to the most recent uploaded call script.

How a call runs:

1. **Opening.** The AI lines before the first 情境 heading are spoken in order, verbatim. A prompt
   about 語言 accepts 1/2, 中文/英文 or spoken digits; a prompt asking for N 碼 requires N digits;
   other answers are accepted as given. The last opening line is the service menu.
2. **Routing.** The caller selects a 情境 by number (`情境 3`, or a bare `3` at the menu), by its
   title, or by describing it; the model picks among the section titles and their first caller
   lines, or returns to the menu when the request is unclear.
3. **Scenario turns.** The model receives the section's example dialogue with numbered AI lines,
   the section's figures (transcribed once by the vision model and cached), and only this
   scenario's turns of the live call. It returns which script line it performs; reaching the last
   AI line completes the scenario, after which the next request is routed again. Inside a scenario
   only an explicit `情境 N` switches scenarios, so a bare number stays an answer (a score, a
   quantity). A turn the model matches to no script line, or reports as a change of topic, is routed
   again. Fillers (嗯、呃那個) never select anything; a second unclear request lists the options.
4. **Grounding.** Facts about this call come only from the caller; reference facts (stock, SOP
   steps, fault codes, colleagues) only from the script's AI lines and figures. In work-order
   scripts, example IDs the caller has not said are masked from the model, a reply that still
   repeats one is regenerated, and any sentence that still carries it is dropped.
5. **Saved work orders.** Besides the script's sections, the router offers a built-in lookup:
   「查詢最新的工單」, 「最舊的呢？」, a work order number, or how many there are. The model only
   classifies the question (latest / oldest / number / all / the one just answered, and which detail);
   the rows are selected and the answer is worded from their actual fields in code, so dates and
   values are never invented. Answers stay short: number, dispatch date and title; equipment, work
   done, test result or notes only when asked (「那它的維修內容呢？」).
6. **Outbound sections** (whose first line is the AI's, e.g. dispatch reminders and surveys) start
   with that line verbatim.
7. **Work orders.** Sections titled or opened as a work-order report (工單) save a work order. The
   reply goes out first; the n8n workflow then requests the record, which the model extracts from
   the caller's confirmed words.
8. **English.** Choosing 2 translates the opening and outbound lines once (cached) and the model
   speaks the script's equivalents in English.

Sessions are written to `/data/ivr-sessions` after every turn and expire after two hours idle; turns
of one call are processed one at a time. Figure transcriptions and translations are cached in
`/data/ivr-cache`; figures are transcribed when the service starts, so the first call does not wait.

The engine uses the vision worker already loaded for document retrieval:
`IVR_LLM_URL` (default `http://voice-ai:8087/v1`) and `IVR_LLM_MODEL` (default `ivr-vision`,
Qwen3-VL-4B-Instruct). Replies use JSON-schema constrained output.

### Checks

`node test.mjs` runs the offline engine tests with a fake model. `node replay-scenarios.mjs [N…]` replays every 情境 of the uploaded script — the
script's own opening answers and caller lines — against the running service and real model, prints
each turn and extracted work order, and fails if a section does not complete:

```sh
docker exec ivr-knowledge node /app/test.mjs
docker exec ivr-knowledge node /app/replay-scenarios.mjs
```

## Uploads and document retrieval

Uploads accept PDF, DOCX, XLSX, CSV, TXT, Markdown and HTML (companion images require HTML).
Poppler/Tesseract provide local Chinese/English PDF extraction. When `IVR_RAG_INDEX_UPLOADS` is
enabled, the n8n **Document RAG** workflow embeds uploaded text and figures with
Qwen3-VL-Embedding-2B into Qdrant, which runs inside this container (`http://knowledge:6333`,
volume `ivr-qdrant-data`). The IVR call engine does not use vector search: a call script's section
is small enough to give the model in full.

`GET /health` reports saved scenario and file counts.
