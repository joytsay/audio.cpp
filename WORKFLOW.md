# GeoVision IVR Workflow

[Knowledge overview](knowledge/README.md) · [Demo and Compose setup](examples/docker/agx-one-container/README.md) · [n8n workflow guide](examples/docker/agx-one-container/n8n/README.md) · [IVR call engine](examples/docker/agx-one-container/knowledge/README.md#ivr-call-engine)

## Architecture

The voice path is **VAD → STT / ASR → n8n → TTS**. With **Dialogue source → n8n**,
**GeoVision · Workflow** passes every turn to the **IVR call engine** in the knowledge
service. The engine runs the whole call from the uploaded HTML call script and its
images. No AI Agent, memory node or MCP tool sits in
the call path. The engine keeps each call's state on disk, so restarting n8n does not
lose a call. audio.cpp handles speech recognition and synthesis.

```text
   Browser microphone             SIP caller                  Typed input /
           │                         │                        demo mock call
           │                         ▼                            │
           │            ┌─────────────────────────┐               │
           │            │ SIP greeting +          │               │
           │            │ script's language prompt│               │
           │            │ (DTMF 1/2 selects)      │               │
           │            └────────────┬────────────┘               │
           │                         │ Listen                     │
           └────────────┬────────────┘                            │
                        ▼                                         │
             ┌──────────────────────┐                             │
             │  audio.cpp           │                             │
             │  VAD → STT / ASR     │                             │
             │  hotwords.csv        │                             │
             │  (+ SOP terms)       │                             │
             └──────────┬───────────┘                             │
                        └───────────────┬─────────────────────────┘
                                        ▼
             ┌────────────────────────────────────────────────────┐
             │  Demo / SIP dialogue (shared n8n-dialogue client)  │
             │  Normalize transcript · session ID                 │
             │  Start wait-notice timer (default 2 s)             │
             └───────┬──────────────────────────────┬─────────────┘
          ivr-agent  │                              │ ivr-intent (in parallel)
                     ▼                              ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  n8n · GeoVision Workflow   (webhook ivr-agent)                       │
  │                                                                       │
  │  IVR Input → Ensure work_orders → Read work orders · Data Table       │
  │      → Add saved work orders → IVR call engine ──────────┐            │
  │                                                          ▼            │
  │  IVR Intent Input → What is the caller asking?     IVR Output ──▶ reply
  │      → IVR Intent Output (scenario + wait phrases)       │            │
  │                                              after reply │            │
  │                 ┌────────────────────────────────────────┤            │
  │                 ▼                                        ▼            │
  │   Work order to save?                      Call session record        │
  │   → Extract work orders                    → Ensure call_sessions     │
  │   → Save work order · Data Table             columns                  │
  │     (work_orders)                          → Save call session ·      │
  │                                              Data Table               │
  │                                              (call_sessions)          │
  └───────────────────────────────────┬───────────────────────────────────┘
                                      │ HTTP
                                      ▼
            ┌───────────────────────────────────────────────────┐
            │  Knowledge service · POST /ivr (IVR call engine)  │
            │  HTML call script → opening, menu, scenarios      │
            │  Turns and routing: local text LLM                │
            │  (LFM2.5 1.2B, JSON-schema output)                │
            │  Figures: vision LLM (ivr-vision), read once,     │
            │  cached                                           │
            │  Sessions and model cache under /data             │
            └───────────────────────────────────────────────────┘

  Reply text (one sentence per bubble)
                                      ▼
                         ┌─────────────────────────┐
                         │  audio.cpp · TTS        │
                         │  Selected voice / clone │
                         │  Streaming or offline   │
                         └────────────┬────────────┘
                                      ▼
            Browser speaker (normalized volume) / SIP caller

       Demo observes: caller and assistant waves, conversation and events.
```

STT (speech-to-text) and ASR (automatic speech recognition) are the same stage
here. Typed input and mock-call lines enter at the transcript stage. Browser and
SIP turns use the same workflow, engine, routing and wait notice.

## SOP agents

Every uploaded file also becomes an **SOP**: the local LLM (LFM2.5 by default)
writes its purpose, answer rules, Q/A pairs and hotwords, and n8n builds one agent
for it. **GeoVision · SOPs** is the front desk at `/webhook/ivr-sop`: it picks the
SOP for each turn and speaks only what that SOP's skills return. The demo and SIP
still post to `ivr-agent`; `ivr-sop` is the multi-agent path.

```text
  ┌───────────────────────────────────────────────────────────────────────┐
  │  n8n · GeoVision · SOPs   (front desk agent, webhook ivr-sop)         │
  │                                                                       │
  │  SOP Input → SOP context (this call's active SOP) → Turn              │
  │    ├─ new call, several SOPs → greeting that offers each SOP          │
  │    ├─ one SOP only → run it                                           │
  │    └─ otherwise → RAG routing evidence (/sops/rank, every SOP)        │
  │         ├─ one clear exact match (a name, a code) → run that SOP      │
  │         └─ else Front desk agent (LFM2.5) picks an SOP agent tool     │
  │                                   │                                   │
  │                                   ▼                                   │
  │  GeoVision · SOP · <file>   (one agent per uploaded file)             │
  │    HTML call script → Runmap skill every turn; RAG skill for facts.   │
  │                       The reply is the Runmap step, word for word.    │
  │    CSV table        → RAG skill first, then the agent answers.        │
  │                       Numbers and codes must appear in a retrieved    │
  │                       row with the asked name, or caller rephrases.   │
  │                                   │                                   │
  │                                   ▼                                   │
  │  Prepare reply → Remember SOP (/sops/session) → SOP Output ──▶ reply  │
  │      after a Runmap turn: save work_orders and call_sessions          │
  └───────────────────────────────────────────────────────────────────────┘

  Shared skills (n8n workflows any agent calls as tools)
    GeoVision · Skill · RAG     Qdrant semantic search + exact keyword match
                                over one SOP
    GeoVision · Skill · Runmap  next step of the opening and call script
                                (knowledge POST /skills/script → IVR call engine)
    GeoVision · Skill · Embed   SOP Q/A + passages → Qwen3-Embedding → Qdrant
                                (webhook ivr-skill-embed, run on upload)
```

## One conversation turn

1. **Listen.** VAD detects the end of browser or SIP speech.
2. **Transcribe.** The selected ASR model produces text, biased by the
   **ASR hotwords / context** in the demo's left panel (`hotwords.csv`, which the
   SIP container also mounts). The transcript is normalized and sent to
   `/webhook/ivr-agent` with the session ID.
