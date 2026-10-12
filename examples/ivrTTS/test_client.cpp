// Local HTTP, process and pseudo-terminal integration tests. No Python or model weights.
#include "ivrTTS.h"
#include <json-c/json.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <sys/ioctl.h>
#include <pty.h>
#include <spawn.h>
#include <poll.h>
#include <fcntl.h>
#include <unistd.h>
#include <signal.h>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>
#include <vector>

extern char** environ;
namespace {
using namespace std::chrono_literals;
using Clock = std::chrono::steady_clock;
void check(bool ok, const std::string& message) { if (!ok) throw std::runtime_error(message); }
std::string read_file(const std::filesystem::path& path) {
    std::ifstream file(path, std::ios::binary);
    return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}
void write_file(const std::filesystem::path& path, const std::string& bytes) {
    std::ofstream file(path, std::ios::binary); file.write(bytes.data(), bytes.size());
    check(bool(file), "cannot write test file");
}
std::string b64(const std::string& bytes) {
    const char* chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    for (size_t i = 0; i < bytes.size(); i += 3) {
        unsigned n = unsigned(static_cast<unsigned char>(bytes[i])) << 16;
        if (i + 1 < bytes.size()) n |= unsigned(static_cast<unsigned char>(bytes[i + 1])) << 8;
        if (i + 2 < bytes.size()) n |= static_cast<unsigned char>(bytes[i + 2]);
        result += chars[(n >> 18) & 63]; result += chars[(n >> 12) & 63];
        result += i + 1 < bytes.size() ? chars[(n >> 6) & 63] : '=';
        result += i + 2 < bytes.size() ? chars[n & 63] : '=';
    }
    return result;
}
using Json = std::unique_ptr<json_object, decltype(&json_object_put)>;
Json parse(const std::string& body) {
    Json result(json_tokener_parse(body.c_str()), json_object_put);
    check(bool(result), "invalid request JSON"); return result;
}
std::string field(json_object* object, const char* key) {
    json_object* value = nullptr;
    if (!json_object_object_get_ex(object, key, &value)) return "";
    return json_object_get_string(value);
}
std::string reference(json_object* object) {
    json_object* value = nullptr;
    check(json_object_object_get_ex(object, "voice_ref", &value), "missing voice_ref");
    check(field(value, "type") == "base64", "wrong reference type");
    return field(value, "data");
}
struct Temp {
    std::filesystem::path path;
    Temp() {
        char pattern[] = "/tmp/ivrtts-tests-XXXXXX";
        auto* created = mkdtemp(pattern); check(created, "mkdtemp failed"); path = created;
    }
    ~Temp() { std::error_code error; std::filesystem::remove_all(path, error); }
};

class Process {
public:
    std::string output;
    Process(const std::string& executable, const std::vector<std::string>& arguments, bool terminal = false) {
        int input = -1, destination = -1, pipes[2];
        if (terminal) {
            winsize size{}; size.ws_row = 24; size.ws_col = 100;
            check(openpty(&fd_, &destination, nullptr, nullptr, &size) == 0, "openpty failed"); input = destination;
        } else {
            check(pipe(pipes) == 0, "pipe failed"); fd_ = pipes[0]; destination = pipes[1];
            input = open("/dev/null", O_RDONLY);
        }
        posix_spawn_file_actions_t actions;
        posix_spawn_file_actions_init(&actions);
        posix_spawn_file_actions_adddup2(&actions, input, STDIN_FILENO);
        posix_spawn_file_actions_adddup2(&actions, destination, STDOUT_FILENO);
        posix_spawn_file_actions_adddup2(&actions, destination, STDERR_FILENO);
        posix_spawn_file_actions_addclose(&actions, fd_);
        posix_spawn_file_actions_addclose(&actions, destination);
        if (input != destination) posix_spawn_file_actions_addclose(&actions, input);
        std::vector<std::string> owned{executable}; owned.insert(owned.end(), arguments.begin(), arguments.end());
        std::vector<char*> argv; for (auto& arg : owned) argv.push_back(arg.data()); argv.push_back(nullptr);
        int error = posix_spawn(&pid_, executable.c_str(), &actions, nullptr, argv.data(), environ);
        posix_spawn_file_actions_destroy(&actions);
        close(destination); if (input != destination) close(input);
        if (error) { close(fd_); fd_ = -1; throw std::runtime_error("cannot spawn client"); }
        fcntl(fd_, F_SETFL, O_NONBLOCK);
    }
    ~Process() {
        if (pid_ > 0) { kill(pid_, SIGKILL); waitpid(pid_, nullptr, 0); }
        if (fd_ >= 0) close(fd_);
    }
    void pump() {
        pollfd fd{fd_, POLLIN, 0}; poll(&fd, 1, 20);
        char buffer[65536]; ssize_t n;
        while ((n = read(fd_, buffer, sizeof(buffer))) > 0) output.append(buffer, n);
    }
    void send(const std::string& keys) {
        size_t offset = 0;
        while (offset < keys.size()) {
            ssize_t n = write(fd_, keys.data() + offset, keys.size() - offset);
            check(n > 0, "cannot send terminal keys"); offset += n;
        }
    }
    void until(const std::string& marker, int seconds = 6) {
        auto deadline = Clock::now() + std::chrono::seconds(seconds);
        while (output.find(marker) == std::string::npos && Clock::now() < deadline) pump();
        check(output.find(marker) != std::string::npos, "missing TUI text: " + marker + "\n" + output.substr(output.size() > 1800 ? output.size() - 1800 : 0));
    }
    int finish(int seconds = 15) {
        auto deadline = Clock::now() + std::chrono::seconds(seconds); int status = 0;
        while (Clock::now() < deadline) {
            pump();
            if (waitpid(pid_, &status, WNOHANG) == pid_) { pid_ = -1; pump(); return WIFEXITED(status) ? WEXITSTATUS(status) : 128; }
        }
        throw std::runtime_error("client process timed out");
    }
private:
    int fd_ = -1;
    pid_t pid_ = -1;
};

class Server {
public:
    std::string url, wav, pcm;
    std::filesystem::path player_audio;
    std::atomic<bool> early{false}, bad_catalog{false};
    Server() {
        for (int i = 0; i < 24000; ++i) {
            int sample = int(16000 * std::sin(i * 6.283185307 * 440 / 24000));
            pcm += char(sample & 255); pcm += char((sample >> 8) & 255);
        }
        auto le = [](unsigned n, int bytes) { std::string out; while (bytes--) { out += char(n & 255); n >>= 8; } return out; };
        wav = "RIFF" + le(36 + pcm.size(), 4) + "WAVEfmt " + le(16, 4) + le(1, 2) + le(1, 2) +
            le(24000, 4) + le(48000, 4) + le(2, 2) + le(16, 2) + "data" + le(pcm.size(), 4) + pcm;
        socket_ = socket(AF_INET, SOCK_STREAM, 0); check(socket_ >= 0, "cannot open localhost socket");
        fcntl(socket_, F_SETFD, FD_CLOEXEC);
        sockaddr_in address{}; address.sin_family = AF_INET; address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        if (bind(socket_, reinterpret_cast<sockaddr*>(&address), sizeof(address)) || listen(socket_, 8)) {
            close(socket_); throw std::runtime_error("cannot listen on localhost");
        }
        socklen_t size = sizeof(address); getsockname(socket_, reinterpret_cast<sockaddr*>(&address), &size);
        url = "http://127.0.0.1:" + std::to_string(ntohs(address.sin_port));
        worker_ = std::thread([&] {
            while (!stopped_) {
                pollfd ready{socket_, POLLIN, 0};
                if (poll(&ready, 1, 50) <= 0 || stopped_) continue;
                int client = accept(socket_, nullptr, nullptr); if (client < 0) continue;
                fcntl(client, F_SETFD, FD_CLOEXEC);
                timeval timeout{3, 0}; setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
                try { handle(client); }
                catch (const std::exception& e) { std::lock_guard<std::mutex> lock(mutex_); error_ = e.what(); }
                close(client);
            }
        });
    }
    ~Server() { stopped_ = true; worker_.join(); close(socket_); }
    size_t count() { std::lock_guard<std::mutex> lock(mutex_); return requests_.size(); }
    Json latest() {
        std::lock_guard<std::mutex> lock(mutex_); check(error_.empty(), error_);
        check(!requests_.empty(), "no speech request"); return parse(requests_.back());
    }
    void wait_request(size_t previous, Process& process) {
        auto deadline = Clock::now() + 5s;
        while (count() <= previous && Clock::now() < deadline) process.pump();
        check(count() > previous, "speech request missing");
    }
private:
    static bool send_all(int fd, const std::string& data) {
        size_t offset = 0;
        while (offset < data.size()) { ssize_t n = send(fd, data.data() + offset, data.size() - offset, 0); if (n <= 0) return false; offset += n; }
        return true;
    }
    void handle(int fd) {
        std::string request; char buffer[16384]; size_t split;
        while ((split = request.find("\r\n\r\n")) == std::string::npos) {
            ssize_t n = recv(fd, buffer, sizeof(buffer), 0); if (n <= 0) return;
            request.append(buffer, n); check(request.size() < 8 * 1024 * 1024, "request too large");
        }
        if (request.rfind("GET /v1/models ", 0) == 0) {
            std::string catalog = bad_catalog ? "{invalid JSON}" : R"({"data":[
                {"id":"asr","task":"asr","family":"qwen3_asr","mode":"offline","loaded":false},
                {"id":"test","task":"clon","family":"zipvoice","mode":"offline","loaded":false},
                {"id":"other","task":"tts","family":"pocket_tts","mode":"offline","loaded":true},
                {"id":"test-stream","task":"tts","family":"voxcpm1","mode":"streaming","loaded":false}]})";
            send_all(fd, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n" + catalog); return;
        }
        check(request.rfind("POST /v1/audio/speech ", 0) == 0, "unexpected request route");
        std::string headers = request.substr(0, split);
        for (char& c : headers) if (c >= 'A' && c <= 'Z') c += 'a' - 'A';
        auto length_pos = headers.find("content-length:"); check(length_pos != std::string::npos, "missing request length");
        size_t length = std::stoul(headers.substr(length_pos + 15));
        check(length < 8 * 1024 * 1024, "request too large");
        if (headers.find("expect: 100-continue") != std::string::npos) send_all(fd, "HTTP/1.1 100 Continue\r\n\r\n");
        while (request.size() - split - 4 < length) {
            ssize_t n = recv(fd, buffer, sizeof(buffer), 0); if (n <= 0) return; request.append(buffer, n);
        }
        auto body = request.substr(split + 4, length); auto json = parse(body);
        { std::lock_guard<std::mutex> lock(mutex_); requests_.push_back(body); }
        std::string input = field(json.get(), "input");
        if (input == "wait") { for (int i = 0; i < 200 && !stopped_; ++i) std::this_thread::sleep_for(20ms); return; }
        if (input == "fail") { send_all(fd, "HTTP/1.1 503 Busy\r\nConnection: close\r\n\r\n{\"error\":\"server_busy\"}"); return; }
        if (input == "bad") { send_all(fd, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"error\":\"bad audio\"}"); return; }
        bool raw = field(json.get(), "response_format") == "pcm";
        send_all(fd, std::string("HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Type: ") + (raw ? "application/octet-stream" : "audio/wav") + "\r\n\r\n");
        if (input == "early") {
            check(raw && field(json.get(), "stream_format") == "audio", "wrong PCM request");
            send_all(fd, std::string("\1\2\3", 3));
            auto deadline = Clock::now() + 5s;
            while (!stopped_ && Clock::now() < deadline && read_file(player_audio) != std::string("\1\2\3", 3)) std::this_thread::sleep_for(10ms);
            early = read_file(player_audio) == std::string("\1\2\3", 3);
            send_all(fd, std::string("\4", 1)); return;
        }
        const auto& payload = raw ? pcm : wav;
        for (size_t i = 0; i < payload.size() && !stopped_; i += 257) {
            if (!send_all(fd, payload.substr(i, 257))) break;
            std::this_thread::sleep_for(1ms);
        }
    }
    int socket_;
    std::atomic<bool> stopped_{false};
    std::thread worker_;
    std::mutex mutex_;
    std::vector<std::string> requests_;
    std::string error_;
};

