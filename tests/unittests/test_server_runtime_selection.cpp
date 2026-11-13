// Public legacy handlers reject every explicit slots field before touching state.
// Exercise frontend forwarding too; no test hook in the original runtime is needed.
#include "runtime.h"
#include "server_ui.h"
#include "server_protocol.h"
#include "demo_settings.h"
#include "sip_settings.h"
#include "engine/framework/io/json.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>

int main() {
    try {
        {
            namespace srv = minitts::server;
            namespace json = engine::io::json;
            const auto root = std::filesystem::temp_directory_path() /
                ("demo-settings-test-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
            struct Cleanup { std::filesystem::path path; ~Cleanup() { std::filesystem::remove_all(path); } } cleanup{root};
            srv::HttpRequest request; request.method = "GET"; request.path = "/v1/ui/demo-settings";
            if (srv::demo_settings_response(request, false, root).status != 403 || std::filesystem::exists(root))
                throw std::runtime_error("settings bypassed management guard");
            const auto missing = srv::demo_settings_response(request, true, root);
            if (missing.status != 200 || !json::parse(missing.body).require("settings").is_null())
                throw std::runtime_error("first startup must use defaults without creating settings");
            request.method = "POST";
            request.body = R"({"settings":{"schema_version":1,"dialogue_source":"n8n","vad_enabled":false,"vad_threshold":0.65,"vad_window_ms":1000,"vad_end_silence_ms":2000,"asr_model_key":"package:qwen3-asr:q8","asr_model_task":"asr","asr_session_options":{"audio8_asr.repetition_penalty":"1.1","literal":"true"},"tts_voice_id":"preset-wangSG9s","tts_streaming":true,"tts_playback_rate":0.9,"lookup_notice_delay_seconds":7,"tts_test_text":"測試\n\"語音\""}})";
            const auto saved = srv::demo_settings_response(request, true, root);
            if (saved.status != 200) throw std::runtime_error("settings save failed: " + saved.body);
            const auto path = root / "ui-settings/demo-settings.yaml";
            const auto read = [&]() { std::ifstream input(path); return std::string(std::istreambuf_iterator<char>(input), {}); };
            const auto original = read();
            if (original.find("asr_session_options:\n") == std::string::npos) throw std::runtime_error("settings were not saved as readable YAML");
            request.method = "GET";
            const auto restored = json::parse(srv::demo_settings_response(request, true, root).body).require("settings");
            if (restored.require("dialogue_source").as_string() != "n8n" || restored.require("vad_enabled").as_bool() || restored.require("vad_threshold").as_number() != 0.65 || restored.require("vad_end_silence_ms").as_number() != 2000 || restored.require("tts_playback_rate").as_number() != 0.9 || restored.require("lookup_notice_delay_seconds").as_number() != 7 ||
                restored.require("asr_session_options").require("literal").as_string() != "true" ||
                restored.require("tts_test_text").as_string() != "測試\n\"語音\"")
                throw std::runtime_error("settings YAML lost types, options, or Unicode text");
            for (const auto * invalid : {R"({"settings":{"schema_version":1,"vad_end_silence_ms":499}})", R"({"settings":{"schema_version":1,"vad_end_silence_ms":5001}})", R"({"settings":{"schema_version":1,"lookup_notice_delay_seconds":0}})", R"({"settings":{"schema_version":1,"lookup_notice_delay_seconds":61}})", R"({"settings":{"schema_version":1,"lookup_notice_delay_seconds":1.5}})", R"({"settings":{"schema_version":1,"dialogue_source":"unknown"}})", R"({"settings":{"schema_version":1,"tts_playback_rate":0.2}})", R"({"settings":{"schema_version":2}})", R"({"settings":{"schema_version":1,"vad_threshold":2}})", R"({"settings":{"schema_version":1,"vad_enabled":"yes"}})", R"({"settings":{"schema_version":1,"asr_session_options":{"wrong":true}}})"}) {
                request.method = "POST"; request.body = invalid;
                if (srv::demo_settings_response(request, true, root).status != 400 || read() != original)
                    throw std::runtime_error("invalid settings changed the saved YAML");
            }
            { std::ofstream edit(path); edit << "schema_version: 1\nvad_threshold: 0.7\ntts_test_text: \"手動編輯\"\n"; }
            request.method = "GET";
            const auto edited = srv::demo_settings_response(request, true, root);
            if (edited.status != 200 || json::parse(edited.body).require("settings").require("vad_threshold").as_number() != 0.7)
                throw std::runtime_error("manual YAML edits were not read on restart");
            std::cout << "global demo model settings persistence passed\n";
        }

        {
            engine::runtime::AudioBuffer audio;
            audio.sample_rate = 24000; audio.channels = 2;
            audio.samples = {0.25f, -0.25f, 0.5f, -0.5f};
            const auto event = engine::io::json::parse(minitts::server::speech_audio_delta_json(audio));
            if (event.require("sample_rate").as_i64() != 24000 || event.require("channels").as_i64() != 2 ||
                event.require("format").as_string() != "pcm_s16le" || event.require("audio").as_string().empty())
                throw std::runtime_error("streaming speech lost its PCM format metadata");
        }
        {
            const auto root = std::filesystem::temp_directory_path() /
                ("jetson-info-test-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
            struct Cleanup { std::filesystem::path path; ~Cleanup() { std::filesystem::remove_all(path); } } cleanup{root};
            std::filesystem::create_directories(root / "host");
            std::filesystem::create_directories(root / "system/proc/device-tree");
            const auto info = [&]() { return engine::io::json::parse(minitts::server::ui_system_info_response(true, root / "host", root / "system").body); };
            if (minitts::server::ui_system_info_response(false, root / "host", root / "system").status != 403)
                throw std::runtime_error("system information bypassed UI guard");
            if (!info().require("model").as_string().empty()) throw std::runtime_error("unknown host was labeled as Jetson");
            { std::ofstream out(root / "host/os-release"); out << "PRETTY_NAME=\"Ubuntu 22.04.5 LTS\"\nNAME=\"Ubuntu\"\n"; }
            auto fallback = info();
            if (fallback.require("display_name").as_string() != "Ubuntu 22.04.5 LTS" ||
                fallback.require("description").as_string() != "OS: Ubuntu 22.04.5 LTS")
                throw std::runtime_error("OS fallback did not use the host PRETTY_NAME");
            { std::ofstream out(root / "host/model", std::ios::binary); out << "NVIDIA Jetson AGX Orin Developer Kit"; out.put('\0'); }
            { std::ofstream out(root / "host/nv_tegra_release"); out << "# R36 (release), REVISION: 4.4, GCID: 41062509, BOARD: generic\n"; }
            { std::ofstream out(root / "system/proc/device-tree/model"); out << "wrong container identity"; }
            auto detected = info();
            if (detected.require("model").as_string() != "NVIDIA Jetson AGX Orin Developer Kit" ||
                detected.require("short_model").as_string() != "NVIDIA Jetson AGX Orin" ||
                detected.require("l4t").as_string() != "36.4.4" || detected.require("jetpack").as_string() != "6.2.1" ||
                !detected.require("jetpack_inferred").as_bool() ||
                detected.require("display_name").as_string() != "NVIDIA Jetson AGX Orin")
                throw std::runtime_error("host model, NUL stripping, or L4T lookup failed");
            { std::ofstream out(root / "host/nv_tegra_release"); out << "# R36 (release), REVISION: 9.9, BOARD: generic\n"; }
            detected = info();
            if (!detected.require("jetpack").as_string().empty() || detected.require("l4t").as_string() != "36.9.9")
                throw std::runtime_error("unknown BSP was assigned an unverified JetPack version");
            std::filesystem::remove(root / "host/model");
            if (info().require("model").as_string() != "wrong container identity")
                throw std::runtime_error("native device-tree fallback failed");
            std::filesystem::remove(root / "system/proc/device-tree/model");
            { std::ofstream out(root / "host/os-release"); out << "NAME=Alpine\nVERSION=3.22\n"; }
            if (info().require("display_name").as_string() != "Alpine 3.22")
                throw std::runtime_error("OS NAME/VERSION fallback failed");
            std::cout << "Jetson host system information passed\n";
        }

        {
            const auto root = std::filesystem::temp_directory_path() /
                ("sip-settings-test-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
            struct Cleanup { std::filesystem::path path; ~Cleanup() { std::filesystem::remove_all(path); } } cleanup{root};
            minitts::server::HttpRequest request;
            request.path = "/v1/ui/sip";
            request.method = "POST";
            request.body = R"({"proxy":"sip:175.180.90.33:9900","account":"sip:521@175.180.90.33","auth_user":"521","display_name":"521","secret":"private-test-secret"})";
            if (minitts::server::sip_settings_response(request, false, root).status != 403 || std::filesystem::exists(root))
                throw std::runtime_error("SIP settings bypassed management guard");
            if (minitts::server::sip_settings_response(request, true, root).status != 200)
                throw std::runtime_error("SIP gateway settings were not saved");
            const auto saved = root / "sip-data" / "gateway.env";
            auto read = [&]() { std::ifstream input(saved); return std::string(std::istreambuf_iterator<char>(input), {}); };
            const auto original = read();
            request.method = "GET";
            const auto response = minitts::server::sip_settings_response(request, true, root);
            const auto settings = engine::io::json::parse(response.body);
            if (response.body.find("private-test-secret") != std::string::npos ||
                !settings.require("has_secret").as_bool() || settings.require("worker_running").as_bool() ||
                settings.require("proxy").as_string() != "sip:175.180.90.33:9900")
                throw std::runtime_error("SIP settings exposed secret or incorrect status");
            request.method = "POST";
            request.body = R"({"proxy":"sip:175.180.90.33:9900","account":"sip:521@175.180.90.33","auth_user":"521","display_name":"521","secret":""})";
            if (minitts::server::sip_settings_response(request, true, root).status != 200 || read() != original)
                throw std::runtime_error("blank SIP secret did not preserve saved credentials");
            request.body = R"({"proxy":"sip:host\nSIP_SECRET=injected","account":"sip:521@host","auth_user":"521","display_name":"521","secret":"x"})";
            if (minitts::server::sip_settings_response(request, true, root).status != 400 || read() != original)
                throw std::runtime_error("SIP settings accepted injected configuration");
            request.body = R"({"enabled":false,"mode":"tts","echo":true,"interface":"eno1","listen":"192.168.2.111:15061"})";
            if (minitts::server::sip_settings_response(request, true, root).status != 200)
                throw std::runtime_error("SIP sidebar settings save failed");
            request.method = "GET";
            const auto sidebar = engine::io::json::parse(minitts::server::sip_settings_response(request, true, root).body);
            if (sidebar.require("enabled").as_bool() || !sidebar.require("echo").as_bool() ||
                sidebar.require("mode").as_string() != "tts" || !sidebar.require("has_secret").as_bool())
                throw std::runtime_error("SIP sidebar settings did not round-trip");
            if (minitts::server::sip_live_response(false, root).status != 403 ||
                engine::io::json::parse(minitts::server::sip_live_response(true, root).body).require("live").as_bool())
                throw std::runtime_error("SIP live guard or missing monitor status failed");
            request.method = "POST"; request.body = R"({"call_id":"test-call","text":"我要新增工單。"})";
            if (minitts::server::sip_text_response(request, false, root).status != 403 ||
                minitts::server::sip_text_response(request, true, root).status != 409)
                throw std::runtime_error("SIP typed input bypassed management or active-call guard");
            auto snapshot = [&](const std::string& stage) { std::ofstream out(root / "sip-data/live.json"); out << "{\"active\":true,\"call_id\":\"test-call\",\"stage\":\"" << stage << "\"}"; };
            snapshot("Speaking");
            if (minitts::server::sip_text_response(request, true, root).status != 409)
                throw std::runtime_error("SIP typed input interrupted playback");
            snapshot("Listening");
            if (minitts::server::sip_text_response(request, true, root).status != 200 ||
                !std::filesystem::exists(root / "sip-data/text-turn.json") ||
                minitts::server::sip_text_response(request, true, root).status != 409)
                throw std::runtime_error("SIP typed input was not queued exactly once");
            const auto permissions = std::filesystem::status(saved).permissions();
            if ((permissions & (std::filesystem::perms::group_all | std::filesystem::perms::others_all)) != std::filesystem::perms::none)
                throw std::runtime_error("SIP credentials are not private");
        }
        {
            const auto root = std::filesystem::temp_directory_path() /
                ("greetings-csv-test-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
            struct Cleanup { std::filesystem::path path; ~Cleanup() { std::filesystem::remove_all(path); } } cleanup{root};
            std::filesystem::create_directories(root / "model_specs");
            { std::ofstream initial(root / "greetings.csv"); initial << "greeting\nHello\n"; }
            { std::ofstream initial(root / "hotwords.csv"); initial << "context\nX光機\n"; }
            minitts::server::ServerConfig csv_config;
            csv_config.backend = engine::core::BackendType::Cpu;
            csv_config.ui_management = true;
            minitts::server::ServerState csv_state(csv_config, root);
            for (bool forwarded : {false, true}) {
                minitts::server::HttpRequest request;
                request.method = "POST";
                request.path = "/v1/ui/greetings";
                request.body = R"({"content":"greeting\nWelcome to GeoVision IVR\n"})";
                const auto saved = forwarded ? csv_state.forward_to_core(request) : csv_state.handle(request);
                if (saved.status != 200) throw std::runtime_error("greeting CSV save failed: " + saved.body);
                request.method = "GET";
                const auto loaded = forwarded ? csv_state.forward_to_core(request) : csv_state.handle(request);
                if (loaded.status != 200 || engine::io::json::parse(loaded.body).require("content").as_string() !=
                    "greeting\nWelcome to GeoVision IVR\n") throw std::runtime_error("greeting CSV roundtrip failed");
                request.path = "/v1/ui/hotwords";
                request.method = "POST";
                request.body = R"({"content":"context\n\"台積電, X光機\"\n"})";
                const auto hotwords_saved = forwarded ? csv_state.forward_to_core(request) : csv_state.handle(request);
                if (hotwords_saved.status != 200) throw std::runtime_error("hotwords CSV save failed");
                request.method = "GET";
                const auto hotwords_loaded = forwarded ? csv_state.forward_to_core(request) : csv_state.handle(request);
                if (hotwords_loaded.status != 200 || engine::io::json::parse(hotwords_loaded.body).require("content").as_string() != "context\n\"台積電, X光機\"\n")
                    throw std::runtime_error("hotwords CSV did not persist and reload");
                std::ifstream persisted(root / "greetings.csv");
                if (std::string(std::istreambuf_iterator<char>(persisted), {}) != "greeting\nWelcome to GeoVision IVR\n")
                    throw std::runtime_error("greeting CSV was not persisted");
            }
        }
        minitts::server::ServerConfig config;
        config.backend = engine::core::BackendType::Cpu;
        config.ui_management = true;
        minitts::server::ServerState state(config, std::filesystem::current_path());
        {
            minitts::server::HttpRequest request;
            request.method = "GET";
            request.path = "/v1/ui/system-info";
            for (bool forwarded : {false, true}) {
                const auto response = forwarded ? state.forward_to_core(request) : state.handle(request);
                if (response.status != 200 || engine::io::json::parse(response.body).find("display_name") == nullptr)
                    throw std::runtime_error("system information route or frontend forwarding failed");
                request.path = "/v1/ui/demo-settings";
                const auto settings_response = forwarded ? state.forward_to_core(request) : state.handle(request);
                if (settings_response.status != 200 || engine::io::json::parse(settings_response.body).find("settings") == nullptr)
                    throw std::runtime_error("demo settings route or frontend forwarding failed");
                request.path = "/v1/ui/system-info";
            }
        }
        for (const std::string value : {"1", "2", "null", "false", "\"4\""}) {
            minitts::server::HttpRequest request;
            request.method = "POST";
            request.path = "/v1/models/load";
            request.body = "{\"slots\":" + value + "}";
            for (bool forwarded : {false, true}) {
                const auto response = forwarded ? state.forward_to_core(request) : state.handle(request);
                if (response.status != 400 ||
                    response.body.find("slots requires --parallel-jobs") == std::string::npos) {
                    throw std::runtime_error("legacy registration did not reject explicit slots");
                }
            }
        }
        minitts::server::HttpRequest list;
        list.method = "GET";
        list.path = "/v1/models";
        const auto response = state.handle(list);
        if (response.status != 200 ||
            !engine::io::json::parse(response.body).require("data").as_array().empty() ||
            response.body.find("slots") != std::string::npos) {
            throw std::runtime_error("rejected registration changed legacy model state");
        }
        std::cout << "legacy registration and frontend forwarding boundary passed\n";

        for (bool forwarded : {false, true}) {
            minitts::server::HttpRequest recipes;
            recipes.method = "GET";
            recipes.path = "/v1/recipes";
            const auto listed = forwarded ? state.forward_to_core(recipes) : state.handle(recipes);
            if (listed.status != 200 ||
                engine::io::json::parse(listed.body).require("data").as_array().empty()) {
                throw std::runtime_error("recipe listing was not dispatched");
            }
            recipes.method = "POST";
            recipes.path = "/v1/recipes/run";
            recipes.body = "{\"recipe\":\"unknown-recipe\"}";
            const auto rejected = forwarded ? state.forward_to_core(recipes) : state.handle(recipes);
            if (rejected.status != 400 || rejected.body.find("unknown recipe") == std::string::npos) {
                throw std::runtime_error("recipe errors bypassed shared HTTP handling");
            }
        }

        // Live speech needs `input` only for a model that speaks it. The entries
        // are lazy and the streams are never run, so no model loads and the
        // body is never read.
        minitts::server::ServerConfig live_config;
        live_config.backend = engine::core::BackendType::Cpu;
        live_config.device = 3;
        live_config.ui_enabled = false;
        for (const std::string task : {"tts", "s2s", "vc"}) {
            minitts::server::ServerModelConfig model;
            model.id = task;
            model.path = std::filesystem::temp_directory_path() / ("audiocpp-live-input-" + task);
            model.family = "live_input_fixture";
            model.task = task;
            model.mode = "streaming";
            model.lazy = true;
            if (task == "vc") model.device = 7;
            live_config.models.push_back(model);
        }
        minitts::server::ServerState live(live_config, std::filesystem::current_path());
        // The shared dispatcher must retain dev's routes and their UI guards.
        for (bool forwarded : {false, true}) {
            for (const std::string path : {"/v1/ui/voices", "/v1/ui/knowledge", "/v1/ui/prompt", "/v1/ui/hotword", "/v1/ui/hotwords", "/v1/ui/greetings"}) {
                minitts::server::HttpRequest request;
                request.method = "POST";
                request.path = path;
                request.body = "{}";
                const auto response = forwarded ? live.forward_to_core(request) : live.handle(request);
                if (response.status != 403) {
                    throw std::runtime_error("dev UI route lost its disabled guard: " + path);
                }
            }
            for (const std::string path : {"/v1/rag/initialize", "/v1/rag/graph", "/v1/rag/retrieve", "/v1/rag/index/add"}) {
                minitts::server::HttpRequest request;
                request.method = "POST";
                request.path = path;
                request.body = "{}";
                const auto response = forwarded ? live.forward_to_core(request) : live.handle(request);
                if (response.status != 404 || response.body.find("WebUI is disabled") == std::string::npos) {
                    throw std::runtime_error("dev RAG route was not dispatched: " + path);
                }
            }
        }
        minitts::server::HttpRequest live_list;
        live_list.method = "GET";
        live_list.path = "/v1/models";
        const auto live_models = engine::io::json::parse(live.handle(live_list).body).require("data").as_array();
        if (live_models.size() != 3 || live_models[0].require("device").as_number() != 3 ||
            live_models[1].require("device").as_number() != 3 ||
            live_models[2].require("device").as_number() != 7) {
            throw std::runtime_error("legacy model listing did not resolve per-model devices");
        }
        for (const std::string task : {"tts", "s2s", "vc"}) {
            for (const std::string input : {"", "&input="}) {
                std::istream pcm(nullptr);
                minitts::server::HttpRequest request;
                request.method = "POST";
                request.path = "/v1/audio/speech/live";
                request.query = "model=" + task + input;
                request.body_stream = &pcm;
                const auto response = live.handle(request);
                const bool rejected = response.status == 400 &&
                    response.body.find("live speech requires an 'input' query parameter") != std::string::npos;
                if (rejected != (task == "tts") || (!rejected && (response.status != 200 || !response.stream_body))) {
                    throw std::runtime_error("legacy live speech without input: " + task + " got HTTP " +
                                             std::to_string(response.status) + ": " + response.body);
                }
            }
        }
        std::cout << "legacy live speech input requirement passed\n";

        // The generic routes read a request `artifacts` array before the model
        // loads. A malformed one is a 400 naming the entry; a valid one gets as
        // far as loading the model, whose path does not exist.
        minitts::server::ServerConfig task_config;
        task_config.backend = engine::core::BackendType::Cpu;
        task_config.ui_enabled = false;
        minitts::server::ServerModelConfig task_model;
        task_model.id = "task";
        task_model.path = std::filesystem::temp_directory_path() / "audiocpp-legacy-task";
        task_model.family = "loader_free_fixture";
        task_model.task = "tts";
        task_model.lazy = true;
        task_config.models.push_back(task_model);
        minitts::server::ServerState tasks(task_config, std::filesystem::current_path());
        const auto routes = [](const std::string & artifacts) {
            return std::vector<std::pair<std::string, std::string>>{
                {"/v1/tasks/run", "{\"model\":\"task\",\"text\":\"hi\",\"artifacts\":" + artifacts + "}"},
                {"/v1/tasks/run", "{\"model\":\"task\",\"request\":{\"text\":\"hi\",\"artifacts\":" + artifacts + "}}"},
                {"/v1/tasks/stream", "{\"model\":\"task\",\"request\":{\"artifacts\":" + artifacts + "}}"},
                {"/v1/tasks/stream",
                 "{\"model\":\"task\",\"stream_format\":\"sse\",\"request\":{\"artifacts\":" + artifacts + "}}"},
                {"/v1/tasks/batch", "{\"model\":\"task\",\"requests\":[{\"text\":\"hi\"},{\"artifacts\":" + artifacts + "}]}"}};
        };
        const auto post = [&](const std::string & path, const std::string & body) {
            minitts::server::HttpRequest request;
            request.method = "POST";
            request.path = path;
            request.body = body;
            request.headers["content-type"] = "application/json";
            return tasks.handle(request);
        };
        for (const auto & [bad, message] : std::vector<std::pair<std::string, std::string>>{
                 {"{}", "artifacts must be an array of artifact objects"},
                 {"[{\"id\":\"x\",\"kind\":\"tokens\",\"payload\":\"\"}]", "artifacts[0] (x): unknown kind 'tokens'"},
                 {"[{\"id\":\"x\",\"kind\":\"custom\"}]", "artifacts[0] (x): give exactly one of payload"}}) {
            for (const auto & [path, body] : routes(bad)) {
                const auto response = post(path, body);
                if (response.status != 400 || response.body.find(message) == std::string::npos ||
                    response.body.find("invalid_request_error") == std::string::npos) {
                    throw std::runtime_error("legacy " + path + " did not reject artifacts " + bad + ": HTTP " +
                                             std::to_string(response.status) + ": " + response.body);
                }
            }
        }
        const std::string good =
            "[{\"id\":\"x\",\"kind\":\"custom\",\"payload\":\"aGVsbG8=\",\"meta\":{\"n\":1}},"
            "{\"id\":\"y\",\"kind\":\"acoustic_tokens\",\"payload\":\"\"}]";
        // With stream_format sse the headers go out before the model loads, so
        // the load failure comes from the stream body, before it writes anything.
        struct Writer final : minitts::server::HttpStreamWriter {
            std::string output;
            void write(std::string_view data) override { output.append(data); }
        };
        int streamed = 0;
        for (const auto & [path, body] : routes(good)) {
            std::string outcome;
            Writer writer;
            try {
                const auto response = post(path, body);
                outcome = "HTTP " + std::to_string(response.status) + ": " + response.body;
                if (response.stream_body) {
                    ++streamed;
                    if (response.status != 200 || response.content_type != "text/event-stream; charset=utf-8" ||
                        !response.body.empty()) {
                        throw std::runtime_error("unexpected stream response " + outcome);
                    }
                    response.stream_body(writer);
                }
            } catch (const std::exception & error) {
                outcome = error.what();
            }
            if (outcome.find("model path does not exist") == std::string::npos || !writer.output.empty()) {
                throw std::runtime_error("legacy " + path + " did not take valid artifacts to the model load: " + outcome +
                                         writer.output);
            }
        }
        if (streamed != 1) {
            throw std::runtime_error("legacy /v1/tasks/stream with stream_format sse did not stream");
        }
        std::cout << "legacy request artifacts parsing passed\n";

        for (const std::string value : {"\"audio\"", "\"SSE\"", "1", "[]"}) {
            const auto response = post("/v1/tasks/stream", "{\"model\":\"task\",\"stream_format\":" + value + "}");
            if (response.status != 400 || response.stream_body ||
                response.body.find("task stream stream_format must be sse") == std::string::npos ||
                response.body.find("invalid_request_error") == std::string::npos) {
                throw std::runtime_error("legacy /v1/tasks/stream took stream_format " + value + ": HTTP " +
                                         std::to_string(response.status) + ": " + response.body);
            }
        }
        std::cout << "legacy task stream format passed\n";
    } catch (const std::exception & error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
