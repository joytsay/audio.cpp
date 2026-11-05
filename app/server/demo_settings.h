#pragma once
#include "server_protocol.h"
#include "engine/framework/io/yaml.h"

#include <algorithm>
#include <vector>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <mutex>
#include <sstream>

namespace minitts::server {
namespace demo_settings {
namespace json = engine::io::json;
inline const std::vector<std::string> booleans = {"vad_enabled", "asr_enabled", "llm_enabled", "tts_enabled", "tts_streaming"};
inline const std::vector<std::string> strings = {
    "vad_model_key", "vad_model_id", "vad_model_family", "vad_model_path", "vad_model_task",
    "asr_model_key", "asr_model_id", "asr_model_family", "asr_model_path", "asr_model_task",
    "tts_model_key", "tts_model_id", "tts_model_family", "tts_model_path", "tts_model_task",
    "llm_model", "dialogue_source", "tts_voice_id", "tts_reference_text", "tts_test_text"};
inline const std::vector<std::string> maps = {"vad_load_options", "vad_session_options", "asr_load_options", "asr_session_options", "tts_load_options", "tts_session_options"};

inline json::Value validate(const json::Value & input) {
    if (!input.is_object()) throw std::invalid_argument("Model settings must be an object");
    if (json::require_i64(input, "schema_version") != 1) throw std::invalid_argument("Unsupported model settings version");
    for (const auto & [key, value] : input.as_object()) {
        if (key == "schema_version") continue;
        if (std::find(booleans.begin(), booleans.end(), key) != booleans.end()) {
            if (!value.is_bool()) throw std::invalid_argument(key + " must be a boolean");
        } else if (std::find(strings.begin(), strings.end(), key) != strings.end()) {
            if (!value.is_string() || value.as_string().size() > 65536) throw std::invalid_argument(key + " must be a string of at most 64 KiB");
            if (key == "dialogue_source" && value.as_string() != "prompt.csv" && value.as_string() != "n8n")
                throw std::invalid_argument("dialogue_source must be prompt.csv or n8n");
        } else if (key == "vad_threshold" || key == "vad_window_ms" || key == "tts_playback_rate") {
            if (!value.is_number()) throw std::invalid_argument(key + " must be a number");
            const double number = value.as_number();
            if (key == "tts_playback_rate") {
                if (!std::isfinite(number) || number < 0.7 || number > 1.25)
                    throw std::invalid_argument("tts_playback_rate must be between 0.7 and 1.25");
                continue;
            }
            if (!std::isfinite(number) || (key == "vad_threshold" ? number < 0.01 || number > 0.99 : number < 300 || number > 2000 || std::floor(number) != number))
                throw std::invalid_argument(key + " is outside its supported range");
        } else if (std::find(maps.begin(), maps.end(), key) != maps.end()) {
            if (!value.is_object() || value.as_object().size() > 256) throw std::invalid_argument(key + " must be an options mapping");
            for (const auto & [name, option] : value.as_object())
                if (name.empty() || name.size() > 256 || !option.is_string() || option.as_string().size() > 8192)
                    throw std::invalid_argument("Invalid option in " + key);
        } else throw std::invalid_argument("Unknown model setting: " + key);
    }
    return input;
}

inline std::string encode(const json::Value & settings) {
    validate(settings);
    std::ostringstream out;
    out << "# Global demo sidebar settings. Text editors use their separate CSV files.\n";
    std::vector<std::string> keys;
    for (const auto & [key, _] : settings.as_object()) keys.push_back(key);
    std::sort(keys.begin(), keys.end());
    for (const auto & key : keys) {
        const auto & value = settings.require(key);
        out << key << ":";
        if (!value.is_object() || value.as_object().empty()) out << " " << json::stringify(value) << "\n";
        else {
            out << "\n";
            std::vector<std::string> names;
            for (const auto & [name, _] : value.as_object()) names.push_back(name);
            std::sort(names.begin(), names.end());
            for (const auto & name : names) out << "  " << json::stringify(json::Value::make_string(name)) << ": " << json::stringify(value.require(name)) << "\n";
        }
    }
    return out.str();
}

inline json::Value decode(const std::string & text) {
    const auto doc = engine::io::yaml::parse_flattened_document(text);
    if (!doc.lists.empty()) throw std::invalid_argument("Model settings do not accept YAML lists");
    json::Value::Object object;
    std::unordered_map<std::string, json::Value::Object> option_maps;
    for (const auto & map : maps) option_maps[map] = {};
    object["schema_version"] = json::Value::make_number(engine::io::yaml::require_i64(doc, "schema_version"));
    for (const auto & [key, value] : doc.scalars) {
        if (key == "schema_version") continue;
        if (std::find(booleans.begin(), booleans.end(), key) != booleans.end())
            object[key] = json::Value::make_bool(engine::io::yaml::parse_bool_scalar(value, key));
        else if (key == "vad_threshold" || key == "vad_window_ms" || key == "tts_playback_rate") {
            size_t consumed = 0;
            const double number = std::stod(value, &consumed);
            if (consumed != value.size()) throw std::invalid_argument("Invalid numeric model setting: " + key);
            object[key] = json::Value::make_number(number);
        }
        else {
            bool option = false;
            for (const auto & map : maps) {
                const auto prefix = map + ".";
                if (key.rfind(prefix, 0) != 0) continue;
                option_maps[map][key.substr(prefix.size())] = json::Value::make_string(value);
                option = true; break;
            }
            if (!option) {
                if (option_maps.count(key)) throw std::invalid_argument(key + " must be a YAML mapping");
                object[key] = json::Value::make_string(value);
            }
        }
    }
    for (auto & [key, values] : option_maps) object[key] = json::Value::make_object(std::move(values));
    return validate(json::Value::make_object(std::move(object)));
}
}

inline HttpResponse demo_settings_response(const HttpRequest & request, bool management, const std::filesystem::path & base) {
    if (!management) return error_response(403, "Model settings management is disabled", "forbidden");
    static std::mutex mutex;
    std::lock_guard<std::mutex> lock(mutex);
    const auto root = base / "ui-settings", path = root / "demo-settings.yaml";
    constexpr size_t limit = 256 * 1024;
    try {
        if (request.method == "GET") {
            if (!std::filesystem::exists(path)) return json_response("{\"settings\":null,\"exists\":false}");
            if (std::filesystem::file_size(path) > limit) return error_response(500, "Saved model settings exceed 256 KiB", "settings_storage_error");
            std::ifstream input(path, std::ios::binary);
            if (!input) throw std::ios_base::failure("Cannot read model settings");
            const std::string yaml(std::istreambuf_iterator<char>(input), {});
            const auto settings = demo_settings::decode(yaml);
            auto response = json_response("{\"settings\":" + engine::io::json::stringify(settings) + ",\"exists\":true}");
            response.headers["Cache-Control"] = "no-store";
            return response;
        }
        if (request.body.size() > limit) return error_response(413, "Model settings exceed 256 KiB", "invalid_request_error");
        const auto body = engine::io::json::parse(request.body);
        const auto settings = demo_settings::validate(body.require("settings"));
        const auto yaml = demo_settings::encode(settings);
        if (yaml.size() > limit) return error_response(413, "Model settings exceed 256 KiB", "invalid_request_error");
        std::filesystem::create_directories(root);
        const auto temporary = root / "demo-settings.yaml.tmp";
        {
            std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
            if (!output) throw std::ios_base::failure("Cannot create model settings");
            output.write(yaml.data(), static_cast<std::streamsize>(yaml.size()));
            output.close();
            if (!output) throw std::ios_base::failure("Cannot write model settings");
        }
        std::filesystem::rename(temporary, path);
        return json_response("{\"settings\":" + engine::io::json::stringify(settings) + ",\"exists\":true}");
    } catch (const std::filesystem::filesystem_error & e) { return error_response(500, e.what(), "settings_storage_error"); }
      catch (const std::ios_base::failure & e) { return error_response(500, e.what(), "settings_storage_error"); }
      catch (const std::exception & e) { return error_response(request.method == "GET" ? 500 : 400, e.what(), "invalid_settings"); }
}
}
