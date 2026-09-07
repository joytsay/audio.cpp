# Jetson AGX: one-container WebUI

This Compose project builds one container containing the embedded Svelte WebUI,
the native audio.cpp worker (diarization, STT, and TTS), and llama.cpp. There is
no nginx or other reverse proxy.

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
engines. Existing `audio-models` and `llama-models` volumes are reused.

`BUILD_JOBS=2` intentionally limits compiler memory use on Jetson. Increase it
only when the board has enough free unified memory and swap. This deployment
builds only the three native audio families used by the pipeline rather than
the full audio.cpp model catalog. It also builds llama.cpp with that same CUDA
toolkit and SM87 target; a newer prebuilt llama.cpp CUDA image is not mixed into
the JetPack runtime. NCCL is disabled because AGX Orin uses one CUDA device;
this also keeps the Jetson runtime independent of the build image's NCCL ABI.

Open `http://AGX-IP-ADDRESS:8081`. The WebUI becomes available while the native
model manager downloads the default diarization, ASR, and TTS packages and
llama.cpp downloads the instruct model. Downloads persist in two named volumes,
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
- Both ports are published by Compose. The Svelte WebUI automatically connects
  to port 8082 on the same hostname; worker addresses are not user-configurable.

Override `AUDIOCPP_BOOTSTRAP_PACKAGES` or `LLAMA_BOOTSTRAP_MODEL` in `compose.yml`
to change the initial downloads. An empty value disables that bootstrap.
