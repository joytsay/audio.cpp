// Direct SIP/RTP voice pipeline using embedded libbaresip.
#include "ivrTTS.h"
#include "sipPipeline.h"
#include "sipEnv.h"
#include "sipTurn.h"
#include <curl/curl.h>
#include <re.h>
#include <rem.h>
#include <baresip.h>
#include <algorithm>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>

namespace {
using Clock = std::chrono::steady_clock;
volatile std::sig_atomic_t interrupted = 0;
void interrupt_handler(int) { interrupted = 1; }
std::string env(const char* key) { const char* value = std::getenv(key); return value ? value : ""; }
void require(int error, const char* operation) {
    if (error) throw std::runtime_error(std::string(operation) + ": " + std::strerror(error));
}
struct Audio {
    int rate = 0, channels = 0;
    std::vector<unsigned char> pcm;
};
Audio decode_wav(const std::vector<unsigned char>& wav) {
    auto u16 = [](const unsigned char* b) { return unsigned(b[0]) | unsigned(b[1]) << 8; };
    auto u32 = [&](const unsigned char* b) { return u16(b) | u16(b + 2) << 16; };
    if (wav.size() < 12 || std::string(wav.begin(), wav.begin() + 4) != "RIFF" ||
        std::string(wav.begin() + 8, wav.begin() + 12) != "WAVE")
        throw std::runtime_error("TTS response is not RIFF WAV");
    Audio result;
    bool format = false;
    for (size_t offset = 12; offset + 8 <= wav.size();) {
        const auto* chunk = wav.data() + offset;
        size_t length = u32(chunk + 4);
        if (length > wav.size() - offset - 8) throw std::runtime_error("truncated WAV chunk");
        std::string name(reinterpret_cast<const char*>(chunk), 4);
        if (name == "fmt ") {
            if (length < 16 || u16(chunk + 8) != 1 || u16(chunk + 22) != 16)
                throw std::runtime_error("exampleSIP requires PCM16 WAV");
            result.channels = u16(chunk + 10); result.rate = u32(chunk + 12);
            if (result.rate < 1000 || result.rate > 384000 || result.channels < 1 || result.channels > 8 ||
                u16(chunk + 20) != unsigned(result.channels * 2)) throw std::runtime_error("invalid WAV format");
            format = true;
        } else if (name == "data") {
            if (!format || !length || length % (result.channels * 2)) throw std::runtime_error("invalid WAV audio data");
            result.pcm.assign(chunk + 8, chunk + 8 + length); return result;
        }
        offset += 8 + length + (length & 1);
    }
    throw std::runtime_error("WAV has no audio data");
}

// Convert PCM16 to mono at the requested rate. Baresip supplies codec-rate
// frames, so every 20 ms frame converts to exactly 320 samples for the VAD.
std::vector<int16_t> mono(const int16_t* samples, size_t frames, unsigned channels,
                          unsigned source_rate, unsigned target_rate) {
    if (!frames || !channels || !source_rate || !target_rate) return {};
    std::vector<int16_t> result(frames * target_rate / source_rate);
    auto sample = [&](size_t frame) {
        double value = 0;
        for (unsigned c = 0; c < channels; ++c) value += samples[frame * channels + c];
        return value / channels;
    };
    for (size_t i = 0; i < result.size(); ++i) {
        double position = double(i) * source_rate / target_rate;
        size_t a = std::min(size_t(position), frames - 1), b = std::min(a + 1, frames - 1);
        result[i] = int16_t(std::lround(sample(a) * (1 - (position - a)) + sample(b) * (position - a)));
    }
    return result;
}
class AudioBridge {
public:
    explicit AudioBridge(SipPipeline* pipeline) : pipeline_(pipeline) {}
    void play(const std::vector<unsigned char>& wav) {
        auto audio = decode_wav(wav);
        std::vector<int16_t> samples(audio.pcm.size() / 2);
        for (size_t i = 0; i < samples.size(); ++i)
            samples[i] = int16_t(unsigned(audio.pcm[i * 2]) | unsigned(audio.pcm[i * 2 + 1]) << 8);
        auto pcm = mono(samples.data(), samples.size() / audio.channels, audio.channels, audio.rate, 48000);
        if (pcm.empty()) throw std::runtime_error("TTS WAV has no playable samples");
        std::lock_guard<std::mutex> lock(mutex_);
        pcm_ = std::move(pcm); position_ = 0; playing_ = true; finished_ = false;
    }
    void transmit(int16_t* output, size_t frames, unsigned channels, unsigned rate) {
        std::fill(output, output + frames * channels, 0);
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_ || !playing_) return;
        for (size_t i = 0; i < frames && position_ < pcm_.size(); ++i) {
            size_t a = size_t(position_), b = std::min(a + 1, pcm_.size() - 1);
            int16_t value = int16_t(std::lround(pcm_[a] * (1 - (position_ - a)) + pcm_[b] * (position_ - a)));
            for (unsigned c = 0; c < channels; ++c) output[i * channels + c] = value;
            position_ += 48000.0 / rate;
        }
        if (position_ >= pcm_.size()) { playing_ = false; finished_ = true; }
    }
    void receive(const int16_t* input, size_t frames, unsigned channels, unsigned rate) {
        if (!active_ || !pipeline_) return;
        auto pcm = mono(input, frames, channels, rate, 16000);
        std::vector<unsigned char> bytes(pcm.size() * 2);
        for (size_t i = 0; i < pcm.size(); ++i) {
            bytes[i * 2] = unsigned(pcm[i]) & 255; bytes[i * 2 + 1] = (unsigned(pcm[i]) >> 8) & 255;
        }
        pipeline_->feed(bytes.data(), bytes.size());
    }
    bool finished() { std::lock_guard<std::mutex> lock(mutex_); bool value = finished_; finished_ = false; return value; }
    void activate(bool value) { active_ = value; }
    void fail() noexcept { failed_ = true; }
    bool failed() const { return failed_; }
private:
    SipPipeline* pipeline_;
    std::mutex mutex_;
    std::vector<int16_t> pcm_;
    double position_ = 0;
    bool playing_ = false, finished_ = false;
    std::atomic<bool> active_{false}, failed_{false};
};
AudioBridge* bridge = nullptr; // libbaresip is a process-wide singleton.