3. **Run the script.** The IVR call engine handles three stages:
   - **Opening:** the AI lines before the first scenario, spoken verbatim, starting with the
     language prompt.
   - **Menu:** routes the caller to a scenario by number, title or description.
   - **Scenario turns:** grounded in that section's example dialogue and figures.

   A built-in lookup answers questions about saved work orders: the latest or
   oldest one, a work order number, or a detail of the one just answered (for
   example its maintenance work). It gives short answers from the actual row fields.
4. **Reply.** n8n returns the reply first. The demo shows one sentence per bubble,
   and long sentences are split at clause breaks.
5. **Save.** After the reply, n8n records the call:
   - A completed work-order scenario is extracted and upserted into `work_orders`.
   - The call's row in `call_sessions` is updated.
6. **Speak.** The selected TTS model speaks the reply in the browser or on the SIP
   call. In the browser, every voice plays at one normalized loudness, scaled by
   **Volume** (1–10).

## Wait notice

Alongside each turn, the client posts the same text to `/webhook/ivr-intent`. The
engine says which scenario the turn is about and returns that scenario's wait
phrases: a short acknowledgement, what is being looked up and a request to wait.
The model writes them once per script,
and they are cached. If the reply has not arrived after the **Wait notice** delay
(left panel, below ASR, default 2 s), the caller hears one of these phrases.

- **Browser:** synthesizes the phrase as soon as it is known, so it plays
  without delay.
- **SIP:** speaks it as the turn's `progress` event.

A notice never repeats the previous one in the same call, and a turn that answers
in time is not announced. The notice is not part of the dialogue history.

## Call records

| Data Table | Key | Contents |
| --- | --- | --- |
| `work_orders` | `report_key` | One row per completed work-order scenario: dispatch date, equipment, maintenance items, quantity, test result, notes, the caller's words and the scenario dialogue. |
| `call_sessions` | `session_id` | One row per call, updated after every reply. See below. |

Each `call_sessions` row holds:

- `channel`: `sip` or `web`.
- `date` and `time`: when the call started.
- One column per opening question. The model names these in English snake_case
  when the script is first used, for example `employee_id_last3` = `847`.
- `opening`: the same answers as JSON.
- `conversation`: the whole call.
- `conversation_duration`: the call length, as `HH:MM:SS`.

