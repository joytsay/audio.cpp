// Local HTTP, process and pseudo-terminal integration tests. No Python or model weights.
#include "ivrTTS.h"
#include "sipEnv.h"
#include "sipTurn.h"
#ifdef IVRTTS_TEST_PIPELINE
#include "sipPipeline.h"
#endif
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
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdlib>
#include <deque>
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
    std::atomic<bool> pipeline_mode{false}, rag_fails{false}, stt_waits{false};
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
    std::vector<std::pair<std::string, std::string>> pipeline_requests() {
        std::lock_guard<std::mutex> lock(mutex_); check(error_.empty(), error_); return pipeline_requests_;
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
        check(request.rfind("POST /v1/audio/speech ", 0) == 0 ||
              pipeline_mode, "unexpected request route");
        std::string headers = request.substr(0, split);
        for (char& c : headers) if (c >= 'A' && c <= 'Z') c += 'a' - 'A';
        auto length_pos = headers.find("content-length:"); check(length_pos != std::string::npos, "missing request length");
        size_t length = std::stoul(headers.substr(length_pos + 15));
        check(length < 8 * 1024 * 1024, "request too large");
        if (headers.find("expect: 100-continue") != std::string::npos) send_all(fd, "HTTP/1.1 100 Continue\r\n\r\n");
        while (request.size() - split - 4 < length) {
            ssize_t n = recv(fd, buffer, sizeof(buffer), 0); if (n <= 0) return; request.append(buffer, n);
        }
        auto body = request.substr(split + 4, length);
        if (pipeline_mode) {
            auto route = request.substr(5, request.find(' ', 5) - 5);
            { std::lock_guard<std::mutex> lock(mutex_); pipeline_requests_.emplace_back(route, body); }
            auto respond = [&](const std::string& json, bool success = true) {
                send_all(fd, std::string(success ? "HTTP/1.1 200 OK" : "HTTP/1.1 503 Busy") +
                    "\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n" + json);
            };
            if (route == "/v1/ui/upload") {
                check(body.size() >= 44 && body.substr(0, 4) == "RIFF", "pipeline upload is not WAV");
                check(static_cast<unsigned char>(body[24]) == 0x80 && static_cast<unsigned char>(body[25]) == 0x3e, "upload is not 16 kHz");
                last_upload_speech_ = false;
                for (size_t i = 44; i + 1 < body.size(); i += 2) {
                    int16_t sample = int16_t(unsigned(static_cast<unsigned char>(body[i])) |
                                            unsigned(static_cast<unsigned char>(body[i + 1])) << 8);
                    if (std::abs(int(sample)) > 100) { last_upload_speech_ = true; break; }
                }
                respond(R"({"path":"/mock/caller.wav"})"); return;
            }
            if (route == "/v1/tasks/run") {
                auto json = parse(body); check(field(json.get(), "model") == "silero-vad", "VAD stage skipped/wrong model");
                respond(last_upload_speech_ ? R"({"segments":[{"start_sample":0,"end_sample":8000}]})" : "{}"); return;
            }
            if (route == "/v1/audio/transcriptions/details") {
                if (stt_waits) for (int i = 0; i < 200 && !stopped_; ++i) std::this_thread::sleep_for(20ms);
                respond(R"({"text":"Where is the office?"})"); return;
            }
            if (route == "/v1/rag/initialize") {
                respond(R"({"jsonrpc":"2.0","result":{"protocolVersion":1},"id":1})"); return;
            }
            if (route == "/v1/rag/retrieve") {
                respond(R"({"result":{"hits":[{"text":"The office is on floor 3."}]}})", !rag_fails); return;
            }
            if (route == "/v1/chat/completions") {
                respond(R"({"choices":[{"message":{"content":"The office is on floor 3."}}]})"); return;
            }
        }
        auto json = parse(body);
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
    bool last_upload_speech_ = false;
    std::vector<std::pair<std::string, std::string>> pipeline_requests_;
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
    ui.send("ePrevious test message\n\te\25Hello 你好\n\n");
    ui.until("Playing"); ui.send(" "); ui.until("AUSED");
    ui.send(" s"); ui.until("Stopped");
    ui.output.clear(); ui.send("\n"); ui.until("Finished");
    auto play = [&](const std::string& keys, const std::string& model, const std::string& text) {
        auto before = server.count(); ui.output.clear(); ui.send(keys); server.wait_request(before, ui);
        auto body = server.latest(); check(field(body.get(), "model") == model && field(body.get(), "input") == text,
            "model/history request changed: expected " + model + "/" + text + ", received " +
            field(body.get(), "model") + "/" + field(body.get(), "input"));
        ui.until("Finished");
    };
    // The rejected ASR choice left the picker cursor at index zero.
    play("mjj\nk\n", "other", "Previous test message");
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
// A local UDP registrar/UAS exercises real SIP transactions and RTP, including
// digest authentication, rejected calls, auto-answer, DTMF and unregister.
class SipServer {
public:
    std::string uri;
    std::atomic<bool> authenticated{false}, invited{false}, unregistered{false}, bye{false};
    std::atomic<unsigned> packets{0}, voiced_packets{0}, voiced_before_ready{0};
    std::atomic<bool> ready_sent{false};
    SipServer(bool reject, bool busy, bool incoming, bool opus = false, bool conversation = false, bool wait_for_ready = false)
        : reject_(reject), busy_(busy), incoming_(incoming), opus_(opus), conversation_(conversation), wait_for_ready_(wait_for_ready) {
        auto bind_udp = [](int& fd) {
            fd = socket(AF_INET, SOCK_DGRAM, 0); check(fd >= 0, "cannot open SIP test socket");
            fcntl(fd, F_SETFD, FD_CLOEXEC);
            sockaddr_in address{}; address.sin_family = AF_INET; address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
            check(bind(fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == 0, "cannot bind SIP test socket");
            socklen_t size = sizeof(address); getsockname(fd, reinterpret_cast<sockaddr*>(&address), &size);
            return ntohs(address.sin_port);
        };
        port_ = bind_udp(sip_); media_port_ = bind_udp(rtp_);
        uri = "sip:127.0.0.1:" + std::to_string(port_);
        worker_ = std::thread([&] {
            try {
                while (!stopped_) {
                    pollfd ready[2]{{sip_, POLLIN, 0}, {rtp_, POLLIN, 0}};
                    poll(ready, 2, 20);
                    if (wait_for_ready_ && connected_ && !ready_sent && Clock::now() >= ready_at_) {
                        voiced_before_ready = voiced_packets.load();
                        info(dialog_from_, dialog_to_, dialog_id_, signal_peer_, '#');
                        ready_sent = true;
                    }
                    if (conversation_ && connected_ && Clock::now() >= next_audio_) {
                        std::string packet(172, char(audio_frames_ < 25 ? 0x80 : 0xff));
                        packet[0] = char(0x80); packet[1] = 0;
                        packet[2] = char(audio_frames_ >> 8); packet[3] = char(audio_frames_);
                        unsigned timestamp = audio_frames_ * 160;
                        for (unsigned i = 0; i < 4; ++i) packet[4 + i] = char(timestamp >> (24 - i * 8));
                        packet[8] = 0; packet[9] = 0; packet[10] = 0; packet[11] = 42;
                        sendto(rtp_, packet.data(), packet.size(), 0, reinterpret_cast<sockaddr*>(&media_peer_), sizeof(media_peer_));
                        ++audio_frames_; next_audio_ = Clock::now() + 20ms;
                        if (voiced_packets > 70 && !sent_bye_) {
                            sent_bye_ = true;
                            send("BYE " + uri + " SIP/2.0\r\nVia: SIP/2.0/UDP 127.0.0.1:" + std::to_string(port_) +
                                 ";branch=z9hG4bKbye\r\nFrom: " + dialog_from_ + "\r\nTo: " + dialog_to_ +
                                 "\r\nCall-ID: " + dialog_id_ + "\r\nCSeq: 3 BYE\r\nContent-Length: 0\r\n\r\n", signal_peer_);
                        }
                    }
                    if (ready[0].revents & POLLIN) {
                        char buffer[65536]; sockaddr_in peer{}; socklen_t size = sizeof(peer);
                        auto n = recvfrom(sip_, buffer, sizeof(buffer), 0, reinterpret_cast<sockaddr*>(&peer), &size);
                        if (n > 0) handle(std::string(buffer, n), peer);
                    }
                    if (ready[1].revents & POLLIN) {
                        unsigned char buffer[4096];
                        auto n = recv(rtp_, buffer, sizeof(buffer), 0);
                        if (n > 12 && (buffer[1] & 127) == (opus_ ? 111 : 0)) {
                            ++packets;
                            if (opus_ || std::any_of(buffer + 12, buffer + n, [](unsigned char sample) { return sample != 0xff; })) ++voiced_packets;
                        }
                    }
                }
            } catch (const std::exception& e) { error_ = e.what(); }
        });
    }
    ~SipServer() { stopped_ = true; worker_.join(); close(sip_); close(rtp_); }
    void verify() { check(error_.empty(), error_); }
private:
    static std::string header(const std::string& message, const std::string& key) {
        auto start = message.find("\r\n" + key + ":");
        if (start == std::string::npos) return "";
        start += key.size() + 3;
        return sip_trim(message.substr(start, message.find("\r\n", start) - start));
    }
    void send(const std::string& message, const sockaddr_in& peer) {
        check(sendto(sip_, message.data(), message.size(), 0, reinterpret_cast<const sockaddr*>(&peer), sizeof(peer)) == ssize_t(message.size()), "SIP test send failed");
    }
    std::string sdp() {
        return "v=0\r\no=test 1 1 IN IP4 127.0.0.1\r\ns=test\r\nc=IN IP4 127.0.0.1\r\nt=0 0\r\nm=audio " +
            std::to_string(media_port_) + (opus_ ? " RTP/AVP 111 101\r\na=rtpmap:111 opus/48000/2\r\na=rtpmap:101 telephone-event/48000\r\n" :
            " RTP/AVP 0 101\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:101 telephone-event/8000\r\n") + "a=fmtp:101 0-15\r\na=sendrecv\r\n";
    }
    void response(const std::string& request, const sockaddr_in& peer, const std::string& status,
                  std::string extra = "", std::string body = "") {
        auto to = header(request, "To"); if (to.find(";tag=") == std::string::npos) to += ";tag=mock";
        send("SIP/2.0 " + status + "\r\nVia: " + header(request, "Via") + "\r\nFrom: " + header(request, "From") +
             "\r\nTo: " + to + "\r\nCall-ID: " + header(request, "Call-ID") + "\r\nCSeq: " + header(request, "CSeq") +
             "\r\n" + extra + "Content-Length: " + std::to_string(body.size()) + "\r\n\r\n" + body, peer);
    }
    void info(const std::string& from, const std::string& to, const std::string& id, const sockaddr_in& peer, char digit = '5') {
        auto destination = to.substr(to.find('<') + 1); destination = destination.substr(0, destination.find('>'));
        const std::string body = "Signal=" + std::string(1, digit) + "\r\nDuration=160\r\n";
        send("INFO " + destination + " SIP/2.0\r\nVia: SIP/2.0/UDP 127.0.0.1:" + std::to_string(port_) +
             ";branch=z9hG4bKinfo\r\nFrom: " + from + "\r\nTo: " + to + "\r\nCall-ID: " + id +
             "\r\nCSeq: " + std::string(digit == '#' ? "3" : "2") + " INFO\r\nContent-Type: application/dtmf-relay\r\nContent-Length: " +
             std::to_string(body.size()) + "\r\n\r\n" + body, peer);
    }
    void handle(const std::string& request, const sockaddr_in& peer) {
        if (request.rfind("REGISTER ", 0) == 0) {
            if (header(request, "Expires") == "0" || header(request, "Contact").find("expires=0") != std::string::npos) {
                unregistered = true; response(request, peer, "200 OK"); return;
            }
            if (header(request, "Authorization").empty()) {
                response(request, peer, "401 Unauthorized", "WWW-Authenticate: Digest realm=\"test\", nonce=\"testnonce\", algorithm=MD5, qop=\"auth\"\r\n"); return;
            }
            check(header(request, "Authorization").find("username=\"1001\"") != std::string::npos, "wrong digest username");
            authenticated = true;
            if (reject_) { response(request, peer, "403 Forbidden"); return; }
            response(request, peer, "200 OK", "Contact: " + header(request, "Contact") + "\r\nExpires: 300\r\n");
            if (incoming_ && !invited.exchange(true)) {
                auto contact = header(request, "Contact");
                auto destination = contact.substr(contact.find('<') + 1); destination = destination.substr(0, destination.find('>'));
                auto body = sdp();
                send("INVITE " + destination + " SIP/2.0\r\nVia: SIP/2.0/UDP 127.0.0.1:" + std::to_string(port_) +
                     ";branch=z9hG4bKincoming\r\nMax-Forwards: 70\r\nFrom: <sip:1002@127.0.0.1>;tag=mock\r\nTo: <" + destination +
                     ">\r\nCall-ID: incoming-test\r\nCSeq: 1 INVITE\r\nContact: <" + uri + ">\r\nContent-Type: application/sdp\r\nContent-Length: " +
                     std::to_string(body.size()) + "\r\n\r\n" + body, peer);
            }
        } else if (request.rfind("INVITE ", 0) == 0) {
            invited = true;
            check(request.find(opus_ ? "opus/48000" : "PCMU/8000") != std::string::npos, "SIP offer lacks selected codec");
            check(request.find("a=candidate:") == std::string::npos, "unexpected gateway ICE in direct SIP offer");
            if (busy_) { response(request, peer, "486 Busy Here"); return; }
            dialog_from_ = header(request, "To") + ";tag=mock";
            dialog_to_ = header(request, "From"); dialog_id_ = header(request, "Call-ID");
            auto media = request.find("m=audio ");
            check(media != std::string::npos, "offer lacks RTP address");
            media_peer_ = peer; media_peer_.sin_port = htons(std::stoul(request.substr(media + 8)));
            signal_peer_ = peer;
            response(request, peer, "200 OK", "Contact: <" + uri + ">\r\nContent-Type: application/sdp\r\n", sdp());
        } else if (request.rfind("ACK ", 0) == 0 && !busy_) {
            info(dialog_from_, dialog_to_, dialog_id_, peer);
            connected_ = true; next_audio_ = Clock::now() + (conversation_ ? 2s : 0s);
            ready_at_ = Clock::now() + 700ms;
        } else if (request.rfind("SIP/2.0 200", 0) == 0 && header(request, "CSeq") == "1 INVITE") {
            auto to = header(request, "To"); auto from = header(request, "From");
            auto destination = header(request, "Contact"); destination = destination.substr(destination.find('<') + 1); destination = destination.substr(0, destination.find('>'));
            send("ACK " + destination + " SIP/2.0\r\nVia: SIP/2.0/UDP 127.0.0.1:" + std::to_string(port_) +
                 ";branch=z9hG4bKack\r\nFrom: " + from + "\r\nTo: " + to + "\r\nCall-ID: incoming-test\r\nCSeq: 1 ACK\r\nContent-Length: 0\r\n\r\n", peer);
            info(from, to, "incoming-test", peer);
        } else if (request.rfind("BYE ", 0) == 0) { bye = true; response(request, peer, "200 OK"); }
    }
    int sip_ = -1, rtp_ = -1;
    unsigned port_, media_port_;
    bool reject_, busy_, incoming_, opus_, conversation_, wait_for_ready_;
    bool connected_ = false, sent_bye_ = false;
    unsigned audio_frames_ = 0;
    sockaddr_in media_peer_{}, signal_peer_{};
    Clock::time_point next_audio_, ready_at_;
    std::atomic<bool> stopped_{false};
    std::thread worker_;
    std::string error_, dialog_from_, dialog_to_, dialog_id_;
};
void test_sip(const std::string& executable) {
    setenv("SIP_WAIT_FOR_MEDIA", "0", 1);
    setenv("SIP_SECRET", "test-password", 1); unsetenv("SIP_CODEC");
    setenv("SIP_GREETING", "", 1);
    bool turn_test = getenv("IVRTTS_TEST_TURN_URL");
    if (turn_test) {
        setenv("COTURN_URL", getenv("IVRTTS_TEST_TURN_URL"), 1);
        setenv("COTURN_USERNAME", "ivrtts-test", 1);
        setenv("COTURN_PASSWORD", "local-turn-test-password", 1);
    } else unsetenv("COTURN_URL");
    setenv("SIP_LISTEN", "127.0.0.1:0", 1);
    setenv("SIP_INTERFACE", "127.0.0.1", 1);
    for (unsigned scenario = 0; scenario < 5; ++scenario) {
        bool reject = scenario == 0, busy = scenario == 1, incoming = scenario == 3, opus = scenario == 4;
        Server audio;
        SipServer sip(reject, busy, incoming, opus);
        setenv("SIP_CODEC", opus ? "OPUS" : "PCMU", 1);
        Process client(executable, {"sip:1001@127.0.0.1", sip.uri, incoming ? "listen" : "sip:1002@127.0.0.1",
                                   audio.url, "test", "Hello from the SIP test.", "lingCL"});
        check(client.finish(12) == (reject || busy ? 1 : 0), "unexpected SIP exit status: " + client.output);
        sip.verify();
        check(sip.authenticated, "SIP digest authentication missing: " + client.output);
        if (reject) check(client.output.find("registration failed") != std::string::npos && !sip.invited, "registration rejection not handled");
        else if (busy) check(client.output.find("486") != std::string::npos, "busy response missing: " + client.output);
        else {
            check(sip.invited && sip.packets > 10 && sip.voiced_packets > 10 && sip.bye, "SIP/RTP call lifecycle incomplete: " + client.output);
            check(client.output.find("DTMF: 5") != std::string::npos, "received DTMF missing: " + client.output);
        }
        if (!reject) check(sip.unregistered, "SIP unregister missing: " + client.output);
        check(client.output.find("test-password") == std::string::npos, "SIP password printed");
    }
    {
        Server audio; SipServer sip(true, false, false); Temp settings;
        for (const char* key : {"SIP_ACCOUNT", "SIP_PROXY", "SIP_TARGET", "LLM_MODEL"}) unsetenv(key);
        auto filename = settings.path / ".env.sip";
        write_file(filename, "SIP_ACCOUNT=sip:1001@127.0.0.1\nSIP_PROXY=" + sip.uri +
            "\nSIP_TARGET=listen\nSIP_SECRET='test-password'\nLLM_MODEL=test-llm\n");
        Process client(executable, {"--env", filename.string()});
        check(client.finish(10) == 1 && client.output.find("registration failed") != std::string::npos,
              "settings-file startup did not reach SIP registration: " + client.output);
        sip.verify();
    }
#ifdef IVRTTS_TEST_PIPELINE
    {
        Server audio;
        SipServer sip(false, false, false, false, false, true);
        setenv("SIP_WAIT_FOR_MEDIA", "1", 1);
        setenv("SIP_CODEC", "PCMU", 1);
        Process client(executable, {"sip:1001@127.0.0.1", sip.uri, "sip:1002@127.0.0.1",
                                   audio.url, "test", "Greeting waits for ready audio.", "lingCL"});
        check(client.finish(12) == 0, "media-ready greeting call failed: " + client.output);
        sip.verify();
        check(sip.ready_sent && sip.voiced_before_ready == 0 && sip.voiced_packets > 10,
              "greeting must remain silent until caller presses #, then play: " + client.output);
        check(client.output.find("Waiting for caller to press #") != std::string::npos &&
              client.output.find("Caller pressed #; starting greeting.") != std::string::npos,
              "manual greeting trigger missing: " + client.output);
        check(client.output.find("DTMF: 5") != std::string::npos,
              "ordinary DTMF should not start greeting or be consumed");
        setenv("SIP_WAIT_FOR_MEDIA", "0", 1);
    }
    {
        Server audio; audio.pipeline_mode = true;
        SipServer sip(false, false, false, false, true);
        setenv("SIP_CODEC", "PCMU", 1);
        setenv("AUDIOCPP_URL", audio.url.c_str(), 1);
        setenv("LLM_URL", (audio.url + "/v1").c_str(), 1);
        setenv("RAG_URL", (audio.url + "/v1/rag").c_str(), 1);
        setenv("LLM_MODEL", "test-llm", 1);
        unsetenv("SIP_GREETING");
        Process client(executable, {"--pipeline", "sip:1001@127.0.0.1", sip.uri, "sip:1002@127.0.0.1"});
        int status;
        try { status = client.finish(12); } catch (const std::exception& e) {
            std::string routes;
            for (const auto& request : audio.pipeline_requests()) {
                routes += request.first;
                if (request.first == "/v1/ui/upload") {
                    int maximum = 0;
                    for (size_t i = 44; i + 1 < request.second.size(); i += 2) {
                        int16_t sample = int16_t(unsigned(static_cast<unsigned char>(request.second[i])) | unsigned(static_cast<unsigned char>(request.second[i + 1])) << 8);
                        maximum = std::max(maximum, std::abs(int(sample)));
                    }
                    routes += "(" + std::to_string(maximum) + ")";
                }
                routes += " ";
            }
            throw std::runtime_error(std::string(e.what()) + ": " + client.output + " routes=" + routes + " voiced=" + std::to_string(sip.voiced_packets));
        }
        check(status == 0, "RTP conversation failed: " + client.output);
        sip.verify();
        check(sip.voiced_packets > 20 && sip.unregistered, "conversation reply RTP missing");
        auto requests = audio.pipeline_requests();
        check(!requests.empty() && requests.front().first == "/v1/audio/speech", "greeting was not generated before registration");
        auto greeting = parse(requests.front().second);
        check(field(greeting.get(), "input") == "歡迎來電期偶科技 請問我可以怎麼服務您", "welcome greeting text changed");
        check(client.output.find("Playing welcome greeting.") != std::string::npos, "greeting did not start on call establishment");
        for (const char* route : {"/v1/tasks/run", "/v1/audio/transcriptions/details", "/v1/rag/retrieve", "/v1/chat/completions", "/v1/audio/speech"})
            check(std::any_of(requests.begin(), requests.end(), [&](const auto& request) { return request.first == route; }),
                  std::string("RTP conversation skipped ") + route);
    }
#endif
    std::cout << "PASS: direct SIP digest registration, failures, incoming/outgoing PCMU/Opus RTP, DTMF, BYE and unregister\n";
}

void test_env(const std::filesystem::path& root) {
    auto path = root / ".env.sip";
    for (const char* key : {"SIP_SECRET", "SIP_PROXY", "STT_HOTWORDS", "STT_HOTWORDS_FILE", "STT_MODEL", "IVRTTS_VOICE_DIR"}) unsetenv(key);
    setenv("AUDIOCPP_URL", "http://exported-value", 1);
    const std::string secret = "a#b $HOME $(touch " + (root / "unexpected").string() + ")";
    write_file(path, "# Settings\r\nSIP_SECRET='" + secret + "'\r\n"
        "AUDIOCPP_URL=http://file-value\nSIP_PROXY=sip:test:5060 # comment\n"
        "STT_HOTWORDS=\"Office #3\\nAcme\"\nSTT_HOTWORDS_FILE='words.txt'\nIVRTTS_VOICE_DIR=voices\n");
    check(load_sip_env(path.string(), true), "settings not loaded");
    check(std::string(getenv("SIP_SECRET")) == secret && !std::filesystem::exists(root / "unexpected"), "settings executed shell syntax");
    check(std::string(getenv("AUDIOCPP_URL")) == "http://exported-value", "exported variable was overwritten");
    check(std::string(getenv("SIP_PROXY")) == "sip:test:5060", "inline comment not removed");
    check(std::string(getenv("STT_HOTWORDS")) == "Office #3\nAcme", "quoted value changed");
    check(std::string(getenv("STT_HOTWORDS_FILE")) == (root / "words.txt").string(), "relative path not resolved");
    check(!load_sip_env((root / "missing").string()), "optional file was required");
    for (const auto& invalid : {"STT_MODEL=test\nUNKNOWN_KEY=hidden\n", "SIP_SECRET=first\nSIP_SECRET=second\n", "SIP_SECRET='unclosed\n"}) {
        write_file(path, invalid); bool rejected = false;
        try { load_sip_env(path.string(), true); } catch (const std::exception& e) {
            rejected = true; check(std::string(e.what()).find("hidden") == std::string::npos, "invalid value printed");
        }
        check(rejected, "invalid settings accepted");
    }
    check(!getenv("STT_MODEL"), "invalid file partially applied");
    bool missing = false;
    try { load_sip_env((root / "missing").string(), true); } catch (const std::exception&) { missing = true; }
    check(missing, "explicit missing file accepted");
    setenv("COTURN_USERNAME", "ivrtts-test", 1);
    setenv("COTURN_PASSWORD", "secret\nno-auth", 1);
    bool rejected = false;
    try { coturn_credentials(); } catch (const std::exception& e) {
        rejected = true; check(std::string(e.what()).find("secret") == std::string::npos, "TURN password printed");
    }
    check(rejected, "invalid TURN credentials accepted");
    unsetenv("COTURN_PASSWORD");
    std::cout << "PASS: SIP settings quotes, secrets, paths, precedence, invalid files and no shell execution\n";
}
#ifdef IVRTTS_TEST_PIPELINE
void test_pipeline() {
    Server server; server.pipeline_mode = true;
    SipPipelineConfig config;
    config.audio_url = server.url; config.llm_url = server.url + "/v1"; config.llm_model = "test-llm";
    config.rag_url = server.url + "/v1/rag"; config.hotwords = "Office Acme ASML"; config.prompt = "Answer from the reference data.";
    auto send_turn = [](SipPipeline& pipeline) {
        std::vector<unsigned char> speech(16000, 1), silence(32000, 0);
        pipeline.feed(speech.data(), speech.size()); pipeline.feed(silence.data(), silence.size());
    };
    auto reply = [&](SipPipeline& pipeline) {
        auto deadline = Clock::now() + 8s; std::vector<unsigned char> output;
        while (Clock::now() < deadline && !pipeline.take_reply(output) && pipeline.error().empty()) std::this_thread::sleep_for(10ms);
        check(pipeline.error().empty(), pipeline.error());
        check(std::string(output.begin(), output.end()) == server.wav, "pipeline returned no WAV reply");
    };
    {
        SipPipeline pipeline(config); pipeline.resume(); send_turn(pipeline); reply(pipeline);
        pipeline.resume(); send_turn(pipeline); reply(pipeline);
        auto requests = server.pipeline_requests(); size_t stt_count = 0, llm_count = 0;
        for (const auto& request : requests) {
            if (request.first == "/v1/audio/transcriptions/details") {
                auto json = parse(request.second); check(field(json.get(), "text") == config.hotwords, "STT hotwords missing"); ++stt_count;
            }
            if (request.first == "/v1/chat/completions") {
                auto json = parse(request.second); json_object* messages = nullptr; json_object_object_get_ex(json.get(), "messages", &messages);
                check(field(json_object_array_get_idx(messages, 0), "content").find("floor 3") != std::string::npos, "RAG context not given to LLM");
                check(json_object_array_length(messages) == (llm_count ? 4 : 2), "conversation history missing"); ++llm_count;
            }
        }
        check(stt_count == 2 && llm_count == 2, "pipeline skipped a turn");
    }
    {
        server.rag_fails = true; SipPipeline pipeline(config); pipeline.resume(); send_turn(pipeline);
        auto deadline = Clock::now() + 6s;
        while (pipeline.error().empty() && Clock::now() < deadline) std::this_thread::sleep_for(10ms);
        check(pipeline.error().find("503") != std::string::npos, "RAG failure was silently ignored"); server.rag_fails = false;
    }
    {
        server.stt_waits = true; SipPipeline pipeline(config); pipeline.resume(); send_turn(pipeline);
        auto deadline = Clock::now() + 3s; bool in_stt = false;
        auto count = server.pipeline_requests().size();
        while (!in_stt && Clock::now() < deadline) {
            auto requests = server.pipeline_requests();
            for (size_t i = count; i < requests.size(); ++i) in_stt |= requests[i].first == "/v1/audio/transcriptions/details";
            std::this_thread::sleep_for(10ms);
        }
        check(in_stt, "cancellation test did not reach STT");
        auto started = Clock::now(); pipeline.stop(); check(Clock::now() - started < 3s, "pipeline cancellation blocked");
    }
    std::cout << "PASS: VAD turn boundaries, STT hotwords, RAG grounding, LLM history, TTS WAV, errors/cancellation\n";
}
#endif
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
        check(argc == 3, "Usage: ivrtts_tests cli|tui|sip /path/to/example");
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
        else if (std::string(argv[1]) == "sip") test_sip(cli);
        else if (std::string(argv[1]) == "env") test_env(temp.path);
#ifdef IVRTTS_TEST_PIPELINE
        else if (std::string(argv[1]) == "pipeline") test_pipeline();
#endif
        else throw std::runtime_error("unknown test suite");
    } catch (const std::exception& e) { std::cerr << "FAIL: " << e.what() << '\n'; return 1; }
}
