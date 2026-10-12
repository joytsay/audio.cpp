#include "ivrTTS.h"
#include <curl/curl.h>
#include <fstream>
#include <iterator>
#include <memory>
#include <stdexcept>
#include <exception>
#include <algorithm>
#include <filesystem>
#include <cstdlib>
#include <json-c/json.h>

#ifndef IVRTTS_DEFAULT_VOICE_DIR
#define IVRTTS_DEFAULT_VOICE_DIR "voices"
#endif

namespace {
std::string quote(const std::string& s) {
    const char* hex = "0123456789abcdef";
    std::string out = "\"";
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') { out += '\\'; out += c; }
        else if (c < 32) {
            out += "\\u00"; out += hex[c >> 4]; out += hex[c & 15];
        } else out += c;
    }
    return out + '"';
}
std::string base64(const std::vector<unsigned char>& bytes) {
    const char* alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    for (size_t i = 0; i < bytes.size(); i += 3) {
        unsigned n = unsigned(bytes[i]) << 16;
        if (i + 1 < bytes.size()) n |= unsigned(bytes[i + 1]) << 8;
        if (i + 2 < bytes.size()) n |= bytes[i + 2];
        out += alphabet[(n >> 18) & 63]; out += alphabet[(n >> 12) & 63];
        out += i + 1 < bytes.size() ? alphabet[(n >> 6) & 63] : '=';
        out += i + 2 < bytes.size() ? alphabet[n & 63] : '=';
    }
    return out;
}
struct Receiver {
    CURL* curl;
    const ivrTTS::AudioSink& sink;
    ivrTTS::AudioMode mode;
    std::string error_body;
    std::vector<unsigned char> prefix;
    std::exception_ptr failure;
    bool received = false;
    const ivrTTS::CancelCheck& cancel;
};
size_t receive(char* data, size_t size, size_t count, void* context) noexcept {
    auto& state = *static_cast<Receiver*>(context);
    const size_t length = size * count;
    try {
        if (state.cancel && state.cancel()) throw std::runtime_error("request cancelled");
        long code = 0;
        curl_easy_getinfo(state.curl, CURLINFO_RESPONSE_CODE, &code);
        if (code < 200 || code >= 300) {
            // Bound diagnostic memory; never deliver error JSON to the player.
            state.error_body.append(data, std::min(length, size_t(8192) - state.error_body.size()));
            return length;
        }
        char* type = nullptr;
        curl_easy_getinfo(state.curl, CURLINFO_CONTENT_TYPE, &type);
        const std::string content_type = type ? type : "";
        if (content_type.find("json") != std::string::npos ||
            content_type.find("text/") != std::string::npos)
            throw std::runtime_error("server returned non-audio content: " + content_type);
        if (state.mode == ivrTTS::AudioMode::Wav && state.prefix.size() < 12) {
            const size_t take = std::min(length, 12 - state.prefix.size());
            state.prefix.insert(state.prefix.end(), data, data + take);
            data += take;
            if (state.prefix.size() < 12) return length;
            if (std::string(state.prefix.begin(), state.prefix.begin() + 4) != "RIFF" ||
                std::string(state.prefix.begin() + 8, state.prefix.end()) != "WAVE")
                throw std::runtime_error("server did not return a WAV response");
            state.sink(state.prefix.data(), state.prefix.size());
            if (length > take) state.sink(reinterpret_cast<unsigned char*>(data), length - take);
        } else if (length) state.sink(reinterpret_cast<unsigned char*>(data), length);
        state.received = true;
    } catch (...) { state.failure = std::current_exception(); return 0; }
    return length;
}
int progress(void* context, curl_off_t, curl_off_t, curl_off_t, curl_off_t) noexcept {
    auto& state = *static_cast<Receiver*>(context);
    try { return state.cancel && state.cancel() ? 1 : 0; }
    catch (...) { state.failure = std::current_exception(); return 1; }
}
struct CurlRuntime {
    CurlRuntime() {
        if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK)
            throw std::runtime_error("curl initialization failed");
    }
    ~CurlRuntime() { curl_global_cleanup(); }
};
void initialize_curl() { static CurlRuntime runtime; }
}

