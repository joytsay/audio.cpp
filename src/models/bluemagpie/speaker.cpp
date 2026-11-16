#include "engine/models/bluemagpie/speaker.h"
#include "engine/framework/assets/torch_bin.h"
#include "engine/framework/audio/conversion.h"
#include "engine/framework/modules/speaker_encoders/ecapa_tdnn_runtime.h"
#include "gguf.h"
#include <cmath>
#include <cstring>
#include <fstream>
#include <stdexcept>
namespace engine::models::bluemagpie {
namespace {
namespace ecapa = engine::modules::ecapa_tdnn;
using Source = engine::assets::TensorSource;
ecapa::Conv1dWeights conv(const Source &s, const std::string &p,
                          int dilation = 1) {
  auto shape = s.require_metadata(p + ".weight").shape;
  if (shape.size() != 3)
    throw std::runtime_error("Invalid SpeechBrain convolution: " + p);
  ecapa::Conv1dWeights w;
  w.weight_name = p + ".weight";
  w.bias_name = p + ".bias";
  w.weight_source_shape = shape;
  w.out_channels = shape[0];
  w.in_channels = shape[1];
  w.kernel = shape[2];
  w.dilation = dilation;
  w.padding = (w.kernel - 1) * dilation / 2;
  return w;
}
ecapa::BatchNorm1dWeights norm(const Source &s, const std::string &p) {
  return {s.require_f32(p + ".weight"), s.require_f32(p + ".bias"),
          s.require_f32(p + ".running_mean"),
          s.require_f32(p + ".running_var")};
}
ecapa::TDNNBlockWeights tdnn(const Source &s, const std::string &p,
                             int dilation = 1) {
  return {conv(s, p + ".conv.conv", dilation), norm(s, p + ".norm.norm")};
}
std::shared_ptr<const ecapa::EcapaWeights>
load(const std::filesystem::path &checkpoint) {
  auto source = engine::assets::open_torch_bin_tensor_source(checkpoint);
  auto w = std::make_shared<ecapa::EcapaWeights>();
  w->source = source;
  w->block0 = tdnn(*source, "blocks.0");
  for (int i = 1; i <= 3; ++i) {
    auto p = "blocks." + std::to_string(i);
    ecapa::SERes2NetBlockWeights b;
    b.tdnn1 = tdnn(*source, p + ".tdnn1");
    b.tdnn2 = tdnn(*source, p + ".tdnn2");
    b.res2net.scale = 8;
    b.res2net.width = 128;
    for (int j = 0; j < 7; ++j)
      b.res2net.blocks.push_back(tdnn(
          *source, p + ".res2net_block.blocks." + std::to_string(j), i + 1));
    b.se.conv1 = conv(*source, p + ".se_block.conv1.conv");
    b.se.conv2 = conv(*source, p + ".se_block.conv2.conv");
    w->se_blocks.push_back(std::move(b));
  }
  w->mfa = tdnn(*source, "mfa");
  w->asp.tdnn = tdnn(*source, "asp.tdnn");
  w->asp.conv = conv(*source, "asp.conv.conv");
  w->asp_bn = norm(*source, "asp_bn.norm");
  w->fc = conv(*source, "fc.conv");
  return w;
}
void normalize(std::vector<float> &v) {
  double sum = 0;
  for (float x : v)
    sum += double(x) * x;
  if (!std::isfinite(sum) || sum < 1e-20)
    throw std::runtime_error("Invalid BlueMagpie speaker embedding");
  for (float &x : v)
    x /= std::sqrt(sum);
}
std::vector<float> speaker_token(const std::filesystem::path &backbone) {
  gguf_init_params p{};
  p.no_alloc = true;
  std::unique_ptr<gguf_context, decltype(&gguf_free)> ctx(
      gguf_init_from_file(backbone.string().c_str(), p), gguf_free);
  if (!ctx)
    throw std::runtime_error("Invalid BlueMagpie backbone");
  auto k = gguf_find_key(ctx.get(), "tokenizer.ggml.tokens");
  if (k < 0)
    throw std::runtime_error("Missing BlueMagpie vocabulary");
  int64_t token = -1;
  for (size_t i = 0; i < gguf_get_arr_n(ctx.get(), k); ++i)
    if (std::string(gguf_get_arr_str(ctx.get(), k, i)) == "<|bm_spk|>") {
      token = static_cast<int64_t>(i);
      break;
    }
  auto tensor = gguf_find_tensor(ctx.get(), "token_embd.weight");
  if (token < 0 || tensor < 0)
    throw std::runtime_error("Missing BlueMagpie speaker token embedding");
  auto type = gguf_get_tensor_type(ctx.get(), tensor);
  size_t row_size = ggml_row_size(type, 1536);
  auto offset = gguf_get_data_offset(ctx.get()) +
                gguf_get_tensor_offset(ctx.get(), tensor) + token * row_size;
  std::ifstream file(backbone, std::ios::binary);
  file.seekg(offset);
  std::vector<char> raw(row_size);
  file.read(raw.data(), raw.size());
  if (!file)
    throw std::runtime_error("Cannot read BlueMagpie speaker-token row");
  std::vector<float> values(1536);
  if (type == GGML_TYPE_F32)
    std::memcpy(values.data(), raw.data(), values.size() * sizeof(float));
  else {
    auto fn = ggml_get_type_traits(type)->to_float;
    if (!fn)
      throw std::runtime_error("Unsupported BlueMagpie embedding quantization");
    fn(raw.data(), values.data(), 1536);
  }
  return values;
}
} // namespace
struct SpeakerEncoder::Impl {
  core::ExecutionContext execution;
  ecapa::EcapaRuntime encoder;
  std::vector<float> token, weight, bias, norm;
  std::optional<runtime::AudioBuffer> cached_reference;
  std::vector<float> cached_prefix;
  Impl(const std::filesystem::path &backbone,
       const std::filesystem::path &codec,
       const std::filesystem::path &checkpoint, int threads)
      : execution(core::BackendConfig{core::BackendType::Cpu, 0, threads}),
        encoder(load(checkpoint), {}, execution,
                engine::assets::TensorStorageType::F32),
        token(speaker_token(backbone)) {
    auto source = engine::assets::open_tensor_source(codec);
    norm = source->require_f32("lm.speaker.norm.w", {192});
    weight = source->require_f32("lm.speaker.proj.w", {1536, 192});
    bias = source->require_f32("lm.speaker.proj.b", {1536});
  }
};
SpeakerEncoder::SpeakerEncoder(const std::filesystem::path &backbone,
                               const std::filesystem::path &codec,
                               const std::filesystem::path &checkpoint,
                               int threads)
    : impl_(std::make_unique<Impl>(backbone, codec, checkpoint, threads)) {}
SpeakerEncoder::~SpeakerEncoder() = default;
std::vector<float>
SpeakerEncoder::prefix(const runtime::AudioBuffer &reference) {
  auto &s = *impl_;
  if (s.cached_reference &&
      s.cached_reference->sample_rate == reference.sample_rate &&
      s.cached_reference->channels == reference.channels &&
      s.cached_reference->samples == reference.samples)
    return s.cached_prefix;
  runtime::AudioBuffer mono{
      16000, 1,
      engine::audio::
          convert_interleaved_audio_to_mono_torchaudio_sinc_hann_resampled(
              reference.samples, reference.sample_rate, reference.channels,
              16000)};
  std::vector<float> centroid(192, 0);
  size_t count = 0;
  for (size_t start = 0; start < mono.samples.size(); start += 96000) {
    size_t end = std::min(start + 96000, mono.samples.size());
    if (end - start < 16000)
      continue;
    runtime::AudioBuffer chunk{
        16000, 1, {mono.samples.begin() + start, mono.samples.begin() + end}};
    auto embedding = s.encoder.embed_audio(chunk);
    normalize(embedding);
    for (size_t j = 0; j < 192; ++j)
      centroid[j] += embedding[j];
    ++count;
  }
  if (!count)
    throw std::runtime_error("BlueMagpie reference contains no usable speech");
  normalize(centroid);
  double sum = 0;
  for (float x : centroid)
    sum += double(x) * x;
  float scale = 1 / std::sqrt(sum / 192 + 1e-6);
  for (size_t j = 0; j < 192; ++j)
    centroid[j] *= scale * s.norm[j];
  auto prefix = s.token;
  for (size_t i = 0; i < 1536; ++i) {
    double value = s.bias[i];
    for (size_t j = 0; j < 192; ++j)
      value += double(s.weight[i * 192 + j]) * centroid[j];
    prefix[i] += value;
  }
  s.cached_reference = reference;
  s.cached_prefix = prefix;
  return prefix;
}
} // namespace engine::models::bluemagpie
