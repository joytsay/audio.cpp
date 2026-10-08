# ivrTTS client installation

This entire directory builds independently of audio.cpp;
it does not link model runtimes or require a GPU on the client.

Requirements: C++17 compiler, CMake 3.16+, libcurl development headers/library,
and a running audio.cpp server with an offline TTS model configured.

Ubuntu/Debian:

```sh
sudo apt install build-essential cmake libcurl4-openssl-dev
```

Arch Linux:

```sh
sudo pacman -S --needed base-devel cmake curl
```

macOS with Homebrew:

```sh
xcode-select --install
brew install cmake curl
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
`ivrTTS.cpp` alongside your application and link libcurl. Methods throw standard
C++ exceptions on invalid inputs, transport errors, HTTP failures (including the
server response body), and unexpected non-WAV responses. Requests have a
10-second connection timeout and a 300-second total timeout; pass a fourth
argument to `create` to change the total timeout in seconds. Calls are synchronous
and buffer the response in memory. Do not mutate an instance while another thread
uses it. No retries are performed automatically.
