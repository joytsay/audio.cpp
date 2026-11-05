# Jetson AGX: WebUI and SIP pipeline

Saved reference voices in the Pipeline and Studio pages are shared by all web
clients of this server. Recordings, names, and transcripts persist under
`voices/saved/` on the host through the existing `/app/voices` bind mount. Existing
browser voices are imported when that browser next opens either page; its local
recordings remain as backups. Reload or return to the page to refresh the list.
Deleting a saved voice removes it from the shared library for every client.
The `lingCLvocals` and `wangSG9s` recordings and their reference transcripts are
imported into this library automatically on startup. Pipeline voice selection
uses the shared Saved voices menu.

This Compose project builds one container containing the embedded Svelte WebUI,
the native audio.cpp worker (diarization, STT, and TTS), llama.cpp, and a
rag-cpp GraphRAG worker over the repository's `knowledge/` corpus. There is no
nginx or other reverse proxy.

The commands below assume Jetson AGX Orin (CUDA architecture 8.7), Docker, Compose
v2, and the NVIDIA Container Runtime are already installed.

## Minimal test against your existing SIP server

To keep phone 520 on the existing OpenSIPS server and replace only the IVR
worker registered as 521, use the [SIP server test](../sip-server-test/README.md).
It registers 521 and plays prerecorded lingCL / WangSG greetings for #1 / #2.
Only the CPU SIP target is built; it does not start another local registrar or
require a CUDA build.

## Minimal SIP / IVR baseline

For an independent Wi-Fi registration, audio echo and keypad test, start the
[CPU-only SIP MVP](../sip-mvp/README.md). From this directory:

```bash
docker compose -p sip-mvp -f ../sip-mvp/compose.yml up -d
```

It uses local account 520 on UDP 9910, extension 600 for echo, and extension 521
for a tone-and-keypad IVR menu. No CUDA build is required. Once that works, its
guide shows how to connect the real native AI worker as extension 522.

## JetPack compatibility

The supplied profile targets JetPack 6.2.x / L4T R36.4.x on AGX Orin. Both
audio.cpp and llama.cpp are compiled with CUDA 12.6 for SM87. The final image
uses NVIDIA's Jetson-specific L4T CUDA 12.6.11 runtime so cuBLAS and the CUDA
userspace match Jetson rather than a generic SBSA runtime.

Confirm the board release before building:

```bash
cat /etc/nv_tegra_release
```

For an R36.4.x board, copy the supplied environment:

```bash
cp .env.example .env
```

Do not reuse this file unchanged on JetPack 7 or AGX Xavier: those require their
matching L4T CUDA runtime and CUDA architecture.

## Start

From the repository checkout on the AGX:

```bash
cd examples/docker/agx-one-container
docker compose up --build -d
docker compose logs -f voice-ai
```

The first build downloads the L4T CUDA runtime and recompiles both native
engines. It also installs the WebUI's Node dependencies and builds the Svelte
application inside Docker, so host-side `npm ci` and `npm run build` commands
are not required. Existing `audio-models`, `llama-models`, and `rag-data`
volumes are reused. The receptionist index is generated from `prompt.csv` and rebuilt automatically when
that source changes. Both regular RAG and GraphRAG use its linked department/contact pages.
Restart `voice-ai` after saving prompt edits to refresh the index.

`BUILD_JOBS=2` intentionally limits compiler memory use on Jetson. Increase it
only when the board has enough free unified memory and swap. This deployment
builds the full audio.cpp model catalog, including the pipeline models. It also builds llama.cpp with that same CUDA
toolkit and SM87 target; a newer prebuilt llama.cpp CUDA image is not mixed into
the JetPack runtime. NCCL is disabled because AGX Orin uses one CUDA device;
this also keeps the Jetson runtime independent of the build image's NCCL ABI.

