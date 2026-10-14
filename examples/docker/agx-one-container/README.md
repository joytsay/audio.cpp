# Jetson AGX: WebUI and SIP pipeline

This Compose project builds one container containing the embedded Svelte WebUI,
the native audio.cpp worker (diarization, STT, and TTS), llama.cpp, and a
rag-cpp GraphRAG worker over the repository's `knowledge/` corpus. There is no
nginx or other reverse proxy.

The commands below assume Jetson AGX Orin (CUDA architecture 8.7), Docker, Compose
v2, and the NVIDIA Container Runtime are already installed.

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
  `/llm/*` proxies to llama.cpp; all other requests proxy to audio.cpp, including RAG.
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

## SIP telephone pipeline and coturn

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
[coturn network guide](../cotrun/README.md) for the server ports.

Edit `.env` and set the SIP account:

```dotenv
COMPOSE_PROFILES=sip
SIP_ACCOUNT=sip:521@YOUR_SIP_SERVER
SIP_PROXY=sip:YOUR_SIP_SERVER:9900
SIP_SECRET='YOUR_SIP_PASSWORD'
SIP_TARGET=listen
```

Replace the server address, port, account and password with your actual values.
The TURN URL and password are read directly from this `.env`; a separate
`examples/ivrTTS/.env.sip` is not required. `SIP_LLM_MODEL` defaults to the model
that this stack downloads. If you use another LLM, set its registered model ID.
The audio model IDs default to `silero-vad`, `qwen3-asr` and `zipvoice`.

### Start and test

If the standalone coturn container is running, stop it before starting this
stack so both servers do not bind the same TURN ports:

```bash
docker compose --env-file .env -f ../cotrun/compose.yml down
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
standalone [coturn Compose file](../cotrun/compose.yml) remains available, but do
not start both coturn services on the same host ports. TURN carries audio;
SIP registration and ACKs still go directly through your SIP proxy.
