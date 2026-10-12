#include "tui.h"
#include "ivrTTS.h"
#include <SDL.h>
#include <curses.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstring>
#include <csignal>
#include <deque>
#include <locale.h>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>
#include <unistd.h>

namespace {
using namespace std::chrono_literals;
volatile std::sig_atomic_t interrupted = 0;
void interrupt_handler(int) { interrupted = 1; }
class Audio {
public:
    explicit Audio(std::atomic<bool>& cancel) : cancel_(cancel) {
        if (SDL_InitSubSystem(SDL_INIT_AUDIO) != 0) throw std::runtime_error(SDL_GetError());
    }
    ~Audio() { if (device_) SDL_CloseAudioDevice(device_); SDL_QuitSubSystem(SDL_INIT_AUDIO); }
    void open(int rate, int channels) {
        SDL_AudioSpec wanted{}, actual{};
        wanted.freq = rate; wanted.channels = channels; wanted.format = AUDIO_S16LSB;
        wanted.samples = 512; wanted.callback = &callback; wanted.userdata = this;
        device_ = SDL_OpenAudioDevice(nullptr, 0, &wanted, &actual, 0);
        if (!device_) throw std::runtime_error(std::string("audio device: ") + SDL_GetError());
        rate_ = rate; channels_ = channels;
        SDL_PauseAudioDevice(device_, 0);
    }
    void push(const unsigned char* bytes, size_t size) {
        std::unique_lock<std::mutex> lock(mutex_);
        // Three seconds of backpressure; do not retain an entire streamed response.
        size_t limit = size_t(rate_) * channels_ * 2 * 3;
        while (size) {
            if (cancel_) throw std::runtime_error("stopped");
            if (queue_.size() >= limit) { ready_.wait_for(lock, 20ms); continue; }
            size_t n = std::min(size, limit - queue_.size());
            queue_.insert(queue_.end(), bytes, bytes + n);
            bytes += n; size -= n;
        }
    }
    bool empty() { std::lock_guard<std::mutex> lock(mutex_); return queue_.empty(); }
    std::array<float, 512> samples() {
        std::lock_guard<std::mutex> lock(mutex_);
        std::array<float, 512> result{};
        for (size_t i = 0; i < result.size(); ++i) result[i] = samples_[(cursor_ + i) % samples_.size()];
        return result;
    }
    void reset() {
        if (device_) { SDL_CloseAudioDevice(device_); device_ = 0; }
        std::lock_guard<std::mutex> lock(mutex_);
        queue_.clear(); samples_.fill(0); cursor_ = 0; played = 0; paused = false;
    }
    std::atomic<bool> paused{false};
    std::atomic<int> volume{80};
    std::atomic<size_t> played{0};
private:
    static void callback(void* context, Uint8* output, int length) {
        auto& self = *static_cast<Audio*>(context);
        std::memset(output, 0, length);
        std::lock_guard<std::mutex> lock(self.mutex_);
        const size_t frame = size_t(self.channels_) * 2;
        for (size_t offset = 0; offset + frame <= size_t(length); offset += frame) {
            float mono = 0;
            if (!self.paused && !self.cancel_ && self.queue_.size() >= frame) {
                for (int channel = 0; channel < self.channels_; ++channel) {
                    unsigned lo = self.queue_.front(); self.queue_.pop_front();
                    unsigned hi = self.queue_.front(); self.queue_.pop_front();
                    int sample = int(lo | (hi << 8)); if (sample >= 32768) sample -= 65536;
                    sample = sample * self.volume.load() / 100;
                    output[offset + channel * 2] = sample & 255;
                    output[offset + channel * 2 + 1] = (sample >> 8) & 255;
                    mono += sample / 32768.0f / self.channels_;
                }
                self.played++;
            }
            self.samples_[self.cursor_++ % self.samples_.size()] = mono;
        }
        self.ready_.notify_all();
    }
    std::atomic<bool>& cancel_;
    SDL_AudioDeviceID device_ = 0;
    int rate_ = 24000, channels_ = 1;
    std::mutex mutex_;
    std::condition_variable ready_;
    std::deque<unsigned char> queue_;
    std::array<float, 512> samples_{};
    size_t cursor_ = 0;
};

// Incremental RIFF parser: never interpret a WAV header as PCM samples.
class WavInput {
public:
    explicit WavInput(Audio& audio) : audio_(audio) {}
    void write(const unsigned char* bytes, size_t size) {
        if (started_) { feed(bytes, size); return; }
        header_.insert(header_.end(), bytes, bytes + size);
        if (header_.size() > 1024 * 1024) throw std::runtime_error("WAV header exceeds 1 MiB");
        if (header_.size() < 12) return;
        if (std::memcmp(header_.data(), "RIFF", 4) || std::memcmp(header_.data() + 8, "WAVE", 4))
            throw std::runtime_error("invalid WAV header");
        size_t offset = 12;
        while (offset + 8 <= header_.size()) {
            auto* chunk = header_.data() + offset;
            size_t length = u32(chunk + 4);
            if (!std::memcmp(chunk, "data", 4)) {
                if (!rate_) throw std::runtime_error("WAV data before format");
                remaining_ = length;
                if (length % (channels_ * 2)) throw std::runtime_error("incomplete WAV sample frame");
                audio_.open(rate_, channels_); started_ = true;
                feed(chunk + 8, header_.size() - offset - 8);
                header_.clear(); return;
            }
            if (length > 1024 * 1024) throw std::runtime_error("unsupported large WAV metadata");
            if (offset + 8 + length + (length & 1) > header_.size()) return;
            if (!std::memcmp(chunk, "fmt ", 4)) {
                if (length < 16 || u16(chunk + 8) != 1 || u16(chunk + 22) != 16)
                    throw std::runtime_error("TUI requires PCM16 WAV");
                channels_ = u16(chunk + 10); rate_ = u32(chunk + 12);
                if (channels_ < 1 || channels_ > 8 || rate_ < 1000 || rate_ > 384000 ||
                    u16(chunk + 20) != unsigned(channels_ * 2))
                    throw std::runtime_error("invalid WAV format");
            }
            offset += 8 + length + (length & 1);
        }
    }
    void finish() { if (!started_ || remaining_) throw std::runtime_error("truncated WAV audio"); }
private:
    static unsigned u16(const unsigned char* b) { return b[0] | unsigned(b[1]) << 8; }
    static unsigned u32(const unsigned char* b) { return u16(b) | u16(b + 2) << 16; }
    void feed(const unsigned char* bytes, size_t size) {
        size_t n = std::min(size, remaining_); audio_.push(bytes, n); remaining_ -= n;
    }
    Audio& audio_;
    std::vector<unsigned char> header_;
    int rate_ = 0, channels_ = 0;
    size_t remaining_ = 0;
    bool started_ = false;
};

class Terminal {
public:
    Terminal() {
        if (!isatty(STDIN_FILENO) || !isatty(STDOUT_FILENO))
            throw std::runtime_error("tui requires an interactive terminal");
        setlocale(LC_ALL, "");
        if (!initscr()) throw std::runtime_error("cannot initialize terminal");
        cbreak(); noecho(); keypad(stdscr, TRUE); timeout(33); curs_set(0);
        interrupted = 0;
        previous_int_ = std::signal(SIGINT, interrupt_handler);
        previous_term_ = std::signal(SIGTERM, interrupt_handler);
        if (has_colors()) {
            start_color(); use_default_colors();
            init_pair(1, COLOR_CYAN, -1); init_pair(2, COLOR_GREEN, -1);
            init_pair(3, COLOR_YELLOW, -1); init_pair(4, COLOR_MAGENTA, -1);
        }
    }
    ~Terminal() { endwin(); std::signal(SIGINT, previous_int_); std::signal(SIGTERM, previous_term_); }
private:
    using Handler = void (*)(int);
    Handler previous_int_, previous_term_;
};
std::string clean(std::string text) {
    for (char& c : text) if (static_cast<unsigned char>(c) < 32 || c == 127) c = ' ';
    return text;
}
void line(int row, const std::string& text, int color = 1) {
    attron(COLOR_PAIR(color)); mvaddnstr(row, 2, clean(text).c_str(), std::max(0, COLS - 4));
    attroff(COLOR_PAIR(color));
}
}