struct Driver {
    std::atomic<bool> running{true};
    std::thread worker;
    ~Driver() { running = false; if (worker.joinable()) worker.join(); }
};
void driver_destructor(void* state) { delete *static_cast<Driver**>(state); }
// The opaque source/player states hold one pointer to a C++ worker. mem_deref
// joins the worker before baresip frees the callback's audio context.
int start_driver(void** state, unsigned rate, unsigned channels, unsigned ptime, int format,
                 ausrc_read_h* read, auplay_write_h* write, void* arg) noexcept {
    if (!state || !bridge || format != AUFMT_S16LE || !rate || !channels || !ptime || ptime > 200)
        return ENOTSUP;
    auto** holder = static_cast<Driver**>(mem_zalloc(sizeof(Driver*), driver_destructor));
    if (!holder) return ENOMEM;
    try {
        *holder = new Driver;
        Driver* driver = *holder;
        size_t frames = size_t(rate) * ptime / 1000;
        std::vector<int16_t> samples(frames * channels);
        driver->worker = std::thread([=, samples = std::move(samples)]() mutable {
            auto next = Clock::now(); uint64_t timestamp = 0;
            try {
                while (driver->running) {
                    struct auframe frame;
                    auframe_init(&frame, AUFMT_S16LE, samples.data(), samples.size(), rate, channels);
                    frame.timestamp = timestamp;
                    if (read) {
                        bridge->transmit(samples.data(), frames, channels, rate);
                        read(&frame, arg);
                    } else {
                        std::fill(samples.begin(), samples.end(), 0);
                        write(&frame, arg);
                        bridge->receive(samples.data(), frames, channels, rate);
                    }
                    timestamp += uint64_t(ptime) * 1000;
                    next += std::chrono::milliseconds(ptime);
                    // Avoid a burst of stale audio after a scheduling delay.
                    if (next < Clock::now()) next = Clock::now();
                    std::this_thread::sleep_until(next);
                }
            } catch (...) { bridge->fail(); }
        });
        *state = holder;
        return 0;
    } catch (...) { mem_deref(holder); return ENOMEM; }
}
int source_alloc(struct ausrc_st** state, const struct ausrc*, struct ausrc_prm* prm,
                 const char*, ausrc_read_h* read, ausrc_error_h*, void* arg) {
    void* value = nullptr;
    int error = start_driver(&value, prm->srate, prm->ch, prm->ptime, prm->fmt, read, nullptr, arg);
    if (!error) *state = static_cast<struct ausrc_st*>(value);
    return error;
}
int player_alloc(struct auplay_st** state, const struct auplay*, struct auplay_prm* prm,
                 const char*, auplay_write_h* write, void* arg) {
    void* value = nullptr;
    int error = start_driver(&value, prm->srate, prm->ch, prm->ptime, prm->fmt, nullptr, write, arg);
    if (!error) *state = static_cast<struct auplay_st*>(value);
    return error;
}

