#pragma once
#include <json-c/json.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <deque>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <string>

// Audio callbacks only update atomics. The SIP event loop publishes a bounded
// snapshot at 10 Hz, shared with the HTTP server using an atomic rename.
class SipMonitor {
public:
    static SipMonitor& get() { static SipMonitor monitor; return monitor; }
    static int64_t now() {
        return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
    }
    void levels(bool input, const int16_t* pcm, size_t size) noexcept {
        if (!enabled_) return;
        unsigned peak = 0;
        for (size_t i = 0; i < size; ++i) peak = std::max(peak, unsigned(std::abs(int(pcm[i]))));
        auto& target = input ? input_peak_ : output_peak_;
        auto old = target.load();
        while (old < peak && !target.compare_exchange_weak(old, peak)) {}
    }
    void registration(bool value) {
        std::lock_guard<std::mutex> lock(mutex_); registered_ = value;
    }
    void begin(const std::string& peer) {
        std::lock_guard<std::mutex> lock(mutex_);
        call_id_ = instance_ + "-" + std::to_string(++calls_); peer_ = peer; active_ = true;
        messages_.clear(); input_.clear(); output_.clear(); stage_ = "Call established";
    }
    void end() {
        std::lock_guard<std::mutex> lock(mutex_); active_ = false; registered_ = false; stage_ = "Call ended";
        input_peak_ = 0; output_peak_ = 0;
    }
    void event(const std::string& type, const std::string& summary) {
        if (!enabled_) return;
        std::lock_guard<std::mutex> lock(mutex_);
        events_.push_back({++sequence_, now(), type, bounded(summary, 512), call_id_});
        while (events_.size() > 100) events_.pop_front();
    }
    void stage(const std::string& value) {
        std::lock_guard<std::mutex> lock(mutex_); stage_ = value;
    }
    void dialogue(const std::string& source, const std::string& model) {
        std::lock_guard<std::mutex> lock(mutex_); dialogue_source_ = source; dialogue_model_ = model;
    }
    void message(const std::string& role, const std::string& content) {
        if (!enabled_) return;
        std::lock_guard<std::mutex> lock(mutex_);
        messages_.push_back({role, bounded(content, 2048)});
        while (messages_.size() > 40) messages_.pop_front();
    }
    void publish() noexcept {
        if (!enabled_) return;
        try {
            const auto stamp = now();
            if (stamp - published_ < 100) return;
            published_ = stamp;
            std::lock_guard<std::mutex> lock(mutex_);
            input_.push_back(active_ ? input_peak_.exchange(0) / 32768.0 : 0);
            output_.push_back(active_ ? output_peak_.exchange(0) / 32768.0 : 0);
            while (input_.size() > 36) input_.pop_front();
            while (output_.size() > 36) output_.pop_front();
            json_object* root = json_object_new_object();
            struct Cleanup { json_object* p; ~Cleanup() { json_object_put(p); } } cleanup{root};
            auto str = [](json_object* o, const char* key, const std::string& value) {
                json_object_object_add(o, key, json_object_new_string(value.c_str()));
            };
            if (!dialogue_source_.empty()) str(root, "dialogue_source", dialogue_source_);
            str(root, "instance", instance_); str(root, "call_id", call_id_); str(root, "peer", peer_); str(root, "stage", stage_);
            json_object_object_add(root, "active", json_object_new_boolean(active_));
            json_object_object_add(root, "registered", json_object_new_boolean(registered_));
            json_object_object_add(root, "updated_at", json_object_new_int64(stamp));
            auto* models = json_object_new_object();
            for (const auto& field : {std::pair{"vad", "VAD_MODEL"}, std::pair{"asr", "STT_MODEL"}, std::pair{"llm", "LLM_MODEL"}, std::pair{"tts", "TTS_MODEL"}}) {
                const char* value = std::getenv(field.second);
                str(models, field.first, std::string(field.first) == "llm" && !dialogue_model_.empty() ? dialogue_model_ : value ? value : "");
            }
            json_object_object_add(root, "models", models);
            auto bars = [&](const char* key, const std::deque<double>& values) {
                auto* a = json_object_new_array();
                for (double value : values) json_object_array_add(a, json_object_new_double(value));
                json_object_object_add(root, key, a);
            };
            bars("input", input_); bars("output", output_);
            auto* events = json_object_new_array();
            for (const auto& event : events_) {
                auto* e = json_object_new_object();
                json_object_object_add(e, "id", json_object_new_int64(event.id));
                json_object_object_add(e, "time", json_object_new_int64(event.time));
                str(e, "type", event.type); str(e, "summary", event.summary); str(e, "run", event.run);
                json_object_array_add(events, e);
            }
            json_object_object_add(root, "events", events);
            auto* messages = json_object_new_array();
            for (const auto& message : messages_) {
                auto* m = json_object_new_object(); str(m, "role", message.first); str(m, "content", message.second);
                json_object_array_add(messages, m);
            }
            json_object_object_add(root, "messages", messages);
            std::filesystem::create_directories(directory_);
            const auto temp = directory_ / "live.json.tmp";
            std::ofstream file(temp, std::ios::trunc);
            if (!file) return;
            std::filesystem::permissions(temp, std::filesystem::perms::owner_read | std::filesystem::perms::owner_write);
            file << json_object_to_json_string_ext(root, JSON_C_TO_STRING_PLAIN);
            file.close(); if (file) std::filesystem::rename(temp, directory_ / "live.json");
        } catch (...) { /* Monitoring must not interrupt a telephone call. */ }
    }
private:
    static std::string bounded(const std::string& text, size_t limit) {
        size_t end = std::min(limit, text.size());
        while (end < text.size() && end > 0 && (static_cast<unsigned char>(text[end]) & 0xc0) == 0x80) --end;
        return text.substr(0, end);
    }
    SipMonitor() : instance_(std::to_string(now())) {
        const char* dir = std::getenv("SIP_MONITOR_DIR");
        enabled_ = dir && *dir;
        if (enabled_) directory_ = dir;
    }
    struct Event { int64_t id, time; std::string type, summary, run; };
    bool enabled_ = false, active_ = false, registered_ = false;
    std::filesystem::path directory_;
    std::string instance_, call_id_, peer_, stage_ = "Waiting for registration";
    std::string dialogue_source_, dialogue_model_;
    int64_t published_ = 0, sequence_ = 0, calls_ = 0;
    std::atomic<unsigned> input_peak_{0}, output_peak_{0};
    std::mutex mutex_;
    std::deque<double> input_, output_;
    std::deque<Event> events_;
    std::deque<std::pair<std::string, std::string>> messages_;
};
