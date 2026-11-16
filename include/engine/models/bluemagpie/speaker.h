#pragma once
#include "engine/framework/runtime/session.h"
#include <filesystem>
#include <memory>
namespace engine::models::bluemagpie {
class SpeakerEncoder {
public:
  SpeakerEncoder(const std::filesystem::path &backbone,
                 const std::filesystem::path &codec,
                 const std::filesystem::path &checkpoint, int threads);
  ~SpeakerEncoder();
  std::vector<float> prefix(const runtime::AudioBuffer &reference);

private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};
} // namespace engine::models::bluemagpie