std::vector<ivrTTS::Model> ivrTTS::list_models(const std::string& server_url,
                                            const CancelCheck& cancel) {
    if (server_url.rfind("http://", 0) != 0 && server_url.rfind("https://", 0) != 0)
        throw std::invalid_argument("model list requires an HTTP(S) URL");
    initialize_curl();
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(curl_easy_init(), curl_easy_cleanup);
    if (!curl) throw std::runtime_error("cannot allocate curl handle");
    std::string url = server_url;
    while (!url.empty() && url.back() == '/') url.pop_back();
    url += "/v1/models";
    struct ListState {
        std::string body;
        const CancelCheck& cancel;
        std::exception_ptr failure;
    } state{{}, cancel, {}};
    auto write = +[](char* bytes, size_t size, size_t count, void* context) noexcept -> size_t {
        auto& state = *static_cast<ListState*>(context);
        try {
            if (state.body.size() + size * count > 4 * 1024 * 1024)
                throw std::runtime_error("model list exceeds 4 MiB");
            state.body.append(bytes, size * count);
            return size * count;
        } catch (...) { state.failure = std::current_exception(); return 0; }
    };
    auto progress = +[](void* context, curl_off_t, curl_off_t, curl_off_t, curl_off_t) noexcept -> int {
        auto& state = *static_cast<ListState*>(context);
        try { return state.cancel && state.cancel() ? 1 : 0; }
        catch (...) { state.failure = std::current_exception(); return 1; }
    };
    auto set = [&](CURLoption option, auto value) {
        if (curl_easy_setopt(curl.get(), option, value) != CURLE_OK)
            throw std::runtime_error("cannot set curl option");
    };
    set(CURLOPT_URL, url.c_str()); set(CURLOPT_WRITEFUNCTION, write);
    set(CURLOPT_WRITEDATA, &state); set(CURLOPT_NOPROGRESS, 0L);
    set(CURLOPT_XFERINFOFUNCTION, progress); set(CURLOPT_XFERINFODATA, &state);
    set(CURLOPT_TIMEOUT, 10L); set(CURLOPT_CONNECTTIMEOUT, 5L); set(CURLOPT_NOSIGNAL, 1L);
    auto result = curl_easy_perform(curl.get());
    if (state.failure) std::rethrow_exception(state.failure);
    if (result != CURLE_OK) throw std::runtime_error(curl_easy_strerror(result));
    long code = 0; curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &code);
    if (code < 200 || code >= 300)
        throw std::runtime_error("HTTP " + std::to_string(code) + ": " + state.body.substr(0, 8192));
    std::unique_ptr<json_tokener, decltype(&json_tokener_free)> parser(json_tokener_new(), json_tokener_free);
    if (!parser) throw std::runtime_error("cannot allocate JSON parser");
    json_tokener_set_flags(parser.get(), JSON_TOKENER_STRICT);
    std::unique_ptr<json_object, decltype(&json_object_put)> root(
        json_tokener_parse_ex(parser.get(), state.body.c_str(), int(state.body.size())), json_object_put);
    if (!root || json_tokener_get_error(parser.get()) != json_tokener_success)
        throw std::runtime_error("invalid model-list JSON");
    json_object* data = nullptr;
    if (!json_object_object_get_ex(root.get(), "data", &data) || !json_object_is_type(data, json_type_array))
        throw std::runtime_error("model-list JSON requires a data array");
    auto field = [](json_object* item, const char* name) -> std::string {
        json_object* value = nullptr;
        if (!json_object_object_get_ex(item, name, &value)) return "";
        if (!json_object_is_type(value, json_type_string)) throw std::runtime_error("invalid model metadata");
        return {json_object_get_string(value), size_t(json_object_get_string_len(value))};
    };
    std::vector<Model> models;
    for (size_t i = 0; i < json_object_array_length(data); ++i) {
        auto* item = json_object_array_get_idx(data, i);
        if (!json_object_is_type(item, json_type_object)) throw std::runtime_error("invalid model entry");
        Model model{field(item, "id"), field(item, "family"), field(item, "task"), field(item, "mode"), false};
        if (model.id.empty()) throw std::runtime_error("model entry requires an id");
        json_object* loaded = nullptr;
        if (json_object_object_get_ex(item, "loaded", &loaded)) {
            if (!json_object_is_type(loaded, json_type_boolean)) throw std::runtime_error("invalid loaded flag");
            model.loaded = json_object_get_boolean(loaded);
        }
        models.push_back(std::move(model));
    }
    return models;
}

