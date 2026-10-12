#pragma once

#include <string>
#include <functional>
#include <cstddef>
#include <vector>

// One instance represents a local client context; calls are synchronous.
class ivrTTS {
public:
    void create(const std::string& server_url, const std::string& model,
                const std::string& voice = "lingCL", long timeout_seconds = 300);
    // Directory containing lingCLvocals.wav, wangSG9s.wav and prompt_text.
    void set_preset_directory(const std::string& directory);
    std::vector<unsigned char> run(const std::string& text) const;
    std::vector<unsigned char> clone(const std::string& text,
                                     const std::string& reference_wav,
                                     const std::string& reference_text) const;
    // Buffer is valid only during the callback. Throw to cancel the request.
    using AudioSink = std::function<void(const unsigned char*, std::size_t)>;
    using CancelCheck = std::function<bool()>;
    enum class AudioMode { Wav, StreamingPcm }; // PCM: signed 16-bit little endian
    void run_stream(const std::string& text, const AudioSink& sink,
                    AudioMode mode = AudioMode::Wav, const CancelCheck& cancel = {}) const;
    void clone_stream(const std::string& text, const std::string& reference_wav,
                      const std::string& reference_text, const AudioSink& sink,
                      AudioMode mode = AudioMode::Wav, const CancelCheck& cancel = {}) const;
    void del() noexcept;

private:
    std::vector<unsigned char> speech(const std::string& text,
                                      const std::string& reference_fields) const;
    void speech_stream(const std::string& text, const std::string& reference_fields,
                       const AudioSink& sink, AudioMode mode, const CancelCheck& cancel = {}) const;
    std::string url_, model_, voice_;
    std::string preset_directory_;
    long timeout_ = 300;
};
