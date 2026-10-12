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
#include <unordered_map>
#include <sstream>
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
    std::string status = "Ready", draft, current_model = model;
    std::vector<std::string> history{"Hello, welcome to our voice service."};
    size_t history_index = 0, model_index = 0;
    std::vector<ivrTTS::Model> models, fetched_models;
    std::string catalog_error;
    std::thread catalog_worker;
    std::atomic<bool> catalog_cancel{false}, catalog_ready{false};
    bool catalog_fetching = false, picking_model = false;
    std::unordered_map<std::string, std::pair<int, int>> pcm_formats;
    if (rate && !model.empty()) pcm_formats[model] = {rate, channels};
    int selected = 0;
    enum class Editor { None, Message, Format };
    Editor editor = Editor::None;
    const std::array<std::string, 2> presets{"lingCL", "WangSG"};
    auto update = [&](std::string value) { std::lock_guard<std::mutex> lock(status_mutex); status = std::move(value); };
    auto stop = [&] { cancel = true; audio.paused = false; if (worker.joinable()) worker.join(); audio.reset(); done = true; };
    auto refresh_models = [&] {
        if (catalog_fetching) return;
        catalog_fetching = true; catalog_ready = false; catalog_cancel = false;
        update("Fetching /v1/models...");
        catalog_worker = std::thread([&] {
            try {
                fetched_models = ivrTTS::list_models(url, [&] { return catalog_cancel.load(); });
                catalog_error.clear();
            } catch (const std::exception& e) { catalog_error = e.what(); }
            catalog_ready = true;
        });
    };
    auto close_catalog = [&] { catalog_cancel = true; if (catalog_worker.joinable()) catalog_worker.join(); };
    auto start = [&] {
        if (!done || history.empty()) return;
        auto found = std::find_if(models.begin(), models.end(), [&](const auto& item) { return item.id == current_model; });
        if (found == models.end() || !found->can_speak()) {
            update("Choose a TTS/clon model with m; r refreshes the server list."); return;
        }
        int request_rate = 0, request_channels = 1;
        if (found->mode == "streaming") {
            auto format = pcm_formats.find(current_model);
            if (format == pcm_formats.end()) { update("Streaming model: press p to set output RATE CHANNELS."); return; }
            request_rate = format->second.first; request_channels = format->second.second;
        }
        if (worker.joinable()) worker.join();
        audio.reset(); cancel = false; done = false;
        auto input = history[history_index], voice = presets[selected], request_model = current_model;
        update("Generating with " + voice + "...");
        worker = std::thread([&, input, voice, request_model, request_rate, request_channels] {
            try {
                ivrTTS client; client.set_preset_directory(voices); client.create(url, request_model, voice);
                WavInput wav(audio);
                size_t pcm_bytes = 0;
                if (request_rate) audio.open(request_rate, request_channels);
                client.run_stream(input, [&](const unsigned char* bytes, size_t size) {
                    update("Playing / receiving " + voice);
                    if (request_rate) { pcm_bytes += size; audio.push(bytes, size); } else wav.write(bytes, size);
                }, request_rate ? ivrTTS::AudioMode::StreamingPcm : ivrTTS::AudioMode::Wav,
                [&] { return cancel.load(); });
                if (!request_rate) wav.finish();
                else if (pcm_bytes % (request_channels * 2)) throw std::runtime_error("incomplete streamed PCM frame");
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
        refresh_models();
        bool quit = false;
        while (!quit && !interrupted) {
            if (catalog_fetching && catalog_ready) {
                catalog_worker.join(); catalog_fetching = false;
                if (!catalog_error.empty()) update("Model list error: " + catalog_error);
                else {
                    models = std::move(fetched_models);
                    auto found = std::find_if(models.begin(), models.end(), [&](const auto& item) { return item.id == current_model; });
                    if (found == models.end() || !found->can_speak()) {
                        found = std::find_if(models.begin(), models.end(), [](const auto& item) { return item.can_speak(); });
                        current_model = found == models.end() ? "" : found->id;
                    }
                    model_index = found == models.end() ? 0 : size_t(found - models.begin());
                    update(models.empty() ? "No registered models. Load one in the server UI, then press r." :
                           "Models refreshed - m: choose model, e: add message");
                }
            }
            erase();
            if (LINES < 24 || COLS < 64) {
                line(0, "Resize terminal to at least 64 x 24. Press q to quit.");
            } else {
                box(stdscr, 0, 0);
                line(1, "IVR TTS  //  VOICE DECK", 4);
                line(2, (current_model.empty() ? "No speech model selected" : current_model) + "  @  " + url);
                line(4, std::string(selected == 0 ? "[ lingCL ]" : "  lingCL  ") + "    " +
                        (selected == 1 ? "[ WangSG ]" : "  WangSG  "), 2);
                auto current = std::find_if(models.begin(), models.end(), [&](const auto& item) { return item.id == current_model; });
                const bool streaming = current != models.end() && current->mode == "streaming";
                auto format = pcm_formats.find(current_model);
                line(5, streaming ? (format == pcm_formats.end() ? "PCM STREAM // p: configure output rate/channels" :
                    "PCM STREAM " + std::to_string(format->second.first) + " Hz / " + std::to_string(format->second.second) + " ch") :
                    "WAV // playback after server synthesis");
                auto samples = audio.samples();
                const int bars = std::min(32, (COLS - 6) / 2), height = 4;
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
                        attron(COLOR_PAIR(h >= 3 ? 3 : 2) | A_REVERSE);
                        mvaddstr(10 - h, 3 + b * 2, " ");
                        attroff(COLOR_PAIR(h >= 3 ? 3 : 2) | A_REVERSE);
                    }
                }
                std::string state; { std::lock_guard<std::mutex> lock(status_mutex); state = status; }
                line(12, audio.paused ? "PAUSED  //  Space to resume" : state, 3);
                line(13, "Volume " + std::to_string(audio.volume.load()) + "%  //  played frames " + std::to_string(audio.played.load()));
                if (picking_model) {
                    line(15, "SERVER MODELS // Up/Down: browse Enter: select Esc: close r: refresh", 4);
                    int rows = LINES - 20;
                    size_t first = model_index >= size_t(rows) ? model_index - rows + 1 : 0;
                    for (int row = 0; row < rows && first + row < models.size(); ++row) {
                        auto& item = models[first + row];
                        line(16 + row, std::string(first + row == model_index ? "> " : "  ") + item.id +
                             " [" + item.task + "/" + item.mode + "] " + (item.loaded ? "loaded" : "lazy/unloaded") +
                             (item.can_speak() ? "" : " (not TTS)"), item.can_speak() ? 2 : 1);
                    }
                } else {
                    line(15, "CHAT HISTORY // Up/Down: select Enter: speak selection e: new message", 4);
                    int rows = LINES - 20;
                    size_t first = history_index >= size_t(rows) ? history_index - rows + 1 : 0;
                    for (int row = 0; row < rows && first + row < history.size(); ++row) {
                        size_t index = first + row;
                        line(16 + row, std::string(index == history_index ? "> " : "  ") +
                             std::to_string(index + 1) + ". " + history[index], index == history_index ? 2 : 1);
                    }
                }
                if (editor != Editor::None) {
                    std::string visible = clean(draft);
                    size_t width = size_t(std::max(1, COLS - 14));
                    if (visible.size() > width) {
                        size_t start = visible.size() - width;
                        while (start < visible.size() && (static_cast<unsigned char>(visible[start]) & 0xc0) == 0x80) ++start;
                        visible = "..." + visible.substr(start);
                    }
                    line(LINES - 3, (editor == Editor::Format ? "PCM > " : "NEW > ") + visible, 2);
                } else line(LINES - 3, std::to_string(history.size()) + " messages // m: models r: refresh p: PCM format");
                line(LINES - 2, editor != Editor::None ? "Enter: add/save Esc: cancel Ctrl-U: clear Ctrl-N: newline" :
                     "Enter: speak Tab: voice e: new m: models Space: pause s: stop +/-: vol q: quit");
            }
            refresh();
            int key = getch();
            if (key == ERR || key == KEY_RESIZE) continue;
            if (editor != Editor::None) {
                if (key == 27) { editor = Editor::None; draft.clear(); }
                else if (key == '\n' || key == '\r') {
                    if (editor == Editor::Message) {
                        if (!draft.empty()) { history.push_back(draft); history_index = history.size() - 1; update("Message added - Enter to speak"); }
                        editor = Editor::None; draft.clear();
                    } else {
                        std::istringstream input(draft); int r = 0, c = 0; std::string extra;
                        if (!(input >> r >> c) || (input >> extra) || r < 1000 || r > 384000 || c < 1 || c > 8)
                            update("Enter output RATE CHANNELS, for example: 24000 1");
                        else { pcm_formats[current_model] = {r, c}; editor = Editor::None; draft.clear(); update("PCM format saved for " + current_model); }
                    }
                } else if (key == KEY_BACKSPACE || key == 127 || key == 8) {
                    if (!draft.empty()) {
                        size_t last = draft.size() - 1;
                        while (last && (static_cast<unsigned char>(draft[last]) & 0xc0) == 0x80) --last;
                        draft.erase(last);
                    }
                } else if (key == 21) draft.clear();
                else if (key == 14 && editor == Editor::Message && draft.size() < 8192) draft += '\n';
                else if (key >= 32 && key <= 255 && draft.size() < 8192) draft += char(key);
            } else if (picking_model) {
                if (key == 27 || key == 'm') picking_model = false;
                else if ((key == KEY_UP || key == 'k') && model_index) --model_index;
                else if ((key == KEY_DOWN || key == 'j') && model_index + 1 < models.size()) ++model_index;
                else if (key == 'r') refresh_models();
                else if (key == 'q') quit = true;
                else if ((key == '\n' || key == '\r') && !models.empty()) {
                    if (!models[model_index].can_speak()) update("This model is not a text-to-speech model.");
                    else { current_model = models[model_index].id; picking_model = false; update("Selected " + current_model); }
                }
            } else {
                switch (key) {
                    case 'q': case 27: quit = true; break;
                    case '\t': selected = 1 - selected; break;
                    case 'e': editor = Editor::Message; draft.clear(); break;
                    case 'p':
                        if (current_model.empty()) update("Select a speech model first.");
                        else { editor = Editor::Format; draft.clear(); }
                        break;
                    case 'm': picking_model = true; break;
                    case 'r': refresh_models(); break;
                    case KEY_UP: case 'k': if (history_index) --history_index; break;
                    case KEY_DOWN: case 'j': if (history_index + 1 < history.size()) ++history_index; break;
                    case '\n': case '\r': start(); break;
                    case ' ': if (!done) audio.paused = !audio.paused.load(); break;
                    case 's': stop(); update("Stopped"); break;
                    case '+': case '=': audio.volume = std::min(100, audio.volume.load() + 5); break;
                    case '-': audio.volume = std::max(0, audio.volume.load() - 5); break;
                }
            }
        }
    } catch (...) { close_catalog(); stop(); throw; }
    close_catalog();
    stop();
    return 0;
}