Open `https://192.168.5.151:8083/` for the dedicated voice chatbot, or
`http://AGX-IP-ADDRESS:8081` for Studio. The WebUI becomes available while the native
model manager downloads the default ASR and ZipVoice packages and
llama.cpp downloads the instruct model. Downloads persist in the host model directories,
so later starts reuse them.

Check service state with:

```bash
docker compose ps
curl -fsS http://127.0.0.1:8081/health
```

Stop it without deleting downloaded models:

```bash
docker compose down
```

Only run `docker compose down --volumes` when you intentionally want to delete
all downloaded audio and LLM weights.

## Runtime ports

- `:8081` is served directly by `audiocpp_server`. It contains the embedded
  Svelte WebUI and the audio.cpp REST API used for diarization, STT, and TTS.
- `:8082` is served directly by `llama-server` for model management and LLM
  inference.
- A second llama.cpp worker uses Qwen3-Embedding-0.6B internally on `:8084`.
  It is not published to the host; rag-cpp calls it while indexing and querying.
- rag-cpp listens only inside the container on `127.0.0.1:8083`; the native
  server exposes regular RAG at `/v1/rag/retrieve` and GraphRAG at
  `/v1/rag/graph`. Its Qwen embedding vectors are stored in the existing `.ragdb`.
- Caddy publishes HTTPS on host port `8083`, using the same internal-CA and IP/SNI setup
  as Realtime-Venus. This host port is separate from rag-cpp's container-local port 8083.
  `/llm/*` proxies to llama.cpp, `/sip-ws` proxies to the local Asterisk test PBX,
  and all other requests proxy to audio.cpp, including RAG.
  Open `https://192.168.5.151:8083/#/pipeline` directly, or use the root address, which
  opens the chatbot automatically on port 8083. Studio remains available from its navigation link.
- Set `AUDIOCPP_HTTPS_HOST` and `AUDIOCPP_HTTPS_PORT` to change the published address.
  With a custom port, open `/#/pipeline` directly. Caddy stores its CA and certificates in
  persistent `audiocpp-https-data` and `audiocpp-https-config` volumes.
  Trust Caddy's `/data/caddy/pki/authorities/local/root.crt` on each client, as in the
  existing Realtime-Venus deployment. This stack creates its own CA.
- Direct HTTP ports 8081 and 8082 remain published. HTTPS chatbot API requests stay on
  the same origin through Caddy, supporting microphone access without mixed-content requests.

The continuous microphone uses bundled Silero VAD for speech detection and automatic turns.
Uploaded files and examples bypass VAD. Text messages bypass ASR and share the same conversation
history as microphone and file inputs. The conversation runs Qwen3-ASR 0.6B, the default `prompt.csv` grounding (with regular RAG and GraphRAG selectable), the existing
`bartowski/Qwen2.5-3B-Instruct-GGUF:Q4_K_M` LLM, and ZipVoice-Distill voice cloning.
The page sends prior completed user/assistant messages to the LLM, retains each turn's audio
and stage details, and offers the five bundled Chinese MP3 examples. Enter a ZipVoice
reference clip and its matching transcript or select a configured voice before sending audio.
ASR Context prompt loads the compact semiconductor keywords in `hotword.csv`,
beginning with `Technical terms: X光機 T5`; Save CSV persists `hotword.csv`.
The default LLM knowledge base is the 台積電 receptionist in `prompt.csv`.
Regular RAG and GraphRAG are generated from that same source.

After updating the frontend, rebuild and recreate this stack so the native server includes
the new embedded UI and Caddy starts with its proxy configuration:

```bash
docker compose -f examples/docker/agx-one-container/compose.yml up -d --build
```

Override `AUDIOCPP_BOOTSTRAP_PACKAGES`, `LLAMA_BOOTSTRAP_MODEL`, or
`RAG_EMBEDDING_MODEL` in `compose.yml` to change the initial downloads.

### HTTPS voice demo