class SipCall {
public:
    SipCall(std::string account, std::string proxy, std::string target,
            std::vector<unsigned char> announcement, std::unique_ptr<SipPipeline> pipeline = {})
        : account_(std::move(account)), proxy_(std::move(proxy)), target_(std::move(target)),
          announcement_(std::move(announcement)), pipeline_(std::move(pipeline)), audio_(pipeline_.get()) {
        tmr_init(&timer_);
    }
    ~SipCall() {
        tmr_cancel(&timer_);
        if (events_) bevent_unregister(event_handler);
        audio_.activate(false);
        if (ua_initialized_) ua_close(); // destroys drivers and joins their threads
        if (pipeline_) pipeline_->stop();
        mem_deref(source_); mem_deref(player_);
        if (configured_) conf_close();
        if (initialized_) baresip_close();
        if (libre_) { mod_close(); libre_close(); }
        bridge = nullptr;
    }
    int run() {
        const auto wait_for_media = env("SIP_WAIT_FOR_MEDIA");
        if (!wait_for_media.empty() && wait_for_media != "0" && wait_for_media != "1")
            throw std::runtime_error("SIP_WAIT_FOR_MEDIA must be 0 or 1");
        wait_for_media_ = wait_for_media != "0";
        require(libre_init(), "initialize libre"); libre_ = true;
        std::string config = "sip_transports udp,tcp,tls\naudio_source ivrtts,memory\naudio_player ivrtts,memory\n"
                             "audio_alert ivrtts,memory\nrtp_rxmode main\n";
        auto setting = [&](const char* key, const char* name) {
            auto value = env(key);
            if (value.find_first_of("\r\n") != std::string::npos) throw std::runtime_error("invalid SIP network setting");
            if (!value.empty()) config += std::string(name) + " " + value + "\n";
        };
        setting("SIP_LISTEN", "sip_listen"); setting("SIP_RTP_PORTS", "rtp_ports");
        setting("SIP_INTERFACE", "net_interface");
        require(conf_configure_buf(reinterpret_cast<const uint8_t*>(config.data()), config.size()), "configure baresip");
        configured_ = true;
        conf_config()->call.accept = true; conf_config()->call.max_calls = 1;
        require(baresip_init(conf_config()), "initialize baresip"); initialized_ = true;
        bridge = &audio_;
        require(ausrc_register(&source_, baresip_ausrcl(), "ivrtts", source_alloc), "register audio source");
        require(auplay_register(&player_, baresip_auplayl(), "ivrtts", player_alloc), "register audio player");
        require(ua_init("audio.cpp ivrTTS", true, true, true), "initialize SIP user agent"); ua_initialized_ = true;
        std::string codec = env("SIP_CODEC"); if (codec.empty()) codec = "PCMU";
        if (codec != "PCMU" && codec != "OPUS") throw std::runtime_error("SIP_CODEC must be PCMU or OPUS");
        std::string path = env("BARESIP_MODULE_PATH");
        if (path.empty()) path = IVRTTS_BARESIP_MODULE_PATH;
        require(module_load(path.c_str(), codec == "PCMU" ? "g711" : "opus"), "load baresip codec (check BARESIP_MODULE_PATH)");
        if (!env("COTURN_URL").empty()) {
            coturn_credentials();
            if (env("COTURN_URL").rfind("turn:", 0) != 0 || env("COTURN_URL").find_first_of("@\r\n") != std::string::npos)
                throw std::runtime_error("COTURN_URL must be turn:HOST:PORT?transport=udp|tcp without embedded credentials");
            require(module_load(path.c_str(), "turn"), "load baresip TURN module (rebuild with MODULES=g711;opus;turn)");
        }
        require(bevent_register(event_handler, this), "register SIP events"); events_ = true;
        require(ua_alloc(&ua_, ("<" + account_ + ">;regint=300").c_str()), "create SIP account");
        auto* account = ua_account(ua_);
        require(account_set_auth_pass(account, env("SIP_SECRET").c_str()), "set SIP password");
        if (!env("SIP_AUTHUSER").empty()) require(account_set_auth_user(account, env("SIP_AUTHUSER").c_str()), "set SIP auth user");
        require(account_set_outbound(account, proxy_.c_str(), 0), "set SIP proxy");
        require(account_set_audio_codecs(account, codec == "PCMU" ? "PCMU/8000/1" : "opus/48000/2"), "select SIP codec");
        require(account_set_dtmfmode(account, env("SIP_DTMF_MODE") == "info" ? DTMFMODE_SIP_INFO : DTMFMODE_RTP_EVENT), "set DTMF mode");
        if (!env("COTURN_URL").empty()) {
            require(account_set_stun_uri(account, env("COTURN_URL").c_str()), "set TURN server URI");
            require(account_set_stun_user(account, env("COTURN_USERNAME").c_str()), "set TURN username");
            require(account_set_stun_pass(account, env("COTURN_PASSWORD").c_str()), "set TURN password");
            require(account_set_medianat(account, "turn"), "enable TURN media relay");
            std::cout << "TURN media relay enabled.\n";
        }
        deadline_ = Clock::now() + std::chrono::seconds(30);
        tmr_start(&timer_, 20, tick_handler, this);
        require(ua_register(ua_), "register SIP account");
        require(re_main(nullptr), "SIP event loop");
        if (!error_.empty()) throw std::runtime_error(error_);
        return 0;
    }
private:
    static void event_handler(enum bevent_ev event, struct bevent* data, void* context) noexcept {
        auto& self = *static_cast<SipCall*>(context);
        try { self.event(event, data); } catch (const std::exception& e) { self.fail(e.what()); }
    }
    void event(enum bevent_ev event, struct bevent* data) {
        if (closing_ || bevent_get_ua(data) != ua_) return;
        auto* call = bevent_get_call(data);
        switch (event) {
        case BEVENT_REGISTER_OK:
            if (registered_) break;
            registered_ = true;
            std::cout << "SIP registered.\n";
            if (target_ == "listen") { waiting_ = true; std::cout << "Waiting for one incoming call...\n"; }
            else require(ua_connect(ua_, &call_, nullptr, target_.c_str(), VIDMODE_OFF), "start SIP call");
            deadline_ = Clock::now() + std::chrono::seconds(60);
            break;
        case BEVENT_REGISTER_FAIL:
            throw std::runtime_error(std::string("SIP registration failed: ") + bevent_get_text(data));
        case BEVENT_CALL_INCOMING:
            if (target_ != "listen" || call_) { ua_hangup(ua_, call, 486, "Busy Here"); break; }
            call_ = call; waiting_ = false;
            deadline_ = Clock::now() + std::chrono::seconds(30);
            require(ua_answer(ua_, call_, VIDMODE_OFF), "answer SIP call");
            break;
        case BEVENT_CALL_ESTABLISHED:
            established_ = true; audio_.activate(true);
            std::cout << "SIP call established.\n";
            if (!announcement_.empty()) {
                if (wait_for_media_ && !media_ready_) {
                    waiting_for_media_ = true;
                    std::cout << "Waiting for caller to press # to start greeting.\n";
                } else start_announcement();
            } else if (pipeline_) pipeline_->resume();
            break;
        case BEVENT_CALL_DTMF_START:
            if (call == call_ && wait_for_media_ && !announcement_.empty() &&
                std::string(bevent_get_text(data)) == "#" && !announcement_started_) {
                media_ready_ = true;
                if (established_ && waiting_for_media_) {
                    std::cout << "Caller pressed #; starting greeting.\n";
                    start_announcement();
                }
                break;
            }
            if (call == call_) std::cout << "DTMF: " << bevent_get_text(data) << '\n';
            break;
        case BEVENT_CALL_CLOSED:
            if (call != call_) break;
            call_ = nullptr; audio_.activate(false);
            if (!established_ || call_scode(call) >= 400)
                error_ = std::string("SIP call failed: ") + bevent_get_text(data);
            std::cout << "SIP call closed.\n"; close();
            break;
        default: break;
        }
    }
    static void tick_handler(void* context) noexcept {
        auto& self = *static_cast<SipCall*>(context);
        try { self.tick(); } catch (const std::exception& e) { self.fail(e.what()); }
    }
    void start_announcement() {
        if (announcement_started_) return;
        waiting_for_media_ = false;
        announcement_started_ = true;
        if (pipeline_) std::cout << "Playing welcome greeting.\n";
        audio_.play(announcement_);
    }
    void tick() {
        if (closing_) {
            if (Clock::now() >= deadline_) re_cancel();
        } else if (interrupted) close();
        else {
            if (!established_ && !waiting_ && Clock::now() > deadline_) throw std::runtime_error("SIP operation timed out");
            if (audio_.failed()) throw std::runtime_error("SIP audio driver failed");
            if (pipeline_) {
                auto error = pipeline_->error(); if (!error.empty()) throw std::runtime_error(error);
                std::vector<unsigned char> reply;
                if (pipeline_->take_reply(reply)) { audio_.play(reply); draining_ = false; }
            }
            if (audio_.finished()) { draining_ = true; playback_end_ = Clock::now() + std::chrono::milliseconds(300); }
            if (draining_ && Clock::now() >= playback_end_) {
                draining_ = false;
                if (pipeline_) pipeline_->resume(); else close();
            }
        }
        tmr_start(&timer_, 20, tick_handler, this);
    }
    void fail(const std::string& error) noexcept {
        try { error_ = error; close(); } catch (...) { re_cancel(); }
    }
    void close() {
        if (closing_) return;
        closing_ = true; audio_.activate(false);
        if (call_) { ua_hangup(ua_, call_, 0, "Normal clearing"); call_ = nullptr; }
        ua_unregister(ua_);
        // Keep the loop alive briefly for BYE/unregister responses.
        deadline_ = Clock::now() + std::chrono::milliseconds(500);
    }
    std::string account_, proxy_, target_, error_;
    std::vector<unsigned char> announcement_;
    std::unique_ptr<SipPipeline> pipeline_;
    AudioBridge audio_;
    struct ua* ua_ = nullptr;
    struct call* call_ = nullptr;
    struct ausrc* source_ = nullptr;
    struct auplay* player_ = nullptr;
    struct tmr timer_{};
    bool libre_ = false, configured_ = false, initialized_ = false, ua_initialized_ = false, events_ = false;
    bool registered_ = false, established_ = false, waiting_ = false, closing_ = false, draining_ = false;
    bool wait_for_media_ = false, waiting_for_media_ = false, media_ready_ = false, announcement_started_ = false;
    Clock::time_point deadline_, playback_end_;
};

