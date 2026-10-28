#pragma once
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <map>
#include <set>
#include <stdexcept>
#include <string>

inline std::string sip_trim(std::string value) {
    auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    return value.substr(first, value.find_last_not_of(" \t\r\n") - first + 1);
}

// Parse data only. Never source a shell script or expand commands/variables.
inline bool load_sip_env(const std::string& filename, bool required = false) {
    std::ifstream file(filename);
    if (!file) {
        if (!required && !std::filesystem::exists(filename)) return false;
        throw std::runtime_error("cannot read SIP settings file: " + filename);
    }
    const std::set<std::string> keys{
        "DTMF_1", "DTMF_2", "DTMF_3", "SIP_ACCOUNT", "SIP_PROXY", "SIP_TARGET", "SIP_CONTINUOUS", "SIP_ECHO_TEST", "SIP_TTS_DEBUG_DIR", "SIP_CONTACT_HOST", "SIP_CONTACT_URI", "SIP_TRACE", "SIP_SECRET", "SIP_AUTHUSER", "SIP_DISPLAY_NAME", "SIP_CODEC", "SIP_GREETING", "SIP_WAIT_FOR_MEDIA",
        "COTURN_URL", "COTURN_USERNAME", "COTURN_PASSWORD",
        "BARESIP_MODULE_PATH", "SIP_LISTEN", "SIP_INTERFACE", "SIP_RTP_PORTS", "SIP_DTMF_MODE",
        "AUDIOCPP_URL", "VAD_MODEL", "STT_MODEL", "STT_HOTWORDS", "STT_HOTWORDS_FILE", "STT_LANGUAGE",
        "LLM_URL", "LLM_MODEL", "LLM_API_KEY", "RAG_URL", "SYSTEM_PROMPT_FILE", "TTS_MODEL", "TTS_VOICE", "IVRTTS_VOICE_DIR"};
    const std::set<std::string> paths{"SIP_TTS_DEBUG_DIR", "BARESIP_MODULE_PATH", "STT_HOTWORDS_FILE", "SYSTEM_PROMPT_FILE", "IVRTTS_VOICE_DIR"};
    std::map<std::string, std::string> parsed;
    std::string line;
    size_t number = 0;
    auto invalid = [&] { return std::runtime_error("invalid SIP settings at " + filename + ":" + std::to_string(number)); };
    while (std::getline(file, line)) {
        ++number;
        if (number == 1 && line.rfind("\xef\xbb\xbf", 0) == 0) line.erase(0, 3);
        if (line.find('\0') != std::string::npos) throw invalid();
        line = sip_trim(line);
        if (line.empty() || line[0] == '#') continue;
        if (line.rfind("export ", 0) == 0) line = sip_trim(line.substr(7));
        auto equals = line.find('='); if (equals == std::string::npos) throw invalid();
        auto key = sip_trim(line.substr(0, equals));
        if (!keys.count(key) || parsed.count(key)) throw invalid();
        auto raw = sip_trim(line.substr(equals + 1));
        std::string value;
        if (!raw.empty() && (raw[0] == '\'' || raw[0] == '"')) {
            char quote = raw[0]; size_t i = 1; bool closed = false;
            for (; i < raw.size(); ++i) {
                char c = raw[i];
                if (c == quote) { ++i; closed = true; break; }
                if (quote == '"' && c == '\\' && i + 1 < raw.size()) {
                    char next = raw[++i];
                    if (next == 'n') c = '\n'; else if (next == 'r') c = '\r'; else if (next == 't') c = '\t';
                    else if (next == '\\' || next == '"') c = next;
                    else { value += '\\'; c = next; }
                }
                value += c;
            }
            auto tail = sip_trim(raw.substr(i));
            if (!closed || (!tail.empty() && tail[0] != '#')) throw invalid();
        } else {
            size_t comment = std::string::npos;
            for (size_t i = 0; i < raw.size(); ++i)
                if (raw[i] == '#' && (i == 0 || raw[i - 1] == ' ' || raw[i - 1] == '\t')) { comment = i; break; }
            value = sip_trim(raw.substr(0, comment));
        }
        if (paths.count(key) && !value.empty() && std::filesystem::path(value).is_relative())
            value = (std::filesystem::absolute(filename).parent_path() / value).lexically_normal().string();
        parsed.emplace(key, std::move(value));
    }
    if (file.bad()) throw std::runtime_error("cannot read SIP settings file: " + filename);
    for (const auto& setting : parsed) {
        // Explicit process environment takes priority over the file.
        if (!std::getenv(setting.first.c_str()) && setenv(setting.first.c_str(), setting.second.c_str(), 0) != 0)
            throw std::runtime_error("cannot set SIP configuration variable");
    }
    return true;
}