Open `https://192.168.5.151:8083/#/demo` (or your configured HTTPS host and
port). Trust the HTTPS certificate and allow microphone access. The Svelte
console uses the same dark-blue palette as Pipeline and Models, with an
unlinked **GeoVision IVR** brand. It includes model settings, separate measured microphone and playback
waveforms, text messages, mute, call/hangup, and the last 300 events across
calls in this browser. **Clear events** removes that history.
The **Runtime** column shows each operation's elapsed wall time in milliseconds,
including request setup and transfer. Turn totals include reply playback;
instant events and older history without timing show `—`.
The **RTF** column displays a real-time factor only when the model's JSON
response reports one (for example, `timing.rtf`). Missing values show `—`,
including LLM responses that only report token throughput. TTS uses the JSON
audio response to retain its timing. Successful transcription events are named
**ASR_COMPLETED**; saved history using the older name is migrated on load.

The VAD, ASR, LLM, and TTS dropdowns list installed packages, existing local
GGUFs, and available registered models. **Refresh models** discovers new
downloads. The defaults prefer Silero VAD, Audio8 ASR 0.1B Q8_0, LFM2.5 1.2B
Instruct Q4_K_M, and ZipVoice when installed. The LLM dropdown uses the actual
IDs from the same-origin `/llm` router, including local filenames and aliases.
Audio packages must be installed first. The LLM dropdown always includes
`LiquidAI_LFM2.5-1.2B-Instruct-Q4_K_M.gguf`. If missing, select it and press
**Download LFM2.5 Q4_K_M**. The demo requests the download through llama.cpp,
monitors completion, and uses the real router ID once available. Calls cannot
use this preset until it is downloaded. Audio dropdowns merge registered aliases
and equivalent folder/file paths; distinct quantizations remain separate.
Router entries marked `incomplete` or `downloading` remain unavailable for
calls. An incomplete LFM2.5 download has a **Resume LFM2.5 Q4_K_M** action.
Before each LLM turn, the demo explicitly loads the selected worker and waits
for its ready state. Inference also enables router autoload for that request.

The sidebar groups controls into **VAD**, **ASR**, **LLM**, and **TTS** sections,
each with an On/Off switch. System prompt and its save button are in **LLM**.
Turn stages off before starting a call:

- **VAD off:** use **Record voice turn** / **Send voice turn** for manual turns.
- **ASR off:** type messages; microphone capture and VAD are skipped.
- **LLM off:** pass recognized or typed text directly to the output.
- **TTS off:** show text replies without speech or a spoken greeting.

Only enabled stages require a selected model. With ASR off, custom reference
voice transcripts must be entered manually.

Use **Demo scenarios** beside the Events table to choose. The two panels have
fixed matching headers and share the width equally; they stack on narrow
screens:

- **Scenario 0 · audio examples:** click a reception example (中央監控站2、中控室、
  員工檢查哨、大廳、車輛檢查哨) to select it, highlight it blue, and show its
  preview player. Selection and preview playback do not send it to the pipeline.
  Press **Send audio** to send the selected clip and play it in chat. Alternatively,
  choose a WAV/MP3/FLAC file using the compact single-row chooser. Each audio
  message includes a player for replay and its recognized transcript. Bundled
  data URLs are decoded locally, so the embedded UI's connection policy does
  not block example loading.
- **Play all 5 examples:** automatically sends each example in order. The queue
  waits for the source audio to finish, then ASR, the assistant's reply, and
  its TTS playback before sending the next example. The current clip stays
  highlighted blue throughout that turn. Disabled pipeline stages
  are skipped. **Stop scenario** or hangup cancels remaining examples.
- **Scenario 1 · 現場維修保養後的語音回報:** **Run Scenario 1** automatically fills
  and sends the three technician messages in order, waiting for each assistant
  reply. **Script and expected replies** shows the reference dialogue and lets
  you send one technician turn at a time. Replies are generated by the selected
  LLM using maintenance scenario instructions; the saved system prompt is not
  modified. These are simulated work-order reports, not persisted work orders.