void self_test() {
    std::vector<unsigned char> wav{'R','I','F','F',38,0,0,0,'W','A','V','E',
        'f','m','t',' ',16,0,0,0,1,0,1,0,0xc0,0x5d,0,0,0x80,0xbb,0,0,2,0,16,0,
        'd','a','t','a',2,0,0,0,0xff,0x7f};
    auto audio = decode_wav(wav);
    if (audio.rate != 24000 || audio.channels != 1) throw std::runtime_error("WAV metadata self-test failed");
    bool rejected = false;
    try { decode_wav(std::vector<unsigned char>(wav.begin(), wav.end() - 1)); }
    catch (const std::exception&) { rejected = true; }
    if (!rejected) throw std::runtime_error("truncated WAV accepted");
    AudioBridge test(nullptr); test.play(wav); test.activate(true);
    int16_t samples[320]{}; test.transmit(samples, 320, 1, 16000);
    if (samples[0] != 32767 || !test.finished()) throw std::runtime_error("PCM playback self-test failed");
    for (unsigned rate : {8000u, 48000u}) {
        std::vector<int16_t> input(rate / 50, 1000);
        auto output = mono(input.data(), input.size(), 1, rate, 16000);
        if (output.size() != 320 || output[0] != 1000) throw std::runtime_error("caller PCM conversion failed");
    }
    std::cout << "PASS: WAV validation, in-memory playback, 8/48 kHz caller conversion\n";
}
bool sip_uri(const std::string& value) {
    return (value.rfind("sip:", 0) == 0 || value.rfind("sips:", 0) == 0) &&
           value.find_first_of("\r\n<>\" ") == std::string::npos;
}
}

