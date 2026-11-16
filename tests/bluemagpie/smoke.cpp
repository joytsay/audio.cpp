#include "engine/framework/audio/wav_reader.h"
#include "engine/framework/audio/wav_writer.h"
#include "engine/models/bluemagpie/loader.h"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <string>
using namespace engine;
void require(bool value, const char *message) {
  if (!value)
    throw std::runtime_error(message);
}
int main(int argc, char **argv) {
  try {
    if ((argc != 4 && argc != 5) ||
        (argc == 5 && std::string(argv[4]) != "--gpu"))
      throw std::runtime_error(
          "Usage: bluemagpie_smoke BACKBONE REFERENCE_WAV OUTPUT_DIR [--gpu]");
    auto loader = models::bluemagpie::make_bluemagpie_loader();
    runtime::ModelLoadRequest load;
    load.model_path = argv[1];
    load.family_hint = "bluemagpie";
    require(loader->can_load(load), "model detection");
    auto inspection = loader->inspect(load);
    require(inspection.discovered_weights.size() == 2,
            "both weight files must be discovered");
    require(inspection.capabilities.supports_speaker_reference,
            "clone capability");
    require(!inspection.cli.request_options.empty(),
            "model contract request options");
    assets::ModelPackage package{
        load.model_path.parent_path(),
        {load.model_path.filename(), "BlueMagpie-AudioVAE-q8_0.gguf"},
        "gguf"};
    require(loader->resolve_package_load(package).model_path == load.model_path,
            "package must load backbone, not codec");
    const auto q8 =
        load.model_path.parent_path() / "BlueMagpie-Barbet-1B-q8_0.gguf";
    if (std::filesystem::is_regular_file(q8)) {
      auto directory = load;
      directory.model_path = load.model_path.parent_path();
      require(loader->inspect(directory).discovered_weights.front().path == q8,
              "directory loading must prefer Q8_0 when multiple quantizations "
              "are present");
    }
    auto model = loader->load(load);
    runtime::SessionOptions options;
    options.backend.threads = 4;
    if (argc == 5)
      options.backend.type = core::BackendType::Cuda;
    options.options["bluemagpie.max_frames"] = "64";
    runtime::TaskSpec task{runtime::VoiceTaskKind::VoiceCloning,
                           runtime::RunMode::Offline};
    auto offline = model->create_task_session(task, options);
    auto *runner =
        dynamic_cast<runtime::IOfflineVoiceTaskSession *>(offline.get());
    require(runner, "offline interface");
    runtime::TaskRequest request;
    request.text_input = runtime::Transcript{"您好，歡迎來電。", "zh"};
    request.options = {
        {"seed", "1234"}, {"segment_bytes", "0"}, {"stream_chunk_ms", "320"}};
    bool rejected = false;
    try {
      runner->run(request);
    } catch (const std::exception &) {
      rejected = true;
    }
    require(rejected, "clone without reference must fail before inference");
    auto wav = audio::read_wav_f32(std::filesystem::path(argv[2]));
    wav.samples.resize(
        std::min(wav.samples.size(),
                 static_cast<size_t>(wav.sample_rate * wav.channels * 4)));
    request.voice = runtime::VoiceCondition{};
    request.voice->speaker = runtime::VoiceReference{};
    request.voice->speaker->audio = runtime::AudioBuffer{
        wav.sample_rate, wav.channels, std::move(wav.samples)};
    auto result = runner->run(request);
    require(result.audio_output.has_value(), "cloned audio");
    auto original = std::move(*result.audio_output);
    offline.reset();
    require(original.sample_rate == 48000 && original.channels == 1 &&
                !original.samples.empty(),
            "48 kHz output");
    require(std::all_of(original.samples.begin(), original.samples.end(),
                        [](float x) { return std::isfinite(x); }),
            "finite output");
    require(std::any_of(original.samples.begin(), original.samples.end(),
                        [](float x) { return std::abs(x) > 0.01f; }),
            "non-silent output");
    task.mode = runtime::RunMode::Streaming;
    auto streaming = model->create_task_session(task, options);
    auto *stream =
        dynamic_cast<runtime::IStreamingVoiceTaskSession *>(streaming.get());
    require(stream, "streaming interface");
    size_t chunks = 0, total = 0, largest = 0;
    bool returned = false;
    stream->set_stream_event_sink([&](const runtime::StreamEvent &event) {
      require(!returned, "audio arrives during generation");
      if (event.audio_output) {
        ++chunks;
        total += event.audio_output->samples.size();
        largest = std::max(largest, event.audio_output->samples.size());
        std::cout << "Audio chunk " << chunks << ": "
                  << event.audio_output->samples.size() << std::endl;
      }
    });
    stream->start_stream(request);
    returned = true;
    auto streamed = stream->finish_stream();
    require(chunks > 1 && largest < total,
            "single-segment generation must emit incremental PCM");
    require(streamed.audio_output &&
                streamed.audio_output->samples.size() == total,
            "stream events exactly cover final audio");
    require(streamed.audio_output->samples == original.samples,
            "same seed/reference yields identical offline and streamed output");
    std::filesystem::create_directories(argv[3]);
    audio::write_pcm16_wav(std::filesystem::path(argv[3]) / "clone-offline.wav",
                           48000, 1, original.samples);
    audio::write_pcm16_wav(std::filesystem::path(argv[3]) /
                               "clone-streaming.wav",
                           48000, 1, streamed.audio_output->samples);
    std::cout << "PASS BlueMagpie pair detection/package target, "
                 "missing-reference rejection, real voice cloning, 48 kHz "
                 "non-silent output, incremental streaming and offline parity ("
              << chunks << " chunks, " << total << " samples)" << std::endl;
  } catch (const std::exception &e) {
    std::cerr << e.what() << std::endl;
    return 1;
  }
}