void ivrTTS::create(const std::string& url, const std::string& model,
                    const std::string& voice, long timeout) {
    if ((url.rfind("http://", 0) != 0 && url.rfind("https://", 0) != 0) || model.empty() || timeout <= 0)
        throw std::invalid_argument("create requires an HTTP(S) URL, model ID and positive timeout");
    url_ = url;
    while (!url_.empty() && url_.back() == '/') url_.pop_back();
    model_ = model; voice_ = voice; timeout_ = timeout;
}
void ivrTTS::set_preset_directory(const std::string& directory) { preset_directory_ = directory; }
void ivrTTS::del() noexcept { url_.clear(); model_.clear(); voice_.clear(); }
std::vector<unsigned char> ivrTTS::run(const std::string& text) const {
    return speech(text, "");
}
namespace {
std::string reference_fields(const std::string& path, const std::string& transcript) {
    std::ifstream file(path, std::ios::binary | std::ios::ate);
    if (!file) throw std::runtime_error("cannot open reference WAV: " + path);
    auto length = file.tellg();
    if (length <= 0 || length > 5 * 1024 * 1024)
        throw std::runtime_error("reference WAV must be between 1 byte and 5 MiB");
    std::vector<unsigned char> bytes(static_cast<size_t>(length));
    file.seekg(0);
    if (!file.read(reinterpret_cast<char*>(bytes.data()), bytes.size()))
        throw std::runtime_error("cannot read reference WAV: " + path);
    return std::string(",\"voice_ref\":{\"type\":\"base64\",\"data\":") +
        quote(base64(bytes)) + "},\"reference_text\":" + quote(transcript);
}
}
std::vector<unsigned char> ivrTTS::clone(const std::string& text,
    const std::string& path, const std::string& transcript) const {
    return speech(text, reference_fields(path, transcript));
}
void ivrTTS::run_stream(const std::string& text, const AudioSink& sink, AudioMode mode, const CancelCheck& cancel) const {
    speech_stream(text, "", sink, mode, cancel);
}
void ivrTTS::clone_stream(const std::string& text, const std::string& path,
    const std::string& transcript, const AudioSink& sink, AudioMode mode, const CancelCheck& cancel) const {
    speech_stream(text, reference_fields(path, transcript), sink, mode, cancel);
}
std::vector<unsigned char> ivrTTS::speech(const std::string& text,
    const std::string& reference) const {
    std::vector<unsigned char> result;
    speech_stream(text, reference, [&](const unsigned char* bytes, size_t size) {
        result.insert(result.end(), bytes, bytes + size);
    }, AudioMode::Wav);
    return result;
}
void ivrTTS::speech_stream(const std::string& text, const std::string& reference,
    const AudioSink& sink, AudioMode mode, const CancelCheck& cancel) const {
    if (!sink) throw std::invalid_argument("audio callback is required");
    if (model_.empty()) throw std::logic_error("call create before run or clone");
    if (text.empty()) throw std::invalid_argument("text must not be empty");
    initialize_curl();
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(curl_easy_init(), curl_easy_cleanup);
    if (!curl) throw std::runtime_error("cannot allocate curl handle");
    std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)> headers(
        curl_slist_append(nullptr, "Content-Type: application/json"), curl_slist_free_all);
    if (!headers) throw std::runtime_error("cannot allocate HTTP headers");
    std::string body = "{\"model\":" + quote(model_) + ",\"input\":" + quote(text) +
        (mode == AudioMode::Wav ? ",\"response_format\":\"wav\"" :
         ",\"response_format\":\"pcm\",\"stream_format\":\"audio\"");
    if (reference.empty() && !voice_.empty() && voice_ != "lingCL" && voice_ != "WangSG")
        body += ",\"voice\":" + quote(voice_);
    std::string resolved = reference;
    if (reference.empty() && (voice_ == "lingCL" || voice_ == "WangSG")) {
        std::filesystem::path directory = preset_directory_;
        if (directory.empty()) {
            const char* env = std::getenv("IVRTTS_VOICE_DIR");
            directory = env ? env : IVRTTS_DEFAULT_VOICE_DIR;
        }
        const std::string name = voice_ == "lingCL" ? "lingCLvocals" : "wangSG9s";
        std::ifstream prompts(directory / "prompt_text");
        std::string line, transcript;
        while (std::getline(prompts, line)) {
            if (line.rfind(name + "|", 0) == 0) { transcript = line.substr(name.size() + 1); break; }
        }
        if (transcript.empty()) throw std::runtime_error("missing preset transcript in " + (directory / "prompt_text").string());
        resolved = reference_fields((directory / (name + ".wav")).string(), transcript);
    }
    body += resolved + "}";
    Receiver receiver{curl.get(), sink, mode, {}, {}, {}, false, cancel};
    std::string endpoint = url_ + "/v1/audio/speech";
    char error[CURL_ERROR_SIZE] = {};
    auto set = [&](CURLoption option, auto value) {
        if (curl_easy_setopt(curl.get(), option, value) != CURLE_OK)
            throw std::runtime_error("cannot set curl option");
    };
    set(CURLOPT_URL, endpoint.c_str()); set(CURLOPT_HTTPHEADER, headers.get());
    set(CURLOPT_POSTFIELDS, body.c_str());
    set(CURLOPT_POSTFIELDSIZE_LARGE, static_cast<curl_off_t>(body.size()));
    set(CURLOPT_WRITEFUNCTION, &receive); set(CURLOPT_WRITEDATA, &receiver);
    set(CURLOPT_CONNECTTIMEOUT, 10L); set(CURLOPT_TIMEOUT, timeout_);
    set(CURLOPT_NOPROGRESS, 0L); set(CURLOPT_XFERINFOFUNCTION, &progress);
    set(CURLOPT_XFERINFODATA, &receiver);
    set(CURLOPT_NOSIGNAL, 1L); set(CURLOPT_ERRORBUFFER, error);
    auto status = curl_easy_perform(curl.get());
    if (receiver.failure) std::rethrow_exception(receiver.failure);
    if (status != CURLE_OK) throw std::runtime_error(std::string("HTTP request failed: ") +
        (error[0] ? error : curl_easy_strerror(status)));
    long code = 0;
    curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &code);
    if (code < 200 || code >= 300) throw std::runtime_error("HTTP " + std::to_string(code) +
        ": " + receiver.error_body);
    if (!receiver.received) throw std::runtime_error("server returned no complete audio buffer");
}
