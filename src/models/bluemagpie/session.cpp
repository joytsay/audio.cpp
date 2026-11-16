#include "../../../tools/bluemagpie/protocol.h"
#include "engine/framework/model_spec/metadata.h"
#include "engine/framework/runtime/options.h"
#include "engine/framework/runtime/streaming_tts_session.h"
#include "engine/models/bluemagpie/loader.h"
#include "engine/models/bluemagpie/speaker.h"
#include "gguf.h"
#include <algorithm>
#include <cerrno>
#include <cmath>
#include <cstring>
#include <filesystem>
#include <memory>
#include <stdexcept>
#include <utility>
#ifndef _WIN32
#include <fcntl.h>
#include <signal.h>
#include <spawn.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>
#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif
extern char **environ;
#endif
namespace engine::models::bluemagpie {
namespace {
using namespace runtime;
namespace fs = std::filesystem;
namespace ipc = bluemagpie_ipc;
struct Assets {
  fs::path backbone, codec;
};
std::string architecture(const fs::path &path) {
  gguf_init_params p{};
  p.no_alloc = true;
  std::unique_ptr<gguf_context, decltype(&gguf_free)> ctx(
      gguf_init_from_file(path.string().c_str(), p), gguf_free);
  if (!ctx)
    throw std::runtime_error("Invalid BlueMagpie GGUF: " + path.string());
  auto key = gguf_find_key(ctx.get(), "general.architecture");
  if (key < 0 || gguf_get_kv_type(ctx.get(), key) != GGUF_TYPE_STRING)
    throw std::runtime_error("Missing GGUF architecture");
  return gguf_get_val_str(ctx.get(), key);
}
Assets assets(const ModelLoadRequest &request) {
  Assets a;
  auto path = request.model_path;
  if (fs::is_regular_file(path))
    a.backbone = path;
  else if (fs::is_directory(path) &&
           fs::is_regular_file(path / "BlueMagpie-Barbet-1B-q8_0.gguf")) {
    a.backbone = path / "BlueMagpie-Barbet-1B-q8_0.gguf";
  } else if (fs::is_directory(path)) {
    for (const auto &entry : fs::directory_iterator(path)) {
      auto name = entry.path().filename().string();
      if (entry.is_regular_file() && name.rfind("BlueMagpie-Barbet-", 0) == 0 &&
          entry.path().extension() == ".gguf") {
        if (!a.backbone.empty())
          throw std::runtime_error(
              "Multiple BlueMagpie backbones; select a GGUF file");
        a.backbone = entry.path();
      }
    }
  }
  if (a.backbone.empty())
    throw std::runtime_error("BlueMagpie Barbet backbone GGUF is missing");
  a.backbone = fs::absolute(a.backbone);
  a.codec = a.backbone.parent_path() / "BlueMagpie-AudioVAE-q8_0.gguf";
  if (!fs::is_regular_file(a.codec))
    throw std::runtime_error(
        "BlueMagpie requires BlueMagpie-AudioVAE-q8_0.gguf beside its "
        "backbone");
  if (architecture(a.backbone) != "barbet" ||
      architecture(a.codec) != "bluemagpie_audiovae")
    throw std::runtime_error(
        "The selected GGUF pair is not BlueMagpie Barbet/AudioVAE");
  return a;
}
CapabilitySet model_capabilities() {
  CapabilitySet c;
  c.supported_tasks = {
      {VoiceTaskKind::Tts, {RunMode::Offline, RunMode::Streaming}},
      {VoiceTaskKind::VoiceCloning, {RunMode::Offline, RunMode::Streaming}}};
  c.supports_speaker_reference = true;
  c.languages = {"zh", "en"};
  return c;
}
ModelMetadata model_metadata() {
  ModelMetadata m;
  m.family = "bluemagpie";
  m.variant = "barbet-1b";
  m.description = "BlueMagpie Taiwanese Mandarin TTS with speaker-reference "
                  "cloning and 48 kHz streaming.";
  return m;
}
int integer(const std::unordered_map<std::string, std::string> &options,
            const char *name, int value, int low, int high) {
  auto n = parse_int_option(options, {name}).value_or(value);
  if (n < low || n > high)
    throw std::runtime_error(std::string(name) +
                             " is outside its supported range");
  return n;
}
fs::path helper_path(const SessionOptions &options) {
  if (auto p = find_option(options.options, {"bluemagpie.worker_path"}))
    return fs::u8path(*p);
#ifndef _WIN32
  fs::path executable;
#ifdef __APPLE__
  char path[8192];
  uint32_t length = sizeof(path);
  if (_NSGetExecutablePath(path, &length) == 0)
    executable = path;
#else
  std::error_code error;
  executable = fs::read_symlink("/proc/self/exe", error);
#endif
  auto adjacent =
      executable.parent_path() / "bluemagpie" / "audiocpp-bluemagpie-worker";
  if (fs::is_regular_file(adjacent))
    return adjacent;
#endif
#ifdef AUDIOCPP_BLUEMAGPIE_WORKER
  if (fs::is_regular_file(AUDIOCPP_BLUEMAGPIE_WORKER))
    return AUDIOCPP_BLUEMAGPIE_WORKER;
#endif
  throw std::runtime_error(
      "BlueMagpie helper is missing; build the bluemagpie model backend and "
      "keep bin/bluemagpie beside the executable");
}
class Worker {
#ifndef _WIN32
  int fd_ = -1;
  pid_t pid_ = -1;
#endif
public:
  Worker(const Assets &a, const SessionOptions &options) {
#ifdef _WIN32
    (void)a;
    (void)options;
    throw std::runtime_error(
        "BlueMagpie bundled backend currently requires Linux or macOS");
#else
    if (options.backend.type == core::BackendType::WebGPU ||
        options.backend.device != 0)
      throw std::runtime_error(
          "BlueMagpie helper supports CPU or the default compiled GPU device");
    const auto executable = helper_path(options).string();
    std::vector<std::string> args{
        executable,
        a.backbone.string(),
        a.codec.string(),
        std::to_string(std::max(1, options.backend.threads)),
        options.backend.type == core::BackendType::Cpu ? "0" : "1",
        std::to_string(
            integer(options.options, "bluemagpie.max_frames", 512, 1, 4096))};
    int sockets[2];
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, sockets) != 0)
      throw std::runtime_error("Cannot create BlueMagpie helper socket");
    // Keep IPC descriptors away from stdin/stdout even in a daemon that
    // started with those closed. CLOEXEC also prevents sibling sessions
    // from inheriting each other's channels.
    int channel[2] = {fcntl(sockets[0], F_DUPFD_CLOEXEC, 3),
                      fcntl(sockets[1], F_DUPFD_CLOEXEC, 3)};
    close(sockets[0]);
    close(sockets[1]);
    if (channel[0] < 0 || channel[1] < 0) {
      for (int fd : channel)
        if (fd >= 0)
          close(fd);
      throw std::runtime_error("Cannot duplicate BlueMagpie socket");
    }
    sockets[0] = channel[0];
    sockets[1] = channel[1];
#ifdef SO_NOSIGPIPE
    int yes = 1;
    setsockopt(sockets[0], SOL_SOCKET, SO_NOSIGPIPE, &yes, sizeof(yes));
#endif
    posix_spawn_file_actions_t actions;
    posix_spawn_file_actions_init(&actions);
    posix_spawn_file_actions_adddup2(&actions, sockets[1], STDIN_FILENO);
    posix_spawn_file_actions_adddup2(&actions, sockets[1], STDOUT_FILENO);
    posix_spawn_file_actions_addclose(&actions, sockets[0]);
    posix_spawn_file_actions_addclose(&actions, sockets[1]);
    std::vector<char *> argv;
    for (auto &arg : args)
      argv.push_back(arg.data());
    argv.push_back(nullptr);
    // Prefer the helper's private ggml even if the parent was launched with
    // a library path pointing at audio.cpp's ggml of the same soname.
#ifdef __APPLE__
    const std::string library_key = "DYLD_LIBRARY_PATH=";
#else
    const std::string library_key = "LD_LIBRARY_PATH=";
#endif
    std::vector<std::string> env;
    std::string libraries = fs::path(executable).parent_path().string();
    for (char **e = environ; *e; ++e) {
      std::string value = *e;
      if (value.rfind(library_key, 0) == 0)
        libraries += ":" + value.substr(library_key.size());
      else
        env.push_back(std::move(value));
    }
    env.push_back(library_key + libraries);
    std::vector<char *> envp;
    for (auto &value : env)
      envp.push_back(value.data());
    envp.push_back(nullptr);
    const auto status = posix_spawn(&pid_, executable.c_str(), &actions,
                                    nullptr, argv.data(), envp.data());
    posix_spawn_file_actions_destroy(&actions);
    close(sockets[1]);
    fd_ = sockets[0];
    if (status) {
      close(fd_);
      fd_ = -1;
      pid_ = -1;
      throw std::runtime_error("Cannot start BlueMagpie helper: " +
                               std::string(strerror(status)));
    }
    try {
      auto h = header();
      if (h.event != ipc::Ready)
        throw std::runtime_error("BlueMagpie helper failed to initialize");
    } catch (...) {
      stop();
      throw;
    }
#endif
  }
  ~Worker() { stop(); }
  Worker(const Worker &) = delete;
  Worker &operator=(const Worker &) = delete;
  void stop() noexcept {
#ifndef _WIN32
    if (fd_ >= 0) {
      close(fd_);
      fd_ = -1;
    }
    if (pid_ > 0) {
      kill(pid_, SIGTERM);
      int status;
      while (waitpid(pid_, &status, 0) < 0 && errno == EINTR) {
      }
      pid_ = -1;
    }
#endif
  }
  void read(void *data, size_t size) {
#ifndef _WIN32
    auto *out = static_cast<char *>(data);
    while (size) {
      auto n = recv(fd_, out, size, 0);
      if (n < 0 && errno == EINTR)
        continue;
      if (n <= 0)
        throw std::runtime_error(
            "BlueMagpie helper disconnected during inference");
      out += n;
      size -= n;
    }
#else
    (void)data;
    (void)size;
    throw std::runtime_error("Unsupported platform");
#endif
  }
  void write(const void *data, size_t size) {
#ifndef _WIN32
    auto *in = static_cast<const char *>(data);
    while (size) {
#ifdef MSG_NOSIGNAL
      auto n = send(fd_, in, size, MSG_NOSIGNAL);
#else
      auto n = send(fd_, in, size, 0);
#endif
      if (n < 0 && errno == EINTR)
        continue;
      if (n <= 0)
        throw std::runtime_error(
            "BlueMagpie helper disconnected while sending request");
      in += n;
      size -= n;
    }
#else
    (void)data;
    (void)size;
    throw std::runtime_error("Unsupported platform");
#endif
  }
  void string(const std::string &value) {
    if (value.size() > ipc::max_string)
      throw std::runtime_error("BlueMagpie input is too long");
    uint32_t n = static_cast<uint32_t>(value.size());
    write(&n, sizeof(n));
    write(value.data(), n);
  }
  ipc::Header header() {
    ipc::Header h;
    read(&h, sizeof(h));
    if (h.event == ipc::Error) {
      if (h.size > ipc::max_string)
        throw std::runtime_error("Invalid helper error size");
      std::string message(h.size, '\0');
      read(message.data(), h.size);
      throw std::runtime_error("BlueMagpie: " + message);
    }
    return h;
  }
};
class Session final : public IOfflineVoiceTaskSession,
                      public StreamingTtsSessionBase {
  TaskSpec task_;
  SessionOptions options_;
  Assets assets_;
  std::unique_ptr<Worker> worker_;
  std::unique_ptr<SpeakerEncoder> speaker_encoder_;
  TaskResult generate(const TaskRequest &request,
                      const StreamEventCallback &sink) {
    if (!request.text_input || request.text_input->text.empty())
      throw std::runtime_error("BlueMagpie requires nonempty text");
    auto text = request.text_input->text;
    if (text.size() > ipc::max_string)
      throw std::runtime_error("BlueMagpie text limit exceeded");
    ipc::Request r;
    r.steps = integer(request.options, "num_inference_steps", 10, 1, 100);
    r.chunk_ms = integer(request.options, "stream_chunk_ms", 320, 40, 5000);
    r.segment_bytes = integer(request.options, "segment_bytes", 240, 0, 4096);
    r.seed = static_cast<uint32_t>(
        integer(request.options, "seed", 1234, 0, 2147483647));
    r.guidance = parse_finite_float_option(request.options, {"guidance_scale"})
                     .value_or(2.f);
    if (r.guidance < 0 || r.guidance > 20)
      throw std::runtime_error("guidance_scale must be 0–20");
    const AudioBuffer *reference = nullptr;
    if (request.voice && request.voice->speaker) {
      if (request.voice->speaker->audio)
        reference = &*request.voice->speaker->audio;
      else if (request.voice->speaker->cached_voice_id)
        throw std::runtime_error(
            "BlueMagpie requires reference audio, not a cached voice ID");
    }
    if (!reference && request.audio_input)
      reference = &*request.audio_input;
    if (task_.task == VoiceTaskKind::VoiceCloning && !reference)
      throw std::runtime_error(
          "BlueMagpie voice cloning requires reference audio");
    std::vector<float> mono;
    if (reference) {
      if (reference->sample_rate < 8000 || reference->sample_rate > 192000 ||
          reference->channels < 1 || reference->channels > 8 ||
          reference->samples.size() % reference->channels)
        throw std::runtime_error("Invalid BlueMagpie reference audio format");
      auto frames = reference->samples.size() / reference->channels;
      if (frames < static_cast<size_t>(reference->sample_rate) * 3 ||
          frames > static_cast<size_t>(reference->sample_rate) * 30)
        throw std::runtime_error(
            "BlueMagpie voice reference must be 3–30 seconds");
      if (frames > ipc::max_samples)
        throw std::runtime_error(
            "BlueMagpie voice reference exceeds sample limit");
      mono.resize(frames);
      for (size_t i = 0; i < frames; ++i)
        for (int c = 0; c < reference->channels; ++c) {
          auto v = reference->samples[i * reference->channels + c];
          if (!std::isfinite(v))
            throw std::runtime_error("Nonfinite reference sample");
          mono[i] += v / reference->channels;
        }
      const auto checkpoint =
          assets_.backbone.parent_path() / "embedding_model.ckpt";
      if (!fs::is_regular_file(checkpoint))
        throw std::runtime_error(
            "BlueMagpie cloning needs SpeechBrain embedding_model.ckpt; "
            "install the complete model package");
      if (!speaker_encoder_)
        speaker_encoder_ = std::make_unique<SpeakerEncoder>(
            assets_.backbone, assets_.codec, checkpoint,
            std::max(1, options_.backend.threads));
      mono = speaker_encoder_->prefix(
          AudioBuffer{reference->sample_rate, 1, std::move(mono)});
      r.ref_samples = static_cast<uint32_t>(mono.size());
    }
    auto voice = find_option(request.options, {"voice"}).value_or("");
    if (voice.size() > ipc::max_string)
      throw std::runtime_error("BlueMagpie voice name limit exceeded");
    if (!worker_)
      worker_ = std::make_unique<Worker>(assets_, options_);
    try {
      worker_->write(&r, sizeof(r));
      worker_->string(text);
      worker_->string(voice);
      worker_->write(mono.data(), mono.size() * sizeof(float));
      TaskResult result;
      AudioBuffer merged;
      size_t events = 0;
      while (true) {
        auto h = worker_->header();
        if (h.event == ipc::Done)
          break;
        if (h.event != ipc::Audio || h.sample_rate != 48000 ||
            h.channels != 1 || !h.size || h.size > ipc::max_samples ||
            ++events > 10000)
          throw std::runtime_error("Invalid BlueMagpie helper audio event");
        AudioBuffer audio;
        audio.sample_rate = h.sample_rate;
        audio.channels = h.channels;
        audio.samples.resize(h.size);
        worker_->read(audio.samples.data(),
                      audio.samples.size() * sizeof(float));
        if (!std::all_of(audio.samples.begin(), audio.samples.end(),
                         [](float x) { return std::isfinite(x); }))
          throw std::runtime_error("BlueMagpie produced nonfinite audio");
        append_audio_buffer(merged, audio);
        if (sink) {
          StreamEvent event;
          event.audio_output = std::move(audio);
          sink(event);
        }
      }
      if (merged.samples.empty())
        throw std::runtime_error("BlueMagpie generated no audio");
      result.audio_output = std::move(merged);
      return result;
    } catch (...) {
      worker_.reset();
      throw;
    }
  }
  TaskResult generate_stream(const TaskRequest &r) override {
    return generate(r, stream_event_sink());
  }
  void reset_stream_state() override {}

public:
  Session(TaskSpec task, SessionOptions options, Assets a)
      : task_(task), options_(std::move(options)), assets_(std::move(a)) {}
  std::string family() const override { return "bluemagpie"; }
  VoiceTaskKind task_kind() const override { return task_.task; }
  RunMode run_mode() const override { return task_.mode; }
  void prepare(const SessionPreparationRequest &) override {
    if (!worker_)
      worker_ = std::make_unique<Worker>(assets_, options_);
  }
  TaskResult run(const TaskRequest &r) override {
    if (task_.mode != RunMode::Offline)
      throw std::runtime_error("Use start_stream for streaming BlueMagpie");
    return generate(r, {});
  }
};
class Model final : public ILoadedVoiceModel {
  Assets assets_;
  ModelMetadata metadata_ = model_metadata();
  CapabilitySet caps_ = model_capabilities();

public:
  explicit Model(Assets a) : assets_(std::move(a)) {}
  const ModelMetadata &metadata() const noexcept override { return metadata_; }
  const CapabilitySet &capabilities() const noexcept override { return caps_; }
  std::unique_ptr<IVoiceTaskSession>
  create_task_session(const TaskSpec &task,
                      const SessionOptions &options) const override {
    if (task.task != VoiceTaskKind::Tts &&
        task.task != VoiceTaskKind::VoiceCloning)
      throw std::runtime_error("BlueMagpie supports TTS and voice cloning");
    if (task.mode != RunMode::Offline && task.mode != RunMode::Streaming)
      throw std::runtime_error("Unsupported BlueMagpie mode");
    return std::make_unique<Session>(task, options, assets_);
  }
};
class Loader final : public IVoiceModelLoader {
public:
  std::string family() const override { return "bluemagpie"; }
  std::vector<std::string> family_aliases() const override {
    return {"bluemagpie_tts", "blue_magpie"};
  }
  CapabilitySet advertised_capabilities() const override {
    return model_capabilities();
  }
  std::string advertised_instructions_policy() const override { return "none"; }
  bool can_load(const ModelLoadRequest &request) const override {
    try {
      if (request.family_hint && *request.family_hint != "bluemagpie" &&
          *request.family_hint != "bluemagpie_tts" &&
          *request.family_hint != "blue_magpie")
        return false;
      (void)assets(request);
      return true;
    } catch (...) {
      return false;
    }
  }
  ModelInspection inspect(const ModelLoadRequest &request) const override {
    auto a = assets(request);
    ModelInspection i;
    i.metadata = model_metadata();
    i.capabilities = model_capabilities();
    if (auto cli = engine::model_spec::cli_interface(family()))
      i.cli = *cli;
    i.model_root = a.backbone.parent_path();
    i.discovered_weights = {{"backbone", a.backbone}, {"audiovae", a.codec}};
    return i;
  }
  std::unique_ptr<ILoadedVoiceModel>
  load(const ModelLoadRequest &request) const override {
    return std::make_unique<Model>(assets(request));
  }
};
} // namespace
std::shared_ptr<runtime::IVoiceModelLoader> make_bluemagpie_loader() {
  return std::make_shared<Loader>();
}
} // namespace engine::models::bluemagpie
