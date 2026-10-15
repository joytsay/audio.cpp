# Connect ivrTTS directly to SIP with baresip

For Jetson AGX, use the [integrated Docker Compose setup](../docker/agx-one-container/README.md#sip-telephone-pipeline-and-coturn).
Docker builds the SIP dependencies and starts the pipeline and coturn. The
instructions below are for building a standalone SIP client.

`exampleSIP` embeds [baresip](https://github.com/baresip/baresip) and connects
directly to your SIP registrar/proxy. It uses SIP for call control and RTP for
telephone audio. No browser or separate media gateway is required.

```text
Caller -> SIP/RTP -> baresip -> 16 kHz mono PCM -> VAD -> STT with hotwords
                                                           |
                                                          RAG -> LLM
                                                                  |
Telephone <- SIP/RTP <- baresip <- PCM <- TTS reply in memory <------+
```

The program registers one SIP account and handles one incoming or outgoing call.
It can run the complete conversation pipeline or play one fixed announcement.
Audio stays in memory; it does not use the machine's microphone or speakers.

## 1. Prepare your SIP account

For a local Jetson test without an existing PBX, use the
[minimal Asterisk Docker Compose setup](../docker/asterisk/README.md).
It provides two extensions and an echo test without company router forwarding.

You need an existing SIP registrar/PBX or SIP provider, an account and password,
and another telephone or softphone to call. Baresip is the client; it does not
provide a registrar. Your existing PBX can stay on your LAN.

| Setting | Example | Purpose |
| --- | --- | --- |
| `SIP_ACCOUNT` | `sip:1001@192.168.5.20` | Account to register |
| `SIP_PROXY` | `sip:192.168.5.20:5060` | Registrar/outbound proxy |
| `SIP_TARGET` | `listen` or `sip:1002@192.168.5.20` | Answer or dial |
| `SIP_SECRET` | Your account password | SIP digest authentication |
| `SIP_AUTHUSER` | `1001` | Optional authentication username |

Use the actual account, proxy, transport and destination supplied by your PBX.
SIP URI transport parameters such as `;transport=tcp` are supported. The default
is UDP. `sips:` URIs use TLS. The example sends ordinary RTP audio; encrypted
media is not enabled. Optional coturn TURN relaying is configured below.

The client must reach the SIP server and the RTP address advertised by the peer.
For a LAN PBX, run the client on the LAN or over a routed VPN. Allow SIP signaling
on the configured port and bidirectional UDP media on `SIP_RTP_PORTS` (the example
settings use `10000-20000`). A SIP connection alone does not establish an audio
path across NAT. Use a PBX that anchors media or a VPN when needed.

The current workspace already has a build in `build-sip/` and private libraries
and codec modules in `build-sip/deps/`. You can use that executable directly.
Follow the installation steps below when setting up another machine.

## 2. Install client dependencies

The SIP target requires libbaresip and libre version 4.0 or newer, plus the
matching `g711` codec module. Install `opus` as well if you select Opus.
The implementation is verified with baresip/libre 4.12.0. Use matching libraries
and modules from the same installation.

On Ubuntu, install the build tools and HTTP/JSON/Opus dependencies:

```sh
sudo apt update
sudo apt install build-essential cmake pkg-config git libssl-dev zlib1g-dev \
  libcurl4-openssl-dev libjson-c-dev libopus-dev
```

On Arch Linux:

```sh
sudo pacman -S --needed base-devel cmake pkgconf git openssl zlib curl json-c opus
```

Build [libre](https://github.com/baresip/re) first, then baresip. These commands
install into a private prefix and do not need `sudo`:

```sh
mkdir -p /tmp/ivrtts-sip-src
cd /tmp/ivrtts-sip-src
git clone --branch v4.12.0 --depth 1 https://github.com/baresip/re.git
git clone --branch v4.12.0 --depth 1 https://github.com/baresip/baresip.git

cmake -S re -B re/build -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$HOME/.local/ivrtts-sip"
cmake --build re/build --parallel
cmake --install re/build

cmake -S baresip -B baresip/build -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_PREFIX_PATH="$HOME/.local/ivrtts-sip" \
  -DCMAKE_INSTALL_PREFIX="$HOME/.local/ivrtts-sip" \
  -DMODULES="g711;opus;turn"
cmake --build baresip/build --parallel
cmake --install baresip/build
```

See the [upstream build instructions](https://github.com/baresip/baresip#building).
A distribution package can also be used if it includes development headers,
`libbaresip.pc`, `libre.pc`, shared libraries and the codec modules at these versions.

### Optional: coturn TURN relay

Baresip's `turn` module allocates relay addresses with
[coturn](https://github.com/coturn/coturn). It works with ordinary SIP/RTP peers;
the peer does not need ICE. Setting `COTURN_URL` forces media through the relay.
An empty URL disables TURN. TURN does not carry SIP registration, INVITE or ACK,
so SIP signaling/NAT problems must be addressed separately.

Run coturn using [the Docker Compose setup](../docker/cotrun/README.md).
The server variables are in
[examples/docker/agx-one-container/.env.example](../docker/agx-one-container/.env.example).
Copy that file to `.env`, set the server addresses and a real password, then run
from the repository root:

```sh
docker compose --env-file examples/docker/agx-one-container/.env \
  -f examples/docker/cotrun/compose.yml up -d
```

The container uses Linux host networking, so its listening and relay addresses
must belong to the machine running Docker. Use a public relay address for callers
outside the LAN, or configure a public/private mapping and port forwarding.
Allow UDP/TCP on `COTURN_PORT` and UDP on `COTURN_MIN_PORT`–`COTURN_MAX_PORT`.
These are separate from the client's `SIP_RTP_PORTS`.

Copy `COTURN_URL`, `COTURN_USERNAME` and `COTURN_PASSWORD` into the SIP client's
`.env.sip`, then start `exampleSIP` normally. It prints
`TURN media relay enabled.`. The realm is supplied by the server's authentication
challenge. This setup supports `turn:` URLs using UDP or TCP; TLS/DTLS listeners
are disabled. No native coturn build or client-side server config generator is
needed.

## 3. Build the example

```sh
cd /home/joy/Git/audio.cpp/examples/ivrTTS
export PKG_CONFIG_PATH="$HOME/.local/ivrtts-sip/lib/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
export LD_LIBRARY_PATH="$HOME/.local/ivrtts-sip/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

cmake -S . -B build-sip -DIVRTTS_BUILD_SIP=ON -DIVRTTS_BUILD_TUI=OFF
cmake --build build-sip --target exampleSIP --parallel
./build-sip/exampleSIP --help
./build-sip/exampleSIP --self-test
```

Replace the repository path if you copied the directory elsewhere. Some systems
install libraries into `lib64`; use that directory instead if applicable.
Keep `LD_LIBRARY_PATH` available when running against the private installation.
CMake detects the codec module directory from `libbaresip.pc`. Override it with
`-DIVRTTS_BARESIP_MODULE_PATH=/path/to/baresip/modules` at build time, or set
`BARESIP_MODULE_PATH` at runtime.

The self-test checks WAV validation, in-memory playback and conversion from
8/48 kHz caller audio to 16 kHz PCM. It does not register or place a call.

## 4. Configure the conversation pipeline

```sh
cp .env.sip.example .env.sip
chmod 600 .env.sip
vim .env.sip
```

Replace the SIP account, proxy, password and LLM model placeholders. Check the
service URLs and model IDs. For example:

```dotenv
SIP_ACCOUNT=sip:1001@192.168.5.20
SIP_PROXY=sip:192.168.5.20:5060
SIP_TARGET=listen
SIP_SECRET='your SIP account password'
SIP_CODEC=PCMU
SIP_DTMF_MODE=rtp
SIP_RTP_PORTS=10000-20000

AUDIOCPP_URL=http://192.168.5.151:8081
VAD_MODEL=silero-vad
STT_MODEL=qwen3-asr
LLM_URL=http://192.168.5.151:8082/v1
LLM_MODEL=your-loaded-model-id
RAG_URL=http://192.168.5.151:8081/v1/rag
TTS_MODEL=zipvoice
TTS_VOICE=lingCL
IVRTTS_VOICE_DIR=voices
```

Use one `NAME=value` setting per line. Single quotes preserve literal passwords.
Double quotes support `\n`, `\r`, `\t`, `\"` and `\\` escapes. The program does
not expand shell variables, `~` or commands. Do not source the file. Relative
file paths start at the settings file's directory. Exported environment variables
take priority over file settings; command-line account arguments take priority
over the file's account arguments. Unknown keys, duplicate names and unmatched
quotes cause a settings error. The private `.env.sip` file is ignored by Git.

### Prepare RAG

The knowledge index must contain the information that the assistant will use.
The audio.cpp RAG routes require the WebUI to be enabled.
They proxy to rag-cpp at `127.0.0.1:8083` inside the audio server environment.
That address is not the SIP client's address.

The repository's [Jetson deployment guide](../docker/agx-one-container/README.md)
provides audio.cpp, llama.cpp, an embedding worker, and rag-cpp in one container.
Use that guide only for the supported Jetson environment.
For an existing deployment, use its loaded LLM and prepared knowledge index.

Check the RAG connection with:

```sh
curl http://192.168.5.151:8081/v1/rag/initialize -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"client":{"name":"sip-check","version":"1.0"},"capabilities":{}}}'
```

An `already initialized` response is acceptable.
Check retrieval with:

```sh
curl http://192.168.5.151:8081/v1/rag/retrieve -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"retrieve","params":{"query":"contact office","k":5,"mode":"hybrid","includeText":true}}'
```

Replace the query with a question covered by your index.
Confirm that `result.hits` contains useful text.
The example uses regular hybrid RAG, not GraphRAG.
It includes up to five retrieved passages in the LLM system message.
It does not invent reference data if the index returns no results.
A missing RAG service is an error; the example does not silently skip RAG.

### Set STT hotwords

Edit `STT_HOTWORDS` in `.env.sip` to set recognition context.
The template includes a short example.
For a longer context, set `STT_HOTWORDS_FILE` to a local UTF-8 file path.

Hotwords are sent as recognition context in the STT request's `text` field.
Their effect depends on the selected STT model.
They do not guarantee exact spelling.
You can also use the repository's single-column `hotword.csv` file.
The example removes its `context` heading and outer CSV quotes.

The file has priority when both settings are present.
Set `STT_LANGUAGE` only if you need a specific recognition language.
Use the language value supported by your STT model.

### Set the system prompt

Leave `SYSTEM_PROMPT_FILE` empty to use the built-in telephone prompt.
To use your own prompt, set it to a local UTF-8 text file path.
A custom prompt replaces that built-in prompt.

## 5. Start a call

For settings-file startup:

```sh
./build-sip/exampleSIP
# Or use a specific settings file:
./build-sip/exampleSIP --env /absolute/path/to/.env.sip
```

Wait for `SIP registered.`. With `SIP_TARGET=listen`, call the account from your
telephone. The program answers one call automatically. With a destination URI,
it dials after registration. It exits when the call ends. Ctrl+C hangs up and
unregisters. Registration and call setup errors return a nonzero exit status.

You can override the account arguments explicitly:

```sh
./build-sip/exampleSIP --pipeline \
  sip:1001@192.168.5.20 \
  sip:192.168.5.20:5060 \
  sip:1002@192.168.5.20
```

The pipeline plays “歡迎來電期偶科技 請問我可以怎麼服務您” when a call connects.
It starts listening after the greeting finishes. Set `SIP_GREETING` to change the
message; an empty value disables it. The greeting uses the same TTS voice as
conversation replies and is generated before registration.

During a conversation, baresip decodes caller audio and the custom audio player
converts it to 16 kHz mono PCM16 for `SipPipeline`. The existing pipeline runs
VAD, STT, RAG retrieval, LLM completion and TTS. The custom audio source feeds the
reply to baresip at the negotiated codec rate for RTP transmission. Caller input
is paused while a reply is being generated or played, then resumes after playback.
There is no barge-in. Only one call is handled per process.

### Fixed announcement

```sh
./build-sip/exampleSIP \
  sip:1001@192.168.5.20 \
  sip:192.168.5.20:5060 \
  sip:1002@192.168.5.20 \
  http://192.168.5.151:8081 \
  zipvoice 'Hello. This is an audio test.' lingCL
```

This generates the message before registration and hangs up after playback.
Use `listen` instead of the destination to play the announcement to an incoming
caller. TTS must return PCM16 RIFF WAV audio.

### Codec and DTMF

`SIP_CODEC=PCMU` selects G.711 mu-law at 8 kHz. `SIP_CODEC=OPUS` selects Opus at
48 kHz and requires the matching `opus` module and support on the telephone/PBX.
Only the selected codec is offered.

Received keypad presses are printed as `DTMF: 5`, for example. Baresip supports
RTP telephone events and SIP INFO; `SIP_DTMF_MODE=rtp` is the default, while
`info` selects SIP INFO for outbound DTMF. The current example logs digits; it
does not map them to menu actions or send digits through a command interface.
Audible tones carried only inside audio are not detected by this example.

## 6. Optional settings

| Variable | Purpose |
| --- | --- |
| `SIP_AUTHUSER` | Authentication username when different from the account user |
| `SIP_LISTEN` | Local signaling address, such as `192.168.5.151:5060` |
| `SIP_INTERFACE` | Network interface name or local IP address used by baresip |
| `SIP_RTP_PORTS` | UDP media port range, such as `10000-20000` |
| `BARESIP_MODULE_PATH` | Directory containing `g711.so` and/or `opus.so` |
| `COTURN_URL` | TURN URI; empty disables the relay |
| `COTURN_USERNAME`, `COTURN_PASSWORD` | Coturn long-term credentials |
| `SIP_CODEC` | `PCMU` (default) or `OPUS` |
| `SIP_DTMF_MODE` | `rtp` (default) or `info` |
| `STT_HOTWORDS_FILE` | Local UTF-8 hotwords file; takes priority over inline hotwords |
| `STT_LANGUAGE` | Optional recognition language supported by the STT model |
| `SYSTEM_PROMPT_FILE` | Optional local UTF-8 prompt replacing the built-in prompt |
| `LLM_API_KEY` | Optional bearer token for the LLM service |
| `IVRTTS_VOICE_DIR` | Reference recordings and transcripts |

The complete service/model settings are in [.env.sip.example](.env.sip.example).

## 7. Troubleshooting and tests

| Symptom | Check |
| --- | --- |
| CMake cannot find libbaresip/libre | Installation versions, development headers and `PKG_CONFIG_PATH` |
| Shared library cannot be loaded | `LD_LIBRARY_PATH` or system loader configuration |
| Codec module cannot be loaded | `BARESIP_MODULE_PATH` and matching library/module versions |
| Registration fails | Account, password, auth username, proxy and transport |
| Registration times out | SIP routing, DNS and firewall |
| Call rejected or unsupported codec | Destination, PBX dial plan and selected codec |
| Connected call has no audio | Peer SDP address, RTP ports, NAT and media routing |
| No keypad events | PBX/phone RTP telephone-event or SIP INFO configuration |
| Pipeline fails | Model IDs and VAD/STT/RAG/LLM/TTS service logs |

Run the integration tests after building with tests enabled:

```sh
cmake -S . -B build-sip -DIVRTTS_BUILD_SIP=ON \
  -DIVRTTS_BUILD_TUI=OFF -DIVRTTS_BUILD_TESTS=ON
cmake --build build-sip --parallel
ctest --test-dir build-sip --output-on-failure
```

The SIP test uses a local UDP registrar and telephone peer. It checks digest
registration, registration rejection, busy responses, incoming/outgoing calls,
PCMU/Opus RTP, received DTMF, BYE and unregister. It also sends caller audio over
RTP through the full conversation pipeline and checks that a reply returns over
RTP. The separate conversation test checks
VAD/STT/hotwords/RAG/LLM/TTS against local mock HTTP services. These tests require
permission to open localhost sockets; they do not call your real SIP provider.
