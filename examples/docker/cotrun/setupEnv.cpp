// Linux coturn environment setup. No shell evaluation or ip-command parsing.
#include <arpa/inet.h>
#include <ifaddrs.h>
#include <net/if.h>
#include <sys/random.h>
#include <sys/stat.h>
#include <sys/socket.h>
#include <fcntl.h>
#include <unistd.h>
#include <curl/curl.h>
#include <cerrno>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace fs = std::filesystem;
using Settings = std::map<std::string, std::string>;
std::string trim(const std::string& value) {
    auto a = value.find_first_not_of(" \t\r\n");
    return a == std::string::npos ? "" : value.substr(a, value.find_last_not_of(" \t\r\n") - a + 1);
}
std::string key(const std::string& line) {
    auto text = trim(line);
    if (text.empty() || text.front() == '#') return "";
    if (text.rfind("export ", 0) == 0) text.erase(0, 7);
    auto equal = text.find('=');
    return equal == std::string::npos ? "" : trim(text.substr(0, equal));
}
std::string value(const std::string& line) {
    auto text = trim(line.substr(line.find('=') + 1));
    if (text.empty()) return "";
    if (text.front() == '\'' || text.front() == '"') {
        auto end = text.find(text.front(), 1);
        if (end == std::string::npos) throw std::runtime_error("unclosed quoted setting");
        return text.substr(1, end - 1);
    }
    auto comment = text.find(" #");
    return trim(text.substr(0, comment));
}
struct Document {
    std::vector<std::string> lines;
    Settings settings;
    explicit Document(const fs::path& path) {
        std::ifstream input(path);
        if (!input) throw std::runtime_error("cannot read " + path.string());
        std::string line;
        while (std::getline(input, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            auto name = key(line);
            if (!name.empty()) {
                if (settings.count(name)) throw std::runtime_error("duplicate setting: " + name);
                settings[name] = value(line);
            }
            lines.push_back(line);
        }
        if (input.bad()) throw std::runtime_error("cannot read settings file");
    }
    void update(const Settings& updates) {
        Settings pending = updates;
        for (auto& line : lines) {
            auto name = key(line);
            auto found = pending.find(name);
            if (found != pending.end()) { line = name + "=" + found->second; pending.erase(found); }
        }
        for (const auto& entry : pending) lines.push_back(entry.first + "=" + entry.second);
        for (const auto& entry : updates) settings[entry.first] = value(entry.first + "=" + entry.second);
    }
    void save(const fs::path& path) const {
        struct stat status{};
        if (lstat(path.c_str(), &status) == 0 && !S_ISREG(status.st_mode))
            throw std::runtime_error("settings destination must be a regular file");
        std::string temporary = path.string() + ".tmp.XXXXXX";
        std::vector<char> name(temporary.begin(), temporary.end()); name.push_back(0);
        int fd = mkstemp(name.data());
        if (fd < 0) throw std::runtime_error("cannot create temporary settings file");
        try {
            for (const auto& line : lines) {
                std::string text = line + "\n";
                for (size_t offset = 0; offset < text.size();) {
                    auto n = write(fd, text.data() + offset, text.size() - offset);
                    if (n < 0 && errno == EINTR) continue;
                    if (n <= 0) throw std::runtime_error("cannot write settings file");
                    offset += size_t(n);
                }
            }
            if (fsync(fd)) throw std::runtime_error("cannot flush settings file");
            close(fd); fd = -1;
            if (rename(name.data(), path.c_str())) throw std::runtime_error("cannot replace settings file");
        } catch (...) { if (fd >= 0) close(fd); unlink(name.data()); throw; }
    }
};
bool ipv4(const std::string& text) { in_addr address{}; return inet_pton(AF_INET, text.c_str(), &address) == 1; }
std::string local_ip(const std::string& interface) {
    std::string preferred = interface;
    if (preferred.empty()) {
        // Route lookup selects the source address without sending packets.
        int fd = socket(AF_INET, SOCK_DGRAM, 0);
        if (fd >= 0) {
            sockaddr_in remote{}; remote.sin_family = AF_INET; remote.sin_port = htons(53);
            inet_pton(AF_INET, "1.1.1.1", &remote.sin_addr);
            if (!connect(fd, reinterpret_cast<sockaddr*>(&remote), sizeof(remote))) {
                sockaddr_in local{}; socklen_t length = sizeof(local);
                if (!getsockname(fd, reinterpret_cast<sockaddr*>(&local), &length)) {
                    char address[INET_ADDRSTRLEN]{};
                    inet_ntop(AF_INET, &local.sin_addr, address, sizeof(address)); close(fd);
                    return address;
                }
            }
            close(fd);
        }
        std::ifstream routes("/proc/net/route"); std::string line;
        while (std::getline(routes, line)) {
            std::istringstream row(line); std::string iface, destination, gateway, flags;
            if (row >> iface >> destination >> gateway >> flags && destination == "00000000") { preferred = iface; break; }
        }
    }
    ifaddrs* addresses = nullptr;
    if (getifaddrs(&addresses)) throw std::runtime_error("cannot inspect network interfaces; use --local-ip ADDRESS");
    struct Cleanup { ifaddrs* addresses; ~Cleanup() { freeifaddrs(addresses); } } cleanup{addresses};
    std::vector<std::string> matches;
    for (auto* item = addresses; item; item = item->ifa_next) {
        if (!item->ifa_addr || item->ifa_addr->sa_family != AF_INET || !(item->ifa_flags & IFF_UP) || (item->ifa_flags & IFF_LOOPBACK)) continue;
        if (!preferred.empty() && preferred != item->ifa_name) continue;
        char address[INET_ADDRSTRLEN]{};
        inet_ntop(AF_INET, &reinterpret_cast<sockaddr_in*>(item->ifa_addr)->sin_addr, address, sizeof(address));
        matches.emplace_back(address);
    }
    if (matches.size() != 1) throw std::runtime_error("cannot select one local IPv4 address; use --interface NAME or --local-ip ADDRESS");
    return matches.front();
}
size_t receive(char* data, size_t size, size_t count, void* context) noexcept {
    auto* text = static_cast<std::string*>(context);
    size_t bytes = size * count;
    if (bytes > 128 || text->size() + bytes > 128) return 0;
    try { text->append(data, bytes); return bytes; } catch (...) { return 0; }
}
std::string public_ip() {
    if (curl_global_init(CURL_GLOBAL_DEFAULT)) throw std::runtime_error("cannot initialize public IP lookup");
    struct Cleanup { ~Cleanup() { curl_global_cleanup(); } } cleanup;
    CURL* curl = curl_easy_init();
    if (!curl) throw std::runtime_error("cannot create public IP lookup");
    std::string response;
    curl_easy_setopt(curl, CURLOPT_URL, "https://api.ipify.org");
    curl_easy_setopt(curl, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, receive);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    auto error = curl_easy_perform(curl); long status = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status); curl_easy_cleanup(curl);
    response = trim(response);
    if (error != CURLE_OK || status != 200 || !ipv4(response))
        throw std::runtime_error("public IP lookup failed; use --public-ip ADDRESS (settings were not changed)");
    return response;
}
std::string password() {
    unsigned char bytes[24]; size_t offset = 0;
    while (offset < sizeof(bytes)) {
        auto n = getrandom(bytes + offset, sizeof(bytes) - offset, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) throw std::runtime_error("cannot generate TURN password");
        offset += size_t(n);
    }
    const char* hex = "0123456789abcdef"; std::string result;
    for (auto byte : bytes) { result += hex[byte >> 4]; result += hex[byte & 15]; }
    return result;
}
fs::path repository() {
    std::vector<fs::path> starts{fs::current_path()};
    char executable[4096]; auto n = readlink("/proc/self/exe", executable, sizeof(executable));
    if (n > 0) starts.emplace_back(fs::path(std::string(executable, n)).parent_path());
    for (auto start : starts) {
        for (; !start.empty(); start = start.parent_path()) {
            if (fs::exists(start / "examples/docker/agx-one-container/.env.example")) return start;
            if (start == start.parent_path()) break;
        }
    }
    throw std::runtime_error("cannot find repository; specify --env and --template");
}
int main(int argc, char** argv) {
    try {
        fs::path destination, source, sip;
        std::string interface, local, external; bool discover_public = false, dry_run = false;
        for (int i = 1; i < argc; ++i) {
            std::string option = argv[i];
            if (option == "--help") {
                std::cout << "Usage: coturn_setup [--interface NAME | --local-ip ADDRESS] [--public | --public-ip ADDRESS]\n"
                             "  [--env PATH] [--template PATH] [--sip-env PATH] [--dry-run]\n"
                             "Default: update examples/docker/agx-one-container/.env for LAN use.\n"
                             "--public queries https://api.ipify.org; configure router forwarding separately.\n"
                             "--sip-env updates an existing SIP client file with TURN URL and credentials.\n";
                return 0;
            }
            if (option == "--public") discover_public = true;
            else if (option == "--dry-run") dry_run = true;
            else {
                if (++i >= argc) throw std::runtime_error("missing option value");
                if (option == "--env") destination = argv[i];
                else if (option == "--template") source = argv[i];
                else if (option == "--sip-env") sip = argv[i];
                else if (option == "--interface") interface = argv[i];
                else if (option == "--local-ip") local = argv[i];
                else if (option == "--public-ip") external = argv[i];
                else throw std::runtime_error("unknown option: " + option);
            }
        }
        if ((!interface.empty() && !local.empty()) || (discover_public && !external.empty()))
            throw std::runtime_error("use only one local address option and one public address option");
        if (destination.empty() || (source.empty() && !fs::exists(destination))) {
            auto root = repository();
            if (destination.empty()) destination = root / "examples/docker/agx-one-container/.env";
            if (source.empty()) source = root / "examples/docker/agx-one-container/.env.example";
        }
        Document document(fs::exists(destination) ? destination : source);
        // Add newly introduced settings when upgrading an existing deployment.
        if (!source.empty() && fs::exists(source)) {
            Document defaults(source); Settings missing;
            for (const auto& line : defaults.lines) {
                auto name = key(line);
                if (!name.empty() && !document.settings.count(name))
                    missing[name] = line.substr(line.find('=') + 1);
            }
            document.update(missing);
        }
        if (local.empty()) local = local_ip(interface);
        if (!ipv4(local)) throw std::runtime_error("invalid local IPv4 address");
        if (discover_public) external = public_ip();
        if (!external.empty() && !ipv4(external)) throw std::runtime_error("invalid public IPv4 address");
        std::string port = document.settings["COTURN_PORT"];
        if (port.empty()) port = "3478";
        if (port.size() > 5 || port.find_first_not_of("0123456789") != std::string::npos || std::stoul(port) < 1 || std::stoul(port) > 65535)
            throw std::runtime_error("invalid COTURN_PORT");
        // Preserve a configured external address unless explicitly changed.
        std::string mapping = document.settings["COTURN_EXTERNAL_IP"];
        if (!external.empty()) mapping = external == local ? "" : external + "/" + local;
        else if (!mapping.empty()) {
            external = mapping.substr(0, mapping.find('/'));
            if (!ipv4(external)) throw std::runtime_error("existing COTURN_EXTERNAL_IP is invalid");
            mapping = external == local ? "" : external + "/" + local;
        }
        Settings updates{{"COTURN_LISTEN_IP", local}, {"COTURN_RELAY_IP", local},
                         {"COTURN_EXTERNAL_IP", mapping}, {"COTURN_PORT", port},
                         {"COTURN_URL", "turn:" + (external.empty() ? local : external) + ":" + port + "?transport=udp"}};
        for (const auto& entry : Settings{{"COTURN_IMAGE", "coturn/coturn:4.18.0-r0-alpine"}, {"COTURN_REALM", "ivrtts"},
                                        {"COTURN_USERNAME", "ivrtts"}, {"COTURN_MIN_PORT", "49160"}, {"COTURN_MAX_PORT", "49200"}})
            if (document.settings[entry.first].empty()) updates[entry.first] = entry.second;
        if (document.settings["COTURN_PASSWORD"].empty() || document.settings["COTURN_PASSWORD"] == "REPLACE_WITH_TURN_PASSWORD")
            updates["COTURN_PASSWORD"] = "'" + password() + "'";
        document.update(updates);
        // Read and validate all destinations before writing either file.
        std::unique_ptr<Document> client;
        if (!sip.empty()) {
            if (fs::absolute(sip).lexically_normal() == fs::absolute(destination).lexically_normal())
                throw std::runtime_error("SIP and server settings must use different files");
            client = std::make_unique<Document>(sip);
            Settings connection{{"COTURN_URL", updates.at("COTURN_URL")}};
            // Copy the original assignment syntax to preserve quoted secrets.
            for (const auto& line : document.lines) {
                auto name = key(line);
                if (name == "COTURN_USERNAME" || name == "COTURN_PASSWORD")
                    connection[name] = line.substr(line.find('=') + 1);
            }
            client->update(connection);
        }
        if (!dry_run) { document.save(destination); if (client) client->save(sip); }
        std::cout << (dry_run ? "Preview" : "Updated") << ": " << destination << "\n"
                  << "COTURN_LISTEN_IP=" << local << "\nCOTURN_RELAY_IP=" << local
                  << "\nCOTURN_EXTERNAL_IP=" << mapping << "\nCOTURN_URL=" << updates.at("COTURN_URL") << "\n";
        std::cout << "TURN credentials preserved or generated; password is not displayed.\n";
        if (client) std::cout << (dry_run ? "Would update: " : "Updated: ") << sip << "\n";
    } catch (const std::exception& error) { std::cerr << "Error: " << error.what() << "\n"; return 1; }
}
