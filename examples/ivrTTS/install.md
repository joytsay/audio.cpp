# ivrTTS: install and use

## 1. Build and run exampleTTS

Install the required packages before you build the example.
Use the command for your operating system.

**Ubuntu**

```sh
sudo apt update
sudo apt install build-essential cmake pkg-config libcurl4-openssl-dev libjson-c-dev libncurses-dev libsdl2-dev ffmpeg
```

**Arch Linux**

```sh
sudo pacman -S --needed base-devel cmake pkgconf curl json-c ncurses sdl2 ffmpeg
```

1. Open the client directory.

   ```sh
   cd /home/joy/Git/audio.cpp/examples/ivrTTS
   ```

   If you copied the client, use its new directory path.

2. Configure the build.

   ```sh
   cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
   ```

3. Build the example.

   ```sh
   cmake --build build --target exampleTTS --parallel
   ```

4. Run the example from this directory.

   ```sh
   ./build/exampleTTS
   ```

The example connects to `http://192.168.5.151:8081`.
It uses the `zipvoice` model and the `lingCL` voice.
Change these values in [exampleTTS.cpp](exampleTTS.cpp) if necessary.

The example reads voice files from `voices/` in the current directory.
It prints `Received … WAV bytes` after the server returns audio.
The WAV audio remains in memory.
The example does not save or play the audio.

## 2. Check the server

The client requires a running audio.cpp server.
The client does not require local model weights or a GPU.

1. Get the registered model list.

   ```sh
   curl http://192.168.5.151:8081/v1/models
   ```

2. Find the model ID that you want to use.

3. Use that ID in the client command or C++ code.

The model list includes registered models that are not loaded into memory.
A downloaded model does not appear until the server registers it.
Load a missing model in the server web UI, or add it to `server.json`.

Use `127.0.0.1:8080` only if the server runs on your client computer at port 8080.
See the [server guide](../../app/server/README.md) for server configuration.

## 3. Use the default voices

| Voice name | Reference recording |
| --- | --- |
| `lingCL` | `voices/lingCLvocals.wav` |
| `WangSG` | `voices/wangSG9s.wav` |

`lingCL` is the default voice.
The client sends the selected recording and its transcript to the server.
The transcripts are in `voices/prompt_text`.
Use a model that supports voice cloning.

Keep the complete `voices/` directory with the client.
CMake copies this directory into `build/`.

To use another voice directory, set this variable:

```sh
export IVRTTS_VOICE_DIR=/absolute/path/to/voices
```

In C++, use `set_preset_directory()` to set the directory.
An explicit directory has priority over the environment variable.
The supplied C++ example sets its directory to `voices`.

Other voice names refer to voices configured on the server.
Pass an empty voice argument (`''`) to use the server default.
Explicit reference audio in `clone()` has priority over the default voice.

## 4. Build and use the terminal client

1. Build the terminal client.

   ```sh
   cmake --build build --target ivrtts_cli --parallel
   ```

2. Show the available commands.

   ```sh
   ./build/ivrtts_cli --help
   ```

### Open the terminal user interface

Start the TUI and get the server model list:

```sh
./build/ivrtts_cli tui http://192.168.5.151:8081
```

To select an initial model, include its ID:

```sh
./build/ivrtts_cli tui http://192.168.5.151:8081 zipvoice
```

Use a terminal with at least 64 columns and 24 rows.
The TUI plays audio through SDL2.
The spectrum display uses samples sent to the audio device.

| Key | Action |
| --- | --- |
| `m` | Open the model list |
| Up / Down | Select a model or a history message |
| `Enter` in the model list | Use the selected model |
| `r` | Get the model list again |
| `e` | Open a blank message draft |
| `Enter` in a draft | Add the message to the history |
| `Esc` in a draft | Discard the draft |
| `Ctrl-U` in a draft | Clear the draft |
| `Ctrl-N` in a draft | Insert a new line |
| `Enter` in the history | Speak the selected message |
| `Tab` | Select `lingCL` or `WangSG` |
| `Space` | Pause or resume audio |
| `s` | Stop audio and cancel the client request |
| `+` / `-` | Adjust the volume |
| `p` | Set the selected model's PCM rate and channel count |
| `Esc` in the model list | Close the model list |
| `q` / `Esc` in the main view | Quit |

Only models with the `tts` or `clon` task can speak text.
Press `r` after you register a model in the server web UI.
A model change applies to the next speech request.

New messages do not overwrite previous messages.
The history remains available until you close the TUI.
Replay generates new audio with the current model and voice.

The audio queue holds up to three seconds of audio.
A pause can stop further reception when this queue becomes full.
The server can continue its current inference after you cancel the client request.

### Play audio without a disk file

Play with the default `lingCL` voice:

```sh
./build/ivrtts_cli play http://192.168.5.151:8081 zipvoice 'Hello.'
```

Play with `WangSG`:

```sh
./build/ivrtts_cli play http://192.168.5.151:8081 zipvoice 'Hello.' WangSG
```

These commands send WAV buffers to `ffplay`.
They do not write an audio file.

### Save a WAV file

```sh
./build/ivrtts_cli run http://192.168.5.151:8081 zipvoice out.wav 'Hello.'
```

### Use another reference recording

```sh
./build/ivrtts_cli clone http://192.168.5.151:8081 zipvoice cloned.wav \
  'Hello.' reference.wav 'Words spoken in the reference recording.'
```