int run_tui(const std::string& url, const std::string& model,
            const std::string& voices, int rate, int channels) {
    std::atomic<bool> cancel{false}, done{true};
    Audio audio(cancel);
    Terminal terminal;
    std::thread worker;
    std::mutex status_mutex;
    std::string status = "Ready", text = "Hello, welcome to our voice service.";
    int selected = 0;
    bool editing = false;
    const std::array<std::string, 2> presets{"lingCL", "WangSG"};
    auto update = [&](std::string value) { std::lock_guard<std::mutex> lock(status_mutex); status = std::move(value); };
    auto stop = [&] { cancel = true; audio.paused = false; if (worker.joinable()) worker.join(); audio.reset(); done = true; };
    auto start = [&] {
        if (!done || text.empty()) return;
        if (worker.joinable()) worker.join();
        audio.reset(); cancel = false; done = false;
        auto input = text, voice = presets[selected];
        update("Generating with " + voice + "...");
        worker = std::thread([&, input, voice] {
            try {
                ivrTTS client; client.set_preset_directory(voices); client.create(url, model, voice);
                WavInput wav(audio);
                size_t pcm_bytes = 0;
                if (rate) audio.open(rate, channels);
                client.run_stream(input, [&](const unsigned char* bytes, size_t size) {
                    update("Playing / receiving " + voice);
                    if (rate) { pcm_bytes += size; audio.push(bytes, size); } else wav.write(bytes, size);
                }, rate ? ivrTTS::AudioMode::StreamingPcm : ivrTTS::AudioMode::Wav,
                [&] { return cancel.load(); });
                if (!rate) wav.finish();
                else if (pcm_bytes % (channels * 2)) throw std::runtime_error("incomplete streamed PCM frame");
                update("Playing remaining audio...");
                while (!cancel && !audio.empty()) std::this_thread::sleep_for(20ms);
                // Allow the final device buffer to play before marking completion.
                if (!cancel) std::this_thread::sleep_for(40ms);
                update(cancel ? "Stopped" : "Finished - Enter to replay");
            } catch (const std::exception& e) {
                const bool stopped = cancel.load(); cancel = true;
                update(stopped ? "Stopped" : std::string("Error: ") + e.what());
            }
            done = true;
        });
    };
    try {
        bool quit = false;
        while (!quit && !interrupted) {
            erase();
            if (LINES < 20 || COLS < 64) {
                line(0, "Resize terminal to at least 64 x 20. Press q to quit.");
            } else {
                box(stdscr, 0, 0);
                line(1, "IVR TTS  //  VOICE DECK", 4);
                line(2, model + "  @  " + url);
                line(4, std::string(selected == 0 ? "[ lingCL ]" : "  lingCL  ") + "    " +
                        (selected == 1 ? "[ WangSG ]" : "  WangSG  "), 2);
                line(5, rate ? "PCM STREAM  " + std::to_string(rate) + " Hz / " + std::to_string(channels) + " ch" :
                     "WAV  //  playback after server synthesis");
                auto samples = audio.samples();
                const int bars = std::min(32, (COLS - 6) / 2), height = 6;
                for (int b = 0; b < bars; ++b) {
                    // Log-spaced frequency bins, Hann-windowed DFT of actually played samples.
                    double bin = std::pow(128.0, double(b) / std::max(1, bars - 1));
                    double re = 0, im = 0;
                    for (size_t i = 0; i < samples.size(); ++i) {
                        double window = 0.5 - 0.5 * std::cos(6.283185307 * i / 511);
                        double angle = 6.283185307 * bin * i / samples.size();
                        re += samples[i] * window * std::cos(angle); im += samples[i] * window * std::sin(angle);
                    }
                    double db = 20 * std::log10(std::hypot(re, im) / 128 + 1e-6);
                    int level = std::clamp(int((db + 60) / 60 * height), 0, height);
                    for (int h = 0; h < level; ++h) {
                        attron(COLOR_PAIR(h >= 4 ? 3 : 2) | A_REVERSE);
                        mvaddstr(12 - h, 3 + b * 2, " ");
                        attroff(COLOR_PAIR(h >= 4 ? 3 : 2) | A_REVERSE);
                    }
                }
                std::string state; { std::lock_guard<std::mutex> lock(status_mutex); state = status; }
                line(14, audio.paused ? "PAUSED  //  Space to resume" : state, 3);
                line(15, "Volume " + std::to_string(audio.volume.load()) + "%  //  played frames " + std::to_string(audio.played.load()));
                line(17, std::string(editing ? "EDIT > " : "Text > ") + text);
                line(LINES - 2, editing ? "Type text | Enter: finish editing | Esc: finish editing" :
                     "Enter: speak  Tab: voice  e: edit  Space: pause  s: stop  +/-: volume  q: quit");
            }
            refresh();
            int key = getch();
            if (key == ERR || key == KEY_RESIZE) continue;
            if (editing) {
                if (key == '\n' || key == '\r' || key == 27) editing = false;
                else if (key == KEY_BACKSPACE || key == 127 || key == 8) {
                    if (!text.empty()) {
                        size_t last = text.size() - 1;
                        while (last && (static_cast<unsigned char>(text[last]) & 0xc0) == 0x80) --last;
                        text.erase(last);
                    }
                } else if (key == 21) text.clear(); // Ctrl-U
                else if (key >= 32 && key <= 255 && text.size() < 8192) text += char(key);
            } else {
                switch (key) {
                    case 'q': case 27: quit = true; break;
                    case '\t': selected = 1 - selected; break;
                    case 'e': editing = true; break;
                    case '\n': case '\r': start(); break;
                    case ' ': if (!done) audio.paused = !audio.paused.load(); break;
                    case 's': stop(); update("Stopped"); break;
                    case '+': case '=': audio.volume = std::min(100, audio.volume.load() + 5); break;
                    case '-': audio.volume = std::max(0, audio.volume.load() - 5); break;
                }
            }
        }
    } catch (...) { stop(); throw; }
    stop();
    return 0;
}
