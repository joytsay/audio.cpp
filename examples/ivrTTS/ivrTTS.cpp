#include "ivrTTS.h"
#include <curl/curl.h>
#include <fstream>
#include <iterator>
#include <memory>
#include <stdexcept>

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
size_t receive(char* data, size_t size, size_t count, void* context) noexcept {
    auto& out = *static_cast<std::vector<unsigned char>*>(context);
    try { out.insert(out.end(), data, data + size * count); }
    catch (...) { return 0; }
    return size * count;
}
struct CurlRuntime {
    CurlRuntime() {
        if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK)
            throw std::runtime_error("curl initialization failed");
    }
    ~CurlRuntime() { curl_global_cleanup(); }
};
}

void ivrTTS::create(const std::string& url, const std::string& model,
                    const std::string& voice, long timeout) {
    if ((url.rfind("http://", 0) != 0 && url.rfind("https://", 0) != 0) || model.empty() || timeout <= 0)
        throw std::invalid_argument("create requires an HTTP(S) URL, model ID and positive timeout");
    url_ = url;
    while (!url_.empty() && url_.back() == '/') url_.pop_back();
    model_ = model; voice_ = voice; timeout_ = timeout;
}
void ivrTTS::del() noexcept { url_.clear(); model_.clear(); voice_.clear(); }
std::vector<unsigned char> ivrTTS::run(const std::string& text) const {
    return speech(text, "");
}
std::vector<unsigned char> ivrTTS::clone(const std::string& text,
    const std::string& path, const std::string& transcript) const {
    std::ifstream file(path, std::ios::binary | std::ios::ate);
    if (!file) throw std::runtime_error("cannot open reference WAV: " + path);
    auto length = file.tellg();
    if (length <= 0 || length > 5 * 1024 * 1024)
        throw std::runtime_error("reference WAV must be between 1 byte and 5 MiB");
    std::vector<unsigned char> bytes(static_cast<size_t>(length));
    file.seekg(0);
    if (!file.read(reinterpret_cast<char*>(bytes.data()), bytes.size()))
        throw std::runtime_error("cannot read reference WAV: " + path);
    return speech(text, ",\"voice_ref\":{\"type\":\"base64\",\"data\":" +
        quote(base64(bytes)) + "},\"reference_text\":" + quote(transcript));
}
std::vector<unsigned char> ivrTTS::speech(const std::string& text,
    const std::string& reference) const {
    if (model_.empty()) throw std::logic_error("call create before run or clone");
    if (text.empty()) throw std::invalid_argument("text must not be empty");
    static CurlRuntime runtime;
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(curl_easy_init(), curl_easy_cleanup);
    if (!curl) throw std::runtime_error("cannot allocate curl handle");
    std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)> headers(
        curl_slist_append(nullptr, "Content-Type: application/json"), curl_slist_free_all);
    if (!headers) throw std::runtime_error("cannot allocate HTTP headers");
    std::string body = "{\"model\":" + quote(model_) + ",\"input\":" + quote(text) +
        ",\"response_format\":\"wav\"";
    if (reference.empty() && !voice_.empty()) body += ",\"voice\":" + quote(voice_);
    body += reference + "}";
    std::vector<unsigned char> result;
    std::string endpoint = url_ + "/v1/audio/speech";
    char error[CURL_ERROR_SIZE] = {};
    auto set = [&](CURLoption option, auto value) {
        if (curl_easy_setopt(curl.get(), option, value) != CURLE_OK)
            throw std::runtime_error("cannot set curl option");
    };
    set(CURLOPT_URL, endpoint.c_str()); set(CURLOPT_HTTPHEADER, headers.get());
    set(CURLOPT_POSTFIELDS, body.c_str());
    set(CURLOPT_POSTFIELDSIZE_LARGE, static_cast<curl_off_t>(body.size()));
    set(CURLOPT_WRITEFUNCTION, &receive); set(CURLOPT_WRITEDATA, &result);
    set(CURLOPT_CONNECTTIMEOUT, 10L); set(CURLOPT_TIMEOUT, timeout_);
    set(CURLOPT_NOSIGNAL, 1L); set(CURLOPT_ERRORBUFFER, error);
    auto status = curl_easy_perform(curl.get());
    if (status != CURLE_OK) throw std::runtime_error(std::string("HTTP request failed: ") +
        (error[0] ? error : curl_easy_strerror(status)));
    long code = 0;
    curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &code);
    if (code < 200 || code >= 300) throw std::runtime_error("HTTP " + std::to_string(code) +
        ": " + std::string(result.begin(), result.end()));
    if (result.size() < 12 || std::string(result.begin(), result.begin() + 4) != "RIFF" ||
        std::string(result.begin() + 8, result.begin() + 12) != "WAVE")
        throw std::runtime_error("server did not return a WAV response");
    return result;
}
