#include "engine/community_models/voxcpm1/session.h"

#include <algorithm>
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace engine;
using namespace community_models::voxcpm1;

namespace {
void require(bool condition, const char *message) {
  if (!condition) throw std::runtime_error(message);
}
}

// Model-backed regression: run with a VoxCPM 0.5B GGUF path and optional --gpu.
int main(int argc, char **argv) {
  try {
    require(argc == 2 || (argc == 3 && std::string(argv[2]) == "--gpu"),
            "Usage: voxcpm1_streaming_decode MODEL_GGUF [--gpu]");
    auto assets = load_voxcpm1_assets(argv[1]);
    runtime::SessionOptions options;
    options.backend.threads = 8;
    if (argc == 3) options.backend.type = core::BackendType::Cuda;
    VoxCPM1StreamingSession session(
        {runtime::VoiceTaskKind::Tts, runtime::RunMode::Streaming}, options, assets);
    session.prepare({});
    runtime::TaskRequest request;
    request.text_input = runtime::Transcript{"您好，請問需要什麼協助？", "zh"};
    request.options = {{"seed", "1234"}, {"max_tokens", "7"},
                       {"min_tokens", "7"}, {"retry_badcase", "false"}};

    for (const auto *invalid : {"0", "17", "-1", "no", "1.5"}) {
      request.options["stream_decode_patches"] = invalid;
      bool rejected = false;
      try { session.start_stream(request); }
      catch (const std::exception &) { rejected = true; }
      require(rejected, "invalid decoder batch must be rejected");
    }

    std::vector<float> baseline;
    for (int batch : {1, 4, 16, 0}) {
      // Zero here exercises the default (four patches), not an option value.
      const int expected_batch = batch == 0 ? 4 : batch;
      if (batch == 0) request.options.erase("stream_decode_patches");
      else request.options["stream_decode_patches"] = std::to_string(batch);
      size_t calls = 0;
      bool returned = false;
      std::vector<float> streamed;
      session.set_stream_event_sink([&](const runtime::StreamEvent &event) {
        require(!returned, "audio must stream before start_stream returns");
        for (const auto &named : event.named_audio_outputs) {
          const size_t patches = std::min<size_t>(expected_batch, 7 - calls * expected_batch);
          require(named.audio.sample_rate == 16000 && named.audio.channels == 1,
                  "stream must remain 16 kHz mono");
          require(named.audio.samples.size() == patches * 1280,
                  "each chunk must contain only its new patches, including final partial group");
          require(named.meta.at("generated_patches") ==
                      std::to_string(std::min<size_t>(7, (calls + 1) * expected_batch)),
                  "chunk metadata must identify the last generated patch");
          streamed.insert(streamed.end(), named.audio.samples.begin(), named.audio.samples.end());
          ++calls;
        }
      });
      session.start_stream(request);
      returned = true;
      auto result = session.finish_stream();
      require(calls == static_cast<size_t>((7 + expected_batch - 1) / expected_batch),
              "wrong number of decoder chunks");
      require(result.audio_output && result.audio_output->samples == streamed,
              "merged output must match every streamed sample exactly");
      require(streamed.size() == 7 * 1280, "batching must conserve all output samples");
      if (baseline.empty()) baseline = streamed;
      double error_squared = 0;
      for (size_t i = 0; i < baseline.size(); ++i) {
        require(std::isfinite(streamed[i]), "all output samples must be finite");
        const double difference = streamed[i] - baseline[i];
        error_squared += difference * difference;
      }
      const double rms = std::sqrt(error_squared / baseline.size());
      require(rms < 1e-4, "batching must preserve the decoded waveform within floating-point tolerance");
      std::cout << "batch=" << expected_batch << " chunks=" << calls
                << " samples=" << streamed.size() << " rms_difference=" << rms << '\n';
    }
    std::cout << "VoxCPM1 streaming decoder regression passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
