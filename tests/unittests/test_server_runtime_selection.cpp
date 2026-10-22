// Public legacy handlers reject every explicit slots field before touching state.
// Exercise frontend forwarding too; no test hook in the original runtime is needed.
#include "runtime.h"
#include "sip_settings.h"
#include "engine/framework/io/json.h"

#include <filesystem>
#include <iostream>
#include <stdexcept>

int main() {
    try {
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
            const auto permissions = std::filesystem::status(saved).permissions();
            if ((permissions & (std::filesystem::perms::group_all | std::filesystem::perms::others_all)) != std::filesystem::perms::none)
                throw std::runtime_error("SIP credentials are not private");
        }
        minitts::server::ServerConfig config;
        config.backend = engine::core::BackendType::Cpu;
        config.ui_management = true;
        minitts::server::ServerState state(config, std::filesystem::current_path());
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
            for (const std::string path : {"/v1/ui/voices", "/v1/ui/knowledge", "/v1/ui/prompt", "/v1/ui/hotword"}) {
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
