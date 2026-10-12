#pragma once
#include <atomic>
#include <condition_variable>
#include <cstddef>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

struct SipPipelineConfig {
    std::string audio_url, llm_url, llm_model, rag_url;
    std::string vad_model = "silero-vad", stt_model = "qwen3-asr", tts_model = "zipvoice";
    std::string hotwords, prompt, language, voice = "lingCL";
    static SipPipelineConfig from_environment();
};

// Caller PCM is signed 16-bit little-endian, 16 kHz, mono.
// resume() starts a listening turn; a reply pauses input until playback completes.
class SipPipeline {
public:
    explicit SipPipeline(SipPipelineConfig config);
    ~SipPipeline();
    void resume();
    void feed(const unsigned char* bytes, std::size_t size) noexcept;
    bool take_reply(std::vector<unsigned char>& wav);
    std::string error();
    void stop();
private:
    void work();
    bool speech(const std::vector<unsigned char>& pcm);
    void respond(const std::vector<unsigned char>& pcm);
    std::string upload(const std::vector<unsigned char>& pcm);
    SipPipelineConfig config_;
    std::atomic<bool> stopping_{false};
    std::mutex mutex_;
    std::condition_variable ready_;
    std::deque<unsigned char> input_;
    std::vector<unsigned char> reply_;
    std::string error_;
    bool listening_ = false;
    std::vector<std::pair<std::string, std::string>> history_;
    std::thread worker_;
};
