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
credentials and these two new workflows, preserving any existing edits:

| Workflow | File | Editor |
|---|---|---|
| IVR Maintenance Knowledge · RAG Tool | [maintenance-knowledge-rag.json](maintenance-knowledge-rag.json) | `http://192.168.5.151:5678/workflow/ivrMaintenanceKnowledge` |
| IVR Maintenance MCP Tools | [maintenance-mcp-tools.json](maintenance-mcp-tools.json) | `http://192.168.5.151:5678/workflow/ivrMaintenanceMcp` |

**Publish both workflows**, then select **n8n** in the demo's Dialogue source
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

## RAG components

The knowledge subworkflow contains:

```text
RAG tool input → Prepare guidance → Seed Simple Vector Store → Retrieve guidance → Return guidance
                                      ↑ Document Loader        ↑ Local Embeddings
                                      ↑ Recursive Text Splitter
                                      ↑ Local Embeddings
```

The **Default Document Loader** loads static reporting guidance, the
**Recursive Text Splitter** chunks it, and **Local Embeddings** populates the
built-in **Simple Vector Store**. **Retrieve guidance** performs semantic
retrieval for the MCP tool's query. A workflow tool connects this subworkflow
to the MCP Server Trigger.

Only workflow guidance is indexed. User transcripts are used by maintenance
tools and as conversational context, not inserted into the shared knowledge
store. The small demo reseeds static guidance on every RAG call because Simple
Vector Store is memory-only and loses vectors on restart. n8n's Docker volume
persists workflows/credentials, not these vectors. For larger document sets,
separate ingestion and use persistent vector storage. See the
[official Simple Vector Store docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoreinmemory/).

The local embedding model defaults to `Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0`.
The prefilled Local Embeddings credential is supplied by
[local-credentials.json](local-credentials.json), using the non-secret dummy
key `local`. Change that model/credential if you change the embedding worker.
The local LLM is called by audio.cpp's existing UI, so its model comes from
the sidebar rather than a chat-model node inside the MCP workflow.

## Tune and extend

- Edit **Maintenance MCP Server → Instructions** for tool-use guidance. The
  client includes these instructions in the LLM's conversation.
- Edit **Prepare guidance** in the RAG workflow to change the knowledge text.
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