**Scenario 2 · maintenance audio** bundles `scenario2-1.wav`, `scenario2-2.wav`,
and `scenario2-3.wav`. It has the same preview, explicit **Send audio**, chat
playback, turn highlighting, and cancellation controls as Scenario 0. **Play all
3 examples** sends the WAV files in order, waiting for the complete assistant
reply and its TTS playback before advancing. Switching scenarios clears the
previous audio selection. The files are bundled from `assets/resources/scenarios`
and included in the Docker WebUI build.

With TTS on, Scenario 1 speaks each technician message using another built-in
voice from the selected TTS model (Ling/Wang swap automatically for ZipVoice),
then plays the assistant reply using its configured voice/reference. Technician
playback drives the input waveform; assistant playback drives the output
waveform. Technical codes remain intact in the conversation, with pronunciation
normalization applied only to speech. The selected TTS model needs at least two
built-in voices. **Stop scenario** cancels the sequence; hangup also stops it.

ZipVoice uses the mounted Ling/Wang voices or a custom reference. **Record
clone voice** opens the microphone; **Stop recording** transcribes it with the
selected ASR. Uploads are also transcribed automatically. Review the editable
transcript before calling. Its initial value is
`你好我是語音助手 請問您需要什麼服務 如果需要轉接請按分機號碼`.
The ASR hotwords/context field is sent with both turn and reference
transcription requests. Whether it affects recognition depends on the ASR
model's context support; Audio8 ASR currently uses a fixed transcription prompt.

**Call greeting** is the first settings section below the brand. It reads the
host's `greetings.csv` (one `greeting` column and
one quoted row). **Update greetings.csv** saves it through `/v1/ui/greetings`.
The system prompt is read from `prompt.csv`; **Save prompt.csv** writes edits
back to that file. Both CSVs are mounted into the container so edits persist.
Greeting audio is prepared ahead of the call and reused until its text, model,
voice, or reference changes. It plays once after connecting, without waiting
for an LLM response. Wait for **Greeting ready · instant playback** for the
fastest call start. Reference transcripts apply only to custom uploaded or
recorded audio. Built-in voices use the matching transcript from the server's
voice library, rather than the example custom-reference transcript.

Press **Start call** to enable the microphone. Silero VAD checks successive
audio windows and submits a turn after a silent window or 15 seconds of speech.
The pipeline runs ASR → LLM → TTS sequentially. Browser echo cancellation is
enabled; listening pauses during processing/playback and resumes afterward.
Hangup cancels requests and stops microphone capture and playback.

After updating the sources, run `docker compose up --build -d voice-ai`.
The existing `https` service already routes this page on port 8083.

### Audio8 ASR local conversion

