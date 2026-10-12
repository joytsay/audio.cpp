#include "ivrTTS.h"
#include <fstream>
#include <iostream>
#include <string>
#include <cstdio>
#include <csignal>
#include <stdexcept>
#include <utility>
#include <filesystem>
#include <cstdlib>
#ifdef IVRTTS_HAS_TUI
#include "tui.h"
#endif

namespace {
// Only fixed arguments and validated integers enter the shell command.
class Player {
public:
    explicit Player(std::string command) : command_(std::move(command)) {}
    ~Player() { if (pipe_) pclose(pipe_); }
    void write(const unsigned char* bytes, size_t size) {
        if (!pipe_) {
            pipe_ = popen(command_.c_str(), "w");
            if (!pipe_) throw std::runtime_error("cannot start ffplay");
        }
        if (fwrite(bytes, 1, size, pipe_) != size || fflush(pipe_) != 0)
            throw std::runtime_error("audio player stopped or failed; check ffplay installation and audio device");
    }
    void finish() {
        if (!pipe_) return;
        FILE* pipe = pipe_; pipe_ = nullptr;
        if (pclose(pipe) != 0) throw std::runtime_error("ffplay failed; check audio device and PCM settings");
    }
private:
    std::string command_;
    FILE* pipe_ = nullptr;
};
int number(const char* value, int low, int high) {
    std::string text(value);
    if (text.empty() || text.find_first_not_of("0123456789") != std::string::npos)
        throw std::invalid_argument("sample rate and channels must be positive integers");
    int result = std::stoi(text);
    if (result < low || result > high) throw std::invalid_argument("sample rate or channels out of range");
    return result;
}
std::string preset_directory(const char* executable) {
    if (const char* env = std::getenv("IVRTTS_VOICE_DIR")) return env;
    std::error_code error;
    auto path = std::filesystem::read_symlink("/proc/self/exe", error);
    if (error) path = std::filesystem::absolute(executable);
    auto beside = path.parent_path() / "voices";
    if (std::filesystem::exists(beside / "prompt_text")) return beside.string();
    auto installed = path.parent_path() / "../share/ivrTTS/voices";
    if (std::filesystem::exists(installed / "prompt_text")) return installed.string();
    return ""; // Library falls back to its source directory.
}
}

int main(int argc, char** argv) {
    if (argc < 2 || std::string(argv[1]) == "--help") {
        std::cout << "Usage:\n"
            "  ivrtts_cli run URL MODEL OUTPUT.wav TEXT [VOICE]\n"
            "  ivrtts_cli clone URL MODEL OUTPUT.wav TEXT REFERENCE.wav TRANSCRIPT\n"
            "  ivrtts_cli play URL MODEL TEXT [VOICE]\n"
            "  ivrtts_cli play-clone URL MODEL TEXT REFERENCE.wav TRANSCRIPT\n"
            "  ivrtts_cli stream URL MODEL RATE CHANNELS TEXT [VOICE]\n"
            "  ivrtts_cli stream-clone URL MODEL RATE CHANNELS TEXT REFERENCE.wav TRANSCRIPT\n"
            "  ivrtts_cli interactive URL MODEL [VOICE]\n";
#ifdef IVRTTS_HAS_TUI
        std::cout << "  ivrtts_cli tui URL MODEL [RATE CHANNELS]\n";
#endif
        std::cout << "Default clone voice: lingCL; alternate: WangSG.\n";
        return argc < 2 ? 1 : 0;
    }
    try {
        // Convert a closed player pipe into a write error instead of process termination.
        std::signal(SIGPIPE, SIG_IGN);
        const std::string command = argv[1];
        ivrTTS client;
        const auto voices = preset_directory(argv[0]);
        client.set_preset_directory(voices);
        auto save = [](const std::string& path, const auto& bytes) {
            std::ofstream file(path, std::ios::binary);
            if (!file || !file.write(reinterpret_cast<const char*>(bytes.data()), bytes.size()))
                throw std::runtime_error("cannot write output: " + path);
            file.close();
            if (!file) throw std::runtime_error("cannot finish output: " + path);
            std::cout << "Saved " << bytes.size() << " bytes to " << path << '\n';
        };
#ifdef IVRTTS_HAS_TUI
        if (command == "tui" && (argc == 4 || argc == 6)) {
            return run_tui(argv[2], argv[3], voices,
                           argc == 6 ? number(argv[4], 1000, 384000) : 0,
                           argc == 6 ? number(argv[5], 1, 8) : 1);
        }
#endif
        if ((command == "play" && (argc == 5 || argc == 6)) ||
            (command == "play-clone" && argc == 7) ||
            (command == "stream" && (argc == 7 || argc == 8)) ||
            (command == "stream-clone" && argc == 9)) {
            const bool streaming = command == "stream" || command == "stream-clone";
            const bool cloning = command == "play-clone" || command == "stream-clone";
            std::string player_command = "ffplay -nodisp -autoexit -loglevel error ";
            if (streaming) {
                int rate = number(argv[4], 1000, 384000);
                int channels = number(argv[5], 1, 16);
                player_command += "-f s16le -ar " + std::to_string(rate) +
                    " -ch_layout " + std::to_string(channels) + "c ";
            } else player_command += "-f wav ";
            player_command += "-i pipe:0";
            Player player(player_command);
            auto sink = [&](const unsigned char* bytes, size_t size) { player.write(bytes, size); };
            const int text_index = streaming ? 6 : 4;
            const std::string voice = !cloning && argc > text_index + 1 ? argv[text_index + 1] : "lingCL";
            client.create(argv[2], argv[3], voice);
            auto mode = streaming ? ivrTTS::AudioMode::StreamingPcm : ivrTTS::AudioMode::Wav;
            if (cloning) client.clone_stream(argv[text_index], argv[text_index + 1],
                                            argv[text_index + 2], sink, mode);
            else client.run_stream(argv[text_index], sink, mode);
            player.finish();
        } else if (command == "run" && (argc == 6 || argc == 7)) {
            client.create(argv[2], argv[3], argc == 7 ? argv[6] : "lingCL");
            save(argv[4], client.run(argv[5]));
        } else if (command == "clone" && argc == 8) {
            client.create(argv[2], argv[3]);
            save(argv[4], client.clone(argv[5], argv[6], argv[7]));
        } else if (command == "interactive" && (argc == 4 || argc == 5)) {
            const std::string voice = argc == 5 ? argv[4] : "lingCL";
            client.create(argv[2], argv[3], voice);
            auto read = [](const char* prompt, std::string& value) {
                std::cout << prompt << std::flush;
                return bool(std::getline(std::cin, value));
            };
            std::string action, text, output, reference, transcript;
            while (read("Command (run/clone/create/del/quit): ", action)) {
                try {
                    if (action == "quit") break;
                    if (action == "del") { client.del(); continue; }
                    if (action == "create") { client.create(argv[2], argv[3], voice); continue; }
                    if (action != "run" && action != "clone") {
                        std::cout << "Unknown command\n"; continue;
                    }
                    if (!read("Text: ", text) || !read("Output WAV: ", output)) break;
                    if (action == "run") save(output, client.run(text));
                    else {
                        if (!read("Reference WAV: ", reference) || !read("Reference transcript: ", transcript)) break;
                        save(output, client.clone(text, reference, transcript));
                    }
                } catch (const std::exception& error) { std::cerr << error.what() << '\n'; }
            }
        } else throw std::runtime_error("invalid arguments; use --help");
        client.del();
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n'; return 1;
    }
}
