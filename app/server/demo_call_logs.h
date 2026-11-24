#pragma once

#include "http.h"
#include "engine/framework/io/json.h"

#include <algorithm>
#include <chrono>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <mutex>
#include <regex>
#include <sstream>
#include <vector>

namespace minitts::server {

inline HttpResponse demo_call_log_response(const HttpRequest & request, bool management,
                                           const std::filesystem::path & base) {
    namespace fs = std::filesystem;
    namespace json = engine::io::json;
    if (!management) return error_response(403, "Demo call logs are disabled", "forbidden");
    if (request.body.size() > 64 * 1024)
        return error_response(413, "Call log entry exceeds 64 KiB", "invalid_request_error");

    static std::mutex mutex;
    std::lock_guard<std::mutex> lock(mutex);
    try {
        const auto body = json::parse(request.body);
        const auto id = json::require_string(body, "session_id");
        const auto started = json::require_i64(body, "started_at_ms");
        const auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        static const std::regex session_id("^(demo|sip)-[a-zA-Z0-9-]{1,60}$");
        if (!std::regex_match(id, session_id) || started < 1000000000000LL || started > now + 300000)
            return error_response(400, "Invalid call log session", "invalid_request_error");

        const auto & entries = body.require("entries").as_array();
        if (entries.empty() || entries.size() > 3)
            return error_response(400, "Expected one to three call log entries", "invalid_request_error");

        const auto timestamp = [](int64_t milliseconds) {
            const auto seconds = static_cast<std::time_t>(milliseconds / 1000);
            const auto * utc = std::gmtime(&seconds);
            if (!utc) throw std::invalid_argument("Invalid call log timestamp");
            std::ostringstream out;
            out << std::put_time(utc, "%Y-%m-%dT%H-%M-%S") << '.'
                << std::setfill('0') << std::setw(3) << milliseconds % 1000 << 'Z';
            return out.str();
        };
        const auto recorded = timestamp(now);
        std::ostringstream text;
        for (const auto & entry : entries) {
            const auto role = json::require_string(entry, "role");
            auto content = json::require_string(entry, "text");
            if ((role != "Caller" && role != "AI" && role != "Call") || content.empty())
                return error_response(400, "Invalid call log entry", "invalid_request_error");
            // Keep each interaction on one line, even when it came from a multiline utterance.
            std::replace_if(content.begin(), content.end(), [](unsigned char ch) { return ch < 32 || ch == 127; }, ' ');
            text << recorded << ' ' << role << ": " << content << '\n';
        }

        const auto root = base / "ui-settings" / "call-logs";
        if (fs::create_directories(root)) fs::permissions(root, fs::perms::owner_all);
        const auto filename = timestamp(started) + '-' + id + "-log.txt";
        const auto path = root / filename;
        static const std::regex call_file(
            "^[0-9]{4}(-[0-9]{2}){2}T[0-9]{2}(-[0-9]{2}){2}\\.[0-9]{3}Z-(demo|sip)-[a-zA-Z0-9-]{1,60}-log\\.txt$");
        std::vector<std::string> logs;
        for (const auto & entry : fs::directory_iterator(root)) {
            auto name = entry.path().filename().string();
            if (entry.symlink_status().type() == fs::file_type::regular && std::regex_match(name, call_file))
                logs.push_back(std::move(name));
        }
        if (std::find(logs.begin(), logs.end(), filename) == logs.end()) logs.push_back(filename);
        std::sort(logs.begin(), logs.end(), std::greater<>());
        constexpr std::size_t retained = 10;
        const auto recent_end = logs.begin() + std::min(retained, logs.size());
        if (std::find(logs.begin(), recent_end, filename) != recent_end) {
            const auto type = fs::symlink_status(path).type();
            if (type != fs::file_type::not_found && type != fs::file_type::regular)
                return error_response(500, "Invalid demo call log file", "call_log_storage_error");
            std::ofstream output(path, std::ios::binary | std::ios::app);
            if (!output) throw std::ios_base::failure("Cannot open demo call log");
            output << text.str();
            output.close();
            if (!output) throw std::ios_base::failure("Cannot write demo call log");
        }
        for (std::size_t i = retained; i < logs.size(); ++i) fs::remove(root / logs[i]);
        return json_response("{\"ok\":true}");
    } catch (const fs::filesystem_error &) {
        return error_response(500, "Cannot access demo call logs", "call_log_storage_error");
    } catch (const std::ios_base::failure &) {
        return error_response(500, "Cannot write demo call log", "call_log_storage_error");
    } catch (const std::exception &) {
        return error_response(400, "Invalid call log request", "invalid_request_error");
    }
}

} // namespace minitts::server
