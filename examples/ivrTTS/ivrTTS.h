#pragma once

#include <string>
#include <vector>

// One instance represents a local client context; calls are synchronous.
class ivrTTS {
public:
    void create(const std::string& server_url, const std::string& model,
                const std::string& voice = "", long timeout_seconds = 300);
    std::vector<unsigned char> run(const std::string& text) const;
    std::vector<unsigned char> clone(const std::string& text,
                                     const std::string& reference_wav,
                                     const std::string& reference_text) const;
    void del() noexcept;

private:
    std::vector<unsigned char> speech(const std::string& text,
                                      const std::string& reference_fields) const;
    std::string url_, model_, voice_;
    long timeout_ = 300;
};
