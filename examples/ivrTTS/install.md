# ivrTTS client installation

This entire directory builds independently of audio.cpp;
it does not link model runtimes or require a GPU on the client.

Requirements: C++17 compiler, CMake 3.16+, libcurl development headers/library,
pkg-config, json-c, ncursesw, SDL2, and a running audio.cpp server.
The TUI plays through SDL2 directly; the `play` commands require `ffplay` from FFmpeg.
For true PCM streaming, use a streaming-capable model configured with
`"mode": "streaming"` instead of an offline model.

Ubuntu/Debian:

```sh
sudo apt install build-essential cmake pkg-config libcurl4-openssl-dev libjson-c-dev libncurses-dev libsdl2-dev ffmpeg
```

Arch Linux:

```sh
sudo pacman -S --needed base-devel cmake pkgconf curl json-c ncurses sdl2 ffmpeg
```

macOS with Homebrew:

```sh
xcode-select --install
brew install cmake pkg-config curl json-c ncurses sdl2 ffmpeg
```

From this directory:

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
./build/ivrtts_cli --help
# Optional installation, without administrator privileges:
cmake --install build --prefix "$HOME/.local"
```

On macOS, if curl is not discovered, add
`-DCMAKE_PREFIX_PATH="$(brew --prefix curl)"` to the configure command.
For Homebrew ncurses, set `PKG_CONFIG_PATH="$(brew --prefix ncurses)/lib/pkgconfig"`
when configuring if ncursesw is not discovered. To build only the original CLI
without ncurses/SDL2, configure with `-DIVRTTS_BUILD_TUI=OFF`.

## Default clone voices

`lingCL` is the default when no voice is supplied. `WangSG` is the second preset:

```sh
./build/ivrtts_cli play http://192.168.5.151:8081 zipvoice 'hello'
./build/ivrtts_cli play http://192.168.5.151:8081 zipvoice 'hello' WangSG
```

Both use the bundled WAV and transcript in `voices/`, uploaded as `voice_ref` and
`reference_text`. They require a model supporting reference-audio cloning and do
not require server-side voice presets. Other voice names are sent as server voice
names; pass an empty voice argument (`''`) to use the server's default instead.
Explicit `clone`/`clone_stream` inputs override the selected preset.

CMake copies `voices/` beside the built executable and installs it into
`share/ivrTTS/voices`. Keep this directory with the client when handing it off.
Set `IVRTTS_VOICE_DIR` to override the directory, or call
`tts.set_preset_directory("/path/to/voices")` in C++. An installed standalone
library consumer should set that directory explicitly.

## Terminal UI

```sh
./build/ivrtts_cli tui http://192.168.5.151:8081 zipvoice
# Discover server models and choose in the TUI (defaults to the first speech model):
./build/ivrtts_cli tui http://127.0.0.1:8080
# Streaming-capable model with 24 kHz mono output:
./build/ivrtts_cli tui http://127.0.0.1:8080 streaming-model 24000 1
```

The retro voice deck has a spectrum display computed from samples sent to the
audio device, two selectable clone voices, a model picker, chat history, and volume controls.
The model list comes from the supplied server URL's `/v1/models` endpoint. It
shows all registered models with task/mode/load metadata; only `tts` and `clon`
models can be selected for speech. Downloaded but unregistered models must first
be loaded in the server UI or configured in `server.json`, then refreshed here.
Switching models changes the next request; it does not cancel current playback
or unload/load a model through the management API. Lazy server loading still applies.

Use a terminal at least 64 columns by 24 rows. Keys:

| Key | Action |
| --- | --- |
| Enter | Speak/replay the selected history message |
| Up / Down (or k / j) | Select a previous/next history message |
| m | Open model list; Up/Down browse, Enter selects, Esc closes |
| r | Refresh models from the server |
| p | Set the selected model's PCM output rate and channels, e.g. `24000 1` |
| Tab | Switch between lingCL and WangSG for the next request |
| e | Open a blank new message draft; Enter adds it to history, Esc discards it |
| Ctrl-U / Ctrl-N (in draft) | Clear draft / insert a newline |
| Space | Pause/resume playback |
| s | Stop playback and cancel the client request |
| + / - | Adjust volume |
| q / Esc | Quit |

UTF-8 text is accepted. Playback and network reception run in a worker thread so
controls remain responsive. The audio queue is bounded to three seconds; pausing
eventually applies network backpressure. Cancellation closes the client request;
the server may still finish its current inference. No audio output file is written.
History lasts for the current TUI session. Adding text never overwrites previous
messages; replay synthesizes the selected text using the current model and voice.
Multiline messages show a condensed preview in the history list.
The WAV path currently accepts PCM16 WAV (audio.cpp's default output). The raw
stream path requires the actual model sample rate/channel count. The TUI uses
each model's reported mode: offline uses WAV; streaming requires its per-model
PCM settings (press `p`, or pass rate/channels at startup for the initial model).
The settings stay with that model while switching during the session. ZipVoice still
finishes synthesis before returning WAV; selecting TUI does not change this.

## Server setup

The server must already have model weights and a model ID in its configuration.
See [audio.cpp server instructions](../../app/server/README.md) in the full repository.
For example, run `build/bin/audiocpp_server --config server.json` there.
Confirm available IDs with:

```sh
curl http://127.0.0.1:8080/v1/models
```

Replace `pocket-tts` below with an ID returned by your server. The server needs
network connectivity from the client. This wrapper supports HTTP and HTTPS,
with libcurl's default certificate verification. It has no authentication option.

## CLI testbed

```sh
./build/ivrtts_cli run http://127.0.0.1:8080 pocket-tts out.wav 'Hello from IVR.'
# Optional configured voice name:
./build/ivrtts_cli run http://127.0.0.1:8080 pocket-tts out.wav 'Hello.' alba
# Reference WAV is read from the CLIENT machine and sent inline:
./build/ivrtts_cli clone http://127.0.0.1:8080 pocket-tts cloned.wav \
  'Speak this in the reference voice.' reference.wav 'Words spoken in the reference recording.'
