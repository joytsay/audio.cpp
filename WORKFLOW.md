# GeoVision IVR Workflow

[Knowledge overview](knowledge/README.md) · [Demo and Compose setup](examples/docker/agx-one-container/README.md) · [n8n workflow guide](examples/docker/agx-one-container/n8n/README.md)

## Architecture

The Demo's voice path is **VAD → STT / ASR → LLM ↔ n8n / MCP → TTS**.
With **Dialogue source → n8n**, the **GeoVision · Workflow** AI Agent owns the
LLM conversation and tool loop. audio.cpp handles speech recognition and speech
generation; the agent uses the selected local LLM to choose tools and compose
the spoken reply.

```text
   Browser microphone             SIP caller                  Typed input
           │                         │                            │
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
  │  ┌───────────┐      ┌─────────────────┐      ┌────────────────────┐  │
  │  │ IVR Input │─────▶│    AI Agent     │◀────▶│  Local LLM         │  │
  │  └───────────┘      │                 │      │  Selected model    │  │
  │                     │ Session memory  │      └────────────────────┘  │
  │                     └─────────┬───────┘                              │
  │                               │ tool call / result                   │
  │                               ▼                                      │
  │                    ┌────────────────────┐                            │
  │                    │ Scenario MCP Server│                            │
  │                    └─────────┬──────────┘                            │
  │                               │                                      │
  │            ┌──────────────────┴──────────────────┐                   │
  │            ▼                  ▼                  ▼                   │
  │    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
  │    │ Uploaded file  │ │ retrieve_      │ │ add_work_order │          │
  │    │ scenario tool  │ │ knowledge      │ │                │          │
  │    └───────┬────────┘ └───────┬────────┘ └───────┬────────┘          │
  │            ▼                  ▼                  ▼                   │
  │    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
  │    │ File's n8n     │ │ RAG / source   │ │ Native n8n     │          │
  │    │ subworkflow    │ │ Q/A retrieval  │ │ work_orders    │          │
  │    └───────┬────────┘ └────────────────┘ │ Data Table     │          │
  │            ▼                             └────────────────┘          │
  │    ┌────────────────┐                                                │
  │    │ Same-name n8n  │   Results return to the AI Agent.              │
  │    │ Data Table +   │   The LLM produces a short grounded reply.     │
  │    │ voice template │                                                │
  │    └────────────────┘                                                │
  │                                                                      │
  │                    AI Agent ──────▶ IVR Output                       │
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

## One conversation turn

1. **Listen:** browser or SIP audio enters VAD, which detects the end of speech.
2. **Transcribe:** the selected ASR model produces text. Transcript normalization,
   the session ID and caller history accompany the request to n8n.
3. **Reason:** the AI Agent asks the selected LLM how to handle the caller's
   request, using session memory for conversational context.
4. **Use tools when needed:** Scenario MCP exposes the uploaded-file tools and
   the core retrieval/save tools. A file tool calls its subworkflow, reads the
   live Data Table and returns original field labels and matching records or
   dialogue guidance. The LLM receives those results before answering.
5. **Reply:** n8n returns a short Traditional Chinese reply and the completed
   tool names. While a lookup exceeds the configured wait time, the Demo/SIP
   dialogue layer can speak `查詢中，請稍後。` through TTS.
6. **Speak and display:** the selected TTS model generates the reply audio for
   browser or SIP playback. The Demo shows the transcript, assistant reply,
   audio waveforms and workflow/tool events.

Recognized lookup requests require a first tool call so smaller models cannot
skip retrieval and simply echo the question. Greetings can receive a direct
reply. Work-order saves are acknowledged only after the write succeeds.

## Upload a scenario

**Scenarios → Add New Scenario** accepts PDF, DOCX, XLSX, XLS, CSV, TXT,
Markdown and JSON. Each uploaded file creates one named tool, one subworkflow
and one native Data Table.

```text
                 Add New Scenario · upload file
                               │
                               ▼
                 ┌───────────────────────────┐
                 │ Extract records, tables   │
                 │ and Q/A dialogue templates│
                 └─────────────┬─────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │ Selected LLM translates   │
                 │ unsupported table headers │
                 │ Original labels preserved│
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
| `CSD資料庫.xlsx` | `CSD資料庫` | `CSD資料庫` | `CSD資料庫` |
| `情境模擬_20261105.docx` | `情境模擬_20261105` | `情境模擬_20261105` | `情境模擬_20261105` |

These are upload examples; documents are added by the user. MCP uses an ASCII
wire alias where needed while preserving the filename as the display name.
Excel sheets share one table with sheet provenance. Dialogue examples guide the
conversation; example identities and quantities are not current caller facts.
Screenshot tables use OCR and need verification against the source images.

The MCP tool exposes a callable capability to the agent; its subworkflow executes
the table query. Tool results restore original headers even though n8n stores
English column IDs. Colliding translated IDs receive suffixes such as `_2`.
Identical upload retries reuse saved mappings and imported row keys.

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
scenario removes its registered tool, generated subworkflow, owned Data Table
and stored source files.

Diagram layout inspired by the boxed architecture overview in
[CAAL](https://github.com/coreworxlab/caal#architecture).