The image includes `/app/audiocpp_gguf` and the Audio8 ASR Python conversion
wrapper. Download the original checkpoint with `/app/audiocpp_model_manager`,
then convert it under `/app/models`; no PyTorch or pip installation is needed.
Follow the [Audio8 ASR Docker setup](../../../docs/models/audio8_asr.md#docker--agx-all-in-one)
for the exact Compose commands. Both checkpoint and GGUF are persisted in the
host repository's `audio-models/` mount. Rebuild `voice-ai` once if an older image
does not contain the converter.

### Audio8 TTS local conversion

`docker compose up --build -d voice-ai` includes both Audio8 TTS conversion
scripts and installs NumPy, safetensors, and the Hugging Face CLI in
`/app/tts-convert-venv`. No manual `pip install` or `docker cp` is needed.
Follow the [Audio8 TTS Docker setup](../../../docs/models/audio8_tts.md#docker--agx-all-in-one)
to authenticate, download, and convert the checkpoint. Model files persist in
the host repository's `audio-models/` mount.

### LFM2.5 1.2B Instruct

In the **LLM / llama.cpp** page, select **LFM2.5 1.2B Instruct · Q4_K_M**
under **Model preset**, then choose **Download in llama.cpp**. This requests
`bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M`; the Direct GGUF
link points to `LiquidAI_LFM2.5-1.2B-Instruct-Q4_K_M.gguf`. When the
download finishes, select it under **Loaded model** and choose **Load model**.
Model files remain in the existing persistent `llama-models/` mount.

The Dockerfile and this Compose profile retain the pinned llama.cpp revision
`2cbca389f515df455412dafa07e2b1359cc72a6d`, which includes the `lfm2`
architecture used by LFM2.5 and the
router download/load/SSE endpoints used by this page. If an existing `.env`
overrides `LLAMA_CPP_REF`, update it to this revision too, then rebuild:

```bash
docker compose up --build -d voice-ai
```

The default Qwen bootstrap model is retained. LFM2.5 weights are downloaded only
when requested from the page. Actual AGX loading and generation must be checked
after rebuilding the worker.

### Native build cache

The CUDA Dockerfile retains the audio.cpp and llama.cpp build directories in
BuildKit cache mounts and uses a shared, persistent 10 GiB ccache for C, C++, and
CUDA compilation. Native dependency sources are copied separately from the
WebUI, so a UI-only change keeps the dependency source layer unchanged. The
embedded UI still requires recompiling its server wrapper and relinking.

The first build with this compiler-cache configuration can still take a long
time: it populates the cache. Later builds on the same Docker builder can reuse
it. Changes to compiler/toolkit, architecture, source, or flags can require new
compilation. Cache mounts are local to the builder and can be removed by cache
pruning or storage-pressure garbage collection. Keep the same builder and avoid
`docker builder prune` / `docker system prune` between ordinary rebuilds.

For SIP account/password or proxy configuration changes, recreate only the
affected runtime services; a CUDA image rebuild is unnecessary. For example,
after editing this deployment's `.env`:

```sh
docker compose --profile sip up -d --no-build --force-recreate sip
```

Restart Asterisk separately after edits to its mounted configuration files.

## SIP telephone pipeline and coturn

For browser calls, use the [local Asterisk test PBX](../asterisk/README.md#test-from-the-ivr-webui)
and open `https://192.168.5.151:8083/#/sip`. Trust the Caddy CA and allow
microphone access first.
Keep `SIP_WAIT_FOR_MEDIA=1` in this deployment's `.env` (the default). The
greeting waits for **#1** (`lingCL`) or **#2** (`WangSG`) on the keypad; the browser never
sends it automatically. Set it to `0` only for automatic playback on answer.
Rebuild the `sip` image after changes to the native SIP client;
this does not require rebuilding CUDA inference binaries.

The same Compose project can now start `sip` and `coturn`. Docker builds libre,
baresip, the `g711`, `opus` and `turn` modules, and `exampleSIP` automatically.
No host-side SIP libraries, CMake configuration or `PKG_CONFIG_PATH` are needed.
The SIP executable and setup tool are also included in the all-in-one image.
The separate SIP image runs without NVIDIA; it calls the inference workers over
HTTP. Linux host networking exposes its SIP and RTP addresses directly.

### Prepare the settings

From this directory, create `.env` from `.env.example` if it does not already
exist. Keep an existing `.env` to preserve your model and network settings.

Run the environment setup tool inside Docker:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) \
  docker compose --profile setup run --build --rm --no-deps sip-setup
```

The tool detects the AGX's local IPv4 address, fills missing settings from the
current template, and generates a TURN password if needed. It preserves existing
credentials. It writes `.env` with permissions `0600` as your user.

For a specific network interface, append the tool's arguments:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) \
  docker compose --profile setup run --build --rm --no-deps sip-setup \
  --env /settings/.env --template /settings/.env.example --interface eth0
```

For Internet callers, use `--public` instead of `--interface eth0`, or combine
both. This detects the outbound public IPv4 address and sets the TURN mapping.
Router port forwarding is still required. See the
[coturn network guide](../coturn/README.md) for the server ports.

Enable the SIP service in `.env`:

```dotenv
COMPOSE_PROFILES=sip
```

Open `/#/sip` in the WebUI to configure **SIP Gateway**. The form starts with
outbound proxy `sip:175.180.90.33:9900`, account `sip:521@175.180.90.33`,
authentication username and display name `521`. Enter the account's secret and
click **Save and register**. “Plain secret” means a password is supplied to
baresip for SIP digest authentication; it is not a precomputed hash.

Settings are persisted in the `audiocpp-sip-data` volume and shared by the web
server and SIP container. The secret is stored in an owner-only file, is never
returned by the settings API, and is excluded from request-body debug logging.
Leaving the secret empty after saving keeps the existing password. Saving
changed settings restarts the worker within two seconds and ends active calls.
The worker waits for the first save before starting registration. In this stack,
the page's saved account replaces the old `SIP_ACCOUNT`, `SIP_PROXY`,
`SIP_AUTHUSER`, `SIP_SECRET`, and `SIP_TARGET` environment settings.

The page controls native SIP/RTP on the server; it does not use browser WebRTC.
“Running” reports a live worker process, not successful gateway registration;
confirm `SIP registered.` in the SIP logs. Incoming calls reuse pre-generated
greetings across normal hangups; the process only regenerates them on restart. The standalone SIP entrypoint still
supports its original environment configuration when `SIP_SETTINGS_DIR` is unset.

The TURN URL and password are read directly from `.env`; a separate
`examples/ivrTTS/.env.sip` is not required. `SIP_LLM_MODEL` defaults to the model
that this stack downloads. If you use another LLM, set its registered model ID.
The audio model IDs default to `silero-vad`, `qwen3-asr` and `zipvoice`.

### Start and test

If the standalone coturn container is running, stop it before starting this
stack so both servers do not bind the same TURN ports:

```bash
docker compose --env-file .env -f ../coturn/compose.yml down
```

Start the integrated services:

```bash
docker compose up --build -d
docker compose logs -f sip coturn
```

Wait for the initial model downloads to finish in Studio before making a call.
The SIP service waits for the audio and LLM HTTP health endpoints. This health
check does not confirm that all model files have finished downloading.

Wait for `SIP registered.` and `Waiting for one incoming call...`. Call the SIP
account from another telephone. After `SIP call established.`, the pipeline plays
“歡迎來電期偶科技 請問我可以怎麼服務您”. Wait for the greeting to finish, then
speak a sentence and wait for the reply. Set `SIP_GREETING` in `.env` to change
the opening message, or set it to an empty value to disable it. The greeting uses
the configured TTS model and voice, and is generated before SIP registration. The SIP service registers again after each completed incoming call. It handles one call at a time.

To place one outgoing call, set `SIP_TARGET` to a destination SIP URI. The
service exits after that call. Set `SIP_TARGET=listen` and recreate the service
to return to incoming calls. To stop the SIP service:

```bash
docker compose stop sip
```

For diagnosis, run the audio self-test inside the container:

```bash
docker compose exec sip /opt/sip/bin/exampleSIP --self-test
```

If settings change, recreate the affected services:

```bash
docker compose up -d --force-recreate sip coturn
```

Leave `COMPOSE_PROFILES` empty to start only the web/inference services. The
standalone [coturn Compose file](../coturn/compose.yml) remains available, but do
not start both coturn services on the same host ports. TURN carries audio;
SIP registration and ACKs still go directly through your SIP proxy.

### SIP prompt-only grounding

The SIP service reads `/app/prompt.csv` through `SYSTEM_PROMPT_FILE` at client
startup. It sends that system prompt and conversation history directly to the
LLM. `SIP_USE_RAG=0` is the default: SIP calls do not query the RAG service.
Set `SIP_USE_RAG=1` in `.env` to additionally retrieve reference passages.
Recreate the SIP container after changing environment settings, and restart it
after editing the mounted prompt. Existing calls retain their loaded prompt.
The browser Conversation knowledge-base selector is independent of SIP.

The demo header detects the host model directly from `/proc/device-tree/model`
and reads the L4T release from `/etc/nv_tegra_release`. Compose mounts these files
read-only under `/run/audiocpp-host`; jtop and the `nvidia-jetpack` metapackage
are not required. JetPack 6.2.1 is inferred for L4T 36.4.4. Unknown releases show
the detected L4T version without guessing a JetPack version. When the model is
unavailable, the header falls back to the host's `/etc/os-release` `PRETTY_NAME`
(or `NAME` and `VERSION`), also mounted read-only.

In the demo TTS section, **Streaming** plays incoming audio chunks while the model
continues generating speech. The switch is available only for model families
that support streaming and is remembered after refresh. Cached greetings still
play immediately; uncached greetings, replies, scenario voices, and cloned-voice
tests use streaming when enabled. Text is split into groups of at most two
nonempty lines and 120 characters, with short pauses between groups. All
streaming-capable models, including VoxCPM1, use native PCM streaming. VoxCPM1
queues a 320 ms audio reserve before starting each group and after playback
underruns to absorb uneven patch delivery. Short groups drain when generation
finishes. This adds startup buffering without switching to offline synthesis.
Playback speed defaults
to 0.9× and is included in **Save model settings**. Hangup cancels both the request
and queued audio. Streaming is off by default.

The demo ASR context loads from `hotwords.csv`. **Save hotwords.csv** writes the
one-column `context` CSV back to the server; its Docker bind mount preserves edits
across container restarts. `hotword.csv` remains available for the existing SIP
and other legacy consumers. Context only affects ASR models that support it.

**Save model settings** in the demo sidebar persists global defaults to
`ui-settings/demo-settings.yaml` on the host (`/app/ui-settings/demo-settings.yaml`
in the container). It saves model identities and load/session options, stage
switches, VAD threshold and turn window, TTS streaming, selected voice, reference
transcript, and clone test text. It also saves the current greeting, system prompt,
and hotwords to their existing CSV files. New reference recordings are stored in
the shared voice library, and YAML keeps only their voice ID.

Every new demo page or browser session restores these server settings after
model and voice discovery. Saved paths restore installed models even if a
temporary server registration was lost on restart. Missing models or deleted voices are reported rather
than replaced silently. The directory bind mount preserves settings across
container rebuilds; generated YAML is excluded from Git and image build contexts.
Local panel sizes and event history remain browser preferences.

The demo shows the assistant waveform on the left and microphone/caller waveform
on the right. Use the panel buttons to hide the settings sidebar, Session,
Events, or Scenarios. The full-width header keeps the GeoVision logo visible
when settings are hidden. Events and Scenarios retain clickable title bars
when collapsed; click a title to reopen its contents. The Session restore
button stays in the Console header. Hiding panels
does not stop calls or scenario playback; shown/hidden state is remembered in
the browser alongside panel sizes.

Demo transcripts and assistant replies are displayed in Traditional Chinese.
Spoken dates, times, serials, quantities, and measurements are normalized to
Arabic digits before the transcript is sent to the LLM. Technical identifiers
recover separators and case only when their complete letters/digits match a
single configured hotword. Missing letters, changed digits, and ambiguous
hotwords are not guessed. `五年一維` remains unchanged. The assistant's normalized
reply is used for conversation history. Maintenance scenarios use a separate
spoken-digit readout for TTS while preserving the displayed identifiers.

In maintenance Scenarios 1 and 2, ASR text also uses the scenario terminology
mappings and equipment-code separators before it appears in chat. Recognized
work-order, note, and successful-startup turns send structured grounding from
user transcripts along with the conversation to the LLM. The LLM generates the
reply (`LLM_COMPLETED` in Events); the grounding supplies the reported facts
and confirmation flow instead of filling fields from prompt examples. Serial numbers stay paired with their reported dates
and capacitance values. Missing fields are requested instead of filled from
examples; the final confirmation uses the work-order title from this call.
Unrecognized letters in a part number are preserved, not guessed from hotwords.
