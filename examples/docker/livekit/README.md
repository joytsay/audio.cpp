# Local LiveKit agent for audio.cpp (Jetson AGX Orin)

This deployment adds a self-hosted LiveKit server, a CPU-only Python agent and
a minimal browser client. It reuses the existing audio.cpp and llama.cpp HTTP
servers; it does not launch or download another inference model stack. Linux
host networking lets these containers reach the existing published API ports.
The Python image builds natively as ARM64 on Jetson; no CUDA/PyTorch package is
needed in the agent. Target: JetPack 6.2.1 / L4T 36.4.4.

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
docker compose up -d --build
docker compose logs -f agent
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
