# GeoVision IVR Workflow

[Knowledge overview](knowledge/README.md) · [Demo and Compose setup](examples/docker/agx-one-container/README.md) · [n8n workflow guide](examples/docker/agx-one-container/n8n/README.md)

## Architecture

The Demo's voice path is **VAD → STT / ASR → n8n → TTS**.
With **Dialogue source → n8n**, **GeoVision · Workflow** routes fixed replies
and structured lookup results directly to IVR Output. The AI Agent uses the
selected local LLM and can call Scenario MCP tools to compose other replies.
audio.cpp handles speech recognition and synthesis.

```text
   Browser microphone             SIP caller                  Typed input
           │                         │                            │
           │                         ▼                            │
           │            ┌─────────────────────────┐               │
           │            │ Optional SIP greeting   │               │
           │            │ greetings.csv + saved   │               │
           │            │ TTS settings → playback │               │
           │            └────────────┬────────────┘               │
           │                         │ Listen                     │
           └────────────┬────────────┘                            │
                        ▼                                         │
             ┌──────────────────────┐                             │
             │  audio.cpp           │                             │
             │  VAD → STT / ASR     │                             │
             │  Speech → transcript │                             │
             └──────────┬───────────┘                             │
                        │                                         │
                        └───────────────┬─────────────────────────┘
                                        ▼
             ┌────────────────────────────────────────────────────┐
             │  Demo / SIP dialogue                               │
             │  Normalize transcript + attach session and history │
             └──────────────────────────┬─────────────────────────┘
                                        │ IVR agent webhook
                                        ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  n8n · GeoVision Workflow                                            │
  │                                                                      │
  │  ┌───────────┐                                                       │
  │  │ IVR Input │──▶ Register caller turn                               │
  │  └───────────┘             │                                         │
  │  ┌◀───── Fixed reply ──────┤                                         │
  │  │                         ▼                                         │
  │  │                 Retrieve or save                                  │
  │  │                         ├─ Structured lookup result ────────────┐ │
  │  │                         └──┐                                    │ │
  │  │                            ▼ Other context                      │ │
  │  │                  ┌─────────────────┐      ┌──────────────────┐  │ │
  │  │                  │    AI Agent     │◀────▶│  Local LLM       │  │ │
  │  │                  │                 │      │  Selected model  │  │ │
  │  │                  │ Session memory  │      └──────────────────┘  │ │
  │  │                  └─────────┬─────┬─┘                            │ │
  │  │         tool call / result │     └──────────────────────────┐   │ │
  │  │                            ↕                          reply │   │ │
  │  │                 ┌────────────────────┐                      │   │ │
  │  │                 │ Scenario MCP Server│                      │   │ │
  │  │                 └─────────┬──────────┘                      │   │ │
  │  │                            │                                │   │ │
  │  │         ┌──────────────────┴──────────────────┐             │   │ │
  │  │         ↕                  ↕                  ↕             │   │ │
  │  │ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐    │   │ │
  │  │ │ Uploaded file  │ │ retrieve_      │ │ add_work_order │    │   │ │
  │  │ │ scenario tool  │ │ knowledge      │ │                │    │   │ │
  │  │ └───────┬────────┘ └───────┬────────┘ └───────┬────────┘    │   │ │
  │  │         ▼                  ▼                  ▼             │   │ │
  │  │ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐    │   │ │
  │  │ │ File's n8n     │ │ Imported rows  │ │ Native n8n     │    │   │ │
  │  │ │ subworkflow    │ │ or source Q/A  │ │ work_orders    │    │   │ │
  │  │ └───────┬────────┘ │                │ │ Data Table     │    │   │ │
  │  │         ▼          │ Possible name  │ └────────────────┘    │   │ │
  │  │ ┌────────────────┐ │ with no match  │                       │   │ │
  │  │ │ Same-name n8n  │ │ → source Q/A   │                       │   │ │
  │  │ │ Data Table +   │ └────────────────┘                       │   │ │
  │  │ │ voice template │                                          │   │ │
  │  │ └────────────────┘                                          │   │ │
  │  │                                     ┌───────────────────────┴───┘ │
  │  │                                     ▼                             │
  │  │                            Prepare IVR output                     │
  │  │                                     ▼                             │
  │  └──────────────────────────────▶ IVR Output                         │
  └────────────────────────────────────────┬─────────────────────────────┘
                                           │ reply text + tool events
                                           ▼
                              ┌─────────────────────────┐
                              │  audio.cpp · TTS        │
                              │  Selected voice / clone │
                              │  Streaming or offline   │
                              └────────────┬────────────┘
                                           ▼
                              Browser speaker / SIP caller

       Demo observes: caller and assistant waves, conversation and events.
```

STT (speech-to-text) and ASR (automatic speech recognition) describe the same
recognition stage here. Typed input enters at the transcript stage. Browser and
SIP turns use the same n8n agent workflow.

