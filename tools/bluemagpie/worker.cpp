#include "protocol.h"
#include "tts_runner.h"
#include <cstdlib>
#include <memory>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
using namespace codec_common;
using namespace bluemagpie_ipc;
int main(int argc, char **argv) {
#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  codec_log_set([](codec_log_level, const char *message,
                   void *) { fputs(message, stderr); },
                nullptr);
  try {
    if (argc != 6)
      throw std::runtime_error("BlueMagpie helper requires backbone, codec, "
                               "threads, GPU and max frames");
    tts_runner_params base;
    base.backbone_path = argv[1];
    base.codec_path = argv[2];
    base.n_threads = std::stoi(argv[3]);
    base.use_gpu = std::stoi(argv[4]) != 0;
    base.max_frames = std::stoi(argv[5]);
    std::string reason;
    std::unique_ptr<tts_runner_session, decltype(&tts_runner_free)> session(
        tts_runner_load(base, &reason), tts_runner_free);
    if (!session)
      throw std::runtime_error(reason);
    Header ready{Ready, 48000, 1, 0};
    write(stdout, &ready, sizeof(ready));
    fflush(stdout);
    while (true) {
      Request r;
      const auto n = fread(&r, 1, sizeof(r), stdin);
      if (!n && feof(stdin))
        break;
      if (n != sizeof(r) || r.version != magic)
        throw std::runtime_error("BlueMagpie protocol version mismatch");
      auto p = base;
      p.text = string(stdin);
      p.voice = string(stdin);
      p.sampling.seed = r.seed;
      p.flow_steps = r.steps;
      p.flow_guidance = r.guidance;
      p.stream_chunk_ms = r.chunk_ms;
      p.segment_bytes = r.segment_bytes;
      if (r.ref_samples > max_samples || r.steps < 1 || r.steps > 100 ||
          r.chunk_ms < 1 || r.segment_bytes < 0)
        throw std::runtime_error("Invalid BlueMagpie request");
      std::vector<float> reference(r.ref_samples);
      read(stdin, reference.data(), reference.size() * sizeof(float));
      if (!reference.empty()) {
        if (reference.size() != 1536 || r.ref_rate != 0)
          throw std::runtime_error("Invalid BlueMagpie speaker embedding");
        p.bluemagpie_speaker_embedding = std::move(reference);
      }
      p.on_audio = [](const float *pcm, int32_t n, int32_t sr,
                      int32_t channels) {
        if (n <= 0)
          return true;
        Header h{Audio, sr, channels, static_cast<uint32_t>(n)};
        write(stdout, &h, sizeof(h));
        write(stdout, pcm, static_cast<size_t>(n) * sizeof(float));
        return fflush(stdout) == 0;
      };
      tts_runner_result result;
      if (!tts_runner_run(session.get(), p, &result)) {
        error(result.error);
        continue;
      }
      Header done{Done, result.sample_rate, result.n_channels, 0};
      write(stdout, &done, sizeof(done));
      fflush(stdout);
    }
  } catch (const std::exception &e) {
    try {
      error(e.what());
    } catch (...) {
    }
    return 1;
  }
}