Use `play-clone` instead of `clone` to play without a disk file:

```sh
./build/ivrtts_cli play-clone http://192.168.5.151:8081 zipvoice \
  'Hello.' reference.wav 'Words spoken in the reference recording.'
```

The reference file is on the client computer.
It must contain WAV audio.
It must not be empty or larger than 5 MiB.
Supply an accurate transcript if the model requires one.
Quote text and file paths that contain spaces.

## 5. Use audio streaming

ZipVoice completes speech generation before it returns WAV audio.
The TUI cannot change this model behavior.

A streaming model sends audio in parts during generation.
Configure that server model with `"mode": "streaming"`.
Use its actual output sample rate and channel count.

If the model produces 24 kHz mono audio, use:

```sh
./build/ivrtts_cli tui http://192.168.5.151:8081 streaming-model 24000 1
```

Replace `streaming-model` with the registered model ID.
You can also press `p` in the TUI and enter `24000 1`.
The TUI keeps separate PCM settings for each model during the session.

For playback without the TUI, use:

```sh
./build/ivrtts_cli stream http://192.168.5.151:8081 streaming-model 24000 1 'Hello.'
```

Use `stream-clone` to supply another reference recording:

```sh
./build/ivrtts_cli stream-clone http://192.168.5.151:8081 streaming-model 24000 1 \
  'Hello.' reference.wav 'Words spoken in the reference recording.'
```

The client requests `response_format=pcm` and `stream_format=audio`.
The returned samples use signed 16-bit little-endian PCM.
The response does not contain the sample rate or channel count.
A received buffer can divide a sample between two buffers.

The TUI accepts PCM16 WAV for offline models.
It uses raw PCM for streaming models.

## 6. Add ivrTTS to a C++ project

1. Copy this directory into `third_party/ivrTTS` in your project.

2. Add these lines after your application target in `CMakeLists.txt`.

   ```cmake
   set(IVRTTS_BUILD_TUI OFF CACHE BOOL "" FORCE)
   add_subdirectory(third_party/ivrTTS)
   target_link_libraries(my_app PRIVATE ivrTTS)
   ```

3. Replace `my_app` with your application target.

4. Include `ivrTTS.h` in your source file.

5. Set the actual voice directory path.

6. Call `create()` before you call `run()`.

Use [exampleTTS.cpp](exampleTTS.cpp) as the complete example.
The important calls are:

```cpp
ivrTTS tts;
tts.set_preset_directory("/absolute/path/to/ivrTTS/voices");
tts.create("http://192.168.5.151:8081", "zipvoice", "lingCL");
std::vector<unsigned char> wav = tts.run("Hello.");
tts.del();
```

`run()` returns the complete WAV audio in memory, including the WAV header.
The vector owns the audio buffer.
Its data remains valid until the vector changes or is destroyed.
Decode the WAV before you send samples to a raw audio device.

| Function | Result |
| --- | --- |
| `create()` | Set the local URL, model ID, voice, and timeout |
| `run()` | Return WAV audio in a vector |
| `clone()` | Return WAV audio from an explicit reference recording |
| `run_stream()` | Send received audio buffers to a callback |
| `clone_stream()` | Use a callback with an explicit reference recording |
| `del()` | Clear the local client context |
| `list_models()` | Get model metadata from `/v1/models` |

`create()` and `del()` do not create or delete a server session.
Each speech request uses `POST /v1/audio/speech`.
The client supports HTTP and HTTPS with default certificate verification.
It does not provide an authentication option.

Methods throw standard C++ exceptions for invalid inputs and request failures.
Requests have a 10-second connection timeout and a 300-second total timeout.
Use the fourth `create()` argument to change the total timeout in seconds.
The client does not retry failed requests automatically.
Do not change an instance while another thread uses it.

If you compile the sources without CMake, link libcurl and json-c.
Use a compiler with C++17 support and CMake 3.16 or later.

### Receive audio buffers in a callback

```cpp
tts.run_stream("Hello.", [](const unsigned char* bytes, std::size_t size) {
    // Consume these WAV bytes here.
    // Copy them if you need them after this callback returns.
});
```

The default callback format is WAV.
For a streaming model, pass `ivrTTS::AudioMode::StreamingPcm` as the third argument.

The buffer is valid only during the callback.
Callbacks run on the calling thread.
Throw from the callback to cancel the request.
The client passes that exception back to the caller.

## 7. Optional installation and checks

To install the library, header, CLI, and voices under your home directory, use:

```sh
cmake --install build --prefix "$HOME/.local"
```

The voices are installed in `share/ivrTTS/voices` under this prefix.
The CLI finds this directory relative to its installed executable.
Set the voice directory explicitly in applications that use the installed library.
The `exampleTTS` target remains in the build directory.

To configure the C++ tests, use:

```sh
cmake -S . -B build -DIVRTTS_BUILD_TESTS=ON
```

To build the client and tests, use:

```sh
cmake --build build --parallel
```

To run the tests, use:

```sh
ctest --test-dir build --output-on-failure
```

The tests do not require model weights or a physical audio device.
They use a local HTTP server and a test audio player written in C++.
The TUI test uses a simulated terminal and SDL2's dummy audio driver.
The test environment must permit local sockets and pseudo-terminals.

To build without the TUI dependencies, configure with:

```sh
cmake -S . -B build -DIVRTTS_BUILD_TUI=OFF
```

The library, `exampleTTS`, and command-line playback remain available.