The Demo's upload webhook creates the uploaded-file tool shown above.
[Upload a scenario](#upload-a-scenario)

## One conversation turn

1. **Listen:** browser or SIP audio enters VAD, which detects the end of speech.
2. **Transcribe:** the selected ASR model produces text. Transcript normalization,
   the session ID and caller history accompany the request to n8n.
3. **Route.** n8n can return a fixed reply or call Scenario MCP. Structured
   results go directly to reply formatting. Other retrieved context goes to
   the AI Agent, which uses the selected LLM and session memory.
4. **Use tools when needed:** Scenario MCP exposes the uploaded-file tools and
   the core retrieval/save tools. A file tool calls its subworkflow, reads the
   live Data Table and returns original field labels and matching records or
   dialogue guidance. The LLM receives agent tool results before answering.
5. **Reply:** n8n returns a short Traditional Chinese reply and the completed
   tool names. While a lookup exceeds the configured wait time, the Demo/SIP
   dialogue layer can speak `查詢中，請稍後。` through TTS.
6. **Speak and display:** the selected TTS model generates the reply audio for
   browser or SIP playback. The Demo shows the transcript, assistant reply,
   audio waveforms and workflow/tool events.

Structured lookups include directory names, equipment models and serial
numbers. If the request looks like a name and the directory has no match,
the workflow searches the source Q/A.
Work-order saves are acknowledged only after the write succeeds.

## Upload a scenario

**Scenarios → Add New Scenario** accepts PDF, DOCX, XLSX, CSV, TXT and Markdown.
Each uploaded file creates one tool and one n8n subworkflow. Excel files create
a native Data Table per worksheet. Other files create one same-named table.

```text
                 Demo · Add New Scenario
                               │ POST /n8n/webhook/ivr-import-scenario
                               ▼
                 n8n · Upload scenario file
                               │
                               ▼
                 ┌───────────────────────────┐
                 │ Extract records, tables   │
                 │ and Q/A dialogue templates│
                 └─────────────┬─────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │ Map source headers to    │
                 │ n8n-compatible column IDs│
                 │ Preserve original labels │
                 └─────────────┬─────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │ Create native Data Table  │
                 │ and import source rows    │
                 └─────────────┬─────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │ Publish file subworkflow  │
                 │ Register Scenario MCP tool│
                 └─────────────┬─────────────┘
                               ▼
                     Available to the AI Agent
```

| Uploaded file | MCP tool display name | n8n subworkflow | n8n Data Table |
| --- | --- | --- | --- |
| `geovision_extension_directory_clean.csv` | `geovision_extension_directory_clean` | `geovision_extension_directory_clean` | `geovision_extension_directory_clean` |
| `CSD資料庫.xlsx` | `CSD資料庫` | `CSD資料庫` | `CSD資料庫_派工`, `CSD資料庫_客戶設備`, `CSD資料庫_設備類型`, `CSD資料庫_通訊錄` |
| `情境模擬_20261105.docx` | `情境模擬_20261105` | `情境模擬_20261105` | `情境模擬_20261105` |

These are upload examples; documents are added by the user. MCP uses an ASCII
wire alias where needed while preserving the filename as the display name.
The Excel tool can search all worksheets or a specified worksheet. Dialogue
examples guide the conversation and retain their source attribution.
Screenshot tables use OCR and need verification against the source images.

The MCP tool exposes a callable capability to the agent; its subworkflow executes
the table query. Tool results restore original headers even though n8n stores
English column IDs. Colliding translated IDs receive suffixes such as `_2`.
Identical upload retries reuse saved mappings and retain duplicate source rows.

## Components and entry points

| Component | Responsibility | Reference |
| --- | --- | --- |
| Demo | Microphone/text input, playback, conversation, waveforms and events | [Demo page](webui/native/src/routes/demo/+page.svelte) |
| SIP pipeline | Caller audio, VAD/ASR and reply playback | [SIP pipeline](examples/ivrTTS/sipPipeline.cpp) |
| n8n dialogue transport | Sends turns, reports tool completion and schedules wait notices | [Shared transport](webui/native/src/lib/n8n-dialogue.ts) |
| GeoVision · Workflow | AI Agent, selected LLM, memory, MCP tools and reply formatting | [Workflow definition](examples/docker/agx-one-container/n8n/workflow.json) |
| Scenario manager | Creates/publishes file workflows, tables and MCP registrations | [Workflow manager](examples/docker/agx-one-container/n8n/scenario-workflows.mjs) |
| Knowledge service | Stores uploads, extracted records, templates and original-header mappings | [Knowledge service](examples/docker/agx-one-container/knowledge/README.md) |

The browser sends turns to `/n8n/webhook/ivr-agent`; the gateway forwards them to
n8n's `/webhook/ivr-agent`. Scenario MCP retains `/mcp/ivr-maintenance` as its
endpoint. The main workflow remains **GeoVision · Workflow** as uploads add tools.

| Local interface | URL |
| --- | --- |
| Demo | `http://127.0.0.1:8081/` |
| Demo over HTTPS | `https://127.0.0.1:8082/` |
| Full GeoVision interface | `http://127.0.0.1:8083/` |
| Full interface over HTTPS | `https://127.0.0.1:8084/` |
| n8n workflow editor | `http://127.0.0.1:5678/workflow/ivrWorkflow` |

Original files, templates and mappings persist in `audiocpp-knowledge-data`;
native Data Tables and workflows persist in the n8n data volume. Removing a
scenario removes its registered tool, generated subworkflow, owned Data Tables
and stored source files.

Diagram layout inspired by the boxed architecture overview in
[CAAL](https://github.com/coreworxlab/caal#architecture).
