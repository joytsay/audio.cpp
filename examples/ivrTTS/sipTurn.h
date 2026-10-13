#pragma once
#include <cstdlib>
#include <stdexcept>
#include <string>

inline std::string coturn_value(const char* key, const char* fallback = "") {
    const char* value = std::getenv(key);
    return value && *value ? value : fallback;
}
inline void coturn_credentials() {
    auto user = coturn_value("COTURN_USERNAME"), password = coturn_value("COTURN_PASSWORD");
    if (user.empty() || user.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-") != std::string::npos)
        throw std::runtime_error("set COTURN_USERNAME using letters, digits, dot, underscore or dash");
    if (password.empty() || password == "REPLACE_WITH_TURN_PASSWORD" || password.find_first_of("\r\n#") != std::string::npos)
        throw std::runtime_error("set COTURN_PASSWORD (no newline or #)");
}
