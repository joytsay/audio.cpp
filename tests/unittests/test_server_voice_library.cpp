#include "voice_library.h"

#include <chrono>
#include <iostream>

namespace json = engine::io::json;
using minitts::server::VoiceLibrary;

void require(bool condition, const char * message) {
    if (!condition) throw std::runtime_error(message);
}

int main() {
    const auto root = std::filesystem::temp_directory_path() / ("voice-library-test-" +
        std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
    try {
        VoiceLibrary first(root);
        require(json::parse(first.list()).require("voices").as_array().empty(), "new library must be empty");
        std::vector<uint8_t> wav(46, 0);
        std::copy_n("RIFF", 4, wav.begin());
        std::copy_n("WAVE", 4, wav.begin() + 8);
        auto record = json::Value::make_object({
            {"id", json::Value::make_string("test-voice")},
            {"name", json::Value::make_string("中文 voice")},
            {"transcript", json::Value::make_string("你好\nHello")},
            {"createdAt", json::Value::make_number(1234567890000)},
            {"audio", json::Value::make_string(minitts::server::base64_encode(wav))}
        });
        first.save(json::stringify(record));
        VoiceLibrary restarted(root);
        const auto saved = json::parse(restarted.list()).require("voices").as_array();
        require(saved.size() == 1, "voice must survive server restart and be visible to another client");
        require(saved[0].require("transcript").as_string() == "你好\nHello", "transcript roundtrip");
        require(minitts::server::base64_decode(saved[0].require("audio").as_string()) == wav, "audio roundtrip");
        first.save(json::stringify(record));
        require(json::parse(first.list()).require("voices").as_array().size() == 1, "import must be idempotent");
        for (const auto & id : {"../outside", "/tmp/outside", "bad/name", "", ".."}) {
            auto invalid = record.as_object();
            invalid["id"] = json::Value::make_string(id);
            bool rejected = false;
            try { first.save(json::stringify(json::Value::make_object(invalid))); } catch (const std::invalid_argument &) { rejected = true; }
            require(rejected, "unsafe voice ID accepted");
            rejected = false;
            try { first.erase(id); } catch (const std::invalid_argument &) { rejected = true; }
            require(rejected, "unsafe deletion accepted");
        }
        auto invalid = record.as_object();
        invalid["audio"] = json::Value::make_string("aGVsbG8=");
        bool rejected = false;
        try { first.save(json::stringify(json::Value::make_object(invalid))); } catch (const std::invalid_argument &) { rejected = true; }
        require(rejected, "non-WAV recording accepted");
        std::ofstream(root / "interrupted.tmp") << "partial";
        require(json::parse(first.list()).require("voices").as_array().size() == 1, "partial save exposed");
        restarted.erase("test-voice");
        require(json::parse(first.list()).require("voices").as_array().empty(), "shared deletion not visible");
        first.erase("test-voice");
        std::filesystem::remove_all(root);
        std::cout << "PASS: shared voices, persistence, Unicode/audio roundtrip, idempotent import, validation and deletion\n";
        return 0;
    } catch (const std::exception & ex) {
        std::filesystem::remove_all(root);
        std::cerr << ex.what() << '\n';
        return 1;
    }
}