void test_cli(const std::string& cli, const std::filesystem::path& root) {
    Server server; server.player_audio = root / "audio";
    auto run = [&](std::vector<std::string> args, bool success = true) {
        Process process(cli, args); int code = process.finish();
        check((code == 0) == success, "unexpected CLI result: " + process.output); return process.output;
    };
    const std::string text = "Hello \"quoted\" \\ text\n你好";
    run({"run", server.url, "test", (root / "out.wav").string(), text, "alba"});
    check(read_file(root / "out.wav") == server.wav, "wrong WAV output");
    auto body = server.latest(); check(field(body.get(), "input") == text && field(body.get(), "voice") == "alba", "JSON/Unicode changed");
    write_file(root / "ref.wav", server.wav);
    run({"play-clone", server.url, "test", text, (root / "ref.wav").string(), "transcript"});
    body = server.latest(); check(reference(body.get()) == b64(server.wav) && field(body.get(), "reference_text") == "transcript", "clone upload changed");
    check(read_file(root / "audio") == server.wav, "player WAV changed");
    std::filesystem::remove(root / "audio");
    run({"stream", server.url, "test", "24000", "1", "early"});
    check(server.early, "audio buffered until response end");
    check(read_file(root / "audio") == std::string("\1\2\3\4", 4), "split PCM sample changed");
    check(read_file(root / "args").find("-f s16le -ar 24000 -ch_layout 1c") != std::string::npos, "wrong player format");
    run({"stream-clone", server.url, "test", "24000", "1", text, (root / "ref.wav").string(), "transcript"});
    for (const auto& preset : {std::pair<std::string, std::string>{"lingCL", "lingCLvocals"}, {"WangSG", "wangSG9s"}}) {
        std::vector<std::string> args{"play", server.url, "test", text}; if (preset.first == "WangSG") args.push_back(preset.first);
        run(args); body = server.latest();
        check(reference(body.get()) == b64(read_file(std::filesystem::path(TEST_VOICES) / (preset.second + ".wav"))), "preset upload changed");
        check(!field(body.get(), "reference_text").empty() && field(body.get(), "voice").empty(), "wrong preset metadata");
    }
    std::filesystem::remove(root / "audio");
    auto error = run({"play", server.url, "test", "fail"}, false);
    check(error.find("503") != std::string::npos && error.find("server_busy") != std::string::npos, "HTTP diagnostic missing");
    run({"play", server.url, "test", "bad"}, false);
    check(!std::filesystem::exists(root / "audio"), "error body sent to player");
    run({"stream", server.url, "test", "24000;echo unsafe", "1", text}, false);
    setenv("TEST_PLAYER_FAIL", "1", 1); run({"play", server.url, "test", text}, false); unsetenv("TEST_PLAYER_FAIL");
    ivrTTS client; client.create(server.url, "test", "alba");
    bool propagated = false;
    try { client.run_stream(text, [](const unsigned char*, size_t) { throw std::runtime_error("sink cancelled"); }); }
    catch (const std::exception& e) { propagated = std::string(e.what()) == "sink cancelled"; }
    check(propagated, "callback exception not propagated");
    std::cout << "PASS: WAV/PCM, incremental playback, presets, JSON, HTTP/player errors, callbacks\n";
}

