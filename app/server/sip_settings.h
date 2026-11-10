#pragma once

#include "server_protocol.h"
#include "engine/framework/io/json.h"
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <map>
#include <mutex>
#include <regex>

namespace minitts::server {
inline std::filesystem::path sip_settings_root(const std::filesystem::path & base) {
    const char * configured = std::getenv("SIP_SETTINGS_DIR");
    return configured && *configured ? std::filesystem::path(configured) : base / "sip-data";
}

inline HttpResponse sip_live_response(bool management, const std::filesystem::path & base) {
    if (!management) return error_response(403, "SIP monitoring is disabled", "forbidden");
    const auto path = sip_settings_root(base) / "live.json";
    std::error_code ec;
    const auto modified = std::filesystem::last_write_time(path, ec);
    const bool fresh = !ec && std::filesystem::file_time_type::clock::now() - modified < std::chrono::seconds(3);
    std::ifstream input(path, std::ios::binary);
    std::string data;
    if (input) {
        char buffer[4096];
        while (input.read(buffer, sizeof(buffer)) || input.gcount()) {
            data.append(buffer, static_cast<size_t>(input.gcount()));
            if (data.size() > 1024 * 1024) return error_response(500, "SIP monitor exceeded size limit", "server_error");
        }
    }
    if (!data.empty()) engine::io::json::parse(data); // Never return partial/corrupt JSON.
    auto response = json_response("{\"live\":" + std::string(fresh ? "true" : "false") + ",\"status\":" + (data.empty() ? "null" : data) + "}");
    response.headers["Cache-Control"] = "no-store";
    return response;
}

// Values are parsed as data by sipEnv.h. Secrets never leave this endpoint.
inline HttpResponse sip_settings_response(const HttpRequest & request, bool management,
                                         const std::filesystem::path & base) {
    if (!management) return error_response(403, "SIP configuration is disabled", "forbidden");
    static std::mutex mutex;
    std::lock_guard<std::mutex> lock(mutex);
    namespace json = engine::io::json;
    const auto root = sip_settings_root(base), path = root / "gateway.env";
    const std::map<std::string, std::string> fields{
        {"proxy", "SIP_PROXY"}, {"account", "SIP_ACCOUNT"}, {"auth_user", "SIP_AUTHUSER"},
        {"display_name", "SIP_DISPLAY_NAME"}, {"mode", "SIP_MODE"}, {"interface", "SIP_INTERFACE"},
        {"listen", "SIP_LISTEN"}, {"contact_host", "SIP_CONTACT_HOST"}, {"rtp_ports", "SIP_RTP_PORTS"},
        {"codec", "SIP_CODEC"}, {"dtmf_mode", "SIP_DTMF_MODE"}, {"tts_model", "TTS_MODEL"},
        {"greeting1", "DTMF_1"}, {"greeting2", "DTMF_2"}, {"greeting3", "DTMF_3"}
    };
    std::map<std::string, std::string> values{
        {"SIP_PROXY", "sip:175.180.90.33:9900"}, {"SIP_ACCOUNT", "sip:521@175.180.90.33"},
        {"SIP_AUTHUSER", "521"}, {"SIP_DISPLAY_NAME", "521"},
        {"SIP_ENABLED", std::filesystem::exists(path) ? "1" : "0"}, {"SIP_MODE", "pipeline"},
        {"SIP_ECHO_TEST", "0"}, {"SIP_CODEC", "PCMU"}, {"SIP_DTMF_MODE", "rtp"},
        {"SIP_RTP_PORTS", "49160-49200"}, {"TTS_MODEL", "zipvoice"},
        {"DTMF_1", "歡迎來電期偶科技，請問我可以怎麼服務您？"},
        {"DTMF_2", "歡迎來電期偶科技，請問我可以怎麼服務您？"},
        {"DTMF_3", "歡迎來到台灣積體電路智慧櫃台"}
    };
    for (const auto & field : fields) values.try_emplace(field.second, "");
    std::ifstream input(path);
    std::string line;
    while (std::getline(input, line)) {
        const auto equals = line.find('=');
        if (equals != std::string::npos) values[line.substr(0, equals)] = json::parse(line.substr(equals + 1)).as_string();
    }
    if (request.method == "GET") {
        std::error_code ec;
        const auto heartbeat = std::filesystem::last_write_time(root / "worker.heartbeat", ec);
        const bool worker = !ec && std::filesystem::file_time_type::clock::now() - heartbeat < std::chrono::seconds(10);
        std::string body = "{\"schema_version\":2";
        for (const auto & field : fields) body += "," + json_quote(field.first) + ":" + json_quote(values[field.second]);
        body += ",\"enabled\":" + std::string(values["SIP_ENABLED"] == "1" ? "true" : "false");
        body += ",\"echo\":" + std::string(values["SIP_ECHO_TEST"] == "1" ? "true" : "false");
        body += ",\"has_secret\":" + std::string(values["SIP_SECRET"].empty() ? "false" : "true");
        body += ",\"worker_running\":" + std::string(worker ? "true" : "false") + "}";
        auto response = json_response(body); response.headers["Cache-Control"] = "no-store"; return response;
    }
    if (request.body.size() > 16384) return error_response(413, "SIP settings are too large", "invalid_request_error");
    const auto body = json::parse(request.body);
    if (!body.is_object()) return error_response(400, "SIP settings must be an object", "invalid_request_error");
    for (const auto & field : fields) {
        if (const auto * value = body.find(field.first)) {
            if (!value->is_string()) return error_response(400, "SIP settings must be strings", "invalid_request_error");
            values[field.second] = value->as_string();
        }
    }
    for (const auto & field : {std::pair{"enabled", "SIP_ENABLED"}, std::pair{"echo", "SIP_ECHO_TEST"}}) {
        if (const auto * value = body.find(field.first)) {
            if (!value->is_bool()) return error_response(400, "SIP switches must be booleans", "invalid_request_error");
            values[field.second] = value->as_bool() ? "1" : "0";
        }
    }
    if (const auto * secret = body.find("secret")) {
        if (!secret->is_string()) return error_response(400, "SIP secret must be a string", "invalid_request_error");
        if (!secret->as_string().empty()) values["SIP_SECRET"] = secret->as_string();
    }
    // Legacy gateway form saves still enable registration and preserve new fields.
    if (!body.find("enabled")) values["SIP_ENABLED"] = "1";
    auto invalid = [&](const std::string & message) { return error_response(400, message, "invalid_request_error"); };
    for (const auto & value : values)
        if (value.second.size() > 2048 || value.second.find_first_of("\r\n") != std::string::npos || value.second.find('\0') != std::string::npos)
            return invalid("SIP settings must be single lines of at most 2048 bytes");
    auto uri = [](const std::string & value) { return value.rfind("sip:", 0) == 0 && value.find_first_of(" \t\"<>") == std::string::npos; };
    if (!uri(values["SIP_PROXY"]) || !uri(values["SIP_ACCOUNT"]) || values["SIP_ACCOUNT"].find('@') == std::string::npos ||
        values["SIP_AUTHUSER"].empty() || values["SIP_DISPLAY_NAME"].find_first_of("\"\\<>") != std::string::npos)
        return invalid("Enter valid SIP URIs, authentication username, and display name");
    if (values["SIP_ENABLED"] == "1" && values["SIP_SECRET"].empty()) return invalid("Enter the SIP secret");
    if (values["SIP_MODE"] != "pipeline" && values["SIP_MODE"] != "tts") return invalid("Select IVR pipeline or keypad TTS mode");
    if (values["SIP_CODEC"] != "PCMU" && values["SIP_CODEC"] != "OPUS") return invalid("Select PCMU or OPUS");
    if (values["SIP_DTMF_MODE"] != "rtp" && values["SIP_DTMF_MODE"] != "info") return invalid("Select RTP or SIP INFO DTMF");
    const auto & host = values["SIP_CONTACT_HOST"];
    if (host.size() > 253 || host.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-") != std::string::npos)
        return invalid("Enter a Contact hostname without a port");
    std::smatch ports;
    if (!std::regex_match(values["SIP_RTP_PORTS"], ports, std::regex("([0-9]{1,5})-([0-9]{1,5})")) ||
        std::stoi(ports[1]) < 1024 || std::stoi(ports[2]) > 65535 || std::stoi(ports[1]) >= std::stoi(ports[2]))
        return invalid("Enter an RTP port range between 1024 and 65535");
    if (values["TTS_MODEL"].empty() || values["DTMF_1"].empty() || values["DTMF_2"].empty() || values["DTMF_3"].empty())
        return invalid("Enter the TTS model and three greeting texts");
    values["SIP_TARGET"] = "listen";
    std::filesystem::create_directories(root);
    const auto temporary = root / "gateway.env.tmp";
    {
        std::ofstream create(temporary, std::ios::trunc);
        if (!create) throw std::runtime_error("Cannot create SIP settings");
        std::filesystem::permissions(temporary, std::filesystem::perms::owner_read | std::filesystem::perms::owner_write);
        for (const auto & value : values) create << value.first << '=' << json_quote(value.second) << '\n';
        create.close(); if (!create) throw std::runtime_error("Cannot write SIP settings");
    }
    std::filesystem::rename(temporary, path);
    return json_response("{\"ok\":true,\"message\":\"Saved. The SIP worker applies changes within two seconds; an active call will end.\"}");
}
} // namespace minitts::server
