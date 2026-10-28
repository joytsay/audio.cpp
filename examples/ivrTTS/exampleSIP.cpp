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
#include <condition_variable>
#include <cstdio>
#include <cstring>
#include <deque>
#include <iostream>
#include <fstream>
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
std::string registration_call_id;
uint32_t registration_cseq = 0;
uint16_t registration_public_port = 0;
void trace_sip(bool tx, enum sip_transp, const struct sa * src, const struct sa * dst,
               const uint8_t * packet, size_t size, void *) noexcept {
    try {
        const std::string text(reinterpret_cast<const char *>(packet), size);
        if (env("SIP_TRACE") == "1") {
            const auto end = text.find("\r\n");
            re_printf("SIP %s %J -> %J: %b\n", tx ? "TX" : "RX", src, dst, text.data(), end == std::string::npos ? text.size() : end);
        }
        if (env("SIP_CONTACT_HOST").empty()) return;
        struct Parsed {
            struct mbuf * buffer = nullptr;
            struct sip_msg * message = nullptr;
            ~Parsed() { mem_deref(message); mem_deref(buffer); }
        } parsed;
        parsed.buffer = mbuf_alloc(size);
        if (!parsed.buffer || mbuf_write_mem(parsed.buffer, packet, size)) return;
        parsed.buffer->pos = 0;
        if (sip_msg_decode(&parsed.message, parsed.buffer)) return;
        const auto * message = parsed.message;
        if (pl_strcasecmp(&message->cseq.met, "REGISTER")) return;
        const std::string id(message->callid.p, message->callid.l);
        if (tx && message->req) { registration_call_id = id; registration_cseq = message->cseq.num; }
        else if (!tx && !message->req && message->scode == 200 && id == registration_call_id && message->cseq.num == registration_cseq) {
            struct pl port;
            if (!msg_param_decode(&message->via.params, "rport", &port)) {
                const auto value = pl_u32(&port);
                if (value && value <= 65535) registration_public_port = static_cast<uint16_t>(value);
            }
        }
    } catch (...) { /* Observability must never interrupt SIP processing. */ }
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
// Filter before decimating to the G.711 clock rate. Work outside audio callbacks.
std::vector<int16_t> phone_pcm(const std::vector<int16_t>& wide) {
    if (wide.empty()) return {};
    auto padded = wide;
    padded.resize((padded.size() + 5) / 6 * 6, 0);
    struct auresamp resampler;
    auresamp_init(&resampler);
    if (auresamp_setup(&resampler, 48000, 1, 8000, 1))
        throw std::runtime_error("cannot configure filtered telephone resampler");
    // libre's FIR uses input-sized scratch space, then decimates in place.
    std::vector<int16_t> converted(padded.size());
    size_t count = converted.size();
    if (auresamp(&resampler, converted.data(), &count, padded.data(), padded.size()))
        throw std::runtime_error("cannot resample telephone audio");
    converted.resize(count);
    return converted;
}
class AudioBridge {
public:
    explicit AudioBridge(SipPipeline* pipeline, const std::string& path = env("SIP_TEST_RECORD")) : pipeline_(pipeline) {
        if (!path.empty()) {
            recording_wav_ = std::filesystem::path(path).extension() == ".wav";
            recording_.open(path, std::ios::binary | std::ios::trunc);
            if (!recording_) throw std::runtime_error("cannot create test audio recording");
            if (recording_wav_) write_recording_header();
        }
    }
    ~AudioBridge() {
        // SipCall destroys and joins the audio drivers before this member.
        if (recording_.is_open() && recording_wav_) {
            write_recording_header();
            recording_.flush();
            if (!recording_) std::cerr << "Could not finalize received-audio WAV header.\n";
        }
    }
    struct Playback { std::vector<int16_t> wide, narrow; };
    static Playback prepare(const std::vector<unsigned char>& wav) {
        auto audio = decode_wav(wav);
        std::vector<int16_t> samples(audio.pcm.size() / 2);
        for (size_t i = 0; i < samples.size(); ++i)
            samples[i] = int16_t(unsigned(audio.pcm[i * 2]) | unsigned(audio.pcm[i * 2 + 1]) << 8);
        Playback prepared;
        prepared.wide = mono(samples.data(), samples.size() / audio.channels, audio.channels, audio.rate, 48000);
        if (prepared.wide.empty()) throw std::runtime_error("TTS WAV has no playable samples");
        prepared.narrow = phone_pcm(prepared.wide);
        return prepared;
    }
    void play(const std::vector<unsigned char>& wav) { play(prepare(wav)); }
    void play(Playback prepared) {
        std::lock_guard<std::mutex> lock(mutex_);
        pcm_ = std::move(prepared.wide); narrow_pcm_ = std::move(prepared.narrow);
        position_ = 0; playing_ = true; finished_ = false;
    }
    void stop_playback() {
        std::lock_guard<std::mutex> lock(mutex_);
        playing_ = false; finished_ = false; pcm_.clear(); narrow_pcm_.clear(); position_ = 0;
    }
    void enable_echo(bool enabled) { echo_enabled_ = enabled; }
    bool echo_active() {
        std::lock_guard<std::mutex> lock(mutex_);
        return echo_enabled_ && Clock::now() < speech_until_;
    }
    void transmit(int16_t* output, size_t frames, unsigned channels, unsigned rate) {
        std::fill(output, output + frames * channels, 0);
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_) return;
        if (echo_enabled_ && Clock::now() < speech_until_) {
            for (size_t i = 0; i < frames; ++i) {
                const int16_t value = echo_.empty() ? 0 : echo_.front();
                for (unsigned c = 0; c < channels; ++c) output[i * channels + c] = value;
                echo_position_ += 48000.0 / rate;
                while (echo_position_ >= 1 && !echo_.empty()) { echo_.pop_front(); echo_position_ -= 1; }
                if (echo_.empty()) echo_position_ = 0;
            }
            return; // Freeze the greeting cursor while echoing the caller.
        }
        echo_.clear(); echo_position_ = 0;
        if (!playing_) return;
        for (size_t i = 0; i < frames && position_ < pcm_.size(); ++i) {
            const auto& buffer = rate == 8000 ? narrow_pcm_ : pcm_;
            const double position = rate == 8000 ? position_ / 6 : position_;
            size_t a = std::min(size_t(position), buffer.size() - 1), b = std::min(a + 1, buffer.size() - 1);
            int16_t value = int16_t(std::lround(buffer[a] * (1 - (position - a)) + buffer[b] * (position - a)));
            for (unsigned c = 0; c < channels; ++c) output[i * channels + c] = value;
            position_ += 48000.0 / rate;
        }
        if (position_ >= pcm_.size()) { playing_ = false; finished_ = true; }
    }
    void receive(const int16_t* input, size_t frames, unsigned channels, unsigned rate) {
        if (active_ && recording_.is_open()) {
            if (recording_wav_) {
                if (!recording_rate_) { recording_rate_ = rate; recording_channels_ = channels; }
                if (recording_rate_ != rate || recording_channels_ != channels)
                    throw std::runtime_error("received audio format changed during WAV recording");
                const auto bytes = uint64_t(frames) * channels * 2;
                if (recording_bytes_ + bytes > UINT32_MAX - 36)
                    throw std::runtime_error("received audio exceeded the WAV size limit");
                // Exactly the decoder/jitter-buffer output supplied to the player:
                // retain silence/concealment, channel count and sample rate.
                for (size_t i = 0; i < frames * channels; ++i) write_sample(input[i]);
                recording_bytes_ += bytes;
            } else {
                // Preserve the existing raw 8 kHz mono test recording format.
                for (int16_t value : mono(input, frames, channels, rate, 8000)) write_sample(value);
            }
            if (!recording_) throw std::runtime_error("cannot write test audio recording");
        }
        if (active_ && std::any_of(input, input + frames * channels, [](int16_t value) { return value > 256 || value < -256; })) ++audible_frames_;
        if (active_ && echo_enabled_) {
            auto echo = mono(input, frames, channels, rate, 48000);
            double energy = 0;
            for (const auto sample : echo) energy += double(sample) * sample;
            const bool speech = !echo.empty() && energy / echo.size() > 600.0 * 600.0;
            std::lock_guard<std::mutex> lock(mutex_);
            if (speech) {
                if (Clock::now() >= speech_until_) std::cout << "Caller voice detected; pausing greetings and echoing audio.\n";
                speech_until_ = Clock::now() + std::chrono::seconds(1);
            }
            if (Clock::now() < speech_until_) {
                echo_.insert(echo_.end(), echo.begin(), echo.end());
                while (echo_.size() > 24000) echo_.pop_front();
            }
        }
        if (!active_ || !listening_ || !pipeline_) return;
        auto pcm = mono(input, frames, channels, rate, 16000);
        std::vector<unsigned char> bytes(pcm.size() * 2);
        for (size_t i = 0; i < pcm.size(); ++i) {
            bytes[i * 2] = unsigned(pcm[i]) & 255; bytes[i * 2 + 1] = (unsigned(pcm[i]) >> 8) & 255;
        }
        pipeline_->feed(bytes.data(), bytes.size());
    }
    bool finished() { std::lock_guard<std::mutex> lock(mutex_); bool value = finished_; finished_ = false; return value; }
    void activate(bool value) { active_ = value; }
    void listen(bool value) { listening_ = value; }
    void fail() noexcept { failed_ = true; }
    bool failed() const { return failed_; }
    unsigned audible_frames() const { return audible_frames_; }
private:
    void write_sample(int16_t value) {
        recording_.put(static_cast<char>(value & 255));
        recording_.put(static_cast<char>((unsigned(value) >> 8) & 255));
    }
    void write_recording_header() {
        auto little = [&](uint32_t value, unsigned bytes) {
            while (bytes--) { recording_.put(static_cast<char>(value & 255)); value >>= 8; }
        };
        const unsigned rate = recording_rate_ ? recording_rate_ : 8000;
        const unsigned channels = recording_channels_ ? recording_channels_ : 1;
        recording_.seekp(0);
        recording_.write("RIFF", 4); little(36 + static_cast<uint32_t>(recording_bytes_), 4);
        recording_.write("WAVEfmt ", 8); little(16, 4); little(1, 2); little(channels, 2);
        little(rate, 4); little(rate * channels * 2, 4); little(channels * 2, 2); little(16, 2);
        recording_.write("data", 4); little(static_cast<uint32_t>(recording_bytes_), 4);
        recording_.seekp(0, std::ios::end);
    }
    SipPipeline* pipeline_;
    std::atomic<unsigned> audible_frames_{0};
    std::ofstream recording_;
    bool recording_wav_ = false;
    unsigned recording_rate_ = 0, recording_channels_ = 0;
    uint64_t recording_bytes_ = 0;
    std::mutex mutex_;
    std::vector<int16_t> pcm_, narrow_pcm_;
    double position_ = 0;
    bool echo_enabled_ = false;
    std::deque<int16_t> echo_;
    double echo_position_ = 0;
    Clock::time_point speech_until_{};
    bool playing_ = false, finished_ = false;
    std::atomic<bool> active_{false}, failed_{false}, listening_{true};
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
            uint64_t frames_sent = 0, late_frames = 0, max_late_us = 0;
            try {
                if (read) {
                    // Baresip's encoder has its own 20 ms clock. Give it three
                    // silence frames of headroom before the live source clock
                    // starts, so small scheduling slips do not starve aubuf.
                    for (unsigned i = 0; i < 3 && driver->running; ++i) {
                        struct auframe frame;
                        auframe_init(&frame, AUFMT_S16LE, samples.data(), samples.size(), rate, channels);
                        frame.timestamp = timestamp;
                        read(&frame, arg);
                        timestamp += uint64_t(ptime) * 1000;
                        ++frames_sent;
                    }
                }
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
                    ++frames_sent;
                    const auto now = Clock::now();
                    if (next < now) {
                        ++late_frames;
                        max_late_us = std::max(max_late_us, uint64_t(std::chrono::duration_cast<std::chrono::microseconds>(now - next).count()));
                        next = now;
                    }
                    std::this_thread::sleep_until(next);
                }
            } catch (...) { bridge->fail(); }
            if (read) std::cout << "Audio source timing: frames=" << frames_sent
                                << " late=" << late_frames << " max_late_us=" << max_late_us << '\n';
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
            std::vector<unsigned char> announcement, std::unique_ptr<SipPipeline> pipeline = {},
            std::vector<unsigned char> alternate = {}, bool keep_open = false, std::vector<unsigned char> third = {}, bool realtime_tts = false)
        : account_(std::move(account)), proxy_(std::move(proxy)), target_(std::move(target)),
          announcement_(std::move(announcement)), alternate_(std::move(alternate)), third_(std::move(third)),
          pipeline_(std::move(pipeline)), audio_(pipeline_.get()), keep_open_(keep_open), realtime_tts_(realtime_tts) {
        tmr_init(&timer_);
    }
    ~SipCall() {
        stop_tts();
        tmr_cancel(&timer_);
        if (events_) bevent_unregister(event_handler);
        audio_.activate(false);
        if (ua_initialized_) {
            // Force pending SIP sessions/transactions closed before rebinding
            // the same listening port for the next call.
            ua_stop_all(true);
            ua_close(); // destroys drivers and joins their threads
        }
        if (pipeline_) pipeline_->stop();
        mem_deref(source_); mem_deref(player_);
        if (configured_) conf_close();
        if (initialized_) baresip_close();
        if (libre_) { mod_close(); libre_close(); }
        bridge = nullptr;
    }
    int run() {
        if (realtime_tts_) {
            for (const auto key : {"DTMF_1", "DTMF_2", "DTMF_3"})
                if (env(key).empty()) throw std::runtime_error(std::string("set ") + key);
            tts_worker_ = std::thread([this] { tts_loop(); });
        }
        const auto wait_for_media = env("SIP_WAIT_FOR_MEDIA");
        if (!wait_for_media.empty() && wait_for_media != "0" && wait_for_media != "1")
            throw std::runtime_error("SIP_WAIT_FOR_MEDIA must be 0 or 1");
        wait_for_media_ = wait_for_media != "0";
        const auto echo = env("SIP_ECHO_TEST");
        if (!echo.empty() && echo != "0" && echo != "1")
            throw std::runtime_error("SIP_ECHO_TEST must be 0 or 1");
        audio_.enable_echo(target_ == "listen" && echo == "1");
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
        conf_config()->avt.rtp_stats = true;
        require(baresip_init(conf_config()), "initialize baresip"); initialized_ = true;
        bridge = &audio_;
        require(ausrc_register(&source_, baresip_ausrcl(), "ivrtts", source_alloc), "register audio source");
        require(auplay_register(&player_, baresip_auplayl(), "ivrtts", player_alloc), "register audio player");
        require(ua_init("audio.cpp ivrTTS", true, true, true), "initialize SIP user agent"); ua_initialized_ = true;
        registration_call_id.clear(); registration_public_port = 0;
        if (env("SIP_TRACE") == "1" || !env("SIP_CONTACT_HOST").empty()) sip_set_trace_handler(uag_sip(), trace_sip);
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
        const auto display = env("SIP_DISPLAY_NAME");
        if (display.find_first_of("\"\\<>\r\n") != std::string::npos)
            throw std::runtime_error("invalid SIP display name");
        const auto identity = display.empty() ? "<" + account_ + ">;regint=300;ptime=20"
            : "\"" + display + "\" <" + account_ + ">;regint=300;ptime=20";
        require(ua_alloc(&ua_, identity.c_str()), "create SIP account");
        if (!env("SIP_CONTACT_URI").empty()) {
            const auto value = env("SIP_CONTACT_URI");
            if (value.rfind("sip:", 0) != 0 || value.find_first_of("\r\n<> ") != std::string::npos)
                throw std::runtime_error("invalid SIP_CONTACT_URI");
            struct pl uri;
            pl_set_str(&uri, value.c_str());
            ua_pub_gruu_set(ua_, &uri);
        }
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
            if (!env("SIP_CONTACT_HOST").empty() && env("SIP_CONTACT_URI").empty()) {
                const auto host = env("SIP_CONTACT_HOST");
                if (host.size() > 253 || host.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-") != std::string::npos)
                    throw std::runtime_error("SIP_CONTACT_HOST must be a hostname without a port");
                if (!registration_public_port) throw std::runtime_error("registrar did not report a valid rport for SIP_CONTACT_HOST");
                const auto value = "sip:" + std::string(ua_local_cuser(ua_)) + "@" + host + ":" + std::to_string(registration_public_port);
                struct pl uri; pl_set_str(&uri, value.c_str()); ua_pub_gruu_set(ua_, &uri);
                std::cout << "Dialog Contact: " << value << " (learned registrar rport)\n";
            }
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
            media_deadline_ = Clock::now() + std::chrono::seconds(5);
            test_keys_ = target_ == "listen" ? "" : env("SIP_TEST_DTMF");
            test_next_ = Clock::now() + std::chrono::seconds(1);
            std::cout << "SIP call established.\n";
            re_printf("%H", stream_debug, audio_strm(call_audio(call_)));
            if (realtime_tts_) {
                std::cout << "Waiting for TTS selection: #1 lingCL, #2 WangSG, #3 lingCL.\n";
            } else if (!announcement_.empty()) {
                if (wait_for_media_ && !media_ready_) {
                    waiting_for_media_ = true;
                    std::cout << "Waiting for greeting selection: #1 lingCL, #2 WangSG.\n";
                    if (!third_.empty()) std::cout << "#3: configured TTS greeting (lingCL).\n";
                } else start_announcement();
            } else if (pipeline_) pipeline_->resume();
            break;
        case BEVENT_CALL_RTPESTAB:
            if (call == call_) {
                rtp_received_ = true;
                std::cout << "Incoming RTP established.\n";
            }
            break;
        case BEVENT_CALL_DTMF_START:
            if (call == call_) std::cout << "DTMF: " << bevent_get_text(data) << '\n';
            if (call == call_ && (realtime_tts_ || !announcement_.empty())) {
                const std::string digit = bevent_get_text(data);
                if (digit == "#") { greeting_prefix_ = true; break; }
                if (greeting_prefix_) {
                    greeting_prefix_ = false;
                    if ((digit == "1" || digit == "2" || (digit == "3" && (realtime_tts_ || !third_.empty()))) && established_) {
                        media_ready_ = true;
                        std::cout << "Caller pressed #" << digit << "; starting greeting ("
                                  << (digit == "2" ? "WangSG" : "lingCL") << ").\n";
                        if (realtime_tts_) request_tts(digit[0]);
                        else start_announcement(digit == "2", digit == "3");
                        break;
                    }
                }
            }
            break;
        case BEVENT_CALL_CLOSED:
            if (call != call_) break;
            call_ = nullptr; audio_.activate(false);
            if (!established_ || call_scode(call) >= 400)
                error_ = std::string("SIP call failed: ") + bevent_get_text(data);
            re_printf("%H", audio_debug, call_audio(call));
            std::cout << "SIP call closed.\n"; close();
            break;
        default: break;
        }
    }
    static void tick_handler(void* context) noexcept {
        auto& self = *static_cast<SipCall*>(context);
        try { self.tick(); } catch (const std::exception& e) { self.fail(e.what()); }
    }
    void cancel_tts() {
        { std::lock_guard<std::mutex> lock(tts_mutex_); tts_stop_ = true; ++tts_revision_; }
        tts_cv_.notify_all();
    }
    void stop_tts() {
        cancel_tts();
        if (tts_worker_.joinable()) tts_worker_.join();
    }
    void request_tts(char digit) {
        // A newer selection cancels/discards the previous synthesis.
        audio_.stop_playback(); announcement_playing_ = false; draining_ = false;
        std::lock_guard<std::mutex> lock(tts_mutex_);
        ++tts_revision_; pending_digit_ = digit; tts_ready_ = false;
        tts_cv_.notify_one();
    }
    void tts_loop() noexcept {
        while (!tts_stop_) {
            char digit; unsigned revision;
            {
                std::unique_lock<std::mutex> lock(tts_mutex_);
                tts_cv_.wait(lock, [this] { return tts_stop_ || pending_digit_; });
                if (tts_stop_) return;
                digit = pending_digit_; pending_digit_ = 0; revision = tts_revision_;
            }
            std::vector<unsigned char> wav; AudioBridge::Playback prepared; std::string error;
            try {
                const auto key = std::string("DTMF_") + digit;
                const auto url = env("AUDIOCPP_URL").empty() ? "http://127.0.0.1:8081" : env("AUDIOCPP_URL");
                const auto model = env("TTS_MODEL").empty() ? "zipvoice" : env("TTS_MODEL");
                std::cout << "Generating TTS on keypress: " << key << "\n";
                ivrTTS tts; tts.create(url, model, digit == '2' ? "WangSG" : "lingCL");
                tts.run_stream(env(key.c_str()), [&](const unsigned char* bytes, size_t size) {
                    if (wav.size() + size > 64 * 1024 * 1024) throw std::runtime_error("TTS audio exceeds 64 MiB");
                    wav.insert(wav.end(), bytes, bytes + size);
                }, ivrTTS::AudioMode::Wav, [this, revision] { return tts_stop_ || tts_revision_ != revision; });
                // Decode and resample on the TTS thread, never the SIP/RTP event loop.
                prepared = AudioBridge::prepare(wav);
                const auto debug_dir = env("SIP_TTS_DEBUG_DIR");
                if (!debug_dir.empty() && !tts_stop_ && tts_revision_ == revision) {
                    // Save the server's original WAV without resampling or RTP.
                    // Diagnostic failures must not interrupt greeting playback.
                    try {
                        std::filesystem::create_directories(debug_dir);
                        const auto path = std::filesystem::path(debug_dir) / (key + ".wav");
                        const auto temporary = path.string() + ".tmp";
                        std::ofstream file(temporary, std::ios::binary | std::ios::trunc);
                        file.write(reinterpret_cast<const char*>(wav.data()), wav.size());
                        file.close();
                        if (!file) throw std::runtime_error("cannot write TTS diagnostic WAV");
                        std::filesystem::rename(temporary, path);
                        std::cout << "Original TTS WAV: " << path.string() << '\n';
                        const auto phone_path = std::filesystem::path(debug_dir) / (key + "-8000.wav");
                        {
                            AudioBridge capture(nullptr, phone_path.string()); capture.activate(true);
                            capture.receive(prepared.narrow.data(), prepared.narrow.size(), 1, 8000);
                        }
                        std::cout << "Telephone PCM before G.711: " << phone_path.string() << '\n';
                    } catch (const std::exception& e) { std::cerr << "TTS diagnostic: " << e.what() << '\n'; }
                }
            } catch (const std::exception& e) { error = e.what(); }
            std::lock_guard<std::mutex> lock(tts_mutex_);
            if (!tts_stop_ && tts_revision_ == revision) {
                tts_audio_ = std::move(prepared); tts_error_ = error; tts_ready_ = true;
            }
        }
    }
    void poll_tts() {
        std::lock_guard<std::mutex> lock(tts_mutex_);
        if (!tts_ready_) return;
        tts_ready_ = false;
        if (!tts_error_.empty()) { std::cerr << "TTS selection failed: " << tts_error_ << '\n'; return; }
        if (!established_ || !call_) return;
        audio_.play(std::move(tts_audio_)); announcement_playing_ = true; draining_ = false;
        std::cout << "Playing generated TTS greeting.\n";
    }
    void start_announcement(bool alternate = false, bool third = false) {
        waiting_for_media_ = false;
        announcement_playing_ = true;
        draining_ = false;
        audio_.listen(false);
        if (pipeline_) std::cout << "Playing welcome greeting.\n";
        audio_.play(third && !third_.empty() ? third_ : alternate && !alternate_.empty() ? alternate_ : announcement_);
    }
    void tick() {
        if (closing_) {
            if (Clock::now() >= deadline_) re_cancel();
        } else if (interrupted) close();
        else {
            if (!established_ && !waiting_ && Clock::now() > deadline_) throw std::runtime_error("SIP operation timed out");
            if (established_ && !rtp_received_ && !media_warning_ && Clock::now() >= media_deadline_) {
                media_warning_ = true;
                std::cerr << "No incoming RTP after 5 seconds. Check the SDP media address, TURN public mapping, UDP relay ports, and caller DTMF mode (telephone-event or SIP INFO).\n";
                re_printf("%H", stream_debug, audio_strm(call_audio(call_)));
            }
            if (established_ && !test_keys_.empty() && Clock::now() >= test_next_) {
                if (test_key_down_) {
                    require(call_send_digit(call_, KEYCODE_REL), "release test DTMF");
                    test_key_down_ = false;
                    test_next_ = Clock::now() + std::chrono::milliseconds(350);
                } else if (test_index_ < test_keys_.size()) {
                    const char digit = test_keys_[test_index_++];
                    if (digit == ',') test_next_ = Clock::now() + std::chrono::seconds(1);
                    else {
                        if (std::string("0123456789*#").find(digit) == std::string::npos) throw std::runtime_error("invalid test DTMF sequence");
                        require(call_send_digit(call_, digit), "send test DTMF");
                        std::cout << "Test sent DTMF: " << digit << "\n";
                        if (digit == '1' || digit == '2') {
                            report_test_audio();
                            test_selection_ = digit;
                            test_selection_frames_ = audio_.audible_frames();
                        }
                        test_key_down_ = true;
                        test_next_ = Clock::now() + std::chrono::milliseconds(150);
                    }
                } else {
                    if (!test_finished_) { test_finished_ = true; test_next_ = Clock::now() + std::chrono::seconds(6); }
                    else close();
                }
            }
            if (realtime_tts_) poll_tts();
            if (audio_.failed()) throw std::runtime_error("SIP audio driver failed");
            if (pipeline_) {
                auto error = pipeline_->error(); if (!error.empty()) throw std::runtime_error(error);
                std::vector<unsigned char> reply;
                if (!announcement_playing_ && pipeline_->take_reply(reply)) { audio_.listen(false); audio_.play(reply); draining_ = false; }
            }
            if (audio_.finished()) { draining_ = true; playback_end_ = Clock::now() + std::chrono::milliseconds(300); }
            if (draining_ && audio_.echo_active())
                playback_end_ = Clock::now() + std::chrono::seconds(3);
            if (draining_ && Clock::now() >= playback_end_) {
                draining_ = false;
                announcement_playing_ = false;
                if (pipeline_) {
                    std::vector<unsigned char> reply;
                    if (pipeline_->take_reply(reply)) audio_.play(reply);
                    else { pipeline_->resume(); audio_.listen(true); }
                } else if (!keep_open_) close();
            }
        }
        tmr_start(&timer_, 20, tick_handler, this);
    }
    void fail(const std::string& error) noexcept {
        try { error_ = error; close(); } catch (...) { re_cancel(); }
    }
    void report_test_audio() {
        if (!test_selection_) return;
        std::cout << "Test greeting " << test_selection_ << " audible frames: "
                  << audio_.audible_frames() - test_selection_frames_ << "\n";
        test_selection_ = 0;
    }
    void close() {
        if (closing_) return;
        report_test_audio();
        closing_ = true; cancel_tts(); audio_.activate(false);
        std::cout << "Audible received frames: " << audio_.audible_frames() << "\n";
        if (call_) { ua_hangup(ua_, call_, 0, "Normal clearing"); call_ = nullptr; }
        ua_unregister(ua_);
        // Keep the loop alive briefly for BYE/unregister responses.
        deadline_ = Clock::now() + std::chrono::milliseconds(500);
    }
    std::string account_, proxy_, target_, error_;
    std::vector<unsigned char> announcement_, alternate_, third_;
    std::unique_ptr<SipPipeline> pipeline_;
    AudioBridge audio_;
    struct ua* ua_ = nullptr;
    struct call* call_ = nullptr;
    struct ausrc* source_ = nullptr;
    struct auplay* player_ = nullptr;
    struct tmr timer_{};
    bool libre_ = false, configured_ = false, initialized_ = false, ua_initialized_ = false, events_ = false;
    bool registered_ = false, established_ = false, waiting_ = false, closing_ = false, draining_ = false;
    bool wait_for_media_ = false, waiting_for_media_ = false, media_ready_ = false, announcement_playing_ = false;
    bool greeting_prefix_ = false;
    std::string test_keys_;
    size_t test_index_ = 0;
    char test_selection_ = 0;
    unsigned test_selection_frames_ = 0;
    bool test_key_down_ = false, test_finished_ = false;
    Clock::time_point test_next_;
    bool keep_open_ = false;
    bool realtime_tts_ = false, tts_ready_ = false;
    std::atomic<bool> tts_stop_{false};
    std::atomic<unsigned> tts_revision_{0};
    std::thread tts_worker_;
    std::mutex tts_mutex_;
    std::condition_variable tts_cv_;
    char pending_digit_ = 0;
    AudioBridge::Playback tts_audio_;
    std::string tts_error_;
    bool rtp_received_ = false, media_warning_ = false;
    Clock::time_point deadline_, playback_end_, media_deadline_;
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
    {
        AudioBridge echo(nullptr, ""); echo.enable_echo(true); echo.activate(true); echo.play(wav);
        std::vector<int16_t> voice(160, 2000), output(160);
        echo.receive(voice.data(), voice.size(), 1, 8000);
        echo.transmit(output.data(), output.size(), 1, 8000);
        if (!echo.echo_active() || echo.finished() ||
            !std::all_of(output.begin(), output.end(), [](int16_t sample) { return sample == 2000; }))
            throw std::runtime_error("echo or greeting pause self-test failed");
        std::this_thread::sleep_for(std::chrono::milliseconds(1050));
        echo.transmit(output.data(), output.size(), 1, 8000);
        if (echo.echo_active() || output.front() <= 0 || !echo.finished())
            throw std::runtime_error("greeting did not resume after caller silence");
    }
    {
        auto render = [&](unsigned hz, bool chunked) {
            auto tone = wav; tone.resize(44 + 24000 * 2);
            auto put = [&](size_t at, uint32_t value) { for (unsigned i=0; i<4; ++i) tone[at+i] = value >> (8*i); };
            put(4, tone.size()-8); put(40, tone.size()-44);
            for (size_t i=0; i<24000; ++i) {
                const auto sample = int16_t(12000 * std::sin(2 * 3.141592653589793 * hz * i / 24000));
                tone[44+2*i] = unsigned(sample) & 255; tone[45+2*i] = (unsigned(sample) >> 8) & 255;
            }
            AudioBridge playback(nullptr, ""); playback.activate(true); playback.play(tone);
            std::vector<int16_t> result(8000);
            const size_t block = chunked ? 160 : result.size();
            for (size_t offset=0; offset<result.size(); offset+=block)
                playback.transmit(result.data()+offset, block, 1, 8000);
            if (!playback.finished()) throw std::runtime_error("telephone playback duration changed");
            return result;
        };
        const auto low = render(1000, false), high = render(6000, false);
        auto energy = [](const std::vector<int16_t>& pcm) {
            double sum=0; for (size_t i=100; i<pcm.size()-100; ++i) sum += double(pcm[i])*pcm[i]; return sum;
        };
        if (energy(low) < 1e11 || energy(high) > energy(low)*0.0025)
            throw std::runtime_error("telephone anti-alias filtering failed");
        if (low != render(1000, true)) throw std::runtime_error("20ms telephone frames introduced discontinuities");
    }
    for (unsigned rate : {8000u, 48000u}) {
        std::vector<int16_t> input(rate / 50, 1000);
        auto output = mono(input.data(), input.size(), 1, rate, 16000);
        if (output.size() != 320 || output[0] != 1000) throw std::runtime_error("caller PCM conversion failed");
    }
    for (const auto rate : {8000u, 48000u}) {
        const auto path = std::filesystem::temp_directory_path() /
            ("sip-playout-" + std::to_string(Clock::now().time_since_epoch().count()) + ".wav");
        struct Remove { std::filesystem::path path; ~Remove() { std::filesystem::remove(path); } } cleanup{path};
        const int16_t rendered[] = {0, -32768, 32767, 0, 0, 0, -1234, 5678};
        {
            AudioBridge recording(nullptr, path.string()); recording.activate(true);
            recording.receive(rendered, 4, 2, rate);
        }
        std::ifstream file(path, std::ios::binary);
        const std::vector<unsigned char> received((std::istreambuf_iterator<char>(file)), {});
        const auto capture = decode_wav(received);
        if (capture.rate != int(rate) || capture.channels != 2 || capture.pcm.size() != sizeof(rendered))
            throw std::runtime_error("received WAV format/duration self-test failed");
        for (size_t i = 0; i < sizeof(rendered) / sizeof(rendered[0]); ++i) {
            const auto value = int16_t(unsigned(capture.pcm[2 * i]) | unsigned(capture.pcm[2 * i + 1]) << 8);
            if (value != rendered[i]) throw std::runtime_error("received WAV changed decoded samples");
        }
    }
    std::cout << "PASS: WAV validation, in-memory playback, 8/48 kHz caller conversion, exact received WAV capture\n";
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
        std::string settings = ".env.sip", greetings; bool explicit_file = false, tts_greetings = false;
        for (int i = 1; i < argc; ++i) {
            if (std::string(argv[i]) == "--env") {
                if (++i >= argc || explicit_file) throw std::runtime_error("use --env with one settings file path");
                settings = argv[i]; explicit_file = true;
            } else if (std::string(argv[i]) == "--tts-greetings") {
                tts_greetings = true;
            } else if (std::string(argv[i]) == "--greetings") {
                if (++i >= argc || !greetings.empty()) throw std::runtime_error("use --greetings with one directory");
                greetings = argv[i];
            } else args.emplace_back(argv[i]);
        }
        if (args == std::vector<std::string>{"--help"}) {
            std::cout << "Usage: exampleSIP SIP_ACCOUNT SIP_PROXY TARGET_OR_listen TTS_URL MODEL TEXT [VOICE]\n"
                         "Full pipeline: exampleSIP --pipeline SIP_ACCOUNT SIP_PROXY TARGET_OR_listen\n"
                         "TTS greetings: exampleSIP --tts-greetings SIP_ACCOUNT SIP_PROXY TARGET_OR_listen (DTMF_1, DTMF_2, DTMF_3)\n"
                         "Prerecorded: exampleSIP --greetings DIR SIP_ACCOUNT SIP_PROXY TARGET_OR_listen\n"
                         "TURN client: COTURN_URL, COTURN_USERNAME, COTURN_PASSWORD\n"
                         "SIP_GREETING: opening message; an empty value disables it\n"
                         "Greetings: #1 lingCL, #2 WangSG; repeat either sequence to replay\n"
                         "SIP_WAIT_FOR_MEDIA=1: wait for greeting selection (default 1; 0 starts automatically)\n"
                         "SIP_ECHO_TEST=1: pause greetings and echo caller audio during microphone activity\n"
                         "SIP_CONTINUOUS=1: answer successive pipeline calls and reuse greetings\n"
                         "Settings file: exampleSIP [--env PATH] (defaults to .env.sip, full pipeline)\n"
                         "Required: SIP_SECRET, LLM_MODEL (pipeline). Optional: SIP_AUTHUSER, SIP_CODEC=PCMU|OPUS,\n"
                         "  SIP_LISTEN, SIP_INTERFACE, SIP_RTP_PORTS, SIP_DTMF_MODE=rtp|info, BARESIP_MODULE_PATH\n"
                         "Pipeline: AUDIOCPP_URL, LLM_URL, LLM_API_KEY, RAG_URL, VAD_MODEL, STT_MODEL,\n"
                         "  STT_HOTWORDS_FILE, STT_HOTWORDS, STT_LANGUAGE, SYSTEM_PROMPT_FILE, TTS_MODEL, TTS_VOICE\n";
            return 0;
        }
        if (args == std::vector<std::string>{"--self-test"}) { self_test(); return 0; }
        load_sip_env(settings, explicit_file);
        if (tts_greetings && !greetings.empty()) throw std::runtime_error("choose --tts-greetings or --greetings, not both");
        if (!tts_greetings && greetings.empty() && (args.empty() || args == std::vector<std::string>{"--pipeline"})) {
            args = {"--pipeline"};
            for (const char* key : {"SIP_ACCOUNT", "SIP_PROXY", "SIP_TARGET"}) {
                auto value = env(key); if (value.empty()) throw std::runtime_error(std::string("set ") + key + " in .env.sip");
                args.push_back(value);
            }
        }
        bool pipeline = args.size() == 4 && args[0] == "--pipeline";
        if (((tts_greetings || !greetings.empty()) && args.size() != 3) || (!tts_greetings && greetings.empty() && !pipeline && args.size() != 6 && args.size() != 7)) throw std::runtime_error("use --help for arguments");
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
        if (tts_greetings || !greetings.empty()) {
            auto read = [&](const char * name) {
                const auto path = std::filesystem::path(greetings) / name;
                std::ifstream file(path, std::ios::binary | std::ios::ate);
                if (!file || file.tellg() <= 0 || file.tellg() > 64 * 1024 * 1024)
                    throw std::runtime_error("missing or oversized greeting: " + path.string());
                std::vector<unsigned char> wav(static_cast<size_t>(file.tellg()));
                file.seekg(0);
                if (!file.read(reinterpret_cast<char *>(wav.data()), wav.size())) throw std::runtime_error("cannot read greeting");
                decode_wav(wav);
                return wav;
            };
            std::vector<unsigned char> first, second, third;
            if (tts_greetings) {
                std::cout << "On-demand TTS enabled. #1=lingCL, #2=WangSG, #3=lingCL. No startup synthesis.\n";
            } else {
                first = read("greeting1.wav"); second = read("greeting2.wav");
                std::cout << "Prerecorded greetings ready. #1=lingCL, #2=WangSG. No AI requests during calls.\n";
            }
            do {
                { SipCall call(args[0], args[1], args[2], first, {}, second, true, third, tts_greetings); call.run(); }
                if (args[2] != "listen" || env("SIP_CONTINUOUS") != "1" || interrupted) return 0;
            } while (!interrupted);
            return 0;
        }
        if (pipeline) {
            auto config = SipPipelineConfig::from_environment();
            const char* configured_greeting = std::getenv("SIP_GREETING");
            std::string greeting = configured_greeting ? configured_greeting : "歡迎來電期偶科技 請問我可以怎麼服務您";
            std::vector<unsigned char> welcome, alternate;
            if (!greeting.empty()) {
                ivrTTS tts; tts.create(config.audio_url, config.tts_model, "lingCL");
                std::cout << "Generating welcome greeting (lingCL)...\n";
                welcome = tts.run(greeting); decode_wav(welcome);
                tts.create(config.audio_url, config.tts_model, "WangSG");
                std::cout << "Generating welcome greeting (WangSG)...\n";
                alternate = tts.run(greeting); decode_wav(alternate);
            }
            const auto continuous = env("SIP_CONTINUOUS");
            if (!continuous.empty() && continuous != "0" && continuous != "1")
                throw std::runtime_error("SIP_CONTINUOUS must be 0 or 1");
            do {
                // Each caller gets fresh conversation state, but greetings stay in
                // memory across normal hangups instead of re-running TTS.
                auto conversation = std::make_unique<SipPipeline>(SipPipelineConfig::from_environment());
                {
                    SipCall call(args[1], args[2], args[3], welcome, std::move(conversation), alternate);
                    call.run();
                }
                if (interrupted || args[3] != "listen" || continuous != "1") return 0;
                std::cout << "Call finished; reusing greetings for the next caller.\n";
            } while (!interrupted);
            return 0;
        }
        if (args[3].rfind("http://", 0) != 0 && args[3].rfind("https://", 0) != 0)
            throw std::runtime_error("TTS URL must use HTTP(S)");
        ivrTTS tts; tts.create(args[3], args[4], args.size() == 7 ? args[6] : "lingCL");
        std::cout << "Generating TTS audio in memory...\n";
        auto wav = tts.run(args[5]); decode_wav(wav);
        tts.create(args[3], args[4], "WangSG");
        auto alternate = tts.run(args[5]); decode_wav(alternate);
        SipCall call(args[0], args[1], args[2], std::move(wav), {}, std::move(alternate));
        return call.run();
    } catch (const std::exception& error) { std::cerr << "Error: " << error.what() << '\n'; return 1; }
}