void test_tui(const std::string& cli) {
    Server server;
    Process ui(cli, {"tui", server.url}, true);
    ui.until("VOICE DECK"); ui.until("refreshed");
    ui.send("mk\n"); ui.until("not a text-to-speech");
    ui.send("\33"); std::this_thread::sleep_for(100ms);
    ui.send("\te\25Hello 你好\n\n");
    ui.until("Playing"); ui.send(" "); ui.until("AUSED");
    ui.send(" s"); ui.until("Stopped");
    ui.output.clear(); ui.send("\n"); ui.until("Finished");
    auto play = [&](const std::string& keys, const std::string& model, const std::string& text) {
        auto before = server.count(); ui.output.clear(); ui.send(keys); server.wait_request(before, ui);
        auto body = server.latest(); check(field(body.get(), "model") == model && field(body.get(), "input") == text, "model/history request changed");
        ui.until("Finished");
    };
    // The rejected ASR choice left the picker cursor at index zero.
    play("mjj\nk\n", "other", "Hello, welcome to our voice service.");
    play("j\n", "other", "Hello 你好");
    play("eFirst line\16Second line\n\n", "other", "First line\nSecond line");
    ui.send("eDiscard this\33"); std::this_thread::sleep_for(100ms);
    play("\n", "other", "First line\nSecond line");
    ui.send("mj\npinvalid\n"); ui.until("Enter output RATE CHANNELS");
    ui.send("\25" "24000 1\n"); ui.until("PCM format saved");
    play("\n", "test-stream", "First line\nSecond line");
    auto body = server.latest(); check(field(body.get(), "stream_format") == "audio", "streaming mode ignored");
    check(reference(body.get()) == b64(read_file(std::filesystem::path(TEST_VOICES) / "wangSG9s.wav")), "TUI preset changed");
    auto before = server.count(); server.bad_catalog = true; ui.output.clear(); ui.send("r"); ui.until("invalid model-list JSON");
    server.bad_catalog = false; ui.output.clear(); ui.send("r"); ui.until("refreshed");
    check(server.count() == before, "refresh generated speech");
    ui.send("q"); check(ui.finish(3) == 0, "TUI quit failed");
    Process waiting(cli, {"tui", server.url, "test"}, true);
    waiting.until("refreshed"); before = server.count(); waiting.send("ewait\n\n"); server.wait_request(before, waiting);
    waiting.send("q"); check(waiting.finish(3) == 0, "request cancellation before audio failed");
    std::cout << "PASS: TUI models/history, UTF-8, WAV/PCM, pause/stop/replay, refresh, cancellation\n";
}
}