# Prompt for text, output path, and cloning inputs repeatedly:
./build/ivrtts_cli interactive http://127.0.0.1:8080 pocket-tts
```

Use a model that supports voice cloning for `clone`. Reference WAVs must be
nonempty and at most 5 MiB (the server's inline-reference limit). Supply an
accurate transcript when the model requires one. The server validates the audio
format and model capabilities. Outputs are WAV files; play them with your usual
audio player. Quote text and file paths containing spaces in shell commands.

Interactive commands are `run`, `clone`, `create`, `del`, and `quit`.
`create` initializes a local client context with URL/model/voice; it performs no
HTTP request and does not load or register a server model. `del` clears that
context and does not unload models or delete server files. There is no server
session-create/delete API. Each generation posts to `/v1/audio/speech`.

## Play directly in the terminal

No intermediate output file is needed:

```sh
./build/ivrtts_cli play http://127.0.0.1:8080 pocket-tts 'Hello.' alba
./build/ivrtts_cli play-clone http://192.168.5.151:8081 zipvoice \
  'hello' /path/to/lingCL.wav 'Words spoken in the reference recording.'
```

These commands pass arriving WAV buffers directly to `ffplay`. ZipVoice generates
the full result before the server sends it, so playback starts after synthesis.

For a streaming-capable model, use `stream` or `stream-clone`. The server's raw
PCM response carries no sample-rate or channel metadata: you must specify the
model's actual output rate and channel count. For example, **if** your configured
model produces 24 kHz mono:

```sh
./build/ivrtts_cli stream http://127.0.0.1:8080 streaming-model 24000 1 'Hello.'
./build/ivrtts_cli stream-clone http://127.0.0.1:8080 streaming-model 24000 1 \
  'Hello.' reference.wav 'Reference transcript.'
```

Streaming requests use `response_format=pcm` and `stream_format=audio`.
Buffers contain signed 16-bit little-endian PCM; a network buffer may split a
sample or frame. Playback follows buffer arrival, subject to the player's own
buffering. The CLI waits for playback to finish. Playback errors return a nonzero
exit code. HTTP errors are reported without forwarding their bodies to the player.
An interrupted stream may already have played some audio; requests are not retried.

## Use from C++

```cpp
#include "ivrTTS.h"
#include <fstream>

int main() {
    ivrTTS tts;
    tts.create("http://127.0.0.1:8080", "pocket-tts");
    auto wav = tts.run("Hello from C++.");
    // Alternatively:
    // auto wav = tts.clone("Hello.", "reference.wav", "Reference transcript.");
    std::ofstream output("out.wav", std::ios::binary);
    output.write(reinterpret_cast<const char*>(wav.data()), wav.size());
    tts.del();
    return output ? 0 : 1;
}
```

Embed with `add_subdirectory(path/to/ivrTTS)` and
`target_link_libraries(your_app PRIVATE ivrTTS)`. Alternatively, compile
`ivrTTS.cpp` alongside your application and link libcurl and json-c. Methods throw standard
C++ exceptions on invalid inputs, transport errors, HTTP failures (including the
server response body), and unexpected non-WAV responses. Requests have a
10-second connection timeout and a 300-second total timeout; pass a fourth
argument to `create` to change the total timeout in seconds. Calls are synchronous
and `run`/`clone` buffer the response in memory. Do not mutate an instance while another thread
uses it. No retries are performed automatically.

To consume audio incrementally in your own application:

```cpp
tts.run_stream("Hello.", [](const unsigned char* bytes, std::size_t size) {
    // Copy into your audio queue, or write to a player here.
    // bytes is valid only during this callback; size is a byte count.
}, ivrTTS::AudioMode::StreamingPcm);
// For ZipVoice/offline WAV, omit StreamingPcm (the default mode is Wav).
// clone_stream(text, reference_path, transcript, callback, mode) also works.
```

Callbacks run synchronously on the calling thread. Throw from the callback to
cancel; the original exception is propagated after libcurl returns. Streaming
methods do not retain the full response. WAV mode validates the first 12 bytes
before delivering the header and subsequent buffers.
Use `ivrTTS::list_models(url)` to obtain parsed model metadata from C++.

Run the mock integration tests (Python 3, no model weights needed):

```sh
python3 test_streaming.py ./build/ivrtts_cli
python3 test_tui.py ./build/ivrtts_cli
```
