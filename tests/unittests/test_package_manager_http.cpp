#include "engine/framework/package_manager/manager.h"
#include "engine/framework/io/json.h"
#include "httplib.h"

#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <mutex>
#include <set>
#include <stdexcept>
#include <thread>

int main() {
    namespace fs = std::filesystem;
    namespace json = engine::io::json;
    const auto root = fs::temp_directory_path() / ("audiocpp-http-test-" + std::to_string(
        std::chrono::steady_clock::now().time_since_epoch().count()));
    httplib::Server server;
    std::thread worker;
    std::mutex mutex;
    std::set<int> connections;
    int cdn_heads = 0;
    int downloads = 0;
    int interrupted_gets = 0;
    int denied_gets = 0;
    int failed_gets = 0;
    std::string resumed_range;
    std::string resumed_validator;
    auto require = [](bool condition, const char *message) {
        if (!condition) throw std::runtime_error(message);
    };
    int result = 0;
    try {
        fs::create_directories(root / "model_specs");
        std::ofstream(root / "model_specs" / "demo.json") << R"({
          "family":"demo","display_name":"Demo","category":"tts",
          "status":"supported","tasks":["tts"],"modes":["offline"],
          "capabilities":{},"runtime":{},
          "package_defaults":{"download":{"kind":"huggingface_snapshot","repo":"org/repo"}},
          "packages":[{"id":"demo","display_name":"Demo","format":"gguf",
            "precision":"f32","target_directory":"Demo",
            "files":["a.gguf","b.gguf","fallback.gguf","interrupted.gguf"]},
            {"id":"demo_denied","display_name":"Denied","format":"gguf","precision":"f32","target_directory":"Denied","files":["denied.gguf"]},
            {"id":"demo_failed","display_name":"Failed","format":"gguf","precision":"f32","target_directory":"Failed","files":["failed.gguf"]}]
        })";
        server.Get(R"(/org/repo/resolve/main/(.*))", [&](const auto &request, auto &response) {
            std::lock_guard<std::mutex> lock(mutex);
            connections.insert(request.remote_port);
            const auto file = request.matches[1].str();
            response.status = 302;
            response.set_header("Location", "/cdn/" + file);
            if (file != "fallback.gguf") {
                response.set_header("X-Linked-Size", "7");
                response.set_header("X-Linked-ETag", "\"same-etag\"");
                response.set_header("X-Repo-Commit", "revision");
                if (file == "a.gguf") {
                    response.set_header("X-Linked-ETag", "\"different-lfs-sha\"");
                    response.set_header("X-Xet-Hash", "same-etag");
                }
            }
        });
        server.Get(R"(/cdn/(.*))", [&](const auto &request, auto &response) {
            std::lock_guard<std::mutex> lock(mutex);
            if (request.method == "HEAD") ++cdn_heads;
            else ++downloads;
            response.set_header("ETag", "\"same-etag\"");
            response.set_header("X-Repo-Commit", "revision");
            if (request.method != "HEAD" && request.matches[1].str() == "denied.gguf") {
                ++denied_gets;
                response.status = 403;
                response.set_content("denied", "text/plain");
                return;
            }
            if (request.method != "HEAD" && request.matches[1].str() == "failed.gguf") {
                ++failed_gets;
                response.set_content_provider(7, "application/octet-stream",
                    [](size_t offset, size_t, httplib::DataSink & sink) {
                        if (offset != 0) return false;
                        return sink.write("pay", 3);
                    });
                return;
            }
            if (request.method != "HEAD" && request.matches[1].str() == "interrupted.gguf") {
                ++interrupted_gets;
                if (interrupted_gets == 1) {
                    // Advertise seven bytes, send only three, then disconnect.
                    response.set_content_provider(7, "application/octet-stream",
                        [](size_t offset, size_t, httplib::DataSink & sink) {
                            if (offset != 0) return false;
                            return sink.write("pay", 3);
                        });
                    return;
                }
                resumed_range = request.get_header_value("Range");
                resumed_validator = request.get_header_value("If-Range");
            }
            response.set_content("payload", "application/octet-stream");
        });
        const auto port = server.bind_to_any_port("127.0.0.1");
        require(port > 0, "fixture bind failed");
        const auto url = "http://127.0.0.1:" + std::to_string(port);
#ifdef _WIN32
        _putenv_s("AUDIOCPP_HF_BASE_URL", url.c_str());
#else
        setenv("AUDIOCPP_HF_BASE_URL", url.c_str(), 1);
#endif
        worker = std::thread([&] { server.listen_after_bind(); });
        while (!server.is_running()) std::this_thread::sleep_for(std::chrono::milliseconds(1));
        engine::package_manager::PackageManager manager(root, root / "models");
        const auto inventory = json::parse(manager.inventory(true, "demo"));
        const auto &row = inventory.as_array().at(0);
        require(json::require_string(row, "state") == "ok", "inventory failed");
        require(row.find("size_bytes")->as_f32() == 28, "redirect body size used instead of file size");
        require(json::require_string(row, "remote_revision") == "revision", "revision lost");
        {
            std::lock_guard<std::mutex> lock(mutex);
            require(connections.size() == 1, "inventory did not reuse its origin connection");
            require(cdn_heads == 1, "metadata redirects should skip CDN; missing metadata must fall back");
        }
        manager.install("demo", false, nullptr, nullptr);
        {
            std::lock_guard<std::mutex> lock(mutex);
            require(downloads == 5, "downloads must still follow redirects");
        }
        require(fs::file_size(root / "models" / "Demo" / "a.gguf") == 7, "bad installed payload");
        require(interrupted_gets == 2, "interrupted transfer must retry once");
        require(resumed_range == "bytes=3-", "retry must resume after received bytes");
        require(resumed_validator == "\"same-etag\"", "retry must validate object identity");
        std::ifstream resumed(root / "models" / "Demo" / "interrupted.gguf", std::ios::binary);
        std::string contents((std::istreambuf_iterator<char>(resumed)), {});
        require(contents == "payload", "resumed payload must not be duplicated or truncated");
        const auto manifest = json::parse_file(root / "models" / "Demo" / ".audiocpp-package-demo.json");
        require(manifest.require("files").require("a.gguf").require("etag").as_string() == "same-etag",
            "Xet metadata must preserve the original CDN ETag for existing manifests");
        bool auth_failed = false;
        try { manager.install("demo_denied", false, nullptr, nullptr); }
        catch (const std::exception & error) {
            auth_failed = std::string(error.what()).find("valid HF token") != std::string::npos;
        }
        require(auth_failed && denied_gets == 1, "authentication failures must not retry");
        require(!fs::exists(root / "models" / "Denied" / "denied.gguf"), "error body must not be installed");
        bool retry_limit = false;
        try { manager.install("demo_failed", false, nullptr, nullptr); }
        catch (const std::exception & error) {
            retry_limit = std::string(error.what()).find("5 attempts") != std::string::npos;
        }
        require(retry_limit && failed_gets == 5, "persistent read errors must stop after five attempts");
        require(!fs::exists(root / "models" / "Failed" / "failed.gguf"), "partial model must not be installed");
        const auto installed = json::parse(manager.inventory(true, "demo"));
        require(json::require_string(installed.as_array().at(0), "version_state") == "up_to_date",
            "metadata/manifest comparison changed");
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n';
        result = 1;
    }
    server.stop();
    if (worker.joinable()) worker.join();
    std::error_code error;
    fs::remove_all(root, error);
    if (result == 0) std::cout << "package_manager_http_test passed\n";
    return result;
}
