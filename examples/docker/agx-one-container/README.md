# Jetson AGX: one-container WebUI

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
The default LLM grounding is the 台積電 receptionist in `prompt.csv`.
Regular RAG and GraphRAG are generated from that same source.

After updating the frontend, rebuild and recreate this stack so the native server includes
the new embedded UI and Caddy starts with its proxy configuration:

```bash
docker compose -f examples/docker/agx-one-container/compose.yml up -d --build
```

Override `AUDIOCPP_BOOTSTRAP_PACKAGES`, `LLAMA_BOOTSTRAP_MODEL`, or
`RAG_EMBEDDING_MODEL` in `compose.yml` to change the initial downloads.
