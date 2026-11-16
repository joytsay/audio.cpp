#pragma once
// Private, local-machine protocol. Both ends use the same build/ABI; no network
// listener.
#include <cstdint>
#include <cstdio>
#include <stdexcept>
#include <string>
#include <vector>
namespace bluemagpie_ipc {
constexpr uint32_t magic = 0x424d0002;
constexpr uint32_t max_string = 1024 * 1024, max_samples = 48000 * 120;
enum Event : uint32_t { Ready = 1, Audio = 2, Done = 3, Error = 4 };
struct Request {
  uint32_t version = magic, seed = 1234;
  int32_t steps = 10, chunk_ms = 320, segment_bytes = 240;
  float guidance = 2;
  int32_t ref_rate = 0;
  uint32_t ref_samples = 0;
};
struct Header {
  uint32_t event = 0;
  int32_t sample_rate = 0, channels = 1;
  uint32_t size = 0;
};
inline void read(FILE *file, void *data, size_t size) {
  if (size && fread(data, 1, size, file) != size)
    throw std::runtime_error("BlueMagpie helper disconnected");
}
inline void write(FILE *file, const void *data, size_t size) {
  if (size && fwrite(data, 1, size, file) != size)
    throw std::runtime_error("BlueMagpie helper write failed");
}
inline std::string string(FILE *file) {
  uint32_t n;
  read(file, &n, sizeof(n));
  if (n > max_string)
    throw std::runtime_error("BlueMagpie string limit exceeded");
  std::string s(n, '\0');
  read(file, s.data(), n);
  return s;
}
inline void string(FILE *file, const std::string &s) {
  if (s.size() > max_string)
    throw std::runtime_error("BlueMagpie string limit exceeded");
  uint32_t n = static_cast<uint32_t>(s.size());
  write(file, &n, sizeof(n));
  write(file, s.data(), n);
}
inline void error(const std::string &s) {
  Header h{Error, 0, 1, static_cast<uint32_t>(s.size())};
  write(stdout, &h, sizeof(h));
  write(stdout, s.data(), s.size());
  fflush(stdout);
}
} // namespace bluemagpie_ipc
