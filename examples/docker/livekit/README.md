# Local LiveKit agent for audio.cpp (Jetson AGX Orin)

The current memory workflow has only three views: **My memories**, **My sessions**
and **My conversation turns**. All three are now shared across authenticated
identities in this local workspace. Identity is used for authentication and
write attribution, not row isolation. Migration 003 changes the read policies,
shared search and memory-title uniqueness; existing rows are retained. When
old identities have duplicate titles, older rows receive a UUID suffix.
Sessions and turns are recorded automatically;
information the user asks to save is stored in personal memory. The agent uses
personal_memory_agent.py, with remember/recall/forget tools and private-memory
retrieval. Each finalized user turn runs a validated JSON memory decision through
the existing llama.cpp endpoint and directly saves reported facts before speech;
it does not depend on conversational tool calls. Embedding failures no longer
block text saves. Separate knowledge and structured work-order processing are no longer
part of the running agent or control panel. The historical migrations and legacy
work-order files below are retained for existing databases; no tables or saved
records are deleted. Studio can still display those historical database tables.
Older knowledge/work-order workflow descriptions below describe the previous
implementation, not the current agent.

After updating an existing installation, apply migration 003 and rebuild:

    docker compose -f compose.yml -f compose.supabase.yml up -d --force-recreate migrate
    docker compose -f compose.yml -f compose.supabase.yml up -d --build agent

Then refresh the browser and reconnect the call. No database reset is needed.

This deployment adds a self-hosted LiveKit server, a CPU-only Python agent and
a minimal browser client. It reuses the existing audio.cpp and llama.cpp HTTP
servers; it does not launch or download another inference model stack. Linux
host networking lets these containers reach the existing published API ports.
The Python image builds natively as ARM64 on Jetson; no CUDA/PyTorch package is
needed in the agent. Target: JetPack 6.2.1 / L4T 36.4.4.

## Fully local Supabase (recommended for this deployment)

For a new installation, configure `.env` directly:

```sh
cp .env.example .env
# Edit LIVEKIT_NODE_IP and review the API/model/credential settings in .env.
docker compose -f compose.yml -f compose.supabase.yml up -d --build
```

No setup script is needed. `.env.example` includes a complete, internally
consistent local development configuration, including anon/service-role JWTs
signed with its example VOICE_JWT_SECRET. SUPABASE_PUBLIC_URL follows the IP and
HTTPS port automatically through Compose environment interpolation.

If `.env` already exists, edit it in place instead of overwriting it. Preserve
existing database/JWT credentials when reusing a database volume. For a fresh
installation, replace the shared example credentials as appropriate; changing
VOICE_JWT_SECRET requires updating both signed JWT keys to match. Supabase's
[API key guide](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys)
explains generating a matching set. Keep the completed `.env` private.

Required local fields are VOICE_DB_PASSWORD, VOICE_JWT_SECRET,
VOICE_REALTIME_DB_KEY (16 characters), VOICE_REALTIME_SECRET (at least 64
characters), SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, and
SUPABASE_EMBED_SECRET. Compose reports missing required values before starting.

Open **https://JETSON_IP:8093**. Click **Connect memory identity**, then enable
**Persistent memory** before connecting a voice session. No Supabase Cloud
account, cloud project ref, CLI login, SQL-editor step or function deployment
command is required for this local overlay.

| Local component | Address |
| --- | --- |
| Browser API/Auth/Realtime | https://JETSON_IP:8093/supabase |
| Internal Supabase API | http://127.0.0.1:54321 |
| PostgreSQL | private Compose network only, 5432 |
| Voice control panel | https://JETSON_IP:8093 |

The local overlay runs Supabase PostgreSQL/pgvector, GoTrue Auth with anonymous
sign-in enabled, PostgREST, Realtime, a native `gte-small` Edge Runtime service,
and an API proxy. The migration job applies both versioned SQL files after
Auth is ready; a database ledger prevents reapplying them on restart. The Edge
Function is mounted locally and authenticates with the shared secret configured in `.env`.
No separate Jetson embedding worker is added. Storage, Studio, analytics and
poolers are omitted because this application does not need them.

PostgreSQL data and runtime caches use named Docker volumes. Use both Compose
files for subsequent start/stop commands. `docker compose ... down` preserves
the database; `down -v` deletes it. The selected images publish ARM64 builds,
but the complete stack has not been run on this target Jetson. First startup
needs network access to pull images and cache the Edge Runtime/model assets.
Supabase's native AI runtime must be available in the selected ARM64 image;
check function logs if model initialization fails.

To inspect startup:

```sh
docker compose -f compose.yml -f compose.supabase.yml ps -a
docker compose -f compose.yml -f compose.supabase.yml logs --tail=80 auth migrate realtime functions
```

## Start

First start your existing API deployment, e.g. from the repository root:

```sh
docker compose -f examples/docker/agx-one-container/compose.yml up -d voice-ai
```

Then:

```sh
cd examples/docker/livekit
cp .env.example .env
# Edit LIVEKIT_NODE_IP to the Jetson LAN address and check model IDs/API URLs.
docker compose -f compose.yml -f compose.supabase.yml up -d --build
docker compose -f compose.yml -f compose.supabase.yml logs -f agent
```

An external inference deployment is also supported: change STT_BASE_URL,
TTS_BASE_URL and LLM_BASE_URL in `.env`. They must include `/v1`. For the current
all-in-one deployment the defaults are:

| Setting / endpoint | Default | Use |
| --- | --- | --- |
| STT_BASE_URL | http://127.0.0.1:8081/v1 | POST /audio/transcriptions (multipart WAV) |
| TTS_BASE_URL | http://127.0.0.1:8081/v1 | POST /audio/speech (WAV response) |
| LLM_BASE_URL | http://127.0.0.1:8082/v1 | POST /chat/completions (streaming) |
| LIVEKIT_PORT | TCP 7880 | WebRTC signaling |
| LIVEKIT_TCP_PORT | TCP 7881 | WebRTC media fallback |
| LIVEKIT_UDP_PORT | UDP 7882 | WebRTC media |
| WEB_PORT | TCP 8090 | Browser client and participant token endpoint |
| AGENT_HEALTH_PORT | TCP 8096, loopback only | Agent worker health endpoint |
| ADAPTER_PORT | TCP 8095, loopback only | Internal STT/TTS compatibility adapter |

Use registered backend model IDs, not model download names. The default LLM ID
matches `agx-one-container/compose.yml`. Existing SIP, Caddy and Asterisk ports
are unchanged. LiveKit is a separate browser voice path, not a SIP bridge.

## Browser access

Open `https://192.168.5.151:8093` using your configured LIVEKIT_NODE_IP and
LIVEKIT_HTTPS_PORT. Caddy serves the client and forwards `/livekit/*` as WSS
signaling to the local LiveKit server. No SSH tunnel is required.

The local CA is separate from the existing audio.cpp HTTPS deployment. Export
its certificate after startup:

```sh
docker compose cp https:/data/caddy/pki/authorities/local/root.crt ./livekit-root.crt
```

Install that public CA certificate as a trusted certificate authority on the
browser computer (including Firefox's Authorities store if it does not use the
system trust store). Then reload the page and allow microphone access.

| Browser-facing endpoint | Default |
| --- | --- |
| HTTPS client and token endpoint | https://192.168.5.151:8093 |
| WSS signaling (through Caddy) | wss://192.168.5.151:8093/livekit |

The browser needs LAN access to HTTPS TCP 8093 and WebRTC media TCP 7881 / UDP
7882. HTTPS/WSS proxies signaling, not UDP media. The agent still connects to
`ws://127.0.0.1:7880` internally. Ports are configurable in `.env`; 8093 avoids
conflicting with the existing audio.cpp HTTPS port 8083. The existing `/sip-ws`
route remains for Asterisk.

For HTTP-only localhost/SSH use, explicitly set
LIVEKIT_PUBLIC_URL=ws://192.168.5.151:7880 and open http://localhost:8090
(with an SSH tunnel for port 8090 when using a laptop).

The included web/token service has no login and LiveKit uses development mode.
Use it on a trusted development LAN only, not as a public deployment. All
browser JS is bundled into the image; runtime does not use CDN scripts or
LiveKit Cloud. First build requires network access for packages, images and
Silero VAD assets. Subsequent runs use the built image and existing local APIs.

## Conversation behavior

- Reads mounted `prompt.csv` at each new room/session. No RAG queries.
- Uses local Silero VAD, then transcribes a completed utterance. This is not
  continuous partial-transcript ASR; the current Qwen ASR backend is offline.
- Streams LLM text; LiveKit splits text for sentence-based TTS. The adapter
  currently buffers each WAV response before forwarding it. It does not use
  audio.cpp's `/live` endpoints.
- Uses lingCL or WangSG voice references from `voices/`; other voice names are
  passed to the backend. Remaining ASCII digits are converted to Chinese
  digit-by-digit for speech, leaving the LLM's conversation text unchanged.
- Hotwords are disabled by default to avoid the earlier keyword-echo issue.
  Set USE_HOTWORDS=1 to load `hotword.csv` with new recognition requests.
