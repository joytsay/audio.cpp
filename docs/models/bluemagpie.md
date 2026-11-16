# BlueMagpie-TTS

`bluemagpie` runs [BricksDisplay/BlueMagpie-TTS-GGUF](https://huggingface.co/BricksDisplay/BlueMagpie-TTS-GGUF): a Barbet 1B backbone plus AudioVAE, with 48 kHz mono output. It supports Taiwanese Mandarin, mixed Mandarin/English text, offline speech, speaker-reference cloning and audio streaming.

Although the acoustic path derives from VoxCPM, these files are not compatible with the VoxCPM1/2 loaders: Barbet combines attention and Mamba2, and the audio side includes speaker conditioning and a different decoder. audio.cpp uses a pinned [codec.cpp](https://github.com/mybigday/codec.cpp/tree/d5e385229ea5a0f48fff696fed4699a852aa43b7) C++ helper for this family. Its patched llama.cpp and ggml run in a separate process so their symbols cannot conflict with audio.cpp's ggml. No Python, external HTTP service or listening port is required. One helper loads once per session and serves successive requests.

## Build

Linux and macOS are supported by the bundled helper integration. Selecting `bluemagpie` (including the default `full` model set) builds it automatically. The first build requires Git/network access to fetch the pinned codec.cpp and its submodules. CPU builds need only the usual C++/CMake toolchain. CUDA/HIP/Vulkan/Metal build options are forwarded to the helper. The single-GPU helper forcibly disables NCCL in both codec.cpp and its isolated backbone, including existing build caches; runtime images do not need `libnccl.so.2`. Linux packaging checks reject an accidental NCCL dependency before the image is produced.

```sh
cmake -S . -B build -DAUDIOCPP_MODEL_SET=custom -DAUDIOCPP_MODELS=bluemagpie
cmake --build build --target audiocpp_cli audiocpp_server -j4
```

Docker’s `BUILD_JOBS` is passed to the helper and its nested backbone build.
For example, set `BUILD_JOBS=8` in the Compose `.env` to use `-j8` on the next build.
Standalone CMake builds can set `-DAUDIOCPP_BLUEMAGPIE_BUILD_JOBS=8`; the default
`0` uses `CMAKE_BUILD_PARALLEL_LEVEL` when set, otherwise the processor count.
Existing build caches retain an explicitly cached limit until it is changed.
Compiler launcher settings, including CUDA’s ccache launcher, propagate through
both nested builds.

For an offline build, first check out the pinned codec.cpp revision with its recursive submodules, then set `-DAUDIOCPP_BLUEMAGPIE_CODEC_SOURCE=/path/to/codec.cpp`.

Keep the complete `build/bin/bluemagpie/` directory next to the audio.cpp executable when copying build artifacts. It contains `audiocpp-bluemagpie-worker` and its private shared libraries. `--session-option bluemagpie.worker_path=/path/to/audiocpp-bluemagpie-worker` overrides the executable location. Each session uses its own model context; GPU execution uses the default compiled GPU/device, while `--backend cpu` keeps both stages on CPU.

## Download

In the WebUI **Models** download area, search **BlueMagpie**. The Q8_0 package is recommended; Q4_K_M, Q5_K_M, Q6_K and F16 are also available. Every package downloads the selected backbone, `BlueMagpie-AudioVAE-q8_0.gguf`, and SpeechBrain’s `embedding_model.ckpt` speaker encoder into its own directory. No conversion is needed.

For manual installation, download the two GGUF files from the model repository, and `embedding_model.ckpt` from [speechbrain/spkrec-ecapa-voxceleb](https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb), and keep them together. Pass the backbone GGUF as `--model`, or a directory containing the AudioVAE and backbone. Directory loading prefers Q8_0; if it is absent, the directory must contain exactly one backbone. An explicit GGUF file always selects that quantization.

## Synthesis and voice cloning

```sh
build/bin/audiocpp_cli --task tts --family bluemagpie \
  --model models/BlueMagpie-TTS-Q8_0/BlueMagpie-Barbet-1B-q8_0.gguf \
  --text '歡迎來電，請問我可以怎麼服務您？' --out speech.wav

build/bin/audiocpp_cli --task clon --family bluemagpie \
  --model models/BlueMagpie-TTS-Q8_0/BlueMagpie-Barbet-1B-q8_0.gguf \
  --voice-ref reference.wav --mode streaming \
  --text '今天的會議改到下午三點。' --out cloned.wav
```

Use a clear 3–30 second reference clip. audio.cpp extracts and caches a native ECAPA-TDNN centroid, projects it using the AudioVAE package’s speaker weights, and adds it to the learned Barbet speaker-token row. The bundled runner patch carries that conditioned prefix into Barbet and the residual language model; no reference transcript is needed. Existing WebUI voice-reference selection and streaming controls use the same session path. Traditional Chinese input is preserved.

Streaming emits decoded PCM while the autoregressive generation loop continues, rather than waiting for the whole utterance. `stream_chunk_ms` controls the approximate audio cadence (default 320 ms). `segment_bytes` sets punctuation-aware text segmentation (default 240 UTF-8 bytes; 0 sends all text at once). A segment ends before the next begins; chunked and offline decoder results can differ slightly at boundaries.

Request options: `seed` (default 1234), `num_inference_steps` (10), `guidance_scale` (2), `stream_chunk_ms` (320), `segment_bytes` (240). Session option `bluemagpie.max_frames` caps each segment at 512 latent patches by default (1–4096). Original model files and speaker references remain unchanged.

The weights retain the [original BlueMagpie license and intended uses](https://huggingface.co/OpenFormosa/BlueMagpie-TTS). The auxiliary SpeechBrain weights retain their Apache-2.0 terms. codec.cpp's MIT license and its transitive notices remain in the pinned source checkout.

## Local verification

With the model files and a reference clip available, the optional smoke target checks cloning, speaker-reference validation, single-sentence incremental PCM delivery and matching offline/streamed output:

```sh
cmake --build build --target bluemagpie_smoke -j4
build/bin/bluemagpie_smoke /path/to/BlueMagpie-Barbet-1B-q4_k_m.gguf assets/resources/b.wav /tmp/bluemagpie-audio
```

CPU and Jetson SM87 CUDA inference, Q8 reference cloning and single-sentence six-chunk 48 kHz streaming were verified locally, including matching offline/streamed audio. The native speech SSE endpoint, paired-package downloads and WebUI action were also checked. Append `--gpu` to the smoke command to exercise the CUDA backend.