int main(int argc, char** argv) {
    // Docker captures stdout through a pipe. Flush both baresip's C logging and
    // C++ status messages while the process is waiting for an incoming call.
    std::setvbuf(stdout, nullptr, _IOLBF, 0);
    std::cout << std::unitbuf;
    try {
        std::vector<std::string> args;
        std::string settings = ".env.sip"; bool explicit_file = false;
        for (int i = 1; i < argc; ++i) {
            if (std::string(argv[i]) == "--env") {
                if (++i >= argc || explicit_file) throw std::runtime_error("use --env with one settings file path");
                settings = argv[i]; explicit_file = true;
            } else args.emplace_back(argv[i]);
        }
        if (args == std::vector<std::string>{"--help"}) {
            std::cout << "Usage: exampleSIP SIP_ACCOUNT SIP_PROXY TARGET_OR_listen TTS_URL MODEL TEXT [VOICE]\n"
                         "Full pipeline: exampleSIP --pipeline SIP_ACCOUNT SIP_PROXY TARGET_OR_listen\n"
                         "TURN client: COTURN_URL, COTURN_USERNAME, COTURN_PASSWORD\n"
                         "SIP_GREETING: opening message; an empty value disables it\n"
                         "SIP_WAIT_FOR_MEDIA=1: wait for caller to press # before greeting (default 1; 0 starts automatically)\n"
                         "Settings file: exampleSIP [--env PATH] (defaults to .env.sip, full pipeline)\n"
                         "Required: SIP_SECRET, LLM_MODEL (pipeline). Optional: SIP_AUTHUSER, SIP_CODEC=PCMU|OPUS,\n"
                         "  SIP_LISTEN, SIP_INTERFACE, SIP_RTP_PORTS, SIP_DTMF_MODE=rtp|info, BARESIP_MODULE_PATH\n"
                         "Pipeline: AUDIOCPP_URL, LLM_URL, LLM_API_KEY, RAG_URL, VAD_MODEL, STT_MODEL,\n"
                         "  STT_HOTWORDS_FILE, STT_HOTWORDS, STT_LANGUAGE, SYSTEM_PROMPT_FILE, TTS_MODEL, TTS_VOICE\n";
            return 0;
        }
        if (args == std::vector<std::string>{"--self-test"}) { self_test(); return 0; }
        load_sip_env(settings, explicit_file);
        if (args.empty() || args == std::vector<std::string>{"--pipeline"}) {
            args = {"--pipeline"};
            for (const char* key : {"SIP_ACCOUNT", "SIP_PROXY", "SIP_TARGET"}) {
                auto value = env(key); if (value.empty()) throw std::runtime_error(std::string("set ") + key + " in .env.sip");
                args.push_back(value);
            }
        }
        bool pipeline = args.size() == 4 && args[0] == "--pipeline";
        if (!pipeline && args.size() != 6 && args.size() != 7) throw std::runtime_error("use --help for arguments");
        size_t offset = pipeline ? 1 : 0;
        if (!sip_uri(args[offset]) || !sip_uri(args[offset + 1]) ||
            (args[offset + 2] != "listen" && !sip_uri(args[offset + 2]))) throw std::runtime_error("use SIP URIs for account, proxy and target");
        if (env("SIP_SECRET").empty() || env("SIP_SECRET") == "REPLACE_WITH_TEST_ACCOUNT_PASSWORD")
            throw std::runtime_error("set SIP_SECRET to your account password");
        if (!env("SIP_DTMF_MODE").empty() && env("SIP_DTMF_MODE") != "rtp" && env("SIP_DTMF_MODE") != "info")
            throw std::runtime_error("SIP_DTMF_MODE must be rtp or info");
        std::signal(SIGINT, interrupt_handler); std::signal(SIGTERM, interrupt_handler);
        require(curl_global_init(CURL_GLOBAL_DEFAULT), "initialize HTTP library");
        struct Cleanup { ~Cleanup() { curl_global_cleanup(); } } cleanup;
        if (pipeline) {
            auto config = SipPipelineConfig::from_environment();
            const char* configured_greeting = std::getenv("SIP_GREETING");
            std::string greeting = configured_greeting ? configured_greeting : "歡迎來電期偶科技 請問我可以怎麼服務您";
            std::vector<unsigned char> welcome;
            if (!greeting.empty()) {
                ivrTTS tts; tts.create(config.audio_url, config.tts_model, config.voice);
                std::cout << "Generating welcome greeting...\n";
                welcome = tts.run(greeting); decode_wav(welcome);
            }
            auto conversation = std::make_unique<SipPipeline>(std::move(config));
            SipCall call(args[1], args[2], args[3], std::move(welcome), std::move(conversation));
            return call.run();
        }
        if (args[3].rfind("http://", 0) != 0 && args[3].rfind("https://", 0) != 0)
            throw std::runtime_error("TTS URL must use HTTP(S)");
        ivrTTS tts; tts.create(args[3], args[4], args.size() == 7 ? args[6] : "lingCL");
        std::cout << "Generating TTS audio in memory...\n";
        auto wav = tts.run(args[5]); decode_wav(wav);
        SipCall call(args[0], args[1], args[2], std::move(wav));
        return call.run();
    } catch (const std::exception& error) { std::cerr << "Error: " << error.what() << '\n'; return 1; }
}