- A microphone interruption stops client playback; cancelling the HTTP request
  does not guarantee that backend GPU inference is immediately interrupted.

The agent does not configure inference-server model residency. With
AUDIOCPP_MAX_LOADED_MODELS=1, alternating ASR and TTS can reload models. Measure
latency and memory on the Jetson before increasing simultaneous model residency.
Start with one active conversation; end-to-end ARM64 performance is unverified.

After editing environment settings, run `docker compose up -d --force-recreate`.
Prompt edits apply to new sessions. To stop: `docker compose down` (existing
inference containers remain running).

## Local validation

```sh
python -m pip install -r requirements.txt
python -m unittest discover -s . -p 'test_adapter.py' -v
```

Adapter tests use mocked inference APIs and local reference WAVs. A real
microphone-to-speaker test on Jetson is still required.

## Voice control console

The HTTPS page includes connection controls, microphone mute and level meter,
microphone/speaker selection (browser support varies), playback volume, audio
unlock, live transcripts, agent state and connection events, text input, and
transcript download. Clear view only clears the visible transcript; reconnect
to start a new conversation without prior history.

Before connecting you can edit STT/LLM/TTS URLs and model IDs, load the APIs'
model lists, choose language/voice, enable hotwords, set Chinese number reading,
LLM temperature/output length, VAD threshold/silence, turn delays, interruptions,
preemptive generation, timeout, prompt and greeting. Model lists reflect all
models exposed by each endpoint; choose a model appropriate for that task.
API credentials continue to come from server environment variables and are
never returned to the page. The adapter uses those same credentials for the
selected URLs, so use only trusted API endpoints.

Settings are validated and snapshotted per room. They apply when connecting;
disconnect to change them. They do not modify the mounted prompt/hotword files,
backend server configuration or other active sessions. Export/import saves UI
settings as JSON; reload defaults rereads the mounted files and environment.
The console has no administrator login and remains intended for a trusted LAN.
It controls voice sessions, not LiveKit server configuration or Docker services.

Run all regression tests with:

```sh
python -m unittest discover -s . -p 'test_*.py' -v
```

## Supabase knowledge and persistent memory