See [Call sessions](examples/docker/agx-one-container/n8n/README.md#call-sessions).

## Mock call

**Scenario → Run mock call** plays a test call from the script's own caller lines.
First come the opening answers, then the checked scenarios (by default the outbound ones,
such as 1 and 8). The order is Q1 A1 Q2 A2…. The `ivr-mock-call` webhook varies
each run:

- Names change.
- Numbers get new values of the same length and format.
- Dates and times stay valid, and scores stay on the asked scale.
- Part, model and fault codes, the language digit and outbound titles are kept.

Each run differs by mode:

- **Browser:**
  - Starts over from the greeting.
  - Speaks each line in the **Caller voice** (default TsaiKY).
  - Waits for the reply, then sends the next line.
  - Hangs up after the last reply.
- **SIP:** runs inside the current phone call. Each line is sent as text, and the
  reply is spoken on the phone. Place the call first and end it from the phone.

**Stop scenario** or **Hang up** stops a run. Clicking one mockup question sends
just that line.

## Upload a scenario

**Scenarios → Add New Scenario** accepts a CSV table (for example a front-desk
directory) or an HTML call script. Each file becomes one [SOP](#sop-agents). To run
calls, select the HTML call script and its companion images together.
Reimporting the same HTML adds any missing images. The engine transcribes the
figures when the service starts, so the first call does not wait.

```text
                 Demo · Add New Scenario
                 (CSV table, or HTML call script + images)
                               │ POST /n8n/webhook/ivr-import-scenario
                               ▼
                 n8n · Upload scenario file
                               │
                               ▼
                 ┌───────────────────────────┐
                 │  Knowledge service        │
                 │  Store files, extract the │
                 │  call script / records    │
                 └─────────────┬─────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │  Native Data Tables for   │
                 │  tabular sources          │
                 └─────────────┬─────────────┘
                               │ in the background, after the upload answers
                               ▼
                 ┌───────────────────────────┐
                 │  SOP writer (LFM2.5)      │
                 │  purpose, instructions,   │
                 │  Q/A, hotwords            │
                 │  → added to hotwords.csv  │
                 └─────────────┬─────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │  n8n · Skill · Embed      │
                 │  Q/A + passages →         │
                 │  Qwen3-Embedding-0.6B →   │
                 │  Qdrant (sop_<id>)        │
                 └─────────────┬─────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │  n8n · SOP agent workflow │
                 │  built; front desk agent  │
                 │  rebuilt with its tool    │
                 └─────────────┬─────────────┘
                               ▼
                 Available to the IVR call engine (ivr-agent:
                 latest HTML script by default, SIP scenario chosen
                 in the demo) and to the SOP agents (ivr-sop)
```

**Remove scenario** deletes the uploaded files and any tables created for them.
If the demo's **SIP scenario** is saved empty, SIP calls stop using the call
script and the `prompt.csv` dialogue source answers instead.

## Components and entry points

| Component | Responsibility | Reference |
| --- | --- | --- |
| Demo | Microphone/text input, mock call, playback and loudness, conversation, waveforms and events | [Demo page](webui/native/src/routes/demo/+page.svelte) |
| SIP pipeline | Caller audio, VAD/ASR (hotwords) and reply playback | [SIP pipeline](examples/ivrTTS/sipPipeline.cpp) |
| n8n dialogue transport | Sends turns, fetches the intent, schedules and plays wait notices | [Shared transport](webui/native/src/lib/n8n-dialogue.ts) |
| GeoVision · Workflow | IVR webhooks (agent, intent, mock call), work_orders and call_sessions tables | [Workflow definition](examples/docker/agx-one-container/n8n/workflow.json) |
| IVR call engine | Runs calls from the HTML script: opening, routing, scenario replies, lookups, records | [Engine](examples/docker/agx-one-container/knowledge/ivr-engine.mjs) |
| Scenario manager | Scenario uploads and removal; creates the call_sessions columns; builds the SOP workflows | [Workflow manager](examples/docker/agx-one-container/n8n/scenario-workflows.mjs) |
| SOP writer | Writes each upload's SOP (Q/A, hotwords); retrieval, ranking and SOP sessions | [SOPs](examples/docker/agx-one-container/knowledge/sops.mjs) |
| SOP workflows | Front desk agent, one agent per SOP, RAG / Runmap / Embed skills | [SOP workflow templates](examples/docker/agx-one-container/n8n/sop-workflows.mjs) |

| Webhook (browser proxy `/n8n/webhook/…`) | Purpose |
| --- | --- |
| `ivr-agent` | One caller turn, or `{start: true}` to begin a call |
| `ivr-intent` | Scenario and wait phrases for a turn in progress |
| `ivr-mock-call` | Varied caller lines for the mock call |
| `ivr-import-scenario` | Upload a scenario file |
| `ivr-sop` | One caller turn through the SOP front desk agent |
| `ivr-skill-embed` | Embed an SOP into Qdrant (called after upload) |

| Local interface | URL |
| --- | --- |
| Demo | `http://127.0.0.1:8081/` |
| Demo over HTTPS | `https://127.0.0.1:8082/` |
| Full GeoVision interface | `http://127.0.0.1:8083/` |
| Full interface over HTTPS | `https://127.0.0.1:8084/` |
| n8n workflow editor | `http://127.0.0.1:5678/workflow/ivrWorkflow` |

Where things are kept:

- **`audiocpp-knowledge-data` volume:** uploaded files, call sessions
  (`/data/ivr-sessions`, which expire after two hours idle) and the model cache
  (`/data/ivr-cache`: figures, translations, wait phrases and column names), and the
  written SOPs.
- **`ivr-qdrant-data` volume:** SOP vectors (`sop_<id>` collections).
- **n8n data volume:** Data Tables and workflows.

Diagram layout inspired by the boxed architecture overview in
[CAAL](https://github.com/coreworxlab/caal#architecture).
