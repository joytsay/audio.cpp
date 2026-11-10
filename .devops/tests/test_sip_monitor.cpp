// Standalone regression: the native monitor's real snapshots through the HTTP
// handlers, settings validation, disabled lifecycle and credential preservation.
#include "sip_settings.h"
#include "sipMonitor.h"
#include <cassert>
#include <iostream>
#include <thread>
namespace minitts::server {
std::string json_quote(std::string_view value) { return engine::io::json::stringify_string(value); }
}
int main() {
    using namespace minitts::server;
    namespace json = engine::io::json;
    const auto root = std::filesystem::temp_directory_path() / ("sip-live-test-" + std::to_string(SipMonitor::now()));
    struct Cleanup { std::filesystem::path root; ~Cleanup() { std::filesystem::remove_all(root); } } cleanup{root};
    setenv("SIP_SETTINGS_DIR", root.c_str(), 1);
    setenv("SIP_MONITOR_DIR", root.c_str(), 1);
    assert(sip_live_response(false, root).status == 403);
    assert(!json::parse(sip_live_response(true, root).body).require("live").as_bool());
    HttpRequest r; r.method = "POST";
    r.body = R"({"proxy":"sip:test.example:9900","account":"sip:521@test.example","auth_user":"521","display_name":"521","secret":"private-test","enabled":true,"mode":"tts","echo":true,"interface":"eno1","listen":"192.168.2.111:15061"})";
    assert(sip_settings_response(r, false, root).status == 403);
    assert(sip_settings_response(r, true, root).status == 200);
    r.method = "GET";
    auto result = sip_settings_response(r, true, root);
    auto settings = json::parse(result.body);
    assert(result.body.find("private-test") == std::string::npos);
    assert(settings.require("enabled").as_bool() && settings.require("echo").as_bool());
    assert(settings.require("mode").as_string() == "tts");
    r.method = "POST"; r.body = R"({"enabled":false,"secret":""})";
    assert(sip_settings_response(r, true, root).status == 200);
    r.method = "GET";
    settings = json::parse(sip_settings_response(r, true, root).body);
    assert(!settings.require("enabled").as_bool() && settings.require("has_secret").as_bool());
    for (const auto* invalid : {R"({"enabled":"yes"})", R"({"mode":"bad"})", R"({"rtp_ports":"0-999999"})", R"({"listen":"hello\nSIP_SECRET=bad"})"}) {
        r.method = "POST"; r.body = invalid;
        assert(sip_settings_response(r, true, root).status == 400);
    }
    auto& monitor = SipMonitor::get(); monitor.registration(true); monitor.begin("sip:520@test.example");
    monitor.event("SIP_CALL_ESTABLISHED", "Call established");
    monitor.message("user", "測試"); monitor.message("assistant", "您好");
    const int16_t samples[] = {0, 10000, -20000};
    monitor.levels(true, samples, 3); monitor.levels(false, samples, 3); monitor.publish();
    auto live = json::parse(sip_live_response(true, root).body);
    assert(live.require("live").as_bool());
    const auto& status = live.require("status");
    assert(status.require("active").as_bool() && status.require("registered").as_bool());
    assert(status.require("input").as_array().back().as_number() > 0.5);
    assert(status.require("output").as_array().back().as_number() > 0.5);
    assert(status.require("messages").as_array().size() == 2);
    assert(status.require("events").as_array().size() == 1);
    monitor.end(); std::this_thread::sleep_for(std::chrono::milliseconds(110)); monitor.publish();
    live = json::parse(sip_live_response(true, root).body);
    assert(!live.require("status").require("active").as_bool());
    std::filesystem::last_write_time(root / "live.json", std::filesystem::file_time_type::clock::now() - std::chrono::seconds(5));
    assert(!json::parse(sip_live_response(true, root).body).require("live").as_bool());
    std::cout << "PASS: SIP settings, enable/disable, validation, private secret, live call, PCM levels, transcripts, hangup and stale monitor\n";
}