This optional integration adapts the patterns from
[LiveKit's Supabase memory guide](https://livekit.com/blog/supabase-voice-agent-memory)
to the existing local inference services. The base Compose file can connect to hosted or existing self-hosted Supabase.
The local overlay below deploys Supabase on this same Jetson.
For fully local operation, supply a local Supabase instance. Embeddings are generated inside Supabase by the included `gte-small` Edge
Function. No separate embedding worker is needed for this integration.

### Configure

1. Apply `supabase/001_voice_memory.sql` in the Supabase SQL editor or with your
   migration tooling. It creates new `voice_*` tables, RLS policies, indexes,
   a hybrid-search RPC and Realtime publication entries. It does not overwrite
   tables from the upstream example. Apply once; it is a versioned migration,
   not a repeatedly runnable initialization script.
2. Enable **Anonymous sign-ins** in Supabase Auth. The console uses an anonymous
   Supabase identity persisted in browser storage. This is a real auth user,
   not the unauthenticated `anon` database role. Clearing browser storage or
   using another browser produces a different identity/private memory history.
3. Set these variables in `examples/docker/livekit/.env`:

   ```dotenv
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_PUBLIC_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   SUPABASE_SECRET_KEY=YOUR_SECRET_OR_SERVICE_ROLE_KEY
   SUPABASE_EMBED_FUNCTION=embed
   SUPABASE_EMBED_SECRET=YOUR_FUNCTION_SHARED_SECRET
   ```

   The public URL must be reachable from the browser over HTTPS (including
   Realtime WebSockets) when using the HTTPS console. The internal URL can
   differ for self-hosted networking. Secret/service-role credentials stay
   server-side; the browser receives only URL and publishable key. Never put
   the secret key into the publishable-key variable.
4. Deploy the included Edge Function to that same Supabase project. From
   `examples/docker/livekit`, with Supabase CLI installed and authenticated:

   ```sh
   supabase functions deploy embed --project-ref YOUR_PROJECT_REF
   supabase secrets set --project-ref YOUR_PROJECT_REF VOICE_EMBED_SECRET=YOUR_FUNCTION_SHARED_SECRET
   docker compose up -d --build --force-recreate agent
   ```

   Set SUPABASE_EMBED_SECRET in the agent environment to the same secret.
   Alternatively, a legacy service_role key works as the default shared secret
   when SUPABASE_EMBED_SECRET and VOICE_EMBED_SECRET are both unset. The function
   disables gateway JWT verification and authenticates the server-only shared
   secret itself; do not remove its header check. For an existing self-hosted
   Supabase stack, install this function and environment secret in its Edge
   Runtime using that stack's deployment procedure.

   The schema uses **vector(384)** with cosine `<=>` distance and HNSW indexes.
   Do not mix embedding models in existing rows; regenerate all embeddings when
   changing models. Set SUPABASE_EMBED_FUNCTION to an empty string for lexical-only
   search/storage. Query-embedding failures fall back to lexical search; failed
   write embeddings report an error instead of retaining stale vectors.

5. Reload `https://192.168.5.151:8093`, click **Connect memory identity**, and
   enable **Persistent memory** in session settings before connecting the agent.

### Live tables and agent behavior

The console subscribes to Supabase **Postgres Changes**, not a polling timer.
It displays the latest 50 rows of shared knowledge, your memories, your sessions,
and your conversation turns. Updates from the agent, this console or Supabase
Studio trigger a reload of the selected table. The status badge reports actual
subscription state; Refresh works manually if Realtime is unavailable.

Add/update knowledge or memory with the embedded form. Saving the same title or
memory slot replaces your row and refreshes its embedding. Edit/Delete buttons
appear only on your rows. Sessions and conversation turns are read-only here.
Changing an embedded row directly in Studio requires regenerating its vector;
use the console save form when changing searchable content.

The agent loads recent private memories before greeting, retrieves relevant
shared knowledge and private memory for each user turn, and exposes remember,
recall, forget and knowledge-search tools. Search fuses vector similarity with
Postgres full-text and literal substring results. The latter helps with exact
Chinese terms and equipment IDs. One query embedding is reused across both
sources. Retrieved content is reference data, not prompt instructions.

Only explicitly requested/confirmed facts should be saved as memories. Raw
conversation turns are recorded separately; they are not confirmed maintenance
facts. A session starts as `active`, and its transcript report is finalized as
`completed` on graceful shutdown. A crash can leave `active` sessions and
incomplete history; turn write errors are logged and recorded in the report.
This database persistence does not submit a maintenance work order.

The token endpoint verifies the Supabase user with Auth; browser JSON cannot
choose another user's identity. Private queries/writes always scope by that
verified ID, even though the server key bypasses RLS. Browser reads are protected
by RLS. Knowledge is intentionally shared with signed-in users, while modification
is owner-scoped through the server. The surrounding console is still a trusted
LAN developer tool, not an administrator-authenticated production service.

Supabase documents `gte-small` as English-focused, with a 512-token input limit.
For this Chinese maintenance workflow, verify retrieval quality on actual terms
and equipment IDs; literal/lexical search remains available alongside vectors.
See [Supabase's model documentation](https://supabase.com/docs/guides/functions/ai-models).

A running Supabase database and target-device voice session are required for
end-to-end verification. The HTTP tests mock backend responses; migrations and RLS were also validated
against an isolated PostgreSQL/pgvector test runtime. Real Realtime/Auth/Edge
Runtime and Jetson voice sessions still require deployment testing.

## Reusable maintenance metadata columns

Migration `002_work_order_metadata.sql` adds three owner-scoped live tables.
English column names support reusable APIs; values and UI labels support Chinese.

| Table | Main columns | Meaning |
| --- | --- | --- |
| voice_work_orders | reported_at, customer, work_order_name, site_code, test_result | 時間、客戶、工單名稱、廠區代碼、起機結果 |
| voice_maintenance_items | equipment_id, maintenance_type, exhaust_fan_quantity, panel_fan_quantity | 設備編號、保養項目、強排FAN數量、間面FAN數量 |
| voice_spare_parts | part_number, serial_number, equipment_id, manufactured_on, capacitance_value, capacitance_unit | 料號、SN、所屬設備、製造日期、電容值、原始單位 |

Each table also has `room`, `user_id`, timestamps, `source_text` and
`readback_text`. Store original alphanumeric IDs, timezone-aware timestamps,
SQL dates and numeric quantities. For example `6460` + `MF` remains canonical;
「六千四百六十MF」 is a spoken readback, not a second spare-part record.
Each serial number is a separate row. An unspecified equipment association is
null; never infer it from list order. Updates are atomic through an owner-scoped
RPC. The agent has a typed `save_work_order_metadata` tool for reports and
corrections, so the chat LLM must support function calling. These rows represent
reported metadata, not a separately verified or externally submitted work order.
For hosted/existing databases, apply migration 002 after migration 001 as well.

Retrieval context is bounded to short excerpts per record for the edge device.
Memory tools add tokens to the system prompt: if the chat server reports context
exhaustion, increase its context budget or shorten the prompt/history. Database
text is not substituted for system instructions. Test function-call accuracy
with the deployed quantized chat model before relying on automatic metadata capture.

### Database bootstrap errors from the earlier configuration

The old configuration initialized PostgreSQL with postgres as its bootstrap
superuser. The image expects supabase_admin to hold that bootstrap identity.
Creating an extra administrator does not fix that identity: PostgreSQL refuses
the native migration that tries to demote the original bootstrap superuser.
The earlier repair script has been removed; do not replay native migrations
against the partially initialized database.

For the failed initial installation, select a new empty volume explicitly in
.env, without deleting the old volume:

    SUPABASE_DB_VOLUME=audiocpp-livekit_supabase-db-v2

Then recreate the database and start the remaining services:

    docker compose -f compose.yml -f compose.supabase.yml up -d --force-recreate db
    docker compose -f compose.yml -f compose.supabase.yml up -d --build

This initializes a new database with the corrected bootstrap user. Its matching
configuration/key volume is also separate. The original database/configuration
volumes are retained, but their records are not copied into the new database.
Use this for the failed initial setup, not as a migration of a populated system.
Leaving SUPABASE_DB_VOLUME empty retains the original default volume name.

### Supabase Studio dashboard

The Supabase overlay also starts Studio and postgres-meta, using the existing
database. From this directory, start them with:

    docker compose -f compose.yml -f compose.supabase.yml up -d

Open http://192.168.5.151:54323 (substitute your LIVEKIT_NODE_IP). The Studio
port defaults to 54323 and can be changed with SUPABASE_STUDIO_PORT in .env.
Existing .env files work without adding the new variables. Studio binds to
LIVEKIT_NODE_IP by default; SUPABASE_STUDIO_BIND_IP can override it.

Studio is an administrative interface with no separate dashboard login in this
development stack. Only expose it on a trusted LAN. For local-only access, set
SUPABASE_STUDIO_BIND_IP=127.0.0.1 and use an SSH port forward. This port uses
HTTP; the LiveKit control panel continues to use HTTPS on 8093.

In Studio, use Table Editor to view/edit public.voice_work_orders,
voice_maintenance_items, voice_spare_parts and the memory/history tables.
SQL Editor operates on the same database used by the voice agent. Analytics/log
services, Storage and function deployment management are not included in this
stack; their Studio sections are not supported.

The service configuration follows the upstream self-hosted Compose:
https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml.

### Work-order writes from the voice agent

When Supabase credentials are configured, newly loaded UI defaults enable
Persistent memory. Connect a Supabase identity before starting the voice call.
Changing that checkbox during an existing session does not enable database
writes for that session: disconnect and reconnect.

Every finalized user turn runs a separate JSON completion against the configured
local llama.cpp API before spoken response generation. The application validates
the semantic save/no_change decision and typed metadata, then directly awaits
the Supabase save RPC. Persistence does not depend on the conversational model
emitting a tool call. There is no keyword gate. Questions, hypothetical examples, negated requests and
unrelated conversation should select no_change. Ambiguous intent should lead
to clarification. The UI shows checking, unchanged, saving, saved or error.
Original user turns are retained as bounded reference context so a short
confirmation can use earlier equipment/part details with original identifiers.
Intent classification and field extraction still depend on the deployed model;
requiring the decision step guarantees a decision attempt, not perfect accuracy.
Invalid JSON, API failures and unconfirmed database writes block normal success
speech and produce a visible error. Speculative generation is disabled for
memory-enabled calls to keep database side effects on finalized turns only.
The agent suppresses an initial success statement
until the tool round trip, uses typed original IDs/numbers as tool arguments,
and checks the Supabase RPC's saved=true result. A refused tool call, invalid
arguments or failed database write is shown as an error in the panel.

The persistence status is delivered over LiveKit data messages, independently
of the spoken transcript. On a successful save, the panel selects 工單資料 if
it was still showing shared knowledge/memory/history and refreshes it. The
underlying tables continue to use Supabase Realtime. Work orders are stored in
voice_work_orders (and child maintenance/spare tables), not voice_knowledge.

The bundled llama.cpp launcher now enables Jinja tool templates. After updating
it, restart voice-ai as well as rebuilding the LiveKit agent. If the model
reports context exhaustion, set LLAMA_CTX_SIZE=8192 in the inference deployment's
.env; its Compose setting now supports that override. Token limits must also
leave enough room for the structured arguments. Logs contain
"Work-order persistence:" with the pending/saving/saved/error state.
