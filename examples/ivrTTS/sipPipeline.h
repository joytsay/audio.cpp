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

class ivrTTS;
struct SipTtsConfig {
    std::string model, voice, reference_audio, reference_text, greeting;
    bool streaming = false;
    void apply(ivrTTS& tts, const std::string& audio_url) const;
};
enum class SipTtsPurpose { Reply, Welcome, Keypad };
SipTtsConfig resolve_sip_tts(const std::string& dialogue_url, const std::string& model, const std::string& voice,
                            const std::atomic<bool>& stopping, SipTtsPurpose purpose = SipTtsPurpose::Reply);

struct SipPipelineConfig {
    std::string audio_url, llm_url, llm_model, rag_url, dialogue_url;
    bool use_rag = false;
    int end_silence_ms = 2000;
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
    bool queue_greeting();
    bool submit_text(const std::string& text);
    void feed(const unsigned char* bytes, std::size_t size) noexcept;
    bool take_reply(std::vector<unsigned char>& wav, bool* interim = nullptr, bool* streaming = nullptr, bool* complete = nullptr);
    std::string error();
    void stop();
private:
    void work();
    bool speech(const std::vector<unsigned char>& pcm);
    void respond(const std::vector<unsigned char>& pcm);
    void respond_text(std::string caller);
    std::string upload(const std::vector<unsigned char>& pcm);
    void synthesize_speech(std::string text, bool interim, SipTtsPurpose purpose = SipTtsPurpose::Reply);
    void refresh_settings();
    SipPipelineConfig config_;
    std::string session_id_;
    std::atomic<bool> stopping_{false};
    std::mutex mutex_;
    std::condition_variable ready_;
    std::deque<unsigned char> input_;
    struct QueuedReply { std::vector<unsigned char> wav; bool interim; bool streaming = false; bool complete = true; };
    std::deque<QueuedReply> replies_;
    std::string error_, pending_text_;
    bool listening_ = false, pending_greeting_ = false;
    std::vector<std::pair<std::string, std::string>> history_;
    std::thread worker_;
};