int main(int argc, char** argv) {
    signal(SIGPIPE, SIG_IGN);
    try {
        if (std::filesystem::path(argv[0]).filename() == "ffplay") {
            if (getenv("TEST_PLAYER_FAIL")) return 1;
            std::string args; for (int i = 1; i < argc; ++i) { if (i > 1) args += ' '; args += argv[i]; }
            write_file(getenv("TEST_PLAYER_ARGS"), args);
            std::ofstream audio(getenv("TEST_PLAYER_AUDIO"), std::ios::binary);
            char buffer[4096]; ssize_t n;
            while ((n = read(STDIN_FILENO, buffer, sizeof(buffer))) > 0) { audio.write(buffer, n); audio.flush(); }
            return audio ? 0 : 1;
        }
        check(argc == 3, "Usage: ivrtts_tests cli|tui /path/to/ivrtts_cli");
        Temp temp;
        std::filesystem::create_symlink(std::filesystem::canonical(argv[0]), temp.path / "ffplay");
        std::string path = temp.path.string() + ":" + (getenv("PATH") ? getenv("PATH") : "");
        setenv("PATH", path.c_str(), 1);
        setenv("TEST_PLAYER_ARGS", (temp.path / "args").c_str(), 1);
        setenv("TEST_PLAYER_AUDIO", (temp.path / "audio").c_str(), 1);
        setenv("TERM", "xterm-256color", 1); setenv("SDL_AUDIODRIVER", "dummy", 1);
        setenv("IVRTTS_VOICE_DIR", TEST_VOICES, 1);
        auto cli = std::filesystem::canonical(argv[2]).string();
        if (std::string(argv[1]) == "cli") test_cli(cli, temp.path);
        else if (std::string(argv[1]) == "tui") test_tui(cli);
        else throw std::runtime_error("unknown test suite");
    } catch (const std::exception& e) { std::cerr << "FAIL: " << e.what() << '\n'; return 1; }
}
